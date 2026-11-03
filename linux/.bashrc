# Bash Config

# Interactive Check
case $- in *i*) ;; *) return;; esac

# History
HISTCONTROL=ignoreboth
shopt -s histappend
HISTSIZE=2000
HISTFILESIZE=2000
[ -n "$XDG_STATE_HOME" ] && HISTFILE="$XDG_STATE_HOME/bash/history"
mkdir -p "${HISTFILE%/*}" 2>/dev/null

# Options
shopt -s checkwinsize

# Prompt
PS1='\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '

# Tooling
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
[ -d "$HOME/.local/bin" ] && export PATH="$HOME/.local/bin:$PATH"
export RIPGREP_CONFIG_PATH="${XDG_CONFIG_HOME:-$HOME/.config}/ripgrep/ripgreprc"

# Completion
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# Integrations
if [ -r "${XDG_CONFIG_HOME:-$HOME/.config}/dircolors" ]; then
    eval "$(dircolors -b "${XDG_CONFIG_HOME:-$HOME/.config}/dircolors")"
else
    eval "$(dircolors -b)"
fi
command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init bash)"
command -v fzf >/dev/null 2>&1 && eval "$(fzf --bash 2>/dev/null)"

# Aliases
[ -f "${XDG_CONFIG_HOME:-$HOME/.config}/aliasrc" ] && . "${XDG_CONFIG_HOME:-$HOME/.config}/aliasrc"
