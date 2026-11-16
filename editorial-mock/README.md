# Complete editorial watch mockup
Based on strap-rail-test at 8e624d0f38eea5ca19d0f2b609c6d07d31769278.

This branch is a complete runnable mockup, using Claude's real hanger, straps, watch renderer, dial finishes, film photos, and interaction mechanisms.

## Preview
From the repository root:
```sh
python3 -m http.server 8000
```
Open http://localhost:8000/ . The opening box is skipped by default for easier design review. Use /#intro to inspect the existing unboxing.

## Design changes
- A short homepage introduction and clickable down-arrow invitation.
- A compact Dial disclosure, separate sound toggle, and resume link.
- Five main navigation destinations: Start, Experience, Work, About, Contact.
- Recent-first hanger order: consulting, engineering, quant, banking, journalism.
- A taller hanger, with a warmer, less reflective board and labels that mark the worn strap.
- Experience role and employer information grouped directly above the hanger.
- A clean work index connected to the existing complication hotspots through hover and keyboard focus.
- Persistent collection tabs, explicit previous/next controls, an All work return, and a next-collection suggestion.
- Compact About choices retaining the original movement interactions.
- Direct email and LinkedIn contact information.
- Responsive CSS and reduced-motion support.

Unfinished job dates, employer details, project copy, and interest lists are not invented. Existing placeholders are suppressed or replaced with short “more soon” copy for this mockup only.

## Files and renderer
The editorial layer lives in before.js, after.js, and style.css. before.js runs before the renderer initializes, so it can bind the new controls to the existing mechanisms. after.js uses the existing window.__watch bridge.

src/main.js and bundle.editorial-mock.js both contain the same one-material change: board color #484640, metalness .22, roughness .82, envMapIntensity .42. The new bundle is a copy of the branch's original built renderer with that unique material literal changed; it was not rebuilt during this session. All strap geometry and flight animations are retained. The original bundle and tray test page are retained for comparison.

To rebuild from source with the existing dependencies:
```sh
cd src
npm install
npm run build
cd ..
cp bundle.js bundle.editorial-mock.js
```

## Verification
JavaScript syntax checks passed for the editorial scripts and included renderer. Board substitutions were checked to match exactly once in source and compiled code. Relative file dependencies and pre-render binding order were checked. No local execution environment was available, so this new version has not been rendered or browser-tested and is not deployed.

Before merging, check desktop 1440x900 and 1280x720, phones 390x844 and 360x740, every strap switch, every collection as the first entry, returning to All work, all caseback toys, dial and sound controls, keyboard focus, and reduced motion. In particular, confirm the taller board and narrow phone labels fit without overlapping the story or watch.
