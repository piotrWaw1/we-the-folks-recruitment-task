# We the Folks – recruitment task

Two HTML5 ads, plain HTML/CSS/JS with GSAP for animation. There's no build step. The technical choices are explained in [DECISIONS.md](DECISIONS.md).

| Folder                 | What it is                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `variant-a-game/`      | **Gut Run**: a 360×640 mobile playable ad. Tap to fly, dodge the bacteria, and reach a win or fail endcard.                  |
| `variant-b-fireplace/` | A **fireplace** ad in three parts (`left.html`, `top.html`, `right.html`), with `preview.html` showing all of them together. |

## Run locally

From the repo root (Node.js required):

```bash
npx http-server . -p 8080 -c-1
```

Then open:

- Game: <http://localhost:8080/variant-a-game/>. Open it in mobile view in DevTools, or on a phone on the same network.
- Fireplace: <http://localhost:8080/variant-b-fireplace/preview.html>

Debug flags:

- `variant-a-game/?debug=1` draws the collision hitboxes.
- `variant-b-fireplace/preview.html?debug=1` lays `design/layout.png` over the ad at 50% opacity, for a pixel check against the design.

## What I would do next with more time

- **Optimise the assets.** Compress the PNGs (pngquant or WebP) and pack the game images into a sprite atlas. Add a small preloader so the game never starts with images still loading.
- **Fairer gameplay.** Today obstacles get a random height. Next step is to guarantee a passable gap between neighbours, and use polygon or pixel hitboxes instead of rectangles.
- **Analytics hooks.** Fire events for start, crash, win, replay and CTA click.
- **Device QA.** Test on real iOS and Android devices and in in-app webviews, where audio and autoplay rules differ.
- **Fireplace.** Re-export `box.png`, `hl.png` and `cta.png` with real transparency so the CSS workarounds below can go.
- **Responsive Fireplace.** Each part is built at a fixed pixel size: the sides are 320×975 and the top is 1032×250. I'd make it adapt to different screens:
  - Scale each part to the size of the slot it gets, keeping the shared background aligned across all three parts.
  - Add smaller layouts for laptop-width screens, where the side skyscrapers get narrower or shorter. That means repositioning the logo, panel and CTA instead of just shrinking them.
  - Hide the side parts below a minimum viewport width and fall back to the top banner only.
- **Playwright tests.** Take Playwright screenshots of each screen (start, fail endcard, win endcard, fireplace preview) and compare them with the PNGs in `design/` using `pixelmatch`. It outputs a diff image showing exactly which pixels differ, so any layout drift is caught automatically instead of by eye.

## Known issues and shortcuts

- **GSAP comes from a CDN** (cdnjs, 3.12.5). With no network the ads won't animate, and many ad specs don't allow external requests.
- **The `clickTag` fallback** is `https://example.com/landing` whenever `window.clickTag` isn't set.
- **Game:**
  - Collision uses rectangles shrunk by a per-obstacle factor. It's close, but not pixel-exact.
  - The obstacle order and heights are random, so a run can occasionally be very hard.
  - Sound only starts after the first tap, because of browser autoplay rules. The mute button is an emoji, not a designed asset.
- **Fireplace:** some supplied PNGs aren't transparent (solid black in `box.png`, the copy images and the CTA corners). They're patched with CSS, not fixed in the assets. See [DECISIONS.md](DECISIONS.md).
- **Assets aren't compressed:** about 2.1 MB for the game and 3.5 MB for the fireplace.
- There are no automated tests. I checked everything by hand in Chrome DevTools against the PNGs in `design/`.

## AI note

I used **Claude Code** (Claude in VS Code) as a pair programmer. It scaffolded the HTML/CSS structure, wrote the first versions of the GSAP timelines and game loop, worked out positions from the design PNGs, and helped write the README. I reviewed, tuned and simplified the output by hand. That covered things like game constants, hitbox shrink factors and animation timings.

**One example where the output was wrong:** in the fireplace, the AI assumed `box.png` and `left/hl.png` / `right/hl.png` were transparent PNGs and simply stacked them on top of the background. The result was a big black rectangle covering the moss and the product packs. Looking at the files showed that only the blue band and the white text were real content. Everything else was solid black. I fixed it by showing the panel through a cropped `overflow: hidden` window (`.box`) and blending the copy with `mix-blend-mode: screen`, so the black disappears (see `variant-b-fireplace/css/ad.css`).
