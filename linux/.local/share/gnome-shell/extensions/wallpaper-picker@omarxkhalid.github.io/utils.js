// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GdkPixbuf from "gi://GdkPixbuf";

const APP_NAME = "wallpaper-picker";

export const DATA_DIR = GLib.build_filenamev([
  GLib.get_user_data_dir(),
  APP_NAME,
]);
export const CONFIG_FILE = GLib.build_filenamev([DATA_DIR, "config.json"]);
export const STATS_FILE = GLib.build_filenamev([DATA_DIR, "stats.json"]);
export const FAVORITES_FILE = GLib.build_filenamev([
  DATA_DIR,
  "favorites.json",
]);
export const THUMB_CACHE_DIR = GLib.build_filenamev([
  GLib.get_user_cache_dir(),
  APP_NAME,
  "thumbnails",
]);

export const THUMB_W = 190;
export const THUMB_H = 103;
export const SEARCH_DEBOUNCE_MS = 150;

export const IMAGE_EXTS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".bmp",
  ".tiff",
  ".tif",
  ".avif",
];

export const DEFAULT_WALL_DIR = GLib.build_filenamev([
  GLib.get_home_dir(),
  "Pictures",
  "Wallpapers",
]);

export const PICTURE_MODES = {
  Zoom: "zoom",
  Stretch: "stretched",
  Center: "centered",
  Tile: "wallpaper",
  Span: "spanned",
};
export const PICTURE_MODE_LABELS = Object.keys(PICTURE_MODES);
export const PICTURE_MODE_REVERSE = Object.fromEntries(
  Object.entries(PICTURE_MODES).map(([k, v]) => [v, k]),
);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function loadConfig() {
  try {
    const [ok, bytes] = GLib.file_get_contents(CONFIG_FILE);
    if (!ok) return {};
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if ("wall_dir" in raw && !("wall_dirs" in raw))
      raw.wall_dirs = [raw.wall_dir]; // migrate legacy single-dir key
    return raw;
  } catch (e) {
    console.debug(`[${APP_NAME}] loadConfig: ${e.message}`);
    return {};
  }
}

async function saveFileAsync(path, contents) {
  try {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755);
    const file = Gio.File.new_for_path(path);
    return new Promise((resolve, reject) => {
      file.replace_contents_async(
        contents,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
        (f, res) => {
          try {
            f.replace_contents_finish(res);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      );
    });
  } catch (e) {
    console.error(`[${APP_NAME}] saveFileAsync ${path}: ${e.message}`);
  }
}

export function saveConfig(cfg) {
  saveFileAsync(
    CONFIG_FILE,
    new TextEncoder().encode(JSON.stringify(cfg, null, 2)),
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

// In-memory cache — avoids re-reading the file on every wallpaper apply.
let _statsCache = null;

function _normaliseStats(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "object" && v !== null) {
      out[k] = {
        count: v.count ?? 0,
        last_used: v.last_used ?? 0.0,
        res: v.res ?? null,
        size: v.size ?? null,
        mtime: v.mtime ?? 0,
      };
    } else {
      out[k] = {
        count: Number(v) || 0,
        last_used: 0.0,
        res: null,
        size: null,
        mtime: 0,
      };
    }
  }
  return out;
}

export function loadStats() {
  if (_statsCache) return _statsCache;
  try {
    const [ok, bytes] = GLib.file_get_contents(STATS_FILE);
    _statsCache = ok
      ? _normaliseStats(JSON.parse(new TextDecoder().decode(bytes)))
      : {};
  } catch (e) {
    console.debug(`[${APP_NAME}] loadStats: ${e.message}`);
    _statsCache = {};
  }
  return _statsCache;
}

let _saveTid = null;
function _saveStats() {
  if (!_statsCache) return;
  if (_saveTid) return;

  // Debounce saving to 2 seconds to batch metadata updates during scrolling/hovering.
  _saveTid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
    _saveTid = null;
    saveFileAsync(
      STATS_FILE,
      new TextEncoder().encode(JSON.stringify(_statsCache)),
    );
    return GLib.SOURCE_REMOVE;
  });
}

export function flushStats() {
  if (!_saveTid || !_statsCache) return;
  GLib.Source.remove(_saveTid);
  _saveTid = null;
  try {
    GLib.mkdir_with_parents(GLib.path_get_dirname(STATS_FILE), 0o755);
    GLib.file_set_contents(
      STATS_FILE,
      new TextEncoder().encode(JSON.stringify(_statsCache)),
    );
  } catch (e) {
    console.error(`[${APP_NAME}] flushStats: ${e.message}`);
  }
}

export function recordUse(path) {
  try {
    const stats = loadStats();
    const fname = GLib.path_get_basename(path);
    const entry = stats[fname] ?? {
      count: 0,
      last_used: 0.0,
      res: null,
      size: null,
    };
    entry.count += 1;
    entry.last_used = GLib.get_real_time() / 1_000_000;
    stats[fname] = entry;

    _saveStats();
  } catch (e) {
    console.error(`[${APP_NAME}] recordUse: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export function loadFavorites() {
  try {
    const [ok, bytes] = GLib.file_get_contents(FAVORITES_FILE);
    if (!ok) return new Set();
    return new Set(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) {
    console.debug(`[${APP_NAME}] loadFavorites: ${e.message}`);
    return new Set();
  }
}

export function saveFavorites(favSet) {
  saveFileAsync(
    FAVORITES_FILE,
    new TextEncoder().encode(JSON.stringify([...favSet])),
  );
}

// ---------------------------------------------------------------------------
// Wallpaper (GSettings)
// ---------------------------------------------------------------------------

function _bgSettings() {
  return new Gio.Settings({ schema_id: "org.gnome.desktop.background" });
}

function _colorScheme() {
  try {
    return new Gio.Settings({
      schema_id: "org.gnome.desktop.interface",
    }).get_string("color-scheme");
  } catch (_) {
    return "default";
  }
}

export function getCurrentWallpaper() {
  try {
    const s = _bgSettings();
    const key =
      _colorScheme() === "prefer-dark" ? "picture-uri-dark" : "picture-uri";
    const uri = s.get_string(key) || s.get_string("picture-uri");
    if (!uri) return "";
    const [path] = GLib.filename_from_uri(uri);
    return path ?? "";
  } catch (e) {
    console.debug(`[${APP_NAME}] getCurrentWallpaper: ${e.message}`);
    return "";
  }
}

export function setWallpaper(path, mode = "zoom") {
  try {
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(null)) return;
    const s = _bgSettings();
    const uri = file.get_uri();
    s.set_string("picture-uri", uri);
    s.set_string("picture-uri-dark", uri);
    s.set_string("picture-options", mode);
    recordUse(path);
  } catch (e) {
    console.error(`[${APP_NAME}] setWallpaper: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Image scanning
// ---------------------------------------------------------------------------

export function getImagesAsync(
  wallDirs,
  sortMode = "Most Used",
  maxImages = 0,
  callback,
) {
  const allFiles = [];
  // Keyed by full path so two files with the same name in different dirs are both included.
  const seen = new Set();
  const dirs = [...wallDirs];

  function processNextDir() {
    if (dirs.length === 0) {
      finalize();
      return;
    }

    const dir = dirs.shift();
    try {
      const d = Gio.File.new_for_path(dir);
      if (!d.query_exists(null)) {
        processNextDir();
        return;
      }

      d.enumerate_children_async(
        "standard::name,time::modified",
        Gio.FileQueryInfoFlags.NONE,
        GLib.PRIORITY_DEFAULT,
        null,
        (source, res) => {
          let iter;
          try {
            iter = source.enumerate_children_finish(res);
          } catch (e) {
            console.debug(`[${APP_NAME}] enumerate ${dir}: ${e.message}`);
            processNextDir();
            return;
          }

          function nextBatch() {
            iter.next_files_async(
              50,
              GLib.PRIORITY_DEFAULT,
              null,
              (it, res2) => {
                try {
                  const files = it.next_files_finish(res2);
                  if (files.length === 0) {
                    it.close(null);
                    processNextDir();
                    return;
                  }

                  for (const info of files) {
                    const name = info.get_name();
                    if (!IMAGE_EXTS.some((e) => name.toLowerCase().endsWith(e)))
                      continue;
                    const path = GLib.build_filenamev([dir, name]);
                    if (seen.has(path)) continue;
                    seen.add(path);
                    const mtime =
                      info.get_modification_date_time()?.to_unix() ?? 0;
                    allFiles.push({ path, name, mtime });
                  }

                  GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    nextBatch();
                    return GLib.SOURCE_REMOVE;
                  });
                } catch (e) {
                  console.debug(`[${APP_NAME}] nextBatch ${dir}: ${e.message}`);
                  processNextDir();
                }
              },
            );
          }
          nextBatch();
        },
      );
    } catch (e) {
      console.debug(`[${APP_NAME}] processNextDir ${dir}: ${e.message}`);
      processNextDir();
    }
  }

  function finalize() {
    const lower = (f) => f.name.toLowerCase();
    let filtered = allFiles;

    if (sortMode === "Starred") {
      const favs = loadFavorites();
      filtered = allFiles.filter((f) => favs.has(f.name));
      filtered.sort((a, b) => lower(a).localeCompare(lower(b)));
    } else if (sortMode === "Newest") {
      filtered.sort((a, b) => b.mtime - a.mtime);
    } else if (sortMode === "Most Used") {
      const stats = loadStats();
      filtered.sort(
        (a, b) => (stats[b.name]?.count ?? 0) - (stats[a.name]?.count ?? 0),
      );
    } else if (sortMode === "Recent") {
      const stats = loadStats();
      filtered.sort(
        (a, b) =>
          (stats[b.name]?.last_used ?? 0) - (stats[a.name]?.last_used ?? 0),
      );
    } else {
      filtered.sort((a, b) => lower(a).localeCompare(lower(b)));
    }

    const result = filtered.map((f) => f.path);
    callback(maxImages > 0 ? result.slice(0, maxImages) : result);
  }

  processNextDir();
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

export async function getThumbnailAsync(imagePath) {
  const hash = GLib.compute_checksum_for_string(
    GLib.ChecksumType.MD5,
    imagePath,
    -1,
  );
  const thumbPath = GLib.build_filenamev([THUMB_CACHE_DIR, `${hash}.png`]);
  const thumbFile = Gio.File.new_for_path(thumbPath);
  const origFile = Gio.File.new_for_path(imagePath);

  try {
    if (thumbFile.query_exists(null)) {
      const tInfo = thumbFile.query_info(
        "time::modified",
        Gio.FileQueryInfoFlags.NONE,
        null,
      );
      const oInfo = origFile.query_info(
        "time::modified",
        Gio.FileQueryInfoFlags.NONE,
        null,
      );
      const tTime = tInfo.get_modification_date_time()?.to_unix() ?? 0;
      const oTime = oInfo.get_modification_date_time()?.to_unix() ?? 0;
      if (tTime >= oTime) return thumbPath;
    }
  } catch (_) {}

  return new Promise((resolve) => {
    GLib.mkdir_with_parents(THUMB_CACHE_DIR, 0o755);
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      try {
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
          imagePath,
          THUMB_W,
          THUMB_H,
          false,
        );
        pixbuf.savev(thumbPath, "png", [], []);
        resolve(thumbPath);
      } catch (e) {
        console.debug(
          `[${APP_NAME}] getThumbnailAsync ${imagePath}: ${e.message}`,
        );
        resolve(imagePath);
      }
      return GLib.SOURCE_REMOVE;
    });
  });
}

export function getImageInfo(path) {
  const fname = GLib.path_get_basename(path);
  try {
    const stats = loadStats();
    let entry = stats[fname];

    const file = Gio.File.new_for_path(path);
    const info = file.query_info(
      "standard::size,time::modified",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );
    const mtime = info.get_modification_date_time()?.to_unix() ?? 0;

    // Return cached metadata if available and mtime matches
    if (entry?.res && entry?.size && entry?.mtime === mtime)
      return `${entry.res} | ${entry.size}`;

    const size = info.get_size();
    const sizeStr =
      size > 1_048_576
        ? `${(size / 1_048_576).toFixed(1)} MB`
        : `${Math.round(size / 1024)} KB`;

    const pbInfo = GdkPixbuf.Pixbuf.get_file_info(path);
    const res = pbInfo ? `${pbInfo[1]}×${pbInfo[2]}` : "???";

    const result = `${res} | ${sizeStr}`;

    // Update cache
    if (!entry) {
      entry = stats[fname] = { count: 0, last_used: 0 };
    }
    entry.res = res;
    entry.size = sizeStr;
    entry.mtime = mtime;

    _saveStats();

    return result;
  } catch (e) {
    console.debug(`[${APP_NAME}] getImageInfo ${fname}: ${e.message}`);
    return "Unknown";
  }
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

export function getCacheInfoAsync(callback) {
  let totalSize = 0,
    count = 0;
  try {
    const dir = Gio.File.new_for_path(THUMB_CACHE_DIR);
    if (!dir.query_exists(null)) {
      callback({ totalSize, count });
      return;
    }

    dir.enumerate_children_async(
      "standard::size",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (source, res) => {
        let iter;
        try {
          iter = source.enumerate_children_finish(res);
        } catch (_) {
          callback({ totalSize, count });
          return;
        }

        const nextBatch = () => {
          iter.next_files_async(50, GLib.PRIORITY_DEFAULT, null, (it, res2) => {
            try {
              const files = it.next_files_finish(res2);
              if (files.length === 0) {
                it.close(null);
                callback({ totalSize, count });
                return;
              }
              for (const info of files) {
                totalSize += info.get_size();
                count++;
              }
              GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                nextBatch();
                return GLib.SOURCE_REMOVE;
              });
            } catch (_) {
              callback({ totalSize, count });
            }
          });
        };
        nextBatch();
      },
    );
  } catch (e) {
    console.debug(`[${APP_NAME}] getCacheInfoAsync: ${e.message}`);
    callback({ totalSize, count });
  }
}

export function clearCacheAsync(callback) {
  try {
    const dir = Gio.File.new_for_path(THUMB_CACHE_DIR);
    if (!dir.query_exists(null)) {
      callback?.(true);
      return;
    }

    dir.enumerate_children_async(
      "standard::name",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (source, res) => {
        let iter;
        try {
          iter = source.enumerate_children_finish(res);
        } catch (_) {
          callback?.(false);
          return;
        }

        const nextBatch = () => {
          iter.next_files_async(50, GLib.PRIORITY_DEFAULT, null, (it, res2) => {
            try {
              const files = it.next_files_finish(res2);
              if (files.length === 0) {
                it.close(null);
                callback?.(true);
                return;
              }

              // delete_async avoids blocking the main thread per file.
              let pending = files.length;
              for (const info of files) {
                const child = dir.get_child(info.get_name());
                child.delete_async(
                  GLib.PRIORITY_DEFAULT,
                  null,
                  (_f, delRes) => {
                    try {
                      _f.delete_finish(delRes);
                    } catch (_) {}
                    if (--pending === 0)
                      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        nextBatch();
                        return GLib.SOURCE_REMOVE;
                      });
                  },
                );
              }
            } catch (e) {
              console.debug(
                `[${APP_NAME}] clearCacheAsync batch: ${e.message}`,
              );
              callback?.(false);
            }
          });
        };
        nextBatch();
      },
    );
  } catch (e) {
    console.debug(`[${APP_NAME}] clearCacheAsync: ${e.message}`);
    callback?.(false);
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function makeDisplayName(fname, maxLen = 20) {
  let name = fname
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .trim();
  if (name.length > maxLen) name = `${name.substring(0, maxLen).trimEnd()}…`;
  return name;
}

export function shortenPath(path) {
  const home = GLib.get_home_dir();
  if (path === home || path.startsWith(`${home}/`))
    return `~${path.substring(home.length)}`;
  return path;
}

/**
 * A simple fuzzy match that checks if characters appear in order.
 * Returns true if match, false otherwise.
 */
export function fuzzyMatch(query, text) {
  if (!query) return true;
  if (!text) return false;
  let i = 0,
    j = 0;
  while (i < query.length && j < text.length) {
    if (query[i] === text[j]) i++;
    j++;
  }
  return i === query.length;
}
