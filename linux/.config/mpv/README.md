# MPV / Celluloid Configuration & Scripts

This folder contains mpv configuration and custom scripts used by both `mpv` and GUI frontends like `Celluloid`.

## Auto Subtitle Downloader & Syncer (`autosub.lua`)

This script automatically searches and downloads English subtitles for the currently playing video file from multiple sources. It also features a hotkey to auto-sync out-of-sync subtitles using `ffsubsync` (via `auditok`).

### Features
1. **Auto Download**: Subtitles are fetched automatically when you play a local video file (longer than 15 minutes).
2. **Multiple Sources**: It tries 7 sources in order (e.g., opensubtitles, gestdown, tvsubtitles, podnapisi, etc.). It downloads only one source at a time.
3. **Auto Sync**: If a downloaded subtitle is out of sync, you can perfectly sync it to the audio with a hotkey.
4. **Flatpak Sandbox Escape**: Seamlessly runs external host binaries (`subliminal`, `ffsubsync`) from inside the Celluloid Flatpak via `flatpak-spawn`.

### Dependencies
Ensure the following host packages are installed:
- `subliminal` (Downloads the subtitles)
- `ffsubsync` (Analyzes audio and syncs subtitles)
  - *Note: the script uses `--vad auditok` to bypass modern python `webrtcvad` compatibility issues.*
- `ffmpeg` (Required by `ffsubsync`)

Installation via `pipx` works great:
```bash
pipx install subliminal
pipx install ffsubsync
pipx inject ffsubsync setuptools
```

### Flatpak Overrides (Celluloid specific)
If using the Flatpak version of Celluloid, you **must** give it permission to run commands on your host system and access your videos:
```bash
flatpak override --user --filesystems=home io.github.celluloid_player.Celluloid
flatpak override --user --talk-name=org.freedesktop.Flatpak io.github.celluloid_player.Celluloid
```

### Keybindings
- `b` : If the current subtitle is bad, search and fetch from the **next available subtitle provider**.
- `Shift + s` (`S`) : Auto-sync the currently loaded external subtitle. Wait 1-2 minutes; it replaces the unsynced file with a perfect `.sync.srt`!
- `j` : Cycle through the loaded subtitle tracks (built-in MPV key).
