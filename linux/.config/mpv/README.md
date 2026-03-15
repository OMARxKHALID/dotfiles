# MPV / Celluloid Configuration & Scripts

This folder contains mpv configuration and custom scripts used by both `mpv` and GUI frontends like `Celluloid`.

## Features

### 1. High-Performance Playback (`mpv.conf`)
- **GPU Acceleration**: Uses `gpu-hq` profile for superior scaling and sharp visuals.
- **Hardware Decoding**: Enabled `auto-safe` to minimize CPU usage and battery drain.
- **Improved Caching**: Large 400MiB buffer to prevent stuttering on high-bitrate media.
- **Premium Aesthetics**: Bold, readable subtitle styling with semi-transparent shadows for all environments.
- **ModernX OSC**: Beautifully designed on-screen controller with smooth animations and clean icons.
- **Customized OSD**: Styled with `JetBrainsMono Nerd Font`.

### 2. Auto Subtitle Downloader & Syncer (`autosub.lua`)
This script automatically searches and downloads English subtitles from multiple sources and provides one-click synchronization.

- **Auto Download**: Subtitles are fetched automatically for local videos (>15 mins).
- **Multiple Sources**: Tries 7 providers in order (OpenSubtitles, Addic7ed/Gestdown, Podnapisi, etc.).
- **Auto Sync**: Shift out-of-sync subtitles using `ffsubsync` (via `auditok`).
- **Dynamic Sandbox Escape**: Automatically detects if running in Flatpak and escapes the sandbox via `flatpak-spawn`.
- **Error Logging**: Detailed error reports are saved to `error.txt` in the video's directory if a search or sync fails.

---

## Dependencies
Ensure the following host packages are installed (installation via `pipx` is recommended):

```bash
pipx install subliminal  # Subtitle downloader
pipx install ffsubsync   # Subtitle synchronizer
pipx inject ffsubsync setuptools
```
*Note: `ffmpeg` must be present on your system path.*

---

## Flatpak Overrides (Celluloid specific)
If using Celluloid from Flathub, grant these permissions to allow script execution on the host:

```bash
flatpak override --user --filesystems=home io.github.celluloid_player.Celluloid
flatpak override --user --talk-name=org.freedesktop.Flatpak io.github.celluloid_player.Celluloid
```

---

## Keybindings

| Key | Action |
| --- | --- |
| `b` | **Cycle Source**: Fetch the next provider for the current movie. |
| `Shift + s` | **Auto-Sync**: Perfectly sync the current sub to audio (takes ~1 min). |
| `j` | **Cycle Track**: Cycle through all available subtitles. |
| `[` / `]` | **Speed Control**: Decrease or increase playback speed. |
| `{` | **Reset Speed**: Set playback speed back to 1.0x. |
| `z` / `x` | **Manual Sync**: Shift subtitle timing by +/- 100ms. |
| `Shift + z/x` | **Bulk Sync**: Shift subtitle timing by +/- 1 second. |
| `i` | **Stats Overlay**: Toggle detailed technical performance stats. |
| `s` | **Screenshot**: Capture the screen with subtitles. |
| `c` | **Clean Screenshot**: Capture the video only (no subs/OSD). |
| `Wheel Up/Down`| **Volume**: High-precision volume control (2% steps). |
