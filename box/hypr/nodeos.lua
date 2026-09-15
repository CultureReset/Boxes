-- NODE on Hyprland.
--
-- Loaded from ~/.config/hypr/hyprland.lua (the installer adds the require).
-- Works alongside Omarchy's defaults: it only adds rules for the NODE shell
-- window and a couple of bindings. Everything else stays as Omarchy sets it.

local SHELL = "nodeos-shell"

-- The shell is the home screen: always fullscreen, no gaps, no border, no
-- fade, never tiled with anything else. It lives on workspace 1 so the phone
-- rule "Home is always in the same place" holds.
hl.window_rule({
  match = { class = "^" .. SHELL .. "$" },
  fullscreen = true,
  workspace = "1",
  no_anim = true,
  no_border = true,
  no_rounding = true,
  no_shadow = true,
  opacity = "1.0 1.0",
  tag = "-default-opacity",
  suppress_event = "fullscreen maximize",
})

-- Apps opened from the shell get their own workspace and open full width, so
-- the experience stays one-thing-at-a-time like a phone or tablet. Users who
-- prefer classic tiling delete the next rule and keep everything else.
hl.window_rule({
  match = { class = "^(?!" .. SHELL .. "$).*$", float = false },
  fullscreen = "maximize",
})

-- Super on its own is the Home button. Tap it anywhere and NODE comes back.
hl.bind("SUPER + SUPER_L", hl.dsp.exec_cmd("nodeos home"), { description = "NODE home", release = true })
hl.bind("SUPER + H", hl.dsp.exec_cmd("nodeos home"), { description = "NODE home" })
hl.bind("XF86HomePage", hl.dsp.exec_cmd("nodeos home"), { description = "NODE home" })

-- Start NODE with the session.
hl.on("hyprland.start", function()
  hl.exec_cmd("nodeos start")
end)
