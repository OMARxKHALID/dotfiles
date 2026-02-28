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
const APP_ICON = "emblem-photos-symbolic";

const SMALL_ICON_SIZE = 16;

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
    if (this._button) return;

    this._signalIds = [];
    this._button = new PanelMenu.Button(0.5, _("Wallpaper Picker"), false);

    const box = new St.BoxLayout({
      style_class: "panel-status-menu-box",
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

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
    const menuItems = [
      {
        label: _("Pick Wallpaper"),
        icon: APP_ICON,
        action: () => {
          if (!this._hasValidConfig()) {
            this._promptSettings();
            return;
          }
          this._launchPicker();
        },
      },
      {
        label: _("Shuffle Wallpaper"),
        icon: "media-playlist-shuffle-symbolic",
        action: () => {
          if (!this._hasValidConfig()) {
            this._promptSettings();
            return;
          }
          this._launchPicker(["--shuffle"]);
        },
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

    for (const item of menuItems) {
      if (item.separator) {
        this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        continue;
      }

      const menuItem = new PopupMenu.PopupImageMenuItem(item.label, item.icon);

      const children = menuItem.get_children();
      const iconChild = children.find((c) => c instanceof St.Icon);
      if (iconChild) iconChild.set_icon_size(SMALL_ICON_SIZE);

      const id = menuItem.connect("activate", item.action);
      this._signalIds.push({ obj: menuItem, id });
      this._button.menu.addMenuItem(menuItem);
    }
  }

  _hasValidConfig() {
    const folder = this._getFolderFromConfig();
    return folder !== null && folder !== undefined;
  }

  _promptSettings() {
    Main.notify(
      _("Wallpaper Picker"),
      _("Please open Settings and select your Wallpapers directory first."),
    );
    this._launchPicker(["--settings"]);
  }

  _getBinaryPath() {
    if (GLib.file_test(Paths.LOCAL_BIN, GLib.FileTest.IS_EXECUTABLE))
      return Paths.LOCAL_BIN;
    return GLib.find_program_in_path(BIN_NAME);
  }

  _openWallpapersFolder() {
    let folderPath = this._getFolderFromConfig();

    if (!folderPath) {
      this._promptSettings();
      return;
    }

    let exists = false;
    try {
      const file = Gio.File.new_for_path(folderPath);
      exists = file.query_exists(null);

      if (!exists) {
        Main.notify(
          _("Wallpaper Picker"),
          `${_("Folder Not Found")}: ${folderPath}`,
        );
        return;
      }

      Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
    } catch (e) {
      console.error(`[${BIN_NAME}] Failed to open folder: ${e.message}`);
    }
  }

  _getFolderFromConfig() {
    if (!GLib.file_test(Paths.CONFIG_FILE, GLib.FileTest.EXISTS)) return null;
    try {
      const [success, content] = GLib.file_get_contents(Paths.CONFIG_FILE);
      if (!success) return null;
      const config = JSON.parse(new TextDecoder().decode(content));

      const dirs = config.wall_dirs;
      if (!dirs?.length) return null;

      return dirs[0];
    } catch (e) {
      console.warn(`[${BIN_NAME}] Could not parse config: ${e.message}`);
      return null;
    }
  }

  _launchPicker(args = []) {
    try {
      const binPath = this._getBinaryPath();

      if (!binPath) {
        Main.notify(_("Wallpaper Picker"), _("Application not found."));
        return;
      }

      let env = GLib.get_environ();

      const [, pid] = GLib.spawn_async(
        null,
        [binPath, ...args],
        env,
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null,
      );

      GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (_pid, _status) => {
        GLib.spawn_close_pid(_pid);
      });
    } catch (e) {
      console.error(`[${BIN_NAME}] Launch failed: ${e.message}`);
    }
  }

  disable() {
    for (const { obj, id } of this._signalIds ?? []) obj.disconnect(id);

    this._signalIds = null;
    this._button?.destroy();
    this._button = null;
  }
}
