# Starship Terminal Setup Guide

## Installation Methods

### Windows (Recommended)

```powershell
winget install starship
```

### Alternative Method

```powershell
scoop install starship
```

## Configuration Steps

1. **Configure PowerShell Profile**

   ```powershell
   Invoke-Expression (&starship init powershell)
   ```

   Add this to: `~\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`

2. **Create Configuration File**

   ```powershell
   mkdir -p $env:USERPROFILE\.config\starship
   New-Item -Path $env:USERPROFILE\.config\starship -Name "starship.toml" -ItemType "File"
   ```

3. **Apply Settings**

   - Copy contents from `starship.toml` in this directory
   - Paste into your newly created file

4. **Reload PowerShell**
   ```powershell
   . $PROFILE
   ```

## Verification

Navigate to any project directory to verify the custom prompt display.
