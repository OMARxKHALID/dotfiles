import os
import random
import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("GdkPixbuf", "2.0")
gi.require_version("Pango", "1.0")
from gi.repository import Gdk, GdkPixbuf, Gio, GLib, Gtk, Pango

from constants import (
    DEFAULT_WIN_WIDTH, DEFAULT_SCROLL_H, DEFAULT_COLS, DEFAULT_ROWS,
    THUMB_W, THUMB_H, CSS,
    PICTURE_MODES, PICTURE_MODE_LABELS, SEARCH_DEBOUNCE_MS,
    DEFAULT_WALL_DIRS
)
from utils import (
    get_current_wallpaper, set_wallpaper, get_images,
    _load_config, _save_config, _make_display_name,
    _shorten_path, reveal_in_fm, get_thumbnail,
    get_cache_info, clear_cache, get_image_info,
    load_favorites, save_favorites
)

class WallpaperPicker(Gtk.Window):
    """
    Main window for the Wallpaper Picker application.
    Handles UI assembly, image loading, search filtering, and wallpaper selection.
    """

    def __init__(self, start_page="grid"):
        super().__init__(title="Wallpaper Picker")
        self.set_resizable(False)
        self.set_keep_above(True)
        self.set_skip_taskbar_hint(True)
        self.set_decorated(False)
        # Root Cause Fix: Match the WM_CLASS with the .desktop file name for
        # seamless Wayland focus and shell grouping.
        GLib.set_prgname("wallpaper-picker")
        self.set_wmclass("wallpaper-picker", "wallpaper-picker")
        self.set_icon_name("wallpaper-picker")

        # Load config first to define dimensions
        cfg = _load_config()
        self._cols = int(cfg.get("columns", DEFAULT_COLS))
        self._rows = int(cfg.get("rows", DEFAULT_ROWS))
        self._win_width = (self._cols * 192) + 100
        self._scroll_h  = (self._rows * 155)

        self.set_size_request(self._win_width, -1)

        # ── Startup Notification ─────────────────────────────────────────────
        # Consume DESKTOP_STARTUP_ID passed by the extension.
        startup_id = os.environ.get("DESKTOP_STARTUP_ID", "")
        if startup_id:
            self.set_startup_id(startup_id)

        # ── Window Type Hint ─────────────────────────────────────────────────
        # SPLASHSCREEN is the most effective hint for bypassing Mutter's
        # Smart Placement and FSP.
        self.set_type_hint(Gdk.WindowTypeHint.SPLASHSCREEN)

        # ── Placement Opt-out ────────────────────────────────────────────────
        # WindowPosition.NONE explicitly opts us OUT of smart placement.
        self.set_position(Gtk.WindowPosition.NONE)

        # CSS
        provider = Gtk.CssProvider()
        provider.load_from_data(CSS.encode())
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

        # RGBA visual for rounded corners
        screen = Gdk.Screen.get_default()
        visual = screen.get_rgba_visual() if screen else None
        if visual:
            self.set_visual(visual)

        # Loaded config
        self._wall_dirs    = cfg.get("wall_dirs") or DEFAULT_WALL_DIRS
        self._max_images   = int(cfg.get("max_images", 0))
        self._picture_mode = cfg.get("picture_mode", "zoom")

        # Runtime state
        self._startup_id    = startup_id
        self._active_child  = None
        self._current       = get_current_wallpaper()
        self._paths         = {}   # FlowBoxChild → full path
        self._names         = {}   # FlowBoxChild → display name (lower)
        self._pending       = []   # list of full paths to load
        self._load_idle_id  = None
        self._search_tid    = None
        self._did_select    = False
        self._query_cache   = ""
        self._is_settings   = (start_page == "settings")
        self._favorites     = load_favorites()
        self._star_widgets  = {} # FlowBoxChild -> Gtk.Label (star)

        self._build_ui()
        self.connect("destroy", self._on_destroy)

        # ── Pre-positioning ──────────────────────────────────────────────────
        self._center_on_screen()
        self.show_all()

        if start_page == "settings":
            self._open_settings(None)

        self._load_images()

        # ── Position after WM map ────────────────────────────────────────────
        # Connect to map-event as a safety measure. If Mutter ignores the initial
        # hint and applies Smart Placement, this will snap it back instantly.
        self.connect("map-event", self._on_first_map)


    def _get_startup_timestamp(self):
        """Extracts the X server timestamp from the DESKTOP_STARTUP_ID."""
        if not self._startup_id:
            return 0
        try:
            # Format: uuid-pid-timestamp_TIME123456
            if "_TIME" in self._startup_id:
                return int(self._startup_id.split("_TIME")[-1])
        except (ValueError, IndexError):
            pass
        return 0

    def _on_first_map(self, widget, event):
        """Fire exactly once after the WM has mapped and positioned the window."""
        self._center_on_screen()
        # Use the startup timestamp to bypass Focus Stealing Prevention
        ts = self._get_startup_timestamp()
        if ts > 0:
            self.present_with_time(ts)
        else:
            self.present()

        self.disconnect_by_func(self._on_first_map)
        return False

    def _on_destroy(self, _w):
        for tid in (self._search_tid, self._load_idle_id):
            if tid is not None:
                try:
                    GLib.source_remove(tid)
                except Exception:
                    pass
        self._search_tid = self._load_idle_id = None

    def _build_ui(self):
        self._vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._vbox.set_border_width(8)
        self.add(self._vbox)

        self._build_header()
        self._build_controls()
        self._build_stack()

        self.connect("key-press-event", self._on_key)

    def _build_header(self):
        self._header_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self._header_row.get_style_context().add_class("header-box")

        # ── Left Section ─────────────────────────────────────────────────────
        left_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        left_box.set_size_request(150, -1) # Balanced width for centering

        self._back_btn = Gtk.Button(label="\u2190 Back")
        self._back_btn.get_style_context().add_class("back-btn")
        self._back_btn.connect("clicked", lambda _: self._close_settings())
        self._back_btn.set_valign(Gtk.Align.CENTER)
        self._back_btn.set_no_show_all(True)
        self._back_btn.hide()
        left_box.pack_start(self._back_btn, False, False, 0)
        self._header_row.pack_start(left_box, False, False, 0)

        # ── Center Section (Title) ───────────────────────────────────────────
        self._header_label = Gtk.Label(label="WALLPAPER PICKER")
        self._header_label.get_style_context().add_class("header")
        self._header_label.set_halign(Gtk.Align.CENTER)

        header_eb = Gtk.EventBox()
        header_eb.set_visible_window(False)
        header_eb.add(self._header_label)
        header_eb.connect("button-press-event", self._on_header_drag)
        self._header_row.pack_start(header_eb, True, True, 0)

        # ── Right Section (Actions) ──────────────────────────────────────────
        right_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        right_box.set_size_request(150, -1) # Balanced width with left side

        self._settings_btn = Gtk.Button(label="\u2699")
        self._settings_btn.get_style_context().add_class("icon-btn")
        self._settings_btn.set_tooltip_text("Settings")
        self._settings_btn.connect("clicked", self._open_settings)
        self._settings_btn.set_valign(Gtk.Align.CENTER)
        right_box.pack_end(self._settings_btn, False, False, 0)

        self._shuffle_btn = Gtk.Button(label="\u21c4 Shuffle")
        self._shuffle_btn.get_style_context().add_class("shuffle-btn")
        self._shuffle_btn.set_tooltip_text("Apply a random wallpaper")
        self._shuffle_btn.connect("clicked", self._on_shuffle)
        self._shuffle_btn.set_valign(Gtk.Align.CENTER)
        self._shuffle_btn.set_margin_end(8)
        right_box.pack_end(self._shuffle_btn, False, False, 0)

        self._header_row.pack_start(right_box, False, False, 0)

        self._vbox.pack_start(self._header_row, False, False, 0)

    def _build_controls(self):
        self._controls = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self._controls.set_margin_start(14)
        self._controls.set_margin_end(6)
        self._controls.set_spacing(6)
        self._vbox.pack_start(self._controls, False, False, 4)

        self.search_entry = Gtk.SearchEntry(placeholder_text="Filter wallpapers…")
        self.search_entry.connect("search-changed", self._on_search_changed)
        self.search_entry.connect("key-press-event", self._on_search_key)
        self._controls.pack_start(self.search_entry, True, True, 0)

        self.sort_combo = Gtk.ComboBoxText()
        for m in ("A-Z", "Starred", "Newest", "Most Used", "Recent"):
            self.sort_combo.append_text(m)
        self.sort_combo.set_active(2)
        self.sort_combo.connect("changed", self._on_sort_changed)
        self._controls.pack_start(self.sort_combo, False, False, 0)

    def _build_stack(self):
        self.stack = Gtk.Stack()
        self.stack.set_transition_type(Gtk.StackTransitionType.NONE)

        self.flowbox = Gtk.FlowBox()
        self.flowbox.set_valign(Gtk.Align.START)
        self.flowbox.set_halign(Gtk.Align.START)
        self.flowbox.set_max_children_per_line(self._cols)
        self.flowbox.set_min_children_per_line(self._cols)
        self.flowbox.set_homogeneous(True)
        self.flowbox.set_selection_mode(Gtk.SelectionMode.SINGLE)
        self.flowbox.set_activate_on_single_click(True)
        self.flowbox.set_filter_func(self._filter_func)
        self.flowbox.connect("child-activated", self._on_pick)

        self._grid_scroll = Gtk.ScrolledWindow()
        self._grid_scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        self._grid_scroll.set_min_content_height(self._scroll_h)
        self._grid_scroll.set_max_content_height(self._scroll_h)
        self._grid_scroll.set_min_content_width(self._win_width - 16)
        self._grid_scroll.set_propagate_natural_height(False)
        self._grid_scroll.set_propagate_natural_width(False)
        self._grid_scroll.add(self.flowbox)
        self.stack.add_named(self._grid_scroll, "grid")

        empty_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        empty_box.get_style_context().add_class("empty-box")
        empty_box.set_valign(Gtk.Align.CENTER)
        empty_box.set_halign(Gtk.Align.CENTER)
        empty_box.set_size_request(-1, self._scroll_h)

        self._empty_icon = Gtk.Label()
        self._empty_icon.get_style_context().add_class("empty-icon")
        self._empty_icon.set_markup('<span size="48000">\U0001f5bc</span>')
        empty_box.pack_start(self._empty_icon, False, False, 0)

        self._empty_title = Gtk.Label(label="No Wallpapers")
        self._empty_title.get_style_context().add_class("empty-title")
        empty_box.pack_start(self._empty_title, False, False, 0)

        self._empty_label = Gtk.Label(label="Select a folder to get started")
        self._empty_label.get_style_context().add_class("empty-subtitle")
        self._empty_label.set_justify(Gtk.Justification.CENTER)
        empty_box.pack_start(self._empty_label, False, False, 0)

        self._empty_hint = Gtk.Label(label="\u2699 Open Settings")
        self._empty_hint.get_style_context().add_class("empty-hint")

        empty_hint_eb = Gtk.EventBox()
        empty_hint_eb.set_visible_window(False)
        empty_hint_eb.add(self._empty_hint)
        def _on_empty_hint_clicked(_w, _e):
            if self.sort_combo.get_active_text() != "Starred":
                self._open_settings(None)
        empty_hint_eb.connect("button-press-event", _on_empty_hint_clicked)
        # Cursor change on realize for GTK3 EventBox
        empty_hint_eb.connect("realize", lambda w: w.get_window().set_cursor(
            Gdk.Cursor.new_from_name(Gdk.Display.get_default(), "pointer")))

        empty_box.pack_start(empty_hint_eb, False, False, 0)

        self.stack.add_named(empty_box, "empty")

        no_results_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        no_results_box.get_style_context().add_class("empty-box")
        no_results_box.set_valign(Gtk.Align.CENTER)
        no_results_box.set_halign(Gtk.Align.CENTER)
        no_results_box.set_size_request(-1, self._scroll_h)

        nr_icon = Gtk.Label()
        nr_icon.get_style_context().add_class("empty-icon")
        nr_icon.set_markup('<span size="48000">\U0001f50d</span>')
        no_results_box.pack_start(nr_icon, False, False, 0)

        nr_title = Gtk.Label(label="No Matches")
        nr_title.get_style_context().add_class("empty-title")
        no_results_box.pack_start(nr_title, False, False, 0)

        nr_subtitle = Gtk.Label(label="Try a different search term")
        nr_subtitle.get_style_context().add_class("empty-subtitle")
        no_results_box.pack_start(nr_subtitle, False, False, 0)

        # Consistency: Add clear search hint
        nr_hint_lbl = Gtk.Label(label="\u2715 Clear Search")
        nr_hint_lbl.get_style_context().add_class("empty-hint")
        nr_hint_eb = Gtk.EventBox()
        nr_hint_eb.set_visible_window(False)
        nr_hint_eb.add(nr_hint_lbl)
        nr_hint_eb.connect("button-press-event", self._on_clear_search)
        nr_hint_eb.connect("realize", lambda w: w.get_window().set_cursor(
            Gdk.Cursor.new_from_name(Gdk.Display.get_default(), "pointer")))
        no_results_box.pack_start(nr_hint_eb, False, False, 0)

        self.stack.add_named(no_results_box, "no-results")

        self.stack.add_named(self._build_settings_page(), "settings")

        self._vbox.pack_start(self.stack, True, True, 0)

    def _build_settings_page(self):
        outer = Gtk.ScrolledWindow()
        outer.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        outer.set_min_content_height(self._scroll_h)
        outer.set_max_content_height(self._scroll_h)

        page = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        outer.add(page)

        lbl_dirs = Gtk.Label(label="WALLPAPER FOLDERS")
        lbl_dirs.get_style_context().add_class("settings-section-label")
        lbl_dirs.set_xalign(0)
        page.pack_start(lbl_dirs, False, False, 0)

        hint_dirs = Gtk.Label(label="Images are pulled from all folders below.")
        hint_dirs.get_style_context().add_class("settings-hint")
        hint_dirs.set_xalign(0)
        page.pack_start(hint_dirs, False, False, 0)

        self._dirs_container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        page.pack_start(self._dirs_container, False, False, 0)
        self._rebuild_dirs_ui()

        add_btn = Gtk.Button(label="+ Add Folder")
        add_btn.get_style_context().add_class("add-dir-btn")
        add_btn.set_halign(Gtk.Align.START)
        add_btn.connect("clicked", self._on_add_dir)
        page.pack_start(add_btn, False, False, 4)

        sep1 = Gtk.Box()
        sep1.get_style_context().add_class("separator-line")
        page.pack_start(sep1, False, False, 0)

        lbl_display = Gtk.Label(label="DISPLAY")
        lbl_display.get_style_context().add_class("settings-section-label")
        lbl_display.set_xalign(0)
        page.pack_start(lbl_display, False, False, 0)

        max_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        max_row.get_style_context().add_class("settings-row")
        lbl_max = Gtk.Label(label="Max images to show")
        lbl_max.get_style_context().add_class("settings-label")
        lbl_max.set_xalign(0)
        max_row.pack_start(lbl_max, True, True, 0)

        adj = Gtk.Adjustment(
            value=self._max_images,
            lower=0, upper=2000, step_increment=10, page_increment=100,
        )
        self._max_spin = Gtk.SpinButton(adjustment=adj, climb_rate=1, digits=0)
        self._max_spin.set_width_chars(6)
        self._max_spin.connect("value-changed", self._on_max_changed)
        max_row.pack_end(self._max_spin, False, False, 0)
        page.pack_start(max_row, False, False, 0)

        hint_max = Gtk.Label(label="0 = show all images (no limit)")
        hint_max.get_style_context().add_class("settings-hint")
        hint_max.set_xalign(0)
        page.pack_start(hint_max, False, False, 0)

        mode_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        mode_row.get_style_context().add_class("settings-row")
        lbl_mode = Gtk.Label(label="Wallpaper display mode")
        lbl_mode.get_style_context().add_class("settings-label")
        lbl_mode.set_xalign(0)
        mode_row.pack_start(lbl_mode, True, True, 0)

        self._mode_combo = Gtk.ComboBoxText()
        for m in PICTURE_MODE_LABELS:
            self._mode_combo.append_text(m)
        try:
            rev = {v: k for k, v in PICTURE_MODES.items()}
            idx = PICTURE_MODE_LABELS.index(rev.get(self._picture_mode, "Zoom"))
        except ValueError:
            idx = 0
        self._mode_combo.set_active(idx)
        self._mode_combo.connect("changed", self._on_mode_changed)
        mode_row.pack_end(self._mode_combo, False, False, 0)
        page.pack_start(mode_row, False, False, 4)

        sep2 = Gtk.Box()
        sep2.get_style_context().add_class("separator-line")
        page.pack_start(sep2, False, False, 0)

        cols_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        cols_row.get_style_context().add_class("settings-row")
        lbl_cols = Gtk.Label(label="Grid columns")
        lbl_cols.get_style_context().add_class("settings-label")
        lbl_cols.set_xalign(0)
        cols_row.pack_start(lbl_cols, True, True, 0)

        adj_cols = Gtk.Adjustment(
            value=self._cols,
            lower=2, upper=8, step_increment=1, page_increment=1,
        )
        self._cols_spin = Gtk.SpinButton(adjustment=adj_cols, climb_rate=1, digits=0)
        self._cols_spin.set_width_chars(6)
        self._cols_spin.connect("value-changed", self._on_cols_changed)
        cols_row.pack_end(self._cols_spin, False, False, 0)
        page.pack_start(cols_row, False, False, 0)

        hint_cols = Gtk.Label(label="Adjust how many wallpapers to show per row")
        hint_cols.get_style_context().add_class("settings-hint")
        hint_cols.set_xalign(0)
        page.pack_start(hint_cols, False, False, 0)

        rows_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        rows_row.get_style_context().add_class("settings-row")
        lbl_rows = Gtk.Label(label="Grid rows")
        lbl_rows.get_style_context().add_class("settings-label")
        lbl_rows.set_xalign(0)
        rows_row.pack_start(lbl_rows, True, True, 0)

        adj_rows = Gtk.Adjustment(
            value=self._rows,
            lower=2, upper=8, step_increment=1, page_increment=1,
        )
        self._rows_spin = Gtk.SpinButton(adjustment=adj_rows, climb_rate=1, digits=0)
        self._rows_spin.set_width_chars(6)
        self._rows_spin.connect("value-changed", self._on_rows_changed)
        rows_row.pack_end(self._rows_spin, False, False, 0)
        page.pack_start(rows_row, False, False, 0)

        hint_rows = Gtk.Label(label="Adjust how many rows are visible before scrolling")
        hint_rows.get_style_context().add_class("settings-hint")
        hint_rows.set_xalign(0)
        page.pack_start(hint_rows, False, False, 0)

        sep3 = Gtk.Box()
        sep3.get_style_context().add_class("separator-line")
        page.pack_start(sep3, False, False, 0)

        lbl_storage = Gtk.Label(label="STORAGE & PERFORMANCE")
        lbl_storage.get_style_context().add_class("settings-section-label")
        lbl_storage.set_xalign(0)
        page.pack_start(lbl_storage, False, False, 0)

        storage_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        storage_row.get_style_context().add_class("storage-row")
        self._cache_label = Gtk.Label(label="Calculating cache size...")
        self._cache_label.get_style_context().add_class("settings-label")
        self._cache_label.set_xalign(0)
        storage_row.pack_start(self._cache_label, True, True, 0)

        clear_btn = Gtk.Button(label="Clear Cache")
        clear_btn.get_style_context().add_class("destructive-btn")
        clear_btn.connect("clicked", self._on_clear_cache)
        storage_row.pack_end(clear_btn, False, False, 0)
        page.pack_start(storage_row, False, False, 0)

        hint_storage = Gtk.Label(label="Deleting cache will free space but slightly slow down the next launch.")
        hint_storage.get_style_context().add_class("settings-hint")
        hint_storage.set_xalign(0)
        page.pack_start(hint_storage, False, False, 0)

        return outer

    def _rebuild_dirs_ui(self):
        for child in self._dirs_container.get_children():
            self._dirs_container.remove(child)

        for i, d in enumerate(self._wall_dirs):
            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            row.get_style_context().add_class("dir-row")

            lbl = Gtk.Label(label=_shorten_path(d))
            lbl.get_style_context().add_class("dir-row-label")
            lbl.set_xalign(0)
            lbl.set_ellipsize(Pango.EllipsizeMode.MIDDLE)
            row.pack_start(lbl, True, True, 0)

            rm_btn = Gtk.Button(label="\u00d7")
            rm_btn.get_style_context().add_class("dir-remove-btn")
            rm_btn.set_valign(Gtk.Align.CENTER)
            rm_btn.connect("clicked", self._on_remove_dir, i)
            row.pack_end(rm_btn, False, False, 0)

            self._dirs_container.pack_start(row, False, False, 0)
        self._dirs_container.show_all()

    def _open_settings(self, _btn):
        self._is_settings = True
        self._header_label.set_text("SETTINGS")
        self._update_cache_label()
        self._shuffle_btn.hide()
        self._settings_btn.hide()
        self._back_btn.show()
        self._controls.hide()
        self.stack.set_visible_child_name("settings")

    def _close_settings(self):
        self._is_settings = False
        self._header_label.set_text("WALLPAPER PICKER")
        self._back_btn.hide()
        self._shuffle_btn.show()
        self._settings_btn.show()
        self._controls.show()
        current = self.stack.get_visible_child_name()
        if current == "settings":
            has_images = bool(self._paths)
            self.stack.set_visible_child_name("grid" if has_images else "empty")

    def _on_add_dir(self, _btn):
        dialog = Gtk.FileChooserDialog(
            title="Add Wallpaper Folder",
            transient_for=self,
            action=Gtk.FileChooserAction.SELECT_FOLDER,
        )
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        ok_btn = dialog.add_button("Add", Gtk.ResponseType.ACCEPT)
        ok_btn.get_style_context().add_class("suggested-action")

        start = self._wall_dirs[-1] if self._wall_dirs else os.path.expanduser("~")
        if os.path.isdir(start):
            dialog.set_current_folder(start)

        response = dialog.run()
        chosen   = dialog.get_filename()
        dialog.destroy()

        if response != Gtk.ResponseType.ACCEPT or not chosen:
            return
        if chosen in self._wall_dirs:
            return

        self._wall_dirs.append(chosen)
        self._save_current_config()
        self._rebuild_dirs_ui()
        self._reload_from_settings()

    def _on_remove_dir(self, _btn, index):
        if 0 <= index < len(self._wall_dirs):
            self._wall_dirs.pop(index)
            self._save_current_config()
            self._rebuild_dirs_ui()
            self._reload_from_settings()
            # Silently clear cache after removing a folder to prune orphans
            GLib.idle_add(clear_cache)

    def _on_max_changed(self, spin):
        self._max_images = int(spin.get_value())
        self._save_current_config()
        self._reload_from_settings()

    def _on_mode_changed(self, combo):
        label = combo.get_active_text() or "Zoom"
        self._picture_mode = PICTURE_MODES.get(label, "zoom")
        self._save_current_config()

    def _on_cols_changed(self, spin):
        self._cols = int(spin.get_value())
        self._win_width = (self._cols * 192) + 100

        # Update UI live
        self.set_size_request(self._win_width, -1)
        self.flowbox.set_max_children_per_line(self._cols)
        self.flowbox.set_min_children_per_line(self._cols)
        self._grid_scroll.set_min_content_width(self._win_width - 16)

        self.resize(self._win_width, 1) # Force immediate window size update
        self._center_on_screen()
        self._save_current_config()

    def _on_rows_changed(self, spin):
        self._rows = int(spin.get_value())
        self._scroll_h = (self._rows * 151)

        # Update ALL stack pages so they stay consistent
        for name in ["grid", "settings", "empty", "no-results"]:
            page = self.stack.get_child_by_name(name)
            if not page: continue

            if isinstance(page, Gtk.ScrolledWindow):
                page.set_min_content_height(self._scroll_h)
                page.set_max_content_height(self._scroll_h)
            else:
                # empty and no-results are Boxes
                page.set_size_request(-1, self._scroll_h)

        # Force window to re-calculate its height based on new child sizes
        self.resize(self._win_width, 1)
        self._save_current_config()

    def _update_cache_label(self):
        """Updates the storage label with human-readable cache size."""
        size_bytes, count = get_cache_info()
        size_mb = size_bytes / (1024 * 1024)
        self._cache_label.set_text(f"Cache: {size_mb:.1f} MB ({count} files)")

    def _on_clear_cache(self, _btn):
        if clear_cache():
            self._update_cache_label()
            # Reload images to ensure UI consistency
            self._reload_from_settings()

    def _save_current_config(self):
        _save_config({
            "wall_dirs":    self._wall_dirs,
            "max_images":   self._max_images,
            "picture_mode": self._picture_mode,
            "columns":      self._cols,
            "rows":         self._rows,
        })

    def _reload_from_settings(self):
        self._query_cache = ""
        self.search_entry.handler_block_by_func(self._on_search_changed)
        self.search_entry.set_text("")
        self.search_entry.handler_unblock_by_func(self._on_search_changed)
        self.sort_combo.handler_block_by_func(self._on_sort_changed)
        self.sort_combo.set_active(2)   # Most Used
        self.sort_combo.handler_unblock_by_func(self._on_sort_changed)
        self._load_images("Most Used")

    def _load_images(self, sort_mode="Most Used"):
        if self._search_tid is not None:
            try:
                GLib.source_remove(self._search_tid)
            except Exception:
                pass
            self._search_tid = None
        if self._load_idle_id is not None:
            GLib.source_remove(self._load_idle_id)
            self._load_idle_id = None

        for child in self.flowbox.get_children():
            self.flowbox.remove(child)
        self._paths.clear()
        self._names.clear()
        self._star_widgets.clear()
        self._active_child = None
        self._did_select   = False

        all_paths = get_images(self._wall_dirs, sort_mode, self._max_images)

        cur = os.path.abspath(self._current) if self._current else ""
        if cur and cur in all_paths:
            all_paths.remove(cur)
            all_paths.insert(0, cur)

        self._pending = all_paths

        if not self._pending:
            if not self._wall_dirs:
                self._empty_title.set_text("No Folders Added")
                self._empty_label.set_text("Go to Settings to add your wallpaper directory")
                self._empty_icon.set_markup('<span size="48000">\U0001f5bc</span>')
                self._empty_hint.set_text("\u2699 Open Settings")
            elif sort_mode == "Starred":
                self._empty_title.set_text("No Favorites Yet")
                self._empty_label.set_text("Star your best wallpapers to see them here")
                self._empty_icon.set_markup('<span size="48000">\u2605</span>')
                self._empty_hint.set_text("Tip: Press 'F' to Star")
            else:
                self._empty_title.set_text("No Wallpapers Found")
                dirs_text = ", ".join(_shorten_path(d) for d in self._wall_dirs)
                self._empty_label.set_text(f"No valid images found in:\n{dirs_text}")
                self._empty_icon.set_markup('<span size="48000">\U0001f5bc</span>')
                self._empty_hint.set_text("\u2699 Open Settings")

            if not self._is_settings:
                self.stack.set_visible_child_name("empty")
            return

        if not self._is_settings:
            self.stack.set_visible_child_name("grid")

        # Increase priority so it doesn't wait indefinitely
        self._load_idle_id = GLib.idle_add(self._load_next, priority=GLib.PRIORITY_DEFAULT_IDLE)

    def _load_next(self):
        if not self._pending:
            self._load_idle_id = None
            return False

        path = self._pending.pop(0)

        try:
            thumb_path = get_thumbnail(path)
            pixbuf = GdkPixbuf.Pixbuf.new_from_file(thumb_path)
        except Exception:
            if not self._pending:
                self._load_idle_id = None
            return bool(self._pending)

        display_name = _make_display_name(os.path.basename(path))
        meta_text    = get_image_info(path)

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        card.get_style_context().add_class("card")

        # Overlay for floating metadata
        overlay = Gtk.Overlay()
        img = Gtk.Image.new_from_pixbuf(pixbuf)
        overlay.add(img)

        meta_lbl = Gtk.Label(label=meta_text)
        meta_lbl.get_style_context().add_class("metadata-overlay")
        meta_lbl.set_halign(Gtk.Align.END)
        meta_lbl.set_valign(Gtk.Align.END)
        meta_lbl.set_no_show_all(True)
        overlay.add_overlay(meta_lbl)

        # Star indicator overlay
        star_lbl = Gtk.Label(label="\u2605")
        star_lbl.get_style_context().add_class("star-indicator")
        star_lbl.set_halign(Gtk.Align.START)
        star_lbl.set_valign(Gtk.Align.START)
        star_lbl.set_no_show_all(True)
        is_fav = os.path.basename(path) in self._favorites
        if is_fav:
            star_lbl.show()
        overlay.add_overlay(star_lbl)

        card.pack_start(overlay, False, False, 0)
        card.pack_start(Gtk.Label(label=display_name), False, False, 0)

        child = Gtk.FlowBoxChild()
        child.set_halign(Gtk.Align.CENTER)
        child.set_valign(Gtk.Align.START)
        child.add(card)
        child.set_has_tooltip(False) # We use our own overlay

        self._paths[child] = path
        self._names[child] = display_name.lower()
        self._star_widgets[child] = star_lbl

        child.connect("button-press-event", self._on_child_click)

        # Metadata ONLY for the highlighted (selected) wallpaper
        def update_meta_visibility(*_):
            if child.get_state_flags() & Gtk.StateFlags.SELECTED:
                meta_lbl.show()
            else:
                meta_lbl.hide()
            return False

        child.connect("state-flags-changed", update_meta_visibility)

        # Fallback tooltip for accessibility
        tip = f"\u2605 [FAVORITE] | {meta_text}" if is_fav else meta_text
        child.set_tooltip_text(tip)

        self.flowbox.add(child)
        child.show_all()

        if os.path.abspath(path) == os.path.abspath(self._current or ""):
            self._active_child = child
            child.get_style_context().add_class("active")

        if not self._did_select:
            self._did_select = True
            self.flowbox.select_child(child)
            if not self._is_settings:
                GLib.idle_add(child.grab_focus)

        if self._pending:
            return True
        self._load_idle_id = None
        return False

    def _filter_func(self, child):
        return not self._query_cache or self._query_cache in self._names.get(child, "")

    def _get_visible_children(self):
        return [c for c in self.flowbox.get_children() if c.get_child_visible()]

    def _on_sort_changed(self, combo):
        if self._search_tid is not None:
            GLib.source_remove(self._search_tid)
            self._search_tid = None
        self._query_cache = ""
        self.search_entry.handler_block_by_func(self._on_search_changed)
        self.search_entry.set_text("")
        self.search_entry.handler_unblock_by_func(self._on_search_changed)
        self._load_images(combo.get_active_text())

    def _on_search_changed(self, _entry):
        if self._search_tid is not None:
            GLib.source_remove(self._search_tid)
        self._search_tid = GLib.timeout_add(SEARCH_DEBOUNCE_MS, self._apply_filter)

    def _apply_filter(self):
        self._search_tid  = None
        self._query_cache = self.search_entry.get_text().lower().strip()
        self.flowbox.invalidate_filter()
        if not self._query_cache:
            self.stack.set_visible_child_name("grid")
            return False
        GLib.idle_add(self._select_first_visible)
        return False

    def _on_clear_search(self, _w, _e):
        self.search_entry.set_text("")
        self.search_entry.grab_focus()
        return True

    def _select_first_visible(self):
        visible = self._get_visible_children()
        if visible:
            self.stack.set_visible_child_name("grid")
            self.flowbox.select_child(visible[0])
            visible[0].grab_focus()
        else:
            self.stack.set_visible_child_name("no-results")
        return False

    def _on_pick(self, _fb, child):
        path = self._paths.get(child)
        if not path:
            return
        set_wallpaper(path, self._picture_mode)
        if self._active_child:
            self._active_child.get_style_context().remove_class("active")
        self._active_child = child
        child.get_style_context().add_class("active")
        self._current = path

    def _on_shuffle(self, _btn):
        visible = self._get_visible_children()
        if not visible:
            return
        choice = random.choice(visible)
        self._on_pick(self.flowbox, choice)
        self.flowbox.select_child(choice)
        choice.grab_focus()

        # Ensure the shuffled wallpaper is visible in the scroll area
        adj = self.flowbox.get_parent().get_vadjustment()
        alloc = choice.get_allocation()
        adj.clamp_page(alloc.y, alloc.y + alloc.height)

    def _on_child_click(self, child, event):
        if event.button != 3:
            return False
        self._show_context_menu(child, event)
        return True

    def _toggle_favorite(self, child):
        path = self._paths.get(child)
        if not path:
            return

        fname = os.path.basename(path)
        if fname in self._favorites:
            self._favorites.remove(fname)
            self._star_widgets[child].hide()
        else:
            self._favorites.add(fname)
            self._star_widgets[child].show()

        save_favorites(self._favorites)

        # If we are in "Starred" mode, we need to refresh to hide/show correctly
        if self.sort_combo.get_active_text() == "Starred":
            self._on_sort_changed(self.sort_combo)
        else:
            # Otherwise just update the tooltip and star visibility
            is_fav = fname in self._favorites
            meta_text = get_image_info(path)
            tip = f"\u2605 [FAVORITE] | {meta_text}" if is_fav else meta_text
            child.set_tooltip_text(tip)

    def _show_context_menu(self, child, event):
        path = self._paths.get(child)
        if not path:
            return
        menu = Gtk.Menu()
        item_set = Gtk.MenuItem(label="Set as Wallpaper")
        item_set.connect("activate", lambda _: self._on_pick(self.flowbox, child))
        menu.append(item_set)
        menu.append(Gtk.SeparatorMenuItem())

        is_fav = os.path.basename(path) in self._favorites
        fav_label = "Remove from Favorites" if is_fav else "Add to Favorites"
        item_fav = Gtk.MenuItem(label=fav_label)
        item_fav.connect("activate", lambda _: self._toggle_favorite(child))
        menu.append(item_fav)

        item_reveal = Gtk.MenuItem(label="Reveal in File Manager")
        item_reveal.connect("activate",
                            lambda _: reveal_in_fm(os.path.dirname(path)))
        menu.append(item_reveal)
        item_delete = Gtk.MenuItem(label="Delete File\u2026")
        item_delete.connect("activate", lambda _: self._confirm_delete(child, path))
        menu.append(item_delete)
        menu.show_all()
        menu.popup_at_pointer(event)

    def _confirm_delete(self, child, path):
        fname = os.path.basename(path)
        dialog = Gtk.MessageDialog(
            transient_for=self, modal=True,
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.NONE,
            text="Delete wallpaper?",
        )
        dialog.format_secondary_text(f'"{fname}" will be permanently deleted.')
        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL)
        delete_btn = dialog.add_button("Delete", Gtk.ResponseType.OK)
        delete_btn.get_style_context().add_class("destructive-action")
        response = dialog.run()
        dialog.destroy()
        if response != Gtk.ResponseType.OK:
            return
        try:
            os.remove(path)
            # Remove from favorites if it was starred
            fname = os.path.basename(path)
            if fname in self._favorites:
                self._favorites.remove(fname)
                save_favorites(self._favorites)
        except OSError:
            return
        if self._active_child == child:
            self._active_child = None
            self._current      = ""
        self._paths.pop(child, None)
        self._names.pop(child, None)
        self.flowbox.remove(child)
        GLib.idle_add(self._select_first_visible)

    def _on_header_drag(self, _widget, event):
        if event.button == 1:
            self.begin_move_drag(
                event.button, int(event.x_root), int(event.y_root), event.time)

    def _on_search_key(self, _entry, event):
        if event.keyval == Gdk.KEY_Down:
            visible = self._get_visible_children()
            if visible:
                self.flowbox.select_child(visible[0])
                visible[0].grab_focus()
            return True
        return False

    def _on_key(self, _w, event):
        kv   = event.keyval
        ctrl = event.state & Gdk.ModifierType.CONTROL_MASK
        if kv == Gdk.KEY_Escape or (ctrl and kv in (Gdk.KEY_w, Gdk.KEY_q)):
            if self.stack.get_visible_child_name() == "settings":
                self._close_settings()
            else:
                self.destroy()
            return True
        if self.stack.get_visible_child_name() == "settings":
            return False
        if kv == Gdk.KEY_Return:
            if self.search_entry.has_focus():
                visible = self._get_visible_children()
                if visible:
                    self._on_pick(self.flowbox, visible[0])
                return True
            widget = self.get_focus()
            while widget is not None and not isinstance(widget, Gtk.FlowBoxChild):
                widget = widget.get_parent()
            if widget is not None and widget in self._paths:
                self._on_pick(self.flowbox, widget)
                return True
        if kv == Gdk.KEY_Up:
            widget = self.get_focus()
            while widget is not None and not isinstance(widget, Gtk.FlowBoxChild):
                widget = widget.get_parent()
            if widget is not None and widget in self._paths:
                visible = self._get_visible_children()
                try:
                    if visible.index(widget) < self._cols:
                        self.search_entry.grab_focus()
                        self.search_entry.set_position(-1)
                        return True
                except ValueError:
                    pass
        if kv == Gdk.KEY_f or kv == Gdk.KEY_F:
            # Command key: only toggle if we aren't typing in a text field
            if not self.search_entry.has_focus() and not self.sort_combo.has_focus():
                widget = self.get_focus()
                while widget is not None and not isinstance(widget, Gtk.FlowBoxChild):
                    widget = widget.get_parent()
                if widget is not None and widget in self._paths:
                    self._toggle_favorite(widget)
                    return True

        if not self.search_entry.has_focus() and not self.sort_combo.has_focus():
            if 0x20 <= kv <= 0x7E:
                # Character key: focus search and append
                self.search_entry.grab_focus()
                self.search_entry.set_text(self.search_entry.get_text() + chr(kv))
                self.search_entry.set_position(-1)
                return True
            if kv == Gdk.KEY_BackSpace:
                self.search_entry.grab_focus()
                return True
        return False

    def _center_on_screen(self):
        try:
            display = Gdk.Display.get_default()
            if display is None:
                return

            monitor = None
            # Since we enforce GDK_BACKEND=x11, we can trust the pointer position
            # to detect the active monitor without security-based (0,0) shielding.
            seat = display.get_default_seat()
            if seat:
                pointer = seat.get_pointer()
                if pointer:
                    pos = pointer.get_position()
                    x, y = pos[-2], pos[-1]
                    monitor = display.get_monitor_at_point(x, y)

            if monitor is None:
                monitor = display.get_primary_monitor() or display.get_monitor(0)

            if monitor is None:
                return

            geo = monitor.get_geometry()
            # Position relative to monitor origin
            self.move(geo.x + (geo.width - self._win_width) // 2, geo.y + 50)
        except Exception:
            pass
