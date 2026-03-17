# MPV Configuration

A minimalist, high-performance MPV configuration optimized for Wayland, featuring premium scripts and JetBrainsMono OSD.

## File Structure

| Path | Description |
| :--- | :--- |
| `mpv.conf` | Core playback, GPU acceleration, and UI styling. |
| `input.conf` | Custom keybindings and script-specific triggers. |
| `scripts/` | Lua scripts for Command Palette, History, and Subtitles. |
| `script-opts/` | Configuration files for script behavior. |
| `fonts/` | Essential typography for OSD and subtitles. |

## Core Features

| Feature | Details |
| :--- | :--- |
| **GPU Next** | Uses `vo=gpu-next` and `gpu-hq` for premium rendering. |
| **Wayland Ready** | Native Wayland context for lag-free, glitch-free playback. |
| **Command Palette** | Searchable interface for commands, properties, and tracks. |
| **Modern UI** | Custom OSC (ModernZ) and high-precision thumbnail previews. |
| **Smart Subtitles** | Auto-downloading, syncing, and fuzzy path matching. |
| **Playback Stats** | Integrated history tracking and SponsorBlock integration. |

## Keybindings

| Key | Action |
| :--- | :--- |
| **Ctrl+Shift+P** | **Command Palette**: Search everything. |
| **Right Click** | **Context Palette**: Quick access to menu. |
| **Shift+Enter** | **Playlist**: Show and manage current playlist. |
| **r** / **S** | **Subtitles**: Download next provider / Sync to audio. |
| **[** / **]** | **Speed**: Adjust playback speed by 1.1x. |
| **z** / **x** | **Sub Delay**: Adjust subtitle timing (+/- 100ms). |
| **Alt+b** | **SponsorBlock**: Toggle skipping sponsored segments. |
| **Ctrl+n** | **Audio**: Toggle Dynamic Range Normalizer (Loudness). |
| **v** | **Subs**: Toggle subtitle visibility. |
| **i** / **s** | **Utility**: Toggle stats / Take screenshot. |
| **Shift+c** | **Clean Shot**: Screenshot without OSD/Subtitles. |

## Technical Dependencies

| Tool | Purpose |
| :--- | :--- |
| **JetBrainsMono NF** | Required for OSD icons and minimalist typography. |
| **subliminal** | Backend for `autosub` search and download. |
| **ffsubsync** | Backend for automatic subtitle synchronization. |

## Quick Setup

1. Install `mpv`, `subliminal`, and `ffsubsync` via your package manager.
2. Install **JetBrainsMono Nerd Font** to your system fonts directory.
3. Clone these dotfiles and link this directory to `~/.config/mpv`.
4. Ensure `pip install subliminal ffsubsync` is done for subtitle features.
