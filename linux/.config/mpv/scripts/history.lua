local msg = require "mp.msg"
local opt = require "mp.options"

function is_empty(input)
    if input == nil or input == "" then
        return true
    end
end

function trim(input)
    if is_empty(input) then
        return ""
    end
    return input:match "^%s*(.-)%s*$"
end

function contains(input, find)
    if not is_empty(input) and not is_empty(find) then
        return input:find(find, 1, true)
    end
end

function replace(str, what, with)
    if is_empty(str) then return "" end
    if is_empty(what) then return str end
    if with == nil then with = "" end
    what = string.gsub(what, "[%(%)%.%+%-%*%?%[%]%^%$%%]", "%%%1")
    with = string.gsub(with, "[%%]", "%%%%")
    return string.gsub(str, what, with)
end

function split(input, sep)
    local tbl = {}
    if not is_empty(input) then
        for str in string.gmatch(input, "([^" .. sep .. "]+)") do
            table.insert(tbl, str)
        end
    end
    return tbl
end

function pad_left(input, len, char)
    if input == nil then
        input = ""
    end
    if char == nil then
        char = ' '
    end
    return string.rep(char, len - #input) .. input
end

function round(value)
    return value >= 0 and math.floor(value + 0.5) or math.ceil(value - 0.5)
end

function file_exists(path)
    local f = io.open(path, "r")
    if f ~= nil then
        io.close(f)
        return true
    end
end

function file_append(path, content)
    local h = assert(io.open(path, "ab"))
    h:write(content)
    h:close()
end

time = 0
path = ""

local o = {
    exclude = "",
    storage_path = "~~/history.log",
    minimal_play_time = 0,
}

opt.read_options(o)
o.storage_path = mp.command_native({"expand-path", o.storage_path})

function discard()
    for _, v in pairs(split(o.exclude, ";")) do
        local p = replace(path, "/", "\\")
        v = replace(trim(v), "/", "\\")
        if contains(p, v) then
            return true
        end
    end
end

function history()
    local seconds = round(os.time() - time)

    if not file_exists(o.storage_path) then
        local f = io.open(o.storage_path, "w")
        if f then f:close() end
    end

    if not is_empty(path) and seconds > o.minimal_play_time and not discard() then
        local minutes = round(seconds / 60)
        local line = os.date("%d.%m.%Y %H:%M ") ..
            pad_left(tostring(minutes), 3) .. " " .. path .. "\n"
        file_append(o.storage_path, line)
    end

    local current_path = mp.get_property("path")
    if not is_empty(current_path) and not contains(current_path, "://") then
        local working_dir = mp.get_property("working-directory")
        if not is_empty(working_dir) then
            path = mp.command_native({"expand-path", current_path})
        else
            path = current_path
        end
    elseif not is_empty(current_path) then
        path = mp.get_property("media-title") or current_path
    else
        path = ""
    end
    time = os.time()
end

mp.register_event("shutdown", history)
mp.register_event("file-loaded", history)
