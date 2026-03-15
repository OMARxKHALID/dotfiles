--=============================================================================
-->>    SUBLIMINAL PATH:
--=============================================================================
local subliminal = '/home/omar/.local/bin/subliminal'
--=============================================================================
-->>    SUBTITLE LANGUAGE:
--=============================================================================
local language = { 'English', 'en', 'eng' }
--=============================================================================
-->>    PROVIDERS: Download from these providers (in order).
--          Each successful download is renamed to keep all copies.
--=============================================================================
local providers = { 'opensubtitles', 'opensubtitlescom', 'gestdown', 'tvsubtitles', 'podnapisi', 'bsplayer', 'subtis' }
--=============================================================================
-->>    ADDITIONAL OPTIONS:
--=============================================================================
local bools = {
    auto = true,   -- Automatically download subtitles, no hotkeys required
    force = true,  -- Force download; will overwrite existing subtitle files
    utf8 = true,   -- Save all subtitle files as UTF-8
}
local excludes = {
    'no-subs-dl',
}
local includes = {
}
--=============================================================================
local utils = require 'mp.utils'

-- State variables for progressive downloading
local current_provider_idx = 0
local last_movie_path = ""

-- Download subtitles from a single provider, then rename the file
function download_from_provider(provider, movie_path, dir, base)
    log('Trying ' .. provider .. ' ...', 10)

    local a = {
        "flatpak-spawn", "--host",
        subliminal,
        "download",
        "-f",
        "-e", "utf-8",
        "-l", language[2],
        "-p", provider,
        movie_path
    }

    mp.msg.warn('Running: ' .. table_join(a, " "))

    local result = utils.subprocess({ args = a })

    local output = ""
    if result.stdout then output = output .. result.stdout end
    if result.stderr then output = output .. result.stderr end
    mp.msg.warn(provider .. ' output: ' .. output)

    if string.find(output, 'Downloaded 1 subtitle') then
        -- subliminal saves: <base>.<lang>.srt  (e.g. movie.en.srt)
        local src = dir .. base .. '.' .. language[2] .. '.srt'
        local dst = dir .. base .. '.' .. language[2] .. '.' .. provider .. '.srt'

        -- Rename to provider-specific name so we keep all copies
        local rename_result = utils.subprocess({
            args = { "flatpak-spawn", "--host", "mv", src, dst }
        })
        mp.msg.warn('Renamed: ' .. src .. ' -> ' .. dst)
        return true
    else
        if (result.status or 0) ~= 0 or string.find(output, 'Traceback') or string.find(output, 'Exception') then
            write_error_log("Subliminal error for provider '" .. provider .. "' (status " .. tostring(result.status) .. "):\n" .. output)
        end
        mp.msg.warn(provider .. ': no subtitle found')
        return false
    end
end


-- Main download function: tries the NEXT available provider
function download_next_provider()
    local movie_path = mp.get_property('path')
    if not movie_path then
        log('No file loaded')
        return
    end

    -- Reset provider index if the movie file changed
    if movie_path ~= last_movie_path then
        last_movie_path = movie_path
        current_provider_idx = 0
    end

    local dir, filename = utils.split_path(movie_path)
    -- Strip extension to get base name
    local base = filename:match("(.+)%..+$") or filename

    local found = false

    log('Searching ' .. language[1] .. ' subs (Source ' .. (current_provider_idx + 1) .. '/' .. #providers .. ')', 15)

    -- Try providers starting from the next one
    for i = current_provider_idx + 1, #providers do
        current_provider_idx = i
        local provider = providers[i]
        
        if download_from_provider(provider, movie_path, dir, base) then
            -- Set up subtitle preferences and rescan
            mp.set_property('sub-auto', 'fuzzy')
            mp.set_property('slang', language[2])
            mp.commandv('rescan_external_files')
            log('Downloaded from ' .. provider .. '! Press "b" for next source if out of sync.')
            found = true
            break
        end
    end

    if not found then
        log('No more subtitles found! Tried all sources.')
    end
end


-- Control function: auto-download on file load
function control_downloads()
    -- Reset state when a new file loads
    current_provider_idx = 0
    last_movie_path = mp.get_property('path') or ""

    mp.set_property('sub-auto', 'fuzzy')
    mp.set_property('slang', language[2])
    mp.commandv('rescan_external_files')

    directory, filename = utils.split_path(mp.get_property('path'))

    if not autosub_allowed() then
        return
    end

    -- Check if subtitles are already present
    local dominated = false
    for _, track in ipairs(mp.get_property_native('track-list')) do
        if track['type'] == 'sub' then
            if track['lang'] == language[3] or track['lang'] == language[2] then
                log(language[1] .. ' subtitles already present')
                dominated = true
                break
            end
        end
    end

    if not dominated then
        download_next_provider()
    end
end


-- Check if subtitles should be auto-downloaded
function autosub_allowed()
    local duration = tonumber(mp.get_property('duration'))
    local active_format = mp.get_property('file-format')

    if not bools.auto then
        return false
    elseif duration and duration < 900 then
        mp.msg.warn('Video < 15 min => skip auto-download')
        return false
    elseif directory:find('^http') then
        mp.msg.warn('Web streaming => skip auto-download')
        return false
    elseif active_format and active_format:find('^cue') then
        return false
    else
        local audio_only = {
            'aiff', 'ape', 'flac', 'mp3', 'ogg', 'wav', 'wv', 'tta'
        }
        for _, fmt in pairs(audio_only) do
            if fmt == active_format then return false end
        end

        for _, exclude in pairs(excludes) do
            local escaped = exclude:gsub('%W','%%%0')
            if directory:find(escaped) then return false end
        end

        for i, include in ipairs(includes) do
            local escaped = include:gsub('%W','%%%0')
            if directory:find(escaped) then break
            elseif i == #includes then return false end
        end
    end

    return true
end


-- Auto-sync functionality using ffsubsync
function sync_subtitles()
    local movie_path = mp.get_property('path')
    if not movie_path then
        log('No file loaded to sync')
        return
    end

    local sub_path = nil
    for _, track in ipairs(mp.get_property_native('track-list')) do
        if track.type == 'sub' and track.selected and track['external-filename'] then
            sub_path = track['external-filename']
            break
        end
    end

    if not sub_path then
        log('Error: Select an external subtitle first to auto-sync!')
        return
    end

    log('Auto-syncing subtitle... please wait 1-2 minutes.', 10)

    local dst = sub_path:gsub("%.srt$", ".sync.srt")
    if dst == sub_path then
        dst = sub_path .. ".sync.srt"
    end

    local a = {
        "flatpak-spawn", "--host",
        "/home/omar/.local/bin/ffsubsync",
        movie_path,
        "-i", sub_path,
        "-o", dst,
        "--vad", "auditok"
    }

    mp.msg.warn('Running ffsubsync: ' .. table_join(a, " "))

    mp.command_native_async({
        name = "subprocess",
        args = a,
        capture_stdout = true,
        capture_stderr = true
    }, function(success, result, error)
        if success and result.status == 0 then
            log('Subtitle auto-synced successfully!')
            mp.commandv('sub-add', dst)
            
            -- Delete the original unsynced subtitle file using host OS to bypass Flatpak restrictions
            utils.subprocess({
                args = { "flatpak-spawn", "--host", "rm", "-f", sub_path }
            })
            mp.msg.warn('Deleted unsynced subtitle: ' .. sub_path)
        else
            log('Auto-sync failed! Check error.txt in video folder.', 5)
            local err_msg = "ffsubsync failed with status " .. tostring(result.status)
            if result and result.stderr then
                mp.msg.warn('ffsubsync error: ' .. result.stderr)
                err_msg = err_msg .. "\nStderr:\n" .. tostring(result.stderr)
            end
            write_error_log(err_msg)
        end
    end)
end


-- Helpers
function write_error_log(msg)
    local movie_path = mp.get_property('path')
    if not movie_path then return end
    local dir = utils.split_path(movie_path)
    local err_file = dir .. "error.txt"

    local f = io.open(err_file, "a")
    if f then
        f:write("=== ERROR " .. os.date("%Y-%m-%d %H:%M:%S") .. " ===\n" .. msg .. "\n\n")
        f:close()
    else
        mp.msg.warn("Could not open " .. err_file .. " for writing errors.")
    end
end

function table_join(t, sep)
    local s = ""
    for i, v in ipairs(t) do
        if i > 1 then s = s .. sep end
        s = s .. tostring(v)
    end
    return s
end

function log(str, secs)
    secs = secs or 2.5
    mp.msg.warn(str)
    mp.osd_message(str, secs)
end


-- Keybindings:
--   b = fetch the next subtitle source if the current one is out of sync
--   S = auto-sync the currently selected subtitle (Shift + s)
mp.add_key_binding('b', 'download_next_provider', download_next_provider)
mp.add_key_binding('S', 'sync_subtitles', sync_subtitles)
mp.register_event('file-loaded', control_downloads)