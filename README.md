# Nikhil Kurmala, personal site

A scroll driven mechanical watch that holds a resume. Static site: no server, no database.

## What is in here

| File or folder | What it is | Who edits it |
|---|---|---|
| `content.js` | All the words, links and photo lists | You |
| `photos/` | Film photos and interest photos | You |
| `index.html` | Page layout and styling | Claude |
| `bundle.*.js` | The built watch (generated, do not edit) | Claude |
| `src/main.js` | Source code for the watch | Claude |
| `review.css` | Focused interface refinements | Developer |
| `content-view.html` | Generated readable recovery page | Build script |
| `DESIGN_REVIEW.md` | Review, rationale, remaining content priorities, and validation | Review |

## Where things are in `content.js`

The file runs in the same order as the site.

| Section | What it controls |
|---|---|
| `contact` | Email, LinkedIn and resume, on the Start screen and the Full set |
| `jobs` | The Strap chapter: one block per job (label, years, title, two sentences, optional link) |
| `jobOrder` | The order the straps sit on the display, left to right |
| `projects` | Projects, on the moonphase |
| `articles` | Articles, on the small seconds |
| `film` | Film, in the date window |
| `interests` | The four parts you can play with on the caseback |
| `signedOnTheBack` | The three engraved lines on the caseback |
| `fullSet` | The spec sheet at the end |

Anything still in `[SQUARE BRACKETS]` is a placeholder. Search the file for `[` to see what is left.

## Changing text or links

1. Open `content.js` on GitHub and click the pencil icon.
2. Change the text between the quote marks.
3. Click "Commit changes". The interactive site picks up the content on reload after deployment.
4. Run the build below and commit `content-view.html` too, to refresh the generated readable recovery page.

If the file has a typo that breaks it, the site still loads with its built in text, so nothing goes down. Fix the typo and commit again.

## Adding a photo

1. Open the `photos` folder on GitHub, click "Add file", then "Upload files".
2. Add the file name to the `film` list (or an interest's `photos` list) in `content.js`.

Keep photos under about 300 KB each so the page stays fast.

## Adding a resume

Upload `resume.pdf` next to `index.html`, then set `resume: "resume.pdf"` in `content.js`.

## Changing the watch, the layout or the animations

Those live in `src/main.js`, `index.html`, and `review.css`. To rebuild by hand:

```sh
cd src
npm ci
npm run build
npm test
```

The build generates the hashed `bundle.*.js`, updates its name in `index.html`, and refreshes `content-view.html`. Commit all generated changes with the source changes. Node 24 or newer is recommended for the development checks.

## Local preview

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Leave Terminal running and open **http://localhost:8000/** in your browser. Use **http://localhost:8000/#nointro** to skip the opening, or **http://localhost:8000/content-view.html** for the readable content page. Control-C stops the server. The compiled watch is included, so no Node install is needed just to preview.

