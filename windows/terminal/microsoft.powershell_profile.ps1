# Import Terminal Icons if available
Import-Module Terminal-Icons

# Initialize Starship Prompt
Invoke-Expression (&starship init powershell)

# Import 'z' module if available
if (Get-Module -ListAvailable -Name z) {
    Import-Module z
}

# Import PSReadLine (if available) and set options
if (Get-Module -ListAvailable -Name PSReadLine) {
    Import-Module PSReadLine
    Set-PSReadLineOption -PredictionSource History `
                         -PredictionViewStyle Inline `
                         -EditMode Windows `
                         -BellStyle None `
                         -HistorySearchCursorMovesToEnd:$true

    Set-PSReadLineKeyHandler -Chord UpArrow -Function HistorySearchBackward
    Set-PSReadLineKeyHandler -Chord DownArrow -Function HistorySearchForward
}

# Function to find the location of a command
function whereis ($command) {
    Get-Command -Name $command -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Path -ErrorAction SilentlyContinue
}

# Import PSFzf and set key bindings
Import-Module PSFzf
Set-PsFzfOption -PSReadlineChordProvider 'Ctrl+f' `
                -PSReadlineChordReverseHistory 'Ctrl+r'

# Function to use fzf with bat preview and open file in VS Code
function f {
    $file = fzf --preview "bat --color=always --style=numbers --line-range 1:500 {}"
    if ($file) { code "$file" }
}

# Function to open PowerShell profile in Notepad
function profile { notepad $PROFILE }
