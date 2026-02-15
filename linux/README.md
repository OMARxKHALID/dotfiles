# Linux Dotfiles

Zsh + Bash shell config with Powerlevel10k, zinit, and fzf.

## What's Here

| File                    | What it does                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `.zshenv`               | Bootstrap — sets ZDOTDIR, sources the real config            |
| `.profile`              | Login environment for Bash and display manager (XDG, EDITOR) |
| `.bashrc`               | Bash interactive config (history, prompt, completion)        |
| `.config/aliasrc`       | Shared aliases used by both Bash and Zsh                     |
| `.config/zsh/.zshenv`   | Zsh environment (XDG dirs, PATH, defaults)                   |
| `.config/zsh/.zshrc`    | Zsh interactive (zinit plugins, completion, history, fzf)    |
| `.config/zsh/.p10k.zsh` | Powerlevel10k prompt theme                                   |

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
4. Copy files to their locations:

```bash
cp linux/.zshenv ~/
cp linux/.profile ~/
cp linux/.bashrc ~/
cp -r linux/.config/zsh ~/.config/
cp linux/.config/aliasrc ~/.config/
```

5. Open a new terminal — zinit will auto-install plugins on first run

## Tools

- **[zinit](https://github.com/zdharma-continuum/zinit)** — plugin manager (auto-installs)
- **[Powerlevel10k](https://github.com/romkatv/powerlevel10k)** — prompt theme
- **[fzf](https://github.com/junegunn/fzf)** — fuzzy finder (Ctrl+R for history)
- **[bat](https://github.com/sharkdp/bat)** — better cat (aliased automatically if installed)
