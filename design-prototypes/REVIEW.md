# Watch portfolio: content and navigation review
Reviewed 16 November 2026. Base: `412cffe15650d9d621e7faa0896b0a26045152dc`.

## Recommendation
Keep the mechanical watch as the organizing idea. Make its contents visible before asking someone to explore it.

Use the centered watch map for the work overview, then return to the existing left-watch/right-story composition for detail. Keep a short professional introduction on the opening screen. Preserve the current scroll narrative and clear direct navigation. No extra scroll locks, forced dwell time, or required clicks.

The experience hanger and strap-switching animation are being redesigned separately by Claude. These prototypes change only the experience copy and its hierarchy, not the straps, their geometry, or their animation.

## Working prototypes
Open `design-review.html` from a local server for the comparison launcher.

| Study | Entry | Difference |
|---|---|---|
| A: Editorial | `prototype.html?layout=editorial#nointro` | Existing watch-left composition with clearer identity and substantive collection previews |
| B: Watch map | `prototype.html?layout=map#nointro` | Work overview centers the real watch; connected callouts point to the three real complications |
| Original | `index.html#nointro` | Production page at the branch's base commit |

Inside either study, the “Design study” control switches layouts without restarting the watch. Both studies share the homepage, focus navigation and compact About changes, so the main comparison is how the work overview presents its contents.

These are executable code prototypes, not images. They use the existing renderer, content.js, photos, and mechanisms. **They have not been rendered or browser-tested:** the local execution environment was unavailable. JavaScript syntax and the exact camera patch were checked. The existing Claude artifact was inspected in the browser, including the opening, work overview, and project detail interactions.

## What the audit found
| Area | Finding | Proposed behavior |
|---|---|---|
| Opening | The name is the only introduction. Dial options are more explicit than the person's work. | Name, “High velocity generalist,” one short professional paragraph, one invitation to start. Call the swatches “Dial finish.” |
| Navigation | Eight labels include both Side projects and Projects; Background and interests is long. | Start, Experience, Work, About, Contact. Three collection choices appear where relevant. |
| Experience copy | The joke strikes out “straps” and writes “caps”; material precedes role information. | “Five roles. Choose a strap to see the story behind it.” Role, company/year where known, summary, then material. |
| Work overview | Source has moon/sec/date anchors, but HTML never instantiates the dial hotspot buttons. | Add all three real anchored controls, plus content previews that open the same mechanisms. |
| Work detail | Back means previous item; zoom-out means return to hub. | Separate “All work” from “Previous” and “Next project/article/frame.” |
| Mobile | The category stops are hidden; inactive bottom navigation labels have zero font size. | Persistent readable collection tabs and a plainly named main navigation. |
| Discovery | Current seen state marks a category immediately on entry. | Quiet “Opened” text/check, never “completed” or “read.” A next unopened category is suggested explicitly. |
| About | Provenance, lists, instructions and interaction compete. | One provenance line, four named interests, optional detailed interactions. |

## Content strategy
Suggested opening:
> I work in economic consulting and build tools on the side. Before that, I wrote about watches.

For experience, lead each selected role with **role / organization / dates**, then one concrete contribution. The current file has placeholder companies and dates for engineering, quant and banking; those should be supplied before launch. Prototype copy says that details are coming soon rather than inventing claims.

For work, show why to click:
- Projects: Notch, local agents, other experiments.
- Writing: bylined Wrist Review stories, with recognizable watch names.
- Film: a real photo thumbnail and the number of frames.

The “other two” collections stay visible above every detail. Color supports text labels and checkmarks. Opening every collection cannot be guaranteed; the goal is to make the alternatives clear and appealing.

About becomes “What makes me tick” with **Singapore → UCLA → San Francisco**, then Football, Cooking, Snowboarding and Music. Keep the existing toys. Omit unfinished lists in the prototype.

## Reference research
All five supplied galleries were accessed. Viewport UI redirects to viewportui.com. Cofolios exposed its category/case-study shell; individual portfolios were not reliably inspectable through the reader. The examples below were read on their live primary pages. Further browser inspection of Amanda Guo was blocked by automatic review after the session reached its usage limit. Motion fidelity of the references was not verified.

| Reference | Observed pattern | Adaptation |
|---|---|---|
| [Amanda Guo](https://byamandaguo.com/) via [Siteinspire](https://www.siteinspire.com/profile/28029-amanda-guo) | Professional introduction plus grid/list and disable-ink controls | Let expressive interaction coexist with obvious content navigation |
| [Emi Takahashi](https://emitakahashi.ca/) via [Siteinspire](https://www.siteinspire.com/website/13574-emi-takahashi) | Thumbnail view and project title/year/category metadata | Let callouts preview real contents instead of generic category descriptions |
| [Maximilian Kaspar](https://www.maximiliankaspar.com/) via [Siteinspire](https://www.siteinspire.com/website/13623-maximilian-kaspar) | Immediate professional identity, short project descriptions and metadata | Explain who Nikhil is before asking someone to decode the object |
| [Bauhaus Clock](https://bauhausclock.com/) via [Httpster](https://httpster.net/website/bauhausclock/) | Clock as the focal object; named dial choices | Keep the watch central while differentiating appearance controls from content |
| [Viewport UI: stacked showcase](https://viewportui.com/posts/614-scrollable-stacked-showcase) | Showcase reference for neighboring content | Keep sibling collections perceptible during detail |
| [Design Spells: orb picker](https://designspells.com/spells/orb-picker-in-elevenlabs) | Tactile selection reference | Use a clear selection response, subordinate to what selection reveals |

## Integration with Claude's ongoing work
No existing production files are changed. This branch adds only:
- `design-review.html`: comparison launcher.
- `prototype.html`: snapshot of the current production HTML with isolated study assets.
- `design-prototypes/before.js`: new content and controls, inserted before renderer initialization.
- `design-prototypes/after.js`: navigation, collection state and leader lines.
- `design-prototypes/content.css`: isolated visual studies.
- `design-prototypes/watch.js`: a copy of the existing generated renderer with one camera-center hook.
- `design-prototypes/build.mjs`: rebuilds the prototype from the latest production HTML/source.
- This review.

The included renderer was prepared by a checked, unique substitution of the desktop camera center in the existing bundle. It was not rebuilt in this session. The matching source change is explicit in build.mjs. Existing geometry, shaders, transitions and strap code are retained.

To refresh after the hanger revamp: incorporate the updated main branch, install the existing dependencies in src if needed, then run `node design-prototypes/build.mjs`. The generator fails if the expected camera integration has changed, rather than guessing. The supplemental UI selectors must still be checked against the new experience markup.

## Preview
From the repository root:
```sh
python3 -m http.server 8000
```
Open `http://localhost:8000/design-review.html`.

No install or rebuild is required for the included snapshot. Use a local HTTP server so the real film textures load correctly. Font loading retains the existing Google Fonts dependency.

## Required visual verification before integration
1. Desktop at 1440×900 and 1280×720: check labels/leader lines do not overlap the watch.
2. Phone at 390×844 and narrow phone at 360×740: verify the three rows, category tabs and bottom nav are readable, with no trapped scroll.
3. Open each collection first, switch siblings, use next/previous, return to All work, and verify the next unopened suggestion.
4. Switch all dial finishes; inspect the hot spots as the watch moves.
5. Select every experience and every interest; verify the new hanger still receives its intended interaction.
6. Keyboard: traverse every visible control, activate with Enter/Space, and ensure hidden panels do not capture focus.
7. Reduced motion: verify transitions respect the existing preference and the new callouts do not pulse.

A useful user test is whether a first-time visitor can explain what a strap and each complication contain, then choose a second collection without prompting. Time-on-page alone does not establish this.
