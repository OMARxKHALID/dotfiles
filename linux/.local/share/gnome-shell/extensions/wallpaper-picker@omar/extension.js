import Gio from "gi://Gio";
import GLib from "gi://GLib";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

const WALL_DIR = GLib.build_filenamev([
  GLib.get_home_dir(),
  "Pictures",
  "Wallpapers",
  "fav",
]);
const COLS = 3;
const ICON_SIZE = 100;
const IMAGE_EXTS = /\.(jpe?g|png|webp|bmp)$/i;

export default class WallpaperPickerExtension extends Extension {
  enable() {
    this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

    const icon = new St.Icon({
      icon_name: "preferences-desktop-wallpaper-symbolic",
      style_class: "system-status-icon",
    });
    this._indicator.add_child(icon);

    this._indicator.menu.connect("open-state-changed", (_menu, open) => {
      if (open) this._buildMenu();
    });

    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  _getCurrentUri() {
    const s = new Gio.Settings({ schema_id: "org.gnome.desktop.background" });
    return s.get_string("picture-uri-dark") || s.get_string("picture-uri");
  }

  _setWallpaper(path) {
    const uri = `file://${path}`;
    const s = new Gio.Settings({ schema_id: "org.gnome.desktop.background" });
    s.set_string("picture-uri", uri);
    s.set_string("picture-uri-dark", uri);
  }

  _getImages() {
    const dir = Gio.File.new_for_path(WALL_DIR);
    if (!dir.query_exists(null)) return [];

    const images = [];
    const iter = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );
    let info;
    while ((info = iter.next_file(null)) !== null) {
      if (info.get_file_type() !== Gio.FileType.REGULAR) continue;
      const name = info.get_name();
      if (IMAGE_EXTS.test(name)) images.push(name);
    }
    return images.sort();
  }

  _buildMenu() {
    this._indicator.menu.removeAll();

    const images = this._getImages();
    if (images.length === 0) {
      this._indicator.menu.addMenuItem(
        new PopupMenu.PopupMenuItem("No wallpapers found"),
      );
      return;
    }

    const currentUri = this._getCurrentUri();

    // Each row is a PopupBaseMenuItem with a horizontal box of buttons.
    // PopupMenu handles overflow scrolling natively.
    for (let i = 0; i < images.length; i += COLS) {
      const chunk = images.slice(i, i + COLS);

      const menuItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
      });

      const row = new St.BoxLayout({
        style_class: "wallpaper-row",
        x_expand: true,
      });
      menuItem.add_child(row);

      for (const name of chunk) {
        const path = GLib.build_filenamev([WALL_DIR, name]);
        const isActive = `file://${path}` === currentUri;

        const btn = new St.Button({
          style_class: `wallpaper-thumb${isActive ? " active" : ""}`,
          can_focus: true,
          reactive: true,
          x_expand: true,
        });

        btn.set_child(
          new St.Icon({
            gicon: Gio.Icon.new_for_string(path),
            icon_size: ICON_SIZE,
          }),
        );

        btn.connect("clicked", () => {
          this._setWallpaper(path);
          this._indicator.menu.close();
        });

        row.add_child(btn);
      }

      this._indicator.menu.addMenuItem(menuItem);
    }
  }

  disable() {
    this._indicator?.destroy();
    this._indicator = null;
  }
}
