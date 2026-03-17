# MPV Configuration & Premium Scripts

A high-performance MPV configuration optimized for Wayland, featuring a custom OSD search engine and automated watch history tracking.

## Core Features

- **GPU Acceleration**: Uses `gpu-next` and `gpu-hq` for premium scaling and sharp visuals.
- **Hardware Decoding**: Enabled `auto-safe` for efficient playback.
- **Wayland Optimized**: Specific fixes for black-area glitches on Wayland sessions.
- **Elite Typography**: Bold, readable JetBrainsMono subtitles and OSD interface.

## Premium Scripts

| Script | Purpose |
| :--- | :--- |
| **Command Palette** | Searchable UI for commands, fonts, and tracks. |
| **Integrated History** | Keeps your last 20 videos at your fingertips. |
| **Font Switcher** | Live preview and switcher for premium fonts. |
| **Auto Subtitles** | Downloads English subtitles from multiple providers. |
| **Thumbfast** | High-performance, low-latency thumbnails on hover. |

## Keybindings

| Key | Action |
| :--- | :--- |
| **Ctrl+Shift+P** | **Command Palette**: Searchable interface for everything. |
| **Right Click** | **Context Palette**: Quick access to tracks, fonts, and history. |
| **r** | **Download Sub**: Trigger subtitle search via `autosub`. |
| **S** | **Sync Sub**: Automatically synchronize current subtitle to audio. |
| **[` / `]** | **Speed Control**: Decrease or increase playback speed (1.1x). |
| **z** / **x** | **Manual Sync**: Shift subtitle timing by +/- 100ms. |
| **i** | **Stats Overlay**: Toggle technical performance stats. |
| **s** | **Screenshot**: Capture the screen with subtitles. |
| **Shift+c** | **Clean Screenshot**: Video only (no subtitles/OSD). |
| **Wheel Up/Down**| **Volume Control**: High-precision 2% steps. |

---

## Technical Dependencies

| Resource | Purpose |
| :--- | :--- |
| **JetBrainsMono NF** | Required for icons and searchable OSD. |
| **subliminal** | Required for `autosub` search functionality. |
| **ffsubsync** | Required for `autosub` synchronization features. |
