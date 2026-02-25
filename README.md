# Dotfiles

My development environment configs for Windows and Linux.

## Structure

```
├── windows/          # PowerShell, Starship, VS Code
│   ├── terminal/     # Starship config + PowerShell profile
│   ├── vscode/       # Settings + extensions
│   └── nerd-font.md  # Font setup
│
└── linux/            # Zsh, Bash, shell config
    ├── .zshenv       # Bootstrap (sets ZDOTDIR)
    ├── .profile      # Login env for Bash/GDM
    ├── .bashrc       # Bash interactive config
    ├── .local/
    │   ├── bin/
    │   │   ├── switch-wallpaper   # Random wallpaper switcher
    │   │   └── wallpaper-picker   # Visual wallpaper picker (GTK)
    │   └── share/gnome-shell/extensions/
    │       └── wallpaper-picker@omar/  # Top-bar extension
    └── .config/
        ├── aliasrc   # Shared aliases (Bash + Zsh)
        ├── kitty/
        │   └── kitty.conf         # Kitty terminal (Gruvbox)
        ├── terminal/
        │   └── tcs-gruvbox.dconf  # Gruvbox GNOME Terminal theme
        └── zsh/
            ├── .zshenv   # Zsh environment (XDG, PATH)
            ├── .zshrc    # Zsh interactive (plugins, prompt)
            └── .p10k.zsh # Powerlevel10k theme
```

## Setup

- **Windows** → see [`windows/README.md`](windows/README.md)
- **Linux** → see [`linux/README.md`](linux/README.md)

## License

MIT
