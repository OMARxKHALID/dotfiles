import Gio from "gi://Gio";
import GLib from "gi://GLib";
import St from "gi://St";
import Clutter from "gi://Clutter";

import {
  Extension,
  gettext as _,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

const BIN_NAME = "wallpaper-picker";
const APP_ICON = "preferences-desktop-wallpaper-symbolic";
const SMALL_ICON_SIZE = 14;

const Paths = {
  CONFIG_FILE: GLib.build_filenamev([
    GLib.get_user_data_dir(),
    BIN_NAME,
    "config.json",
  ]),
  LOCAL_BIN: GLib.build_filenamev([
    GLib.get_home_dir(),
    ".local",
    "bin",
    BIN_NAME,
  ]),
};

export default class WallpaperPickerExtension extends Extension {
  enable() {
    this._button = new PanelMenu.Button(0.5, _("Wallpaper Picker"), false);

    // Container for centering
    let box = new St.BoxLayout({
      style_class: "panel-status-menu-box",
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    // Main Panel Icon
    const icon = new St.Icon({
      icon_name: APP_ICON,
      style_class: "system-status-icon",
      icon_size: SMALL_ICON_SIZE,
      y_align: Clutter.ActorAlign.CENTER,
    });

    box.add_child(icon);
    this._button.add_child(box);

    this._buildMenu();

    Main.panel.addToStatusArea(this.uuid, this._button);
  }

  _buildMenu() {
    // Menu layout configuration
    const menuItems = [
      {
        label: _("Pick Wallpaper"),
        icon: APP_ICON,
        action: () => this._launchPicker(),
      },
      {
        label: _("Shuffle Wallpaper"),
        icon: "media-playlist-shuffle-symbolic",
        action: () => this._launchPicker(["--shuffle"]),
      },
      { separator: true },
      {
        label: _("Settings"),
        icon: "emblem-system-symbolic",
        action: () => this._launchPicker(["--settings"]),
      },
      {
        label: _("Open Wallpapers Folder"),
        icon: "folder-pictures-symbolic",
        action: () => this._openWallpapersFolder(),
      },
    ];

    menuItems.forEach((item) => {
      if (item.separator) {
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        return;
      }

      const menuItem = new PopupMenu.PopupImageMenuItem(item.label, item.icon);

      // Apply the smaller icon size to the menu items as well
      menuItem.get_child_at_index(0).icon_size = SMALL_ICON_SIZE;

      menuItem.connect("activate", item.action);
      this._button.menu.addMenuItem(menuItem);
    });
  }

  _getBinaryPath() {
    if (GLib.file_test(Paths.LOCAL_BIN, GLib.FileTest.IS_EXECUTABLE)) {
      return Paths.LOCAL_BIN;
    }
    return GLib.find_program_in_path(BIN_NAME);
  }

  _openWallpapersFolder() {
    let folderPath = this._getFolderFromConfig();

    if (!folderPath) {
      const picturesDir =
        GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) ??
        GLib.build_filenamev([GLib.get_home_dir(), "Pictures"]);
      folderPath = GLib.build_filenamev([picturesDir, "Wallpapers"]);
    }

    const file = Gio.File.new_for_path(folderPath);
    if (!file.query_exists(null)) {
      this._notify(_("Folder Not Found"), folderPath);
      return;
    }

    try {
      Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
    } catch (e) {
      this._notify(_("Open Error"), e.message);
    }
  }

  _getFolderFromConfig() {
    if (!GLib.file_test(Paths.CONFIG_FILE, GLib.FileTest.EXISTS)) return null;
    try {
      const [success, content] = GLib.file_get_contents(Paths.CONFIG_FILE);
      if (!success) return null;
      const config = JSON.parse(new TextDecoder().decode(content));
      return config.wall_dirs && config.wall_dirs.length > 0
        ? config.wall_dirs[0]
        : null;
    } catch (e) {
      return null;
    }
  }

  async _launchPicker(args = []) {
    const binPath = this._getBinaryPath();
    if (!binPath) {
      this._notify(
        _("Binary Not Found"),
        _("Install 'wallpaper-picker' to use."),
      );
      return;
    }

    // Build a DESKTOP_STARTUP_ID using the X11 server timestamp from the
    // last user input event. Mutter validates this timestamp server-side
    // to decide whether FSP (Focus Stealing Prevention) applies.
    const timestamp = global.get_current_time();
    const startupId = `wallpaper-picker-${GLib.getpid()}-${timestamp}_TIME${timestamp}`;

    try {
      // SubprocessLauncher allows injecting env vars before the child starts.
      const launcher = new Gio.SubprocessLauncher({
        flags: Gio.SubprocessFlags.NONE,
      });

      // ── Startup notification ─────────────────────────────────────────────
      // GTK3 reads DESKTOP_STARTUP_ID automatically and calls set_startup_id()
      // internally, which sets _NET_STARTUP_ID on the X11 window — the signal
      // Mutter uses to whitelist the window for focus and placement.
      launcher.setenv("DESKTOP_STARTUP_ID", startupId, true);

      // ── Stable backend ───────────────────────────────────────────────────
      // Force X11 so window.move() semantics are consistent across sessions.
      launcher.setenv("GDK_BACKEND", "x11", true);

      // ── Suppress AT-SPI ──────────────────────────────────────────────────
      // The Accessibility Bus creates a secondary D-Bus connection that can
      // cause focus arbitration issues in long-running sessions.
      launcher.setenv("NO_AT_BRIDGE", "1", true);
      launcher.setenv("GTK_A11Y", "none", true);

      const proc = launcher.spawnv([binPath, ...args]);
      await proc.wait_check_async(null);
    } catch (e) {
      if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
        this._notify(_("Launch Error"), e.message);
      }
    }
  }

  _notify(title, message) {
    Main.notify(_("Wallpaper Picker"), `${title}: ${message}`);
  }

  disable() {
    this._button?.destroy();
    this._button = null;
  }
}
