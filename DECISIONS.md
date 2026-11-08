# Decisions

A short log of the main technical choices and the reasons for them.

## General

- **Plain HTML, CSS and JS with no build step.** Both ads are small, and the reviewer only needs `npx http-server` to run them. There's no framework or bundler to set up.
- **GSAP (3.12.5, from cdnjs) for all animation.** Its timelines make sequenced intros and endcards easy to write and tune. `gsap.globalTimeline.pause()` also freezes every animation at once when the tab is hidden.
- **@2x assets shown at 50%.** Every supplied image is exported at double size, so each one is displayed at half its pixel size. That keeps them sharp on retina screens.
- **`window.clickTag` with a fallback URL.** Both ads read `window.clickTag`, the usual ad-server convention. When it isn't set, they open `https://example.com/landing`.
- **`prefers-reduced-motion` is respected.** Looping pulses and floating animations are skipped. The fireplace skips its intro entirely and shows the final layout straight away.

## Variant A – game (Gut Run)

- **DOM, not canvas.** The scene is a few dozen `<img>` elements moved with GSAP transforms.
  - The design is made of ready-made PNG layers, and in the DOM they can be placed with the same coordinates as the design.
  - Transforms are GPU-composited, so it stays smooth at this element count.
  - Endcards are ordinary HTML with real buttons and `alt` text.
  - Debugging is easier because DevTools shows every element.
  - Canvas would only pay off with many more moving objects or per-pixel effects.
- **Scaling to the viewport.**
  - Everything is laid out in fixed 360×640 "design pixels", half of the 720×1280 design PNGs.
  - `fitStage()` scales the whole `#stage` with `transform: scale()`, using `min(width / 360, height / 640)`, so it never distorts.
  - The stage is centred and its offset rounded to whole pixels to keep edges sharp.
  - The leftover space is filled with a white/navy split background, matching the logo bar on top and the game below.
- **One moving track.** The gut background and all obstacles sit inside one `#track` element that moves left. Only one transform changes per frame, and the obstacles can never drift away from the background.
- **Frame-rate independent physics.**
  - Gravity, jump speed and scroll speed are in px per second and multiplied by `dt`.
  - `dt` is capped at 50 ms, so a slow frame doesn't teleport the player through an obstacle.
  - Speed ramps gently from 90 to 140 px/s over the run.
- **Collision.**
  - Collision uses axis-aligned rectangles, shrunk on each side by a per-obstacle factor (`shrink`), because the PNGs have transparent edges.
  - The player is shrunk by 20%.
  - This is cheap and feels fair. It's not pixel-exact, which is listed as a known issue.
  - `?debug` draws the hitboxes so the factors can be tuned by eye.
- **Obstacles.** Each of the 15 obstacle images appears exactly once per run, in random order, at a random height, with a fixed gap between them. The start of the track has a short "get ready" gap.
- **Audio.**
  - Plain `HTMLAudioElement`s; Web Audio would be too heavy for five sounds.
  - Music starts on the first tap. That is the earliest point browsers allow audio, and the tap also starts the game.
  - `play()` errors from autoplay blocking are caught and ignored.
  - A mute button toggles `muted` on all sounds.
  - When the tab is hidden, the sounds that were playing are paused, and only those are resumed when it comes back.
- **Pause when hidden.** On `visibilitychange` the game loop, all GSAP animations and the audio stop. On return, `lastTime` is reset so the hidden time doesn't count as one giant frame.

## Variant B – fireplace

- **Three separate HTML files plus a preview.** `left.html`, `top.html` and `right.html` are the three ad slots a publisher would serve. They share one `css/ad.css` and one `js/ad.js`. `preview.html` puts them in iframes at their real positions around a placeholder website.
- **Background alignment.**
  - All three parts use the same big image, `bg-big.jpg`, at 1680×975.
  - Each part shifts it left by its own offset (0, −324 px and −1360 px), so the three slices join into one continuous surface.
  - `transform-origin` is the centre of the *whole* fireplace (840 px, 487 px) in every part. When the background zooms, all three slices zoom together like one image instead of each zooming around its own centre.
  - The zoom always ends at scale 1, because the product packs are baked into the background and have to land where the design puts them.
- **Synchronised start.**
  - In `preview.html` each iframe gets `?sync` and waits for a `fireplace-start` `postMessage`.
  - The preview sends that message on its `load` event, which fires only after all three iframes have loaded, so the parts start in the same frame.
  - A 5 s fallback starts any part that never gets the message.
  - Served on its own (no `?sync`), each part starts on `load`.
  - All three timelines use the same start times, so the parts play in step.
- **Workarounds for non-transparent PNGs.** Some supplied images have solid black where transparency was expected, so I fixed them with CSS instead of editing the assets:
  - `box.png`: only the blue band (y 744–914 px) is shown, through an `overflow: hidden` window. It has 85% opacity so the moss shines through, as in the design.
  - The copy images (`left/hl.png`, `right/hl.png`), white text on black: `mix-blend-mode: screen` hides the black and keeps the white.
  - `cta.png` has black corners, which are rounded off with `border-radius`.
- **The top headline split into three lines.** `top/hl.png` is one image. Three `div`s each show one horizontal slice through `background-position`, so the lines can animate one after another. The cut points come from the empty rows between the lines.
- **The idle animation stops by itself.** A slow background "breathe" and a CTA pulse use a fixed number of repeats. They end after about 28 s, inside typical ad-spec animation limits, and the even number of yoyo runs makes the background finish at scale 1.
- **Design overlay.** `preview.html?debug` lays `design/layout.png` on top at 50% opacity. The mockup is about 2.7% smaller than real size and offset by (28, 50), so the overlay is scaled and shifted back to line up 1:1.

## Compression

- **Nothing compressed yet.** The assets are used as supplied, about 2.1 MB for the game and 3.5 MB for the fireplace. Compressing them (pngquant or WebP, plus a sprite atlas for the game) is the first item under "what I would do next" in the README.
