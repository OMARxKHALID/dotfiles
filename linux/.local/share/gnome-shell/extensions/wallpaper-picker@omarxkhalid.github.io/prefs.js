// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk";
import GdkPixbuf from "gi://GdkPixbuf";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import {
  loadConfig,
  saveConfig,
  loadFavorites,
  saveFavorites,
  getCurrentWallpaper,
  setWallpaper,
  getImagesAsync,
  getImageInfo,
  getThumbnail,
  getCacheInfoAsync,
  clearCacheAsync,
  makeDisplayName,
  shortenPath,
  DEFAULT_WALL_DIR,
  THUMB_W,
  THUMB_H,
  SEARCH_DEBOUNCE_MS,
  PICTURE_MODES,
  PICTURE_MODE_LABELS,
  PICTURE_MODE_REVERSE,
} from "./utils.js";

const CARD_CSS = `
  .wp-card {
    border-radius: 10px;
    border: 2px solid transparent;
    padding: 4px;
    transition: border-color 200ms, background-color 200ms;
  }
  .wp-card:hover { border-color: @accent_color; }
  .wp-card.active {
    border-color: @accent_color;
    background-color: alpha(@accent_color, 0.12);
  }
  .wp-card .wp-name { font-size: 11px; font-weight: 600; padding: 4px 2px 2px; }
  .wp-star  { font-size: 16px; color: @accent_color; padding: 4px 6px; }
  .wp-meta  { font-size: 10px; padding: 2px 6px; border-radius: 4px; background-color: alpha(black,0.55); color: white; }
  .wp-empty-icon  { opacity: 0.4; margin-bottom: 16px; }
  .wp-empty-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
  .wp-empty-sub   { font-size: 13px; opacity: 0.7; }
`;

const SORT_MODES = ["A-Z", "Starred", "Newest", "Most Used", "Recent"];
const DEFAULT_SORT_IDX = 3;

export default class WallpaperPickerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const provider = new Gtk.CssProvider();
    provider.load_from_string(CARD_CSS);
    Gtk.StyleContext.add_provider_for_display(
      window.get_display(),
      provider,
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
    );

    this._config = loadConfig();
    this._favorites = loadFavorites();
    this._window = window;
    this._paths = new Map();
    this._names = new Map();
    this._starWidgets = new Map();
    this._activeChild = null;
    this._current = getCurrentWallpaper();
    this._pending = [];
    this._loadIdleId = null;
    this._searchTid = null;
    this._limitTid = null;
    this._queryCache = "";
    this._activeSigId = null;

    window.set_default_size(800, 700);
    window.set_modal(true);

    window.add(this._buildWallpapersPage());
    window.add(this._buildFoldersPage());
    window.add(this._buildDisplayPage());
    window.add(this._buildStoragePage());

    window.connect("close-request", () => {
      this._clearTimers();
      this._disconnectActiveSig();
      return false;
    });

    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      this._fixPageScroll(this._wallpapersPage);
      return GLib.SOURCE_REMOVE;
    });

    // Adw.PreferencesWindow runs its own focus init when presented, which
    // steals focus back to the first focusable widget (_searchEntry).
    // notify::is-active fires after Adwaita finishes, so window.set_focus()
    // here wins. _activeSigId=null after firing is used as a sentinel in
    // _loadNext() to call _focusGrid() if loading finishes after the window
    // was already shown.
    this._activeSigId = window.connect("notify::is-active", () => {
      if (!window.is_active()) return;
      this._disconnectActiveSig();
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        this._focusGrid();
        return GLib.SOURCE_REMOVE;
      });
    });

    this._loadImages();
  }

  _focusGrid() {
    if (!this._window) return;
    const target =
      this._activeChild ?? this._flowBox.get_first_child() ?? this._flowBox;
    if (target instanceof Gtk.FlowBoxChild) this._flowBox.select_child(target);
    this._window.set_focus(target);
  }

  _disconnectActiveSig() {
    if (this._activeSigId !== null) {
      this._window?.disconnect(this._activeSigId);
      this._activeSigId = null;
    }
  }

  _fixPageScroll(page) {
    function find(widget, type) {
      if (!widget) return null;
      if (widget instanceof type) return widget;
      let c = widget.get_first_child();
      while (c) {
        const r = find(c, type);
        if (r) return r;
        c = c.get_next_sibling();
      }
      return null;
    }
    const sw = find(page, Gtk.ScrolledWindow);
    if (sw) {
      sw.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
      sw.vexpand = true;
    }
    const cl = find(page, Adw.Clamp);
    if (cl) {
      cl.vexpand = true;
      cl.maximum_size = 850;
    }
  }

  _clearTimers() {
    [this._loadIdleId, this._searchTid, this._limitTid].forEach((id) => {
      if (id) GLib.Source.remove(id);
    });
    this._loadIdleId = this._searchTid = this._limitTid = null;
  }

  _save() {
    saveConfig(this._config);
  }

  // ---------------------------------------------------------------------------
  // Wallpapers page
  // ---------------------------------------------------------------------------

  _buildWallpapersPage() {
    this._wallpapersPage = new Adw.PreferencesPage({
      title: "Wallpapers",
      icon_name: "emblem-photos-symbolic",
    });

    const controlsGroup = new Adw.PreferencesGroup();
    const controlsBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
    });

    this._searchEntry = new Gtk.SearchEntry({
      hexpand: true,
      placeholder_text: "Filter wallpapers…",
    });
    this._searchEntry.connect("search-changed", () => this._onSearchChanged());
    // Enter in search jumps focus to the grid — standard GTK4 SearchEntry UX.
    this._searchEntry.connect("activate", () => this._focusGrid());
    controlsBox.append(this._searchEntry);

    this._sortDrop = new Gtk.DropDown({
      model: new Gtk.StringList({ strings: SORT_MODES }),
      selected: DEFAULT_SORT_IDX,
    });
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      this._sortDrop.connect("notify::selected", () =>
        this._loadImages(SORT_MODES[this._sortDrop.get_selected()]),
      );
      return GLib.SOURCE_REMOVE;
    });
    controlsBox.append(this._sortDrop);

    const shuffleBtn = new Gtk.Button({
      icon_name: "media-playlist-shuffle-symbolic",
      tooltip_text: "Shuffle",
      valign: Gtk.Align.CENTER,
    });
    shuffleBtn.connect("clicked", () => this._onShuffle());
    controlsBox.append(shuffleBtn);

    controlsGroup.add(controlsBox);
    this._wallpapersPage.add(controlsGroup);

    // FlowBox is the DIRECT child of ScrolledWindow (no Gtk.Stack in between).
    //
    // A Stack between the Viewport and FlowBox breaks keyboard navigation:
    // (a) set_hadjustment/set_vadjustment require adjustments in the same
    //     coordinate space as FlowBox's children — the Stack breaks this.
    // (b) Viewport:scroll-to-focus doesn't propagate through a Stack child.
    //
    // Empty states are siblings of the ScrolledWindow, toggled with set_visible.
    this._flowBox = new Gtk.FlowBox({
      valign: Gtk.Align.START,
      halign: Gtk.Align.CENTER,
      max_children_per_line: 3,
      min_children_per_line: 3,
      homogeneous: true,
      selection_mode: Gtk.SelectionMode.SINGLE,
      activate_on_single_click: true,
      focusable: true,
    });
    this._flowBox.set_filter_func((child) => this._filterFunc(child));
    this._flowBox.connect("child-activated", (_fb, child) =>
      this._applyWallpaper(child),
    );
    // Return false at navigation boundaries — lets focus leave naturally without ringing the bell.
    this._flowBox.connect("keynav-failed", () => false);

    const keyCtrl = new Gtk.EventControllerKey();
    keyCtrl.connect("key-pressed", (_c, keyval) => {
      const focused = this._flowBox.get_focus_child();
      if (!focused) return false;
      if (keyval === Gdk.KEY_f || keyval === Gdk.KEY_F) {
        this._toggleFavorite(focused);
        return true;
      }
      if (keyval === Gdk.KEY_d || keyval === Gdk.KEY_D) {
        const path = this._paths.get(focused);
        if (path) this._confirmDelete(focused, path);
        return true;
      }
      return false;
    });
    this._flowBox.add_controller(keyCtrl);

    this._gridScroll = new Gtk.ScrolledWindow({
      vexpand: true,
      min_content_height: 500,
    });
    this._gridScroll.set_child(this._flowBox);
    this._flowBox.set_hadjustment(this._gridScroll.get_hadjustment());
    this._flowBox.set_vadjustment(this._gridScroll.get_vadjustment());
    const vp = this._gridScroll.get_child();
    if (vp instanceof Gtk.Viewport) vp.set_scroll_to_focus(true);

    this._emptyBox = this._makeEmptyBox(
      "🖼️",
      "No Wallpapers",
      "Select a folder to get started",
    );
    this._emptyTitle = this._emptyBox.emptyTitle;
    this._emptySub = this._emptyBox.emptySub;
    this._emptyBox.set_visible(false);
    this._noResultsBox = this._makeEmptyBox(
      "🔍",
      "No Matches",
      "Try a different search term",
    );
    this._noResultsBox.set_visible(false);

    const outerBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      vexpand: true,
    });
    outerBox.append(this._gridScroll);
    outerBox.append(this._emptyBox);
    outerBox.append(this._noResultsBox);

    const gridGroup = new Adw.PreferencesGroup();
    gridGroup.add(outerBox);
    this._wallpapersPage.add(gridGroup);

    return this._wallpapersPage;
  }

  _showGridState(state) {
    this._gridScroll.set_visible(state === "grid");
    this._emptyBox.set_visible(state === "empty");
    this._noResultsBox.set_visible(state === "no-results");
  }

  _makeEmptyBox(icon, title, sub) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
      vexpand: true,
      spacing: 4,
    });
    box.set_size_request(-1, 3 * 155);
    const il = new Gtk.Label({ label: icon });
    il.add_css_class("wp-empty-icon");
    const tl = new Gtk.Label({ label: title });
    tl.add_css_class("wp-empty-title");
    const sl = new Gtk.Label({ label: sub });
    sl.add_css_class("wp-empty-sub");
    box.append(il);
    box.append(tl);
    box.append(sl);
    box.emptyTitle = tl;
    box.emptySub = sl;
    return box;
  }

  // ---------------------------------------------------------------------------
  // Image loading
  // ---------------------------------------------------------------------------

  _loadImages(sortMode) {
    this._clearTimers();

    let child;
    while ((child = this._flowBox.get_first_child()))
      this._flowBox.remove(child);
    this._paths.clear();
    this._names.clear();
    this._starWidgets.clear();
    this._activeChild = null;

    const cfg = this._config;
    const dirs = cfg.wall_dirs ?? [DEFAULT_WALL_DIR];
    const maxImages = cfg.max_images ?? 0;
    const mode =
      sortMode ??
      SORT_MODES[this._sortDrop?.get_selected() ?? DEFAULT_SORT_IDX];

    getImagesAsync(dirs, mode, maxImages, (allPaths) => {
      if (this._current) {
        const idx = allPaths.indexOf(this._current);
        if (idx > 0) {
          allPaths.splice(idx, 1);
          allPaths.unshift(this._current);
        }
      }

      this._pending = allPaths;

      if (!allPaths.length) {
        if (!dirs.length) {
          this._emptyTitle.set_label("No Folders Added");
          this._emptySub.set_label(
            "Go to the Folders page to add wallpaper directories",
          );
        } else if (mode === "Starred") {
          this._emptyTitle.set_label("No Favorites Yet");
          this._emptySub.set_label("Star wallpapers to see them here");
        } else {
          this._emptyTitle.set_label("No Wallpapers Found");
          this._emptySub.set_label(
            `No images in: ${dirs.map(shortenPath).join(", ")}`,
          );
        }
        this._showGridState("empty");
        return;
      }

      this._showGridState("grid");
      this._loadIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () =>
        this._loadNext(),
      );
    });
  }

  _loadNext() {
    for (let i = 0; i < 10; i++) {
      if (!this._pending.length) {
        this._loadIdleId = null;
        // If notify::is-active already fired (activeSigId is null), focus now.
        // Otherwise the notify::is-active handler will call _focusGrid() once shown.
        if (this._activeSigId === null)
          GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._focusGrid();
            return GLib.SOURCE_REMOVE;
          });
        return GLib.SOURCE_REMOVE;
      }

      const path = this._pending.shift();
      try {
        const thumbPath = getThumbnail(path);
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file(thumbPath);
        const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
        const fname = GLib.path_get_basename(path);
        const displayName = makeDisplayName(fname);
        const isFav = this._favorites.has(fname);

        const cardBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        cardBox.add_css_class("wp-card");

        const overlay = new Gtk.Overlay();
        const picture = Gtk.Picture.new_for_paintable(texture);
        picture.set_size_request(THUMB_W, THUMB_H);
        picture.set_content_fit(Gtk.ContentFit.COVER);
        overlay.set_child(picture);

        const star = new Gtk.Label({ label: "★" });
        star.add_css_class("wp-star");
        star.set_halign(Gtk.Align.START);
        star.set_valign(Gtk.Align.START);
        star.set_visible(isFav);
        overlay.add_overlay(star);

        const meta = new Gtk.Label({ label: "" });
        meta.add_css_class("wp-meta");
        meta.set_halign(Gtk.Align.END);
        meta.set_valign(Gtk.Align.END);
        meta.set_visible(false);
        overlay.add_overlay(meta);

        cardBox.append(overlay);

        const nameLabel = new Gtk.Label({ label: displayName });
        nameLabel.add_css_class("wp-name");
        nameLabel.set_ellipsize(3);
        cardBox.append(nameLabel);

        const fbChild = new Gtk.FlowBoxChild({ focusable: true });
        fbChild.set_child(cardBox);
        fbChild.set_tooltip_text(displayName);

        // Load image resolution/size lazily on first hover to keep bulk load fast.
        let infoLoaded = false;
        const hoverCtrl = new Gtk.EventControllerMotion();
        hoverCtrl.connect("enter", () => {
          if (infoLoaded) return;
          infoLoaded = true;
          const info = getImageInfo(path);
          meta.set_label(info);
          fbChild.set_tooltip_text(isFav ? `★ ${info}` : info);
        });
        fbChild.add_controller(hoverCtrl);

        const gesture = new Gtk.GestureClick({ button: 3 });
        gesture.connect("pressed", () => this._showContextMenu(fbChild));
        fbChild.add_controller(gesture);

        this._paths.set(fbChild, path);
        this._names.set(fbChild, displayName.toLowerCase());
        this._starWidgets.set(fbChild, { star, meta });
        this._flowBox.append(fbChild);

        if (path === this._current) {
          this._activeChild = fbChild;
          cardBox.add_css_class("active");
          const info = getImageInfo(path);
          meta.set_label(info);
          meta.set_visible(true);
          infoLoaded = true;
        }
      } catch (e) {
        console.debug(`[wallpaper-picker] _loadNext ${path}: ${e.message}`);
      }
    }

    return GLib.SOURCE_CONTINUE;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  _applyWallpaper(child) {
    const path = this._paths.get(child);
    if (!path) return;

    setWallpaper(path, this._config.picture_mode ?? "zoom");

    if (this._activeChild) {
      this._activeChild.get_child()?.remove_css_class("active");
      this._starWidgets.get(this._activeChild)?.meta.set_visible(false);
    }

    this._activeChild = child;
    this._current = path;
    child.get_child()?.add_css_class("active");
    this._starWidgets.get(child)?.meta.set_visible(true);
  }

  _onShuffle() {
    const visible = [];
    let c = this._flowBox.get_first_child();
    while (c) {
      if (c.get_child_visible()) visible.push(c);
      c = c.get_next_sibling();
    }
    if (!visible.length) return;
    const choice = visible[Math.floor(Math.random() * visible.length)];
    this._applyWallpaper(choice);
    this._flowBox.select_child(choice);
    choice.grab_focus();
  }

  _toggleFavorite(child) {
    const path = this._paths.get(child);
    if (!path) return;
    const fname = GLib.path_get_basename(path);
    const w = this._starWidgets.get(child);
    if (this._favorites.has(fname)) {
      this._favorites.delete(fname);
      w?.star.set_visible(false);
    } else {
      this._favorites.add(fname);
      w?.star.set_visible(true);
    }
    saveFavorites(this._favorites);
    if (SORT_MODES[this._sortDrop.get_selected()] === "Starred")
      this._loadImages("Starred");
  }

  _showContextMenu(child) {
    if (this._ctxPopover) {
      this._ctxPopover.unparent();
      this._ctxPopover = null;
    }
    const path = this._paths.get(child);
    if (!path) return;
    const fname = GLib.path_get_basename(path);
    const isFav = this._favorites.has(fname);

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_top: 4,
      margin_bottom: 4,
      margin_start: 4,
      margin_end: 4,
    });

    for (const item of [
      { label: "Set as Wallpaper", cb: () => this._applyWallpaper(child) },
      {
        label: isFav ? "★ Remove Favorite" : "☆ Add Favorite",
        cb: () => this._toggleFavorite(child),
      },
      {
        label: "Reveal in Files",
        cb: () =>
          Gio.AppInfo.launch_default_for_uri(
            Gio.File.new_for_path(GLib.path_get_dirname(path)).get_uri(),
            null,
          ),
      },
      {
        label: "Delete…",
        destructive: true,
        cb: () => this._confirmDelete(child, path),
      },
    ]) {
      const btn = new Gtk.Button({ label: item.label });
      btn.add_css_class("flat");
      if (item.destructive) btn.add_css_class("destructive-action");
      btn.connect("clicked", () => {
        this._ctxPopover?.popdown();
        item.cb();
      });
      box.append(btn);
    }

    this._ctxPopover = new Gtk.Popover({ child: box });
    this._ctxPopover.set_parent(child);
    this._ctxPopover.popup();
  }

  _confirmDelete(child, path) {
    const fname = GLib.path_get_basename(path);
    const dialog = new Adw.AlertDialog({
      heading: "Delete Wallpaper?",
      body: `"${fname}" will be permanently deleted.`,
    });
    dialog.add_response("cancel", "Cancel");
    dialog.add_response("delete", "Delete");
    dialog.set_response_appearance(
      "delete",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );
    dialog.set_default_response("cancel");
    dialog.set_close_response("cancel");

    dialog.connect("response", (_d, response) => {
      if (response !== "delete") return;
      try {
        Gio.File.new_for_path(path).delete(null);
      } catch (e) {
        console.error(`[wallpaper-picker] Delete failed: ${e.message}`);
        return;
      }

      if (this._favorites.has(fname)) {
        this._favorites.delete(fname);
        saveFavorites(this._favorites);
      }
      if (this._activeChild === child) {
        this._activeChild = null;
        this._current = "";
      }
      this._paths.delete(child);
      this._names.delete(child);
      this._starWidgets.delete(child);
      this._flowBox.remove(child);
    });

    dialog.present(this._window);
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  _onSearchChanged() {
    if (this._searchTid) {
      GLib.Source.remove(this._searchTid);
      this._searchTid = null;
    }
    this._searchTid = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      SEARCH_DEBOUNCE_MS,
      () => {
        this._searchTid = null;
        this._queryCache = this._searchEntry.get_text().toLowerCase().trim();
        this._flowBox.invalidate_filter();
        if (!this._queryCache) {
          this._showGridState("grid");
          return GLib.SOURCE_REMOVE;
        }
        let hasVisible = false;
        let c = this._flowBox.get_first_child();
        while (c) {
          if (c.get_child_visible()) {
            hasVisible = true;
            break;
          }
          c = c.get_next_sibling();
        }
        this._showGridState(hasVisible ? "grid" : "no-results");
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  _filterFunc(child) {
    if (!this._queryCache) return true;
    return (this._names.get(child) ?? "").includes(this._queryCache);
  }

  // ---------------------------------------------------------------------------
  // Folders page
  // ---------------------------------------------------------------------------

  _buildFoldersPage() {
    const page = new Adw.PreferencesPage({
      title: "Folders",
      icon_name: "folder-pictures-symbolic",
    });

    this._foldersGroup = new Adw.PreferencesGroup({
      title: "Wallpaper Folders",
      description: "Images are pulled from all folders listed below.",
    });

    this._dirs = [...(this._config.wall_dirs ?? [DEFAULT_WALL_DIR])];
    this._folderRows = [];
    this._rebuildFolderRows();

    const addGroup = new Adw.PreferencesGroup();
    const addRow = new Adw.ActionRow({ title: "Add Folder…" });
    addRow.add_prefix(
      new Gtk.Image({
        icon_name: "list-add-symbolic",
        pixel_size: 16,
        valign: Gtk.Align.CENTER,
      }),
    );
    addRow.set_activatable(true);
    addRow.connect("activated", () => this._onAddFolder());
    addGroup.add(addRow);

    page.add(this._foldersGroup);
    page.add(addGroup);
    return page;
  }

  _rebuildFolderRows() {
    for (const row of this._folderRows) this._foldersGroup.remove(row);
    this._folderRows = [];

    for (let i = 0; i < this._dirs.length; i++) {
      const dir = this._dirs[i];
      const short = shortenPath(dir);
      const row = new Adw.ActionRow({
        title: short,
        subtitle: short !== dir ? dir : "",
      });

      const btn = new Gtk.Button({
        icon_name: "user-trash-symbolic",
        valign: Gtk.Align.CENTER,
        css_classes: ["destructive-action", "flat"],
        tooltip_text: "Remove",
      });
      const idx = i;
      btn.connect("clicked", () => {
        this._dirs.splice(idx, 1);
        this._config.wall_dirs = this._dirs;
        this._save();
        this._rebuildFolderRows();
        this._loadImages();
      });

      row.add_suffix(btn);
      this._foldersGroup.add(row);
      this._folderRows.push(row);
    }
  }

  _onAddFolder() {
    const dlg = new Gtk.FileDialog({ title: "Select Wallpaper Folder" });
    dlg.select_folder(this._window, null, (d, res) => {
      try {
        const path = d.select_folder_finish(res)?.get_path();
        if (path && !this._dirs.includes(path)) {
          this._dirs.push(path);
          this._config.wall_dirs = this._dirs;
          this._save();
          this._rebuildFolderRows();
          this._loadImages();
        }
      } catch (_) {}
    });
  }

  // ---------------------------------------------------------------------------
  // Display page
  // ---------------------------------------------------------------------------

  _buildDisplayPage() {
    const page = new Adw.PreferencesPage({
      title: "Display",
      icon_name: "video-display-symbolic",
    });

    const gridGroup = new Adw.PreferencesGroup({ title: "Preferences" });
    const maxRow = new Adw.SpinRow({
      title: "Max Images",
      subtitle: "0 = show all (no limit)",
      adjustment: new Gtk.Adjustment({
        value: Number(this._config.max_images ?? 0),
        lower: 0,
        upper: 2000,
        step_increment: 10,
        page_increment: 100,
      }),
    });
    maxRow.connect("notify::value", (r) => {
      this._config.max_images = Math.round(r.get_value());
      this._save();
      if (this._limitTid) {
        GLib.Source.remove(this._limitTid);
        this._limitTid = null;
      }
      this._limitTid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
        this._limitTid = null;
        this._loadImages(SORT_MODES[this._sortDrop.get_selected()]);
        return GLib.SOURCE_REMOVE;
      });
    });
    gridGroup.add(maxRow);
    page.add(gridGroup);

    const modeGroup = new Adw.PreferencesGroup({ title: "Wallpaper Mode" });
    const currentLabel =
      PICTURE_MODE_REVERSE[this._config.picture_mode ?? "zoom"] ?? "Zoom";
    const modeRow = new Adw.ComboRow({
      title: "Display Mode",
      subtitle: "How the wallpaper fits the screen",
      model: new Gtk.StringList({ strings: PICTURE_MODE_LABELS }),
      selected: Math.max(PICTURE_MODE_LABELS.indexOf(currentLabel), 0),
    });
    modeRow.connect("notify::selected", (r) => {
      const label = PICTURE_MODE_LABELS[r.get_selected()];
      this._config.picture_mode = PICTURE_MODES[label] ?? "zoom";
      this._save();
      if (this._current) setWallpaper(this._current, this._config.picture_mode);
    });
    modeGroup.add(modeRow);
    page.add(modeGroup);

    return page;
  }

  // ---------------------------------------------------------------------------
  // Storage page
  // ---------------------------------------------------------------------------

  _buildStoragePage() {
    const page = new Adw.PreferencesPage({
      title: "Storage",
      icon_name: "drive-harddisk-symbolic",
    });

    const cacheGroup = new Adw.PreferencesGroup({
      title: "Thumbnail Cache",
      description: "Clearing frees space but slows the next launch slightly.",
    });
    this._cacheRow = new Adw.ActionRow({ title: "Calculating…" });

    const spinner = new Gtk.Spinner({
      visible: false,
      valign: Gtk.Align.CENTER,
    });
    const clearBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
    });
    clearBox.append(spinner);
    clearBox.append(new Gtk.Label({ label: "Clear Cache" }));

    const clearBtn = new Gtk.Button({
      css_classes: ["destructive-action"],
      valign: Gtk.Align.CENTER,
    });
    clearBtn.set_child(clearBox);
    clearBtn.connect("clicked", () => {
      clearBtn.set_sensitive(false);
      spinner.set_visible(true);
      spinner.start();
      clearCacheAsync(() => {
        this._updateCacheLabel();
        clearBtn.set_sensitive(true);
        spinner.stop();
        spinner.set_visible(false);
      });
    });

    this._cacheRow.add_suffix(clearBtn);
    cacheGroup.add(this._cacheRow);
    page.add(cacheGroup);
    this._updateCacheLabel();
    return page;
  }

  _updateCacheLabel() {
    getCacheInfoAsync(({ totalSize, count }) => {
      try {
        this._cacheRow.set_title(
          `${(totalSize / 1_048_576).toFixed(1)} MB used`,
        );
        this._cacheRow.set_subtitle(
          `${count} cached thumbnail${count === 1 ? "" : "s"}`,
        );
      } catch (_) {
        this._cacheRow.set_title("0.0 MB used");
        this._cacheRow.set_subtitle("0 cached thumbnails");
      }
    });
  }
}
