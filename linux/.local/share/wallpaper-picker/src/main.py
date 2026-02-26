import sys
import os
import argparse
import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk

from constants import DATA_DIR
from utils import acquire_lock, perform_random_shuffle
from ui import WallpaperPicker

def main():
    parser = argparse.ArgumentParser(description="Wallpaper Picker CLI")
    parser.add_argument("--shuffle", action="store_true", help="Perform a random shuffle and exit")
    parser.add_argument("--settings", action="store_true", help="Launch directly to settings page")
    args = parser.parse_args()

    if args.shuffle:
        perform_random_shuffle()
        sys.exit(0)

    _lock = acquire_lock()
    if not _lock:
        sys.exit(0)

    try:
        os.makedirs(DATA_DIR, exist_ok=True)
    except OSError:
        pass

    start_page = "settings" if args.settings else "grid"
    app = WallpaperPicker(start_page=start_page)
    app.connect("destroy", Gtk.main_quit)
    Gtk.main()

if __name__ == "__main__":
    main()
