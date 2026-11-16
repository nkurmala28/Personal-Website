// Run from the repository root after installing the existing src dependencies.
// This rebuilds only the isolated prototype. Production files are read, never written.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'src/package.json'));
const {build} = require('esbuild');
const source = await readFile(path.join(root, 'src/main.js'),'utf8');
const needle = 'const cx = mob ? 0 : -visW * 0.2, cy =';
if(source.split(needle).length !== 2) throw new Error('The camera integration changed. Review the new main.js before updating this prototype.');
const patched = source.replace(needle,'const cx = mob ? 0 : -visW * 0.2 * (1 - (window.__prototypeCenter || 0)), cy =');
await mkdir(path.join(root,'design-prototypes'), {recursive:true});
await build({stdin:{contents:patched,resolveDir:path.join(root,'src'),sourcefile:'prototype-watch.js',loader:'js'},bundle:true,minify:true,format:'iife',outfile:path.join(root,'design-prototypes/watch.js')});
let html = await readFile(path.join(root,'index.html'),'utf8');
const bundles = [...html.matchAll(/<script src="\.\/bundle[^"]*\.js"><\/script>/g)];
if(bundles.length!==1)throw new Error('Expected exactly one production watch bundle.');
html = html.replace('</head>','<link rel="stylesheet" href="./design-prototypes/content.css">\n<script>if(!location.hash)history.replaceState(null,"","#nointro");</script>\n</head>');
html = html.replace(bundles[0][0],'<script src="./design-prototypes/before.js"></script>\n<script src="./design-prototypes/watch.js"></script>\n<script src="./design-prototypes/after.js"></script>');
html = html.replace('<title>Nikhil Kurmala</title>','<title>Nikhil Kurmala · Content design studies</title>');
await writeFile(path.join(root,'prototype.html'),html);
console.log('Updated prototype.html and design-prototypes/watch.js. Production source is unchanged.');
