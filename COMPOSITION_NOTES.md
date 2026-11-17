# Section composition prototype

Branch: `codex/section-composition`, based on `codex/final-ux-review` at `b19b8cae7ed0c78cd9655c6f3d1e58b93da346ae`. Main is not changed.

This builds the six presentation refinements approved after the initial review. Existing portfolio facts and the source content file are preserved.

## What changed

1. **Different compositions for different chapters.** The desktop watch eases between positions and scales: prominent on Home and About, smaller and farther left for Experience and Contact. The work index has a narrower editorial column. Mobile retains the measured watch fit above the reading sheet.
2. **Experience as one unit.** The hanger comes before the role description on both desktop and mobile. Its desktop width is capped rather than stretching across the entire available column. Labels use a quieter sans-serif; one brass rule identifies the worn strap. The selected role's number and category repeat above the detail, and the strap controls explicitly reference that region for assistive technology.
3. **Quieter board material.** The pegboard is warm charcoal with higher roughness and less reflected light; the steel furniture is less bright. Geometry, strap construction, order, physics, and swap mechanics are retained.
4. **A consistent work preview and reading layout.** The left stage frames the actual watch complication when there is no separate media. Supplied project images/videos take that area when available. Film displays its actual photo there without cropping, while the watch's existing date-window behavior continues. The right column has a scrollable reading region and a stable Previous/Next footer, keeping long article titles from moving the controls. On phones, Film gives more height to the photograph. Native video seeking is not intercepted as project navigation.
5. **Fewer competing accents.** Serif is used for main headings, sans-serif for reading and controls, and monospace for small numbers. Headings and metadata are predominantly neutral; brass identifies actions and selection. The pink hotspot pulses are replaced by static warm-neutral affordances with brass hover/focus. Direction icons use SVG rather than depending on a font glyph.
6. **Subtle collection history.** Collection choices retain accessible current/opened descriptions, but their visual states use small dots rather than Open/Opened/Current labels or a glow. An unopened collection is still suggested below the item controls. Opening is not treated as completing or reading.

## Preview

From your existing repository folder:

```sh
git fetch origin
git switch codex/section-composition
git pull --ff-only origin codex/section-composition
python3 -m http.server 8000 --bind 127.0.0.1
```

Leave Terminal running and open `http://localhost:8000/#nointro`. To compare the prior proposal, stop the server, switch back to `codex/final-ux-review`, and run the same server command. The compiled bundle is included in both branches.

## Checks and visual limits

The source build and nine regression tests pass. The tests cover controller initialization with real THREE geometry and Canvas2D textures, chapter composition interpolation, all experience choices, collection routing, real-media binding, video pausing/seeking, reduced-motion autoplay, narrow-screen controller operation, and startup recovery.

The cloud browser cannot run WebGL. To check the actual HTML/CSS and controls, an ignored local QA page replaces GPU rendering only and runs the actual controller, geometry, and native Canvas2D textures. The desktop layout and a 375 × 667 iframe viewport were inspected with native browser layout. That check caught and fixed an intrinsic grid-size bug that cropped portrait photos and an inherited flex rule that pushed the mobile footer out of view. Long details scroll independently; More targets that region, and changing items resets it to the top.

The QA renderer is not included in this branch's source or compiled production bundle. The watch's final position, lighting/material appearance, and moving strap trajectories still need local visual review before merging. No screenshot, placeholder project media, QA harness, or deployment was added to GitHub.

Source changes are concentrated in `composition.css`, the panel markup in `index.html`, the presentation helper, and the existing controller. The prior review stylesheet remains so the earlier branch can be compared directly. `content.js` is unchanged.
