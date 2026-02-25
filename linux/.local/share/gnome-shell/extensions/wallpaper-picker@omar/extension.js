import Gio from "gi://Gio";
import GLib from "gi://GLib";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as Util from "resource:///org/gnome/shell/misc/util.js";

const PICKER_BIN = GLib.build_filenamev([
  GLib.get_home_dir(),
  ".local",
  "bin",
  "wallpaper-picker",
]);

export default class WallpaperPickerExtension extends Extension {
  enable() {
    this._button = new PanelMenu.Button(0.0, "Wallpaper Picker", false);

    const icon = new St.Icon({
      icon_name: "preferences-desktop-wallpaper-symbolic",
      style_class: "system-status-icon",
    });
    this._button.add_child(icon);

    this._button.connect("button-press-event", () => {
      try {
        Util.trySpawnCommandLine(PICKER_BIN);
      } catch (e) {
        Main.notifyError("Wallpaper Picker", e.message);
      }
    });

    Main.panel.addToStatusArea("wallpaper-picker", this._button, 1, "right");
  }

  disable() {
    if (this._button) {
      this._button.destroy();
      this._button = null;
    }
  }
}
