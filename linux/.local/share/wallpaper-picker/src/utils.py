import os
import json
import time
import random
import fcntl
import subprocess
import threading
from urllib.parse import unquote, urlparse

import gi
gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gio, GLib

from constants import (
    DATA_DIR, STATS_FILE, CONFIG_FILE, LOCK_FILE, RUNTIME_DIR,
    IMAGE_EXTS, PICTURE_MODES, DEFAULT_WALL_DIRS
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

    if sort_mode == "Newest":
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
