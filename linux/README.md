# Linux Dotfiles

Zsh + Bash shell with kitty terminal config with Powerlevel10k, zinit, bat, eza, zoxide, yazi and fzf.

## What's Here

| File              | What it does                                                 |
| ----------------- | ------------------------------------------------------------ |
| `.zshenv`         | Bootstrap — sets ZDOTDIR, sources the real config            |
| `.profile`        | Login environment for Bash and display manager (XDG, EDITOR) |
| `.bashrc`         | Bash interactive config (history, prompt, completion)        |
| `.config/aliasrc` | Shared aliases used by both Bash and Zsh                     |

| `.config/zsh/` | Zsh environment and interactive configuration |
| `.config/kitty/` | Kitty terminal configuration |
| `.config/terminal/` | GNOME Terminal color scheme (Gruvbox) |
| `.config/bat/` | Bat (cat replacement) configuration |
| `.config/yazi/` | Yazi terminal file manager configuration |
| `.config/dircolors` | LS_COLORS configuration |

## How Shell Startup Works

```
Zsh:   ~/.zshenv → ~/.config/zsh/.zshenv → ~/.config/zsh/.zshrc
Bash:  ~/.profile → ~/.bashrc
Both:  → ~/.config/aliasrc (shared aliases)
```

## Setup

1. Install zsh: `sudo apt install zsh`
2. Set zsh as default: `chsh -s $(which zsh)`
3. Install [JetBrains Mono Nerd Font](https://www.nerdfonts.com/font-downloads)
4. Use the installation script to symlink everything:

```bash
chmod +x linux/install.sh
./linux/install.sh
```

5. Load terminal theme: `dconf load /org/gnome/terminal/legacy/profiles:/:b1dcc9dd-5262-4d8d-a863-c897e6d979b9/ < ~/.config/terminal/tcs-gruvbox.dconf`
6. Open a new terminal — zinit will auto-install plugins on first run

## Tools

- **[yazi](https://github.com/sxyazi/yazi)** — blazing fast terminal file manager
- **[zinit](https://github.com/zdharma-continuum/zinit)** — plugin manager (auto-installs)
- **[Powerlevel10k](https://github.com/romkatv/powerlevel10k)** — prompt theme
- **[fzf](https://github.com/junegunn/fzf)** — fuzzy finder (Ctrl+R for history)
- **[bat](https://github.com/sharkdp/bat)** — better cat (aliased automatically if installed)
- **[eza](https://github.com/eza-community/eza)** — modern `ls` replacement with icons
- **[zoxide](https://github.com/ajeetdsouza/zoxide)** — smarter `cd` command
- **[ripgrep](https://github.com/BurntSushi/ripgrep)** — fast search (used by fzf)
