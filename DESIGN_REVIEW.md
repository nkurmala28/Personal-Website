# Portfolio review and five implemented refinements

Reviewed against main `3878a026b156630774d3909037a287c8b0f9f190` on November 16, 2026 (Pacific time). Proposed branch: `codex/final-ux-review`.

## Assessment

The watch is the strongest part of this portfolio. It gives the writing, technical work, and personality a shared visual idea. The next gain comes from making the meaning easier to find, rather than adding more mechanisms. A visitor should understand who Nikhil is immediately, then have reasons to explore the watch.

Main was the newest available version when the review began. The older `strap-rail-test`, `codex/editorial-full-mockup`, and `codex/content-design-prototypes` branches are not the latest source of the design. Main already has the larger industrial hanger, consulting at the left and journalism at the right, a clean work index, and five primary navigation destinations. This proposal builds on those improvements.

Three parallel reviews covered content, usability, and design references, followed by another regression review of the implementation. Findings below come from source inspection, reference research, controller tests, and the browser checks described under Validation. They are design judgments, not results from a user study.

## The five changes

### 1. Make the first visit informative and predictable

The home screen now gives a short professional introduction beside the name: strategy, data, software; an economic consultant who builds tools and used to write about watches. One short italic line bridges that identity to the watch.

The unboxing remains, with a visible Open the box control, one attempt to open, and an immediate Skip intro button. Previously it could require a random two or three attempts. The scroll arrow remains the invitation onward; its animation now stops after two cycles. The older spoken loader phrase is still hidden.

A required-script error, unavailable WebGL, or a 20-second startup timeout now offers a readable content page. That page is generated from the real portfolio content. It is useful to visitors who cannot run the renderer and prevents the old endless-loader dead end. Optional photo failures do not trigger recovery. If startup succeeds after a timeout, the normal controls remain usable.

Why: intrigue is useful when the next action is understandable. The portfolio should not make a recruiter solve the opening before learning who it belongs to.

### 2. Make dial finishes a named, compact choice

The swatch strip is now a native Dial disclosure at the top right. Its options pair a material swatch with a readable finish name. The selected name remains visible on desktop. Selection closes the disclosure and returns focus to its summary; Escape and outside click also close it.

The original sound toggle and volume control are preserved beside it. Sound stays directly accessible because muting should take one action. During an About close-up the whole picker is hidden, matching the existing unobstructed movement view.

Why: dial customization adds delight, but a permanent row of unlabeled circles competes with the opening message. Named options also communicate that these are distinct dial treatments rather than generic page themes.

### 3. Make experience readable without replacing the hanger

The physical hanger, board material, strap animation, and recent-first ordering remain the current main design. A concise instruction explains the relationship between selecting a strap and a work chapter. The medium desktop breakpoint gets a more flexible hanger grid and smaller role heading to reduce crowding.

Unfinished employer names and years are no longer printed as authoring instructions. Empty experience descriptions show Details coming soon and a short honest fallback. Empty metadata rows are hidden. Completed consulting and journalism copy remains intact. The same display cleanup removes unfinished film locations, project instructions, and empty interest lists; the authoring values remain in `content.js` for the owner to fill in.

Why: the board should explain the work through the selected role, employer, dates, contribution, and destination. Increasing its size again would not solve missing career details. Hiding placeholders is a presentation improvement, not a substitute for completing the content.

### 4. Connect the watch to the work and keep other collections discoverable

Projects, Writing, and Film now have actual dial hotspot buttons attached to the existing moonphase, seconds, and date anchors. Hovering or focusing a work-index row highlights its matching hotspot. The existing index remains a clear alternate route.

Inside a collection, the three collection choices appear above the title and stay visible on mobile. Each indicates whether it is current, already opened, or available to open. A contextual onward action suggests an unopened collection. It works regardless of which collection the visitor entered first and disappears once all three have been opened. This means opened, not completed or read.

Previous and Next identify the item type. Missing project media and destinations are labeled as project notes rather than implying a working demo. Videos pause when changing item or leaving, and reduced-motion preferences prevent autoplay. The mobile primary navigation keeps all five text labels visible. Off-screen hotspots and unavailable overlay controls leave the keyboard tab order.

Why: visitors need both a reason to click a complication and an obvious path onward after reading it. Forcing every visitor to finish every section would add friction; persistent choices and a relevant suggestion encourage exploration while leaving control with the visitor.

### 5. Give contact a direct next step

The final screen now leads with Email Nikhil and LinkedIn, then the current role, tools, and background. Resume on request leads to Contact instead of an empty link. Supplying a resume URL in `content.js` still turns it into a normal PDF destination.

Work authorization is a small disclosure containing the user's stated need for H-1B transfer sponsorship. The older fee/timing assertions are no longer presented as portfolio guidance.

Why: the watch metaphor has already done its work by this point. A visitor interested in a conversation should see a clear action immediately.

## Reference research

The review revisited [Siteinspire](https://www.siteinspire.com/), [Httpster](https://httpster.net/), [Cofolios](https://www.cofolios.com/), [Viewport UI](https://viewportui.com/), and [Design Spells](https://www.designspells.com/). Cofolios exposed its page shell but individual profile detail was not available through the research route; it was not used as evidence for a specific design claim. Viewport UI's active destination was `viewportui.com`.

The galleries supplied directions to investigate, not proof that a pattern is better. The most useful primary examples were:

| Example | Relevant observation | Applied judgment |
|---|---|---|
| [Paco](https://paco.me/) | Projects and writing have direct, explicit destinations | Preserve a readable work index beside the metaphor |
| [Rauno](https://rauno.me/) | Professional identity appears immediately | Add one concise home introduction |
| [Bauhaus Clock](https://bauhausclock.com/) | Dial choices use names | Pair finishes with text labels |
| [Bruno Simon](https://bruno-simon.com/) | A playful world also exposes recovery/options controls | Keep the unboxing optional and provide a readable recovery route |
| [Amanda Guo](https://byamandaguo.com/) | Grid/list and disable-ink controls expose different ways to browse | Keep content accessible alongside the interactive presentation |
| [Emi Takahashi](https://emitakahashi.ca/) | Work has titles, dates, categories, and thumbnails | Recommend project evidence as the next content pass |
| [Maximilian Kaspar](https://www.maximiliankaspar.com/) | Immediate identity and project metadata | Make role and project meaning legible early |

These observations concern accessible page content and controls. Motion fidelity and rendering quality were not treated as verified comparisons.

## Content priorities before a public launch

1. Complete engineering, quant, and banking: employer, dates, one concrete contribution, and a destination when appropriate. Until then, three of five straps contain little evidence.
2. Add one real image or short clip and one working destination per project. Notch and On device agents have descriptions, but none of the projects currently has a URL or media. Overflow clone also lacks its description. Consider featuring the strongest completed project first.
3. Add film locations/dates where known. Do not infer them from the images. The current titles and 35mm description remain usable.
4. Replace interest prompts with a few specific items only when supplied. Keep the present short personal descriptions; empty lists do not need to occupy space.
5. Add the resume PDF. The current branch intentionally preserves Resume on request until the file exists.

After content is complete, test with a few unfamiliar visitors: can they describe Nikhil's work after ten seconds, identify how to change experience, enter another work collection, and contact him without help? Record those observations before adding more animation or stronger scroll locks. The goal is voluntary exploration, not time spent fighting navigation.

## Validation and limits

- The source build generates the real THREE renderer bundle and the readable content page. The checked-in hashed bundle matches `index.html`.
- Six automated tests pass. They cover placeholder presentation, entry-order-independent onward suggestions, generated content, real controller initialization and work/role/contact interactions, keyboard Skip behavior, and nonfatal/fatal startup recovery.
- Integration tests build actual app source with real THREE geometry and Canvas2D textures. GPU rendering and layout measurements are replaced by test doubles. These tests catch missing DOM controls and routing failures; they do not verify visual geometry, animation smoothness, or overlap at real viewport sizes.
- The cloud preview browser cannot create a WebGL context. The failure message and its link to the populated readable portfolio were checked there. The actual 3D scene could not be visually signed off in this environment. Check the new branch locally on desktop and mobile before merging.
- No change was merged into main. No public deployment was made.

## Preview and compare

From an existing checkout:

```sh
git fetch origin
git switch codex/final-ux-review
python3 -m http.server 8000 --bind 127.0.0.1
```

Keep that terminal running. Open `http://localhost:8000/` for the normal visit or `http://localhost:8000/#nointro` to go straight to the portfolio. `http://localhost:8000/content-view.html` is the readable recovery page. Stop the server with Control-C.

The compiled bundle is included, so previewing does not require Node. For source changes, use a current Node release supporting the dependencies:

```sh
cd src
npm ci
npm run build
npm test
```

The build updates the hashed filename automatically. `content.js` updates the interactive site on reload; rebuild after editing it to refresh the generated recovery page as well.
