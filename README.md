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
    └── .config/
        ├── aliasrc   # Shared aliases (Bash + Zsh)
        ├── terminal/
        │   └── tcs-gruvbox.dconf  # Gruvbox terminal theme
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
