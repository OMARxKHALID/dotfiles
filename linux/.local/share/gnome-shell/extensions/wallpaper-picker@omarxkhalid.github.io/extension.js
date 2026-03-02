// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import St from "gi://St";
import Clutter from "gi://Clutter";

import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

import {
  loadConfig,
  getImagesAsync,
  setWallpaper,
  getCurrentWallpaper,
  DEFAULT_WALL_DIR,
} from "./utils.js";

const APP_ICON = "emblem-photos-symbolic";
const SMALL_ICON_SIZE = 16;
const PREFS_FOCUS_TIMEOUT = 5000;

export default class WallpaperPickerExtension extends Extension {
  enable() {
    if (this._button) return;

    this._signalIds = [];
    this._prefsWinSigId = null;
    this._prefsFocusTid = null;
    this._restoreCentering = null;

    this._button = new PanelMenu.Button(0.5, _("Wallpaper Picker"), false);

    const box = new St.BoxLayout({
      style_class: "panel-status-menu-box",
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    box.add_child(
      new St.Icon({
        icon_name: APP_ICON,
        style_class: "system-status-icon",
        icon_size: SMALL_ICON_SIZE,
        y_align: Clutter.ActorAlign.CENTER,
      }),
    );

    this._button.add_child(box);
    this._buildMenu();
    Main.panel.addToStatusArea(this.uuid, this._button);
  }

  _buildMenu() {
    const items = [
      {
        label: _("Pick Wallpaper"),
        icon: APP_ICON,
        action: () => this._openPrefs(),
      },
      {
        label: _("Shuffle Wallpaper"),
        icon: "media-playlist-shuffle-symbolic",
        action: () => this._shuffleWallpaper(),
      },
      { separator: true },
      {
        label: _("Open Wallpapers Folder"),
        icon: "folder-pictures-symbolic",
        action: () => this._openWallpapersFolder(),
      },
    ];

    for (const item of items) {
      if (item.separator) {
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        continue;
      }
      const mi = new PopupMenu.PopupImageMenuItem(item.label, item.icon);
      // set_style avoids walking PopupImageMenuItem's internal widget tree,
      // which changes across GNOME Shell versions.
      mi.set_style(`icon-size: ${SMALL_ICON_SIZE}px;`);
      this._signalIds.push({
        obj: mi,
        id: mi.connect("activate", item.action),
      });
      this._button.menu.addMenuItem(mi);
    }
  }

  // ---------------------------------------------------------------------------
  // Open preferences
  //
  // CENTERING: Wayland has no API for window positioning. We temporarily set
  // org.gnome.mutter center-new-windows so the compositor places the window
  // in the centre of the screen, then restore the original value immediately
  // after the window appears.
  //
  // FOCUS: openPreferences() spawns a subprocess. Wayland focus-stealing
  // prevention blocks foreign processes from receiving focus. We hook
  // global.display window-created (inside the Shell process, which holds the
  // Wayland XDG activation token) and call win.activate() from there.
  //
  // _restoreCentering is stored on `this` (not a local closure) so that
  // _cancelWatch can always call it even if _openPrefs is called twice before
  // any window appears — a local closure would be orphaned by the second call
  // and center-new-windows would be left permanently true.
  //
  // window-created is filtered to Meta.WindowType.NORMAL so transient windows
  // from other apps don't steal the focus slot or trigger a premature restore.
  // ---------------------------------------------------------------------------

  _openPrefs() {
    this._cancelWatch();

    const s = new Gio.Settings({ schema_id: "org.gnome.mutter" });
    const wasCentered = s.get_boolean("center-new-windows");
    if (!wasCentered) s.set_boolean("center-new-windows", true);

    this._restoreCentering = () => {
      if (!wasCentered) s.set_boolean("center-new-windows", false);
      this._restoreCentering = null;
    };

    this._prefsWinSigId = global.display.connect(
      "window-created",
      (_d, win) => {
        if (win.get_window_type() !== Meta.WindowType.NORMAL) return;
        this._cancelWatch();
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
          try {
            win.activate(global.get_current_time());
          } catch (_) {}
          return GLib.SOURCE_REMOVE;
        });
      },
    );

    this._prefsFocusTid = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      PREFS_FOCUS_TIMEOUT,
      () => {
        this._prefsFocusTid = null;
        this._cancelWatch();
        return GLib.SOURCE_REMOVE;
      },
    );

    this.openPreferences();
  }

  _cancelWatch() {
    this._restoreCentering?.();
    if (this._prefsWinSigId !== null) {
      global.display.disconnect(this._prefsWinSigId);
      this._prefsWinSigId = null;
    }
    if (this._prefsFocusTid !== null) {
      GLib.Source.remove(this._prefsFocusTid);
      this._prefsFocusTid = null;
    }
  }

  _shuffleWallpaper() {
    try {
      const cfg = loadConfig();
      getImagesAsync(
        cfg.wall_dirs ?? [DEFAULT_WALL_DIR],
        "A-Z",
        cfg.max_images ?? 0,
        (images) => {
          if (!images.length) {
            Main.notify(_("Wallpaper Picker"), _("No wallpapers found."));
            return;
          }
          setWallpaper(
            images[Math.floor(Math.random() * images.length)],
            cfg.picture_mode ?? "zoom",
          );
        },
      );
    } catch (e) {
      console.error(`[wallpaper-picker] Shuffle failed: ${e.message}`);
    }
  }

  _openWallpapersFolder() {
    try {
      const cfg = loadConfig();
      const dirs = cfg.wall_dirs ?? [DEFAULT_WALL_DIR];
      let folderPath = dirs[0] ?? null;

      const curr = getCurrentWallpaper();
      if (curr) {
        const dirname = Gio.File.new_for_path(curr).get_parent()?.get_path();
        if (dirname) {
          // Boundary check prevents /home/user/Pics matching /home/user/Pictures.
          const isUnder = dirs.some(
            (d) => dirname === d || dirname.startsWith(`${d}/`),
          );
          if (isUnder) folderPath = dirname;
        }
      }

      if (!folderPath) {
        this._openPrefs();
        return;
      }

      const file = Gio.File.new_for_path(folderPath);
      if (!file.query_exists(null)) {
        Main.notify(
          _("Wallpaper Picker"),
          `${_("Folder Not Found")}: ${folderPath}`,
        );
        return;
      }

      Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
    } catch (e) {
      console.error(`[wallpaper-picker] Open folder failed: ${e.message}`);
    }
  }

  disable() {
    this._cancelWatch();
    for (const { obj, id } of this._signalIds ?? []) obj.disconnect(id);
    this._signalIds = null;
    this._button?.destroy();
    this._button = null;
  }
}
