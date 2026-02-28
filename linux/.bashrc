# Bash Config

# Exit early if not interactive
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

# Prompt (Minimalist)
PS1='\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '

# Aliases
[ -f "$HOME/.config/aliasrc" ] && . "$HOME/.config/aliasrc"

# Completion
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi
. "$HOME/.cargo/env"
