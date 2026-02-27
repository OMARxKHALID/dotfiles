import os

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_WALL_DIRS = [os.path.expanduser("~/Pictures/Wallpapers")]
THUMB_W     = 160
THUMB_H     = 90
COLS        = 3
IMAGE_EXTS  = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".avif")
DATA_DIR    = os.path.expanduser("~/.local/share/wallpaper-picker")
STATS_FILE  = os.path.join(DATA_DIR, "stats.json")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
RUNTIME_DIR = os.environ.get("XDG_RUNTIME_DIR") or os.path.expanduser("~/.cache")
LOCK_FILE   = os.path.join(RUNTIME_DIR, "wallpaper-picker.lock")
WIN_WIDTH   = 600
SCROLL_H    = 420
SEARCH_DEBOUNCE_MS = 150

PICTURE_MODES = {
    "Zoom":    "zoom",
    "Stretch": "stretched",
    "Center":  "centered",
    "Tile":    "wallpaper",
    "Span":    "spanned",
}
PICTURE_MODE_LABELS = list(PICTURE_MODES.keys())

# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

CSS = """
/* ── Design tokens ──────────────────────────────────────────────────────── */
/* bg0:    #1d2021   (deepest background)                                    */
/* bg1:    #282828   (window background)                                     */
/* bg2:    #32302f   (card / raised surface)                                 */
/* bg3:    #3c3836   (borders, subtle dividers)                              */
/* bg4:    #504945   (hover surfaces)                                        */
/*                                                                           */
/* fg0:    #ebdbb2   (primary text)                                          */
/* fg1:    #a89984   (secondary / muted text)                                */
/* fg2:    #928374   (placeholder / disabled text)                           */
/*                                                                           */
/* accent: #fabd2f   (yellow — primary accent)                              */
/* accent-:  #d79921  (yellow dim — hover/active)                           */
/* accent--: #b57614  (yellow dark — pressed)                               */
/*                                                                           */
/* blue:   #83a598   (focus / info)                                         */
/* green:  #b8bb26   (section labels)                                       */
/* red:    #fb4934   (destructive)                                           */
/* ──────────────────────────────────────────────────────────────────────── */

/* Shared radius & transition */
/* --radius-sm: 6px  — inner elements (cards, rows)  */
/* --radius-md: 8px  — buttons, inputs, flowboxchild */
/* --radius-lg: 12px — window                        */

/* ── Window ─────────────────────────────────────────────────────────────── */
window {
    background-color: rgba(40, 40, 40, 0.94);
    border-radius: 12px;
    border: 1px solid rgba(60, 56, 54, 0.6);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.header-box {
    padding: 12px 14px 8px 14px;
}

.header {
    font-size: 16px;
    font-weight: 800;
    color: #fabd2f;
}

/* ── Flowbox / thumbnails ───────────────────────────────────────────────── */
flowbox {
    margin: 12px 10px 12px 9px;
}

flowboxchild {
    padding: 0;
    margin: 6px;
    border-radius: 8px;
    border: 3px solid transparent;
    background-color: transparent;
    transition: border-color 0.15s ease, background-color 0.15s ease;
}

flowboxchild:focus,
flowboxchild:selected {
    outline: 2px dashed #83a598;
    outline-offset: 2px;
    border-color: transparent;
}

flowboxchild:hover {
    border-color: #d79921;
}

/* Active wallpaper */
flowboxchild.active {
    border-color: #fabd2f;
    background-color: rgba(250, 189, 47, 0.08);
}

flowboxchild.active:focus,
flowboxchild.active:hover {
    border-color: #fabd2f;
    background-color: rgba(250, 189, 47, 0.18);
}

/* ── Card ───────────────────────────────────────────────────────────────── */
.card {
    background-color: rgba(50, 48, 47, 0.92);
    padding: 6px;
    border-radius: 6px;
    border: 1px solid rgba(60, 56, 54, 0.5);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.25);
}

.card label {
    color: #ebdbb2;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 2px 2px 2px;
}

/* ── Inputs ─────────────────────────────────────────────────────────────── */
entry,
combobox button,
spinbutton {
    background-color: rgba(29, 32, 33, 0.90);
    color: #ebdbb2;
    border: 1px solid rgba(60, 56, 54, 0.6);
    border-radius: 8px;
    font-size: 12px;
    min-height: 30px;
    box-shadow: none;
    transition: border-color 0.15s ease, background-color 0.15s ease;
}

entry {
    padding: 0 12px;
}

entry:focus,
combobox button:hover,
spinbutton:focus {
    border-color: #83a598;
    background-color: rgba(40, 40, 40, 0.92);
}

/* Combobox */
combobox button {
    padding: 0 12px;
}

/* Spinbutton internals */
spinbutton entry {
    background-color: transparent;
    border: none;
    box-shadow: none;
    color: #ebdbb2;
    font-size: 12px;
    padding: 0 8px;
}

spinbutton entry:focus {
    background-color: transparent;
    border-color: transparent;
}

spinbutton button {
    background-color: #3c3836;
    color: #a89984;
    border: none;
    border-left: 1px solid #282828;
    border-radius: 0;
    box-shadow: none;
    min-width: 24px;
    transition: color 0.15s ease, background-color 0.15s ease;
}

spinbutton button:last-child {
    border-top-right-radius: 7px;
    border-bottom-right-radius: 7px;
}

spinbutton button:hover {
    background-color: #504945;
    color: #ebdbb2;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

/* Settings / icon button */
.icon-btn {
    background-color: rgba(60, 56, 54, 0.92);
    border: 1px solid rgba(80, 73, 69, 0.6);
    border-radius: 8px;
    font-size: 16px;
    min-height: 28px;
    min-width: 32px;
    padding: 0 8px;
    box-shadow: none;
    transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.icon-btn:hover {
    background-color: rgba(80, 73, 69, 0.8);
    color: #ebdbb2;
    border-color: #83a598;
}

/* Shuffle / primary action button */
.shuffle-btn {
    background-color: rgba(60, 56, 54, 0.92);
    color: #ebdbb2;
    border: 1px solid rgba(80, 73, 69, 0.6);
    border-radius: 8px;
    font-size: 13px;
    font-weight: bold;
    min-height: 28px;
    padding: 0 14px;
    margin-right: 8px;
    box-shadow: none;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.shuffle-btn:hover {
    background-color: rgba(80, 73, 69, 0.8);
    color: #ebdbb2;
    border-color: #83a598;
}

.shuffle-btn:active,
.shuffle-btn:backdrop,
.back-btn:active,
.back-btn:backdrop {
    background-color: rgba(50, 48, 47, 0.6);
    border-color: rgba(60, 56, 54, 0.5);
}

.back-btn {
    background-color: rgba(60, 56, 54, 0.92);
    color: #ebdbb2;
    border: 1px solid rgba(80, 73, 69, 0.6);
    border-radius: 8px;
    font-size: 13px;
    font-weight: bold;
    min-height: 28px;
    padding: 0 14px;
    margin-right: 8px;
    box-shadow: none;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.back-btn:hover {
    background-color: rgba(80, 73, 69, 0.8);
    color: #ebdbb2;
    border-color: #83a598;
}

/* ── Empty state ────────────────────────────────────────────────────────── */
.empty-box {
    padding: 60px 40px;
}

.empty-icon {
    color: rgba(250, 189, 47, 0.4);
    margin-bottom: 20px;
}

.empty-title {
    color: #ebdbb2;
    font-size: 18px;
    font-weight: 800;
    margin-bottom: 8px;
}

.empty-subtitle {
    color: #a89984;
    font-size: 13px;
    font-weight: 500;
}

.empty-hint {
    color: #fabd2f;
    font-size: 12px;
    font-weight: 700;
    margin-top: 24px;
    padding: 6px 16px;
    background-color: rgba(250, 189, 47, 0.1);
    border-radius: 20px;
}

/* ── Settings page ──────────────────────────────────────────────────────── */
.settings-section-label {
    color: #b8bb26;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.5px;
    padding: 18px 16px 6px 16px;
}

.settings-row {
    padding: 10px 16px;
    margin: 4px 16px;
    background-color: rgba(40, 40, 40, 0.3);
    border-radius: 8px;
}

.settings-hint {
    color: #928374;
    font-size: 11px;
    padding: 0 16px 8px 16px;
}

.settings-label {
    color: #a89984;
    font-size: 13px;
    font-weight: 500;
}

.separator-line {
    background-color: #3c3836;
    min-height: 1px;
    margin: 12px 16px;
}

/* ── Directory rows ─────────────────────────────────────────────────────── */
.dir-row {
    background-color: rgba(50, 48, 47, 0.92);
    border-radius: 8px;
    padding: 6px 12px;
    margin: 4px 16px;
    border: 1px solid rgba(60, 56, 54, 0.5);
}

.dir-row-label {
    color: #ebdbb2;
    font-size: 12px;
}

.dir-remove-btn {
    background-color: transparent;
    color: #928374;
    border: none;
    font-size: 16px;
    font-weight: bold;
    min-width: 28px;
    min-height: 28px;
    padding: 0 4px;
    box-shadow: none;
    transition: color 0.15s ease;
}

.dir-remove-btn:hover {
    color: #fb4934;
}

.add-dir-btn {
    background-color: transparent;
    color: #83a598;
    border: 1px dashed rgba(131, 165, 152, 0.45);
    border-radius: 8px;
    font-size: 13px;
    font-weight: bold;
    min-height: 36px;
    padding: 0 16px;
    margin: 8px 16px 4px 16px;
    box-shadow: none;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.add-dir-btn:hover {
    background-color: rgba(131, 165, 152, 0.12);
    border-color: #83a598;
    color: #ebdbb2;
}
"""
