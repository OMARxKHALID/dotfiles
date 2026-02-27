import os
import shutil
import json
import time
import random
import fcntl
import subprocess
import threading
import hashlib
from urllib.parse import unquote, urlparse

import gi
gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
gi.require_version("GdkPixbuf", "2.0")
from gi.repository import Gio, GLib, GdkPixbuf

from constants import (
    DATA_DIR, STATS_FILE, CONFIG_FILE, LOCK_FILE, RUNTIME_DIR,
    IMAGE_EXTS, PICTURE_MODES, DEFAULT_WALL_DIRS,
    THUMB_CACHE_DIR, THUMB_W, THUMB_H, FAVORITES_FILE
)

_stats_lock = threading.Lock()

try:
    _bg_settings = Gio.Settings.new("org.gnome.desktop.background")
except Exception:
    _bg_settings = None

# ---------------------------------------------------------------------------
# GSettings logic
# ---------------------------------------------------------------------------

def get_current_wallpaper():
    if _bg_settings is None:
        return ""
    try:
        uri = (_bg_settings.get_string("picture-uri-dark")
               or _bg_settings.get_string("picture-uri"))
        if not uri:
            return ""
        return os.path.abspath(unquote(urlparse(uri).path))
    except Exception:
        return ""


def set_wallpaper(path, mode="zoom"):
    if _bg_settings is None:
        return
    if not os.path.isfile(path):
        return
    try:
        uri = GLib.filename_to_uri(path)
        _bg_settings.set_string("picture-uri", uri)
        _bg_settings.set_string("picture-uri-dark", uri)
        _bg_settings.set_string("picture-options", mode)
    except Exception:
        pass
    _record_use(path)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def _normalise_stats(raw):
    out = {}
    for k, v in raw.items():
        if isinstance(v, dict):
            out[k] = {"count": v.get("count", 0), "last_used": v.get("last_used", 0.0)}
        else:
            out[k] = {"count": int(v), "last_used": 0.0}
    return out


def _load_stats():
    try:
        with open(STATS_FILE, "r") as f:
            return _normalise_stats(json.load(f))
    except (OSError, json.JSONDecodeError, ValueError):
        return {}


def _record_use(path):
    fname = os.path.basename(path)
    def _work():
        with _stats_lock:
            stats = _load_stats()
            entry = stats.get(fname, {"count": 0, "last_used": 0.0})
            entry["count"]    += 1
            entry["last_used"] = time.time()
            stats[fname] = entry
            try:
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(STATS_FILE, "w") as f:
                    json.dump(stats, f)
            except OSError:
                pass
    threading.Thread(target=_work, daemon=True).start()


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _load_config():
    try:
        with open(CONFIG_FILE, "r") as f:
            raw = json.load(f)
        if "wall_dir" in raw and "wall_dirs" not in raw:
            raw["wall_dirs"] = [raw.pop("wall_dir")]
        return raw
    except (OSError, json.JSONDecodeError, ValueError):
        return {}


def _save_config(config):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------

def load_favorites():
    try:
        with open(FAVORITES_FILE, "r") as f:
            return set(json.load(f))
    except (OSError, json.JSONDecodeError):
        return set()

def save_favorites(fav_set):
    try:
        os.makedirs(os.path.dirname(FAVORITES_FILE), exist_ok=True)
        with open(FAVORITES_FILE, "w") as f:
            json.dump(list(fav_set), f)
    except OSError:
        pass

# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def get_images(wall_dirs, sort_mode="Most Used", max_images=0):
    all_paths = []
    seen_names = set()
    for d in wall_dirs:
        if not os.path.isdir(d):
            continue
        try:
            for fname in os.listdir(d):
                if not fname.lower().endswith(IMAGE_EXTS):
                    continue
                if fname in seen_names:
                    continue
                seen_names.add(fname)
                all_paths.append(os.path.join(d, fname))
        except OSError:
            continue

    favs = load_favorites()

    if sort_mode == "Starred":
        favs = load_favorites()
        all_paths = [p for p in all_paths if os.path.basename(p) in favs]
        all_paths.sort(key=lambda p: os.path.basename(p).lower())
    elif sort_mode == "Newest":
        all_paths.sort(key=_safe_mtime, reverse=True)
    elif sort_mode == "Most Used":
        stats = _load_stats()
        all_paths.sort(
            key=lambda p: stats.get(os.path.basename(p), {}).get("count", 0),
            reverse=True,
        )
    elif sort_mode == "Recent":
        stats = _load_stats()
        all_paths.sort(
            key=lambda p: stats.get(os.path.basename(p), {}).get("last_used", 0.0),
            reverse=True,
        )
    else:
        all_paths.sort(key=lambda p: os.path.basename(p).lower())

    if max_images > 0:
        all_paths = all_paths[:max_images]

    return all_paths


def _safe_mtime(path):
    try:
        return os.path.getmtime(path)
    except OSError:
        return 0.0


def _make_display_name(fname, max_len=20):
    name = os.path.splitext(fname)[0].replace("-", " ").replace("_", " ").strip()
    if len(name) > max_len:
        name = name[:max_len].rstrip() + "\u2026"
    return name


def _shorten_path(path):
    home = os.path.expanduser("~")
    if path == home or path.startswith(home + os.sep):
        return "~" + path[len(home):]
    return path


def acquire_lock():
    try:
        os.makedirs(RUNTIME_DIR, exist_ok=True)
        fd = open(LOCK_FILE, "a")
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return fd
    except OSError:
        return None

def reveal_in_fm(folder):
    try:
        subprocess.Popen(["xdg-open", folder])
    except Exception:
        pass

def perform_random_shuffle():
    """Performs a headless wallpaper shuffle based on current config."""
    config = _load_config()
    wall_dirs = config.get("wall_dirs") or DEFAULT_WALL_DIRS
    mode = config.get("picture_mode", "zoom")

    images = get_images(wall_dirs, sort_mode="A-Z")
    if not images:
        return False

    choice = random.choice(images)
    set_wallpaper(choice, mode)
    return True

def get_thumbnail(image_path):
    """
    Returns the path to a cached thumbnail.
    Creates the thumbnail if it doesn't exist or is outdated.
    """
    try:
        os.makedirs(THUMB_CACHE_DIR, exist_ok=True)

        # 1. Create a unique filename based on the full path
        path_hash = hashlib.md5(image_path.encode()).hexdigest()
        thumb_path = os.path.join(THUMB_CACHE_DIR, f"{path_hash}.png")

        # 2. Check if cache is valid (exists and is newer than original)
        if os.path.exists(thumb_path):
            if os.path.getmtime(thumb_path) >= os.path.getmtime(image_path):
                return thumb_path

        # 3. Not in cache? Generate it.
        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
            image_path, THUMB_W, THUMB_H, False)

        pixbuf.savev(thumb_path, "png", [], [])
        return thumb_path

    except Exception:
        return image_path  # Fallback to original image on error

def get_cache_info():
    """Returns (total_size_bytes, file_count) for the thumbnail cache."""
    total_size = 0
    count = 0
    if os.path.isdir(THUMB_CACHE_DIR):
        for entry in os.scandir(THUMB_CACHE_DIR):
            if entry.is_file():
                total_size += entry.stat().st_size
                count += 1
    return total_size, count

def clear_cache():
    """Deletes all files in the thumbnail cache directory."""
    if os.path.exists(THUMB_CACHE_DIR):
        try:
            shutil.rmtree(THUMB_CACHE_DIR)
            os.makedirs(THUMB_CACHE_DIR, exist_ok=True)
            return True
        except OSError:
            return False
    return True

def get_image_info(path):
    """Returns a string description of image metadata (Resolution and Size)."""
    try:
        # File Size
        size_bytes = os.path.getsize(path)
        if size_bytes > 1024 * 1024:
            size_str = f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            size_str = f"{size_bytes / 1024:.0f} KB"

        # Resolution (Pixbuf can read header info without full decoding)
        info = GdkPixbuf.Pixbuf.get_file_info(path)
        if info:
            res_str = f"{info[1]}x{info[2]}"
        else:
            res_str = "???"

        return f"{res_str} | {size_str}"
    except Exception:
        return "Unknown"
