-- Subliminal
local subliminal = '/home/omar/.local/bin/subliminal'
local language = { 'English', 'en', 'eng' }
local providers = { 'opensubtitles', 'opensubtitlescom', 'gestdown', 'tvsubtitles', 'podnapisi', 'bsplayer', 'subtis' }

local utils = require 'mp.utils'
local opt = require 'mp.options'

-- Options
local bools = {
    auto = true,
    force = true,
    utf8 = true,
}
opt.read_options(bools, "autosub")

local last_movie_path = ""
local current_provider_idx = 0

-- Download
function download_from_provider(provider, movie_path, dir, base)
    log('Trying ' .. provider .. ' ...', 10)

    local a = build_cmd({
        subliminal,
        "download",
        "-f",
        "-e", "utf-8",
        "-l", language[2],
        "-p", provider,
        movie_path
    })

    local result = utils.subprocess({ args = a })
    local output = (result.stdout or "") .. (result.stderr or "")

    if string.find(output, 'Downloaded 1 subtitle') then
        local src = dir .. base .. '.' .. language[2] .. '.srt'
        local dst = dir .. base .. '.' .. language[2] .. '.' .. provider .. '.srt'
        utils.subprocess({ args = build_cmd({ "mv", src, dst }) })
        return true
    else
        if (result.status or 0) ~= 0 or string.find(output, 'Traceback') then
            write_error_log("Subliminal error (" .. provider .. "):\n" .. output)
        end
        return false
    end
end

function download_next_provider()
    if not bools.auto then
        log('Auto-subtitle is disabled.', 3)
        return
    end

    local movie_path = mp.get_property('path')
    if not movie_path then return end

    if movie_path ~= last_movie_path then
        last_movie_path = movie_path
        current_provider_idx = 0
    end

    local dir, filename = utils.split_path(movie_path)
    local base = filename:match("(.+)%..+$") or filename
    local found = false

    log('Searching ' .. language[1] .. ' (' .. (current_provider_idx + 1) .. '/' .. #providers .. ')', 15)

    for i = current_provider_idx + 1, #providers do
        current_provider_idx = i
        if download_from_provider(providers[i], movie_path, dir, base) then
            mp.set_property('sub-auto', 'fuzzy')
            mp.set_property('slang', language[2])
            mp.commandv('rescan_external_files')
            log('Downloaded from ' .. providers[i] .. '!')
            found = true
            break
        end
    end

    if not found then log('No more subtitles found.') end
end

-- Sync
function sync_subtitles()
    local movie_path = mp.get_property('path')
    if not movie_path then return end

    local sub_path = nil
    for _, track in ipairs(mp.get_property_native('track-list')) do
        if track.type == 'sub' and track.selected and track['external-filename'] then
            sub_path = track['external-filename']
            break
        end
    end

    if not sub_path then
        log('Error: Select an external subtitle first!')
        return
    end

    log('Auto-syncing...', 10)

    local dst = sub_path:gsub("%.srt$", ".sync.srt")
    if dst == sub_path then dst = sub_path .. ".sync.srt" end

    local a = build_cmd({
        "/home/omar/.local/bin/ffsubsync",
        movie_path,
        "-i", sub_path,
        "-o", dst,
        "--vad", "auditok"
    })

    mp.command_native_async({
        name = "subprocess",
        args = a,
        capture_stdout = true,
        capture_stderr = true
    }, function(success, result, error)
        if success and result.status == 0 then
            log('Subtitle auto-synced!')
            mp.commandv('sub-add', dst)
            utils.subprocess({ args = build_cmd({ "rm", "-f", sub_path }) })
        else
            log('Sync failed!', 5)
            write_error_log("ffsubsync failed:\n" .. (result.stderr or ""))
        end
    end)
end

-- Helpers
function build_cmd(cmd_list)
    if os.getenv("FLATPAK_ID") then
        local flatpak_cmd = {"flatpak-spawn", "--host"}
        for _, v in ipairs(cmd_list) do table.insert(flatpak_cmd, v) end
        return flatpak_cmd
    end
    return cmd_list
end

function write_error_log(msg)
    local path = mp.get_property('path')
    if not path then return end
    local dir = utils.split_path(path)
    local f = io.open(dir .. "error.txt", "a")
    if f then
        f:write("=== [" .. os.date("%Y-%m-%d %H:%M:%S") .. "] ===\n" .. msg .. "\n\n")
        f:close()
    end
end

function log(str, secs)
    mp.msg.warn(str)
    mp.osd_message(str, secs or 2.5)
end

function control_downloads()
    current_provider_idx = 0
    local path = mp.get_property('path')
    if not path or path:find('^http') then return end

    local duration = tonumber(mp.get_property('duration'))
    if not bools.auto or (duration and duration < 900) then return end

    local has_subs = false
    -- Check tracks
    for _, track in ipairs(mp.get_property_native('track-list')) do
        -- If an external subtitle is loaded, or if there's an embedded English subtitle
        if track.type == 'sub' and (track.lang == 'en' or track.lang == 'eng' or track.external) then
            has_subs = true; break
        end
    end

    -- Check disk for matching subtitle files
    if not has_subs then
        local dir, filename = utils.split_path(path)
        local base = filename:match("(.+)%..+$") or filename
        local files = utils.readdir(dir)
        if files then
            local b_lower = base:lower()
            for _, f in ipairs(files) do
                local lf = f:lower()
                -- Check if file starts with video base name and ends with generic sub tags
                if lf:find(b_lower, 1, true) == 1 then
                    if lf:find("%.srt$") or lf:find("%.ass$") or lf:find("%.vtt$") then
                        has_subs = true
                        break
                    end
                end
            end
        end
    end

    if not has_subs then download_next_provider() end
end

function save_config()
    local path = mp.command_native({"expand-path", "~~/script-opts/autosub.conf"})
    local f = io.open(path, "w")
    if f then
        f:write("auto=" .. (bools.auto and "yes" or "no") .. "\n")
        f:write("force=" .. (bools.force and "yes" or "no") .. "\n")
        f:write("utf8=" .. (bools.utf8 and "yes" or "no") .. "\n")
        f:close()
    end
end

function toggle_autosub()
    bools.auto = not bools.auto
    save_config()
    log("Auto-subtitle: " .. (bools.auto and "On" or "Off"))
end

-- Keybindings
mp.add_key_binding('b', 'download_next_provider', download_next_provider)
mp.add_key_binding('S', 'sync_subtitles', sync_subtitles)
mp.add_key_binding(nil, 'toggle_autosub', toggle_autosub)
mp.register_event('file-loaded', control_downloads)