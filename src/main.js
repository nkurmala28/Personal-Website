import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2, rad = (d) => d * Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const $ = (id) => document.getElementById(id);
const stage = $('stage'), canvas = $('gl');

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { document.body.classList.add('nogl'); throw e; }
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f141a);

/* studio: three strip softboxes, a big overhead, soft fills, black elsewhere */
function studio() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x020203);
  const soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const panel = (w, h, x, y, z, c, i, hard) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), map: hard ? null : soft, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  panel(110, 70, 0, 80, 40, 0xffffff, 4.4);            // overhead key
  panel(10, 120, -75, 10, 45, 0xe6eeff, 7, true);      // left strip
  panel(10, 120, 78, 0, 50, 0xfff3e2, 6, true);        // right strip
  panel(120, 8, 0, 28, 100, 0xffffff, 4.5, true);      // thin front strip for long highlights
  panel(170, 90, 0, 60, 150, 0xffffff, 1.5);           // broad front fill
  panel(170, 70, 0, -70, 120, 0xe6ecf5, 1.5);          // low front fill
  panel(240, 240, 0, -100, 30, 0xffffff, 0.7);         // floor bounce
  panel(70, 70, 0, 30, -90, 0xffffff, 3);              // back light
  s.add(new THREE.Mesh(new THREE.SphereGeometry(320, 16, 8), new THREE.MeshBasicMaterial({ color: 0x8d949e, side: THREE.BackSide })));
  return s;
}
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio(), 0.01).texture;
const camera = new THREE.PerspectiveCamera(22, 1, 10, 900);
camera.position.set(0, 0, 262);
const key = new THREE.DirectionalLight(0xffffff, 3.3); scene.add(key); scene.add(key.target);
key.castShadow = true; key.shadow.mapSize.set(innerWidth <= 800 ? 1024 : 2048, innerWidth <= 800 ? 1024 : 2048); key.shadow.camera.near = 20; key.shadow.camera.far = 600; key.shadow.bias = -0.0006; key.shadow.radius = 3;
const rim = new THREE.DirectionalLight(0xbfd6ff, 0.7); rim.position.set(-120, 30, 40); scene.add(rim);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, opacity: 0.5, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(150,170,200,.55)'); gr.addColorStop(0.5, 'rgba(120,140,170,.14)'); gr.addColorStop(1, 'rgba(120,140,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
glow.position.z = -160; glow.renderOrder = -10; scene.add(glow);
const root = new THREE.Group(); scene.add(root);

/* ---------- layers and materials ---------- */
const ORDER = ['crystal', 'hands', 'dial', 'case', 'mov', 'bridges', 'rotor', 'back', 'strap'];
const LAY = {}; ORDER.forEach((n) => { LAY[n] = { g: new THREE.Group(), mats: [], meshes: [], o: 1 }; });
['crystal', 'hands', 'dial', 'case', 'mov', 'back', 'strap'].forEach((n) => root.add(LAY[n].g));
function M(layer, p, phys) {
  const m = (phys || p.anisotropy || p.clearcoat) ? new THREE.MeshPhysicalMaterial(p) : new THREE.MeshStandardMaterial(p);
  m.userData.bo = p.opacity ?? 1; m.userData.bt = !!p.transparent; m.userData.layer = layer;
  LAY[layer].mats.push(m); return m;
}
function setOpacity(layer, o) {
  const L = LAY[layer]; if (Math.abs(L.o - o) < 1e-4) return; L.o = o;
  L.g.visible = o > 0.01;
  L.mats.forEach((m) => { m.opacity = m.userData.bo * o; const t = m.userData.bt || o < 0.999; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.depthWrite = o > 0.5 && !m.userData.bt; });
  L.meshes.forEach((m) => { m.castShadow = o > 0.6 && !m.material.userData.bt; });
}
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !mat.userData.bt; m.receiveShadow = !mat.userData.bt; if (mat.userData.layer) LAY[mat.userData.layer].meshes.push(m); parent.add(m); return m; }

/* ---------- procedural textures ---------- */
function tex(size, draw, opt = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = opt.data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opt.repeat, opt.repeat); }
  if (opt.span) { t.repeat.set(1 / (2 * opt.span), 1 / (2 * opt.span)); t.offset.set(0.5, 0.5); }
  return t;
}
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
/* the finisher keeps his own dice, so the grain drawn for the dial and the straps elsewhere stays exactly as it was */
let fseed = 4711; const frnd = () => (fseed = (fseed * 16807) % 2147483647) / 2147483647;
/* perlage: rows of overlapping spots, each one a small turned disc that throws a bow tie of light. The tile is four spots by four rows. */
const PERL = 0.74;
const perlage = tex(256, (g, s) => { const q = s / 4, R = q * 0.68; g.fillStyle = '#c2c2c2'; g.fillRect(0, 0, s, s);
  for (let j = -1; j <= 4; j++) for (let i = -1; i <= 5; i++) { g.save(); g.translate((i + (j & 1 ? 0.5 : 0)) * q, j * q); g.scale(1, 1 / 0.866);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, '#dcdcdc'); gr.addColorStop(0.75, '#cacaca'); gr.addColorStop(1, '#a4a4a4'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    for (let k = 0; k < 36; k++) { const a = k * TAU / 36, c = Math.cos(2 * (a - 0.6)); g.fillStyle = c > 0 ? 'rgba(255,255,255,' + (0.6 * c * c) + ')' : 'rgba(0,0,0,' + (0.13 * c * c) + ')'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R * 0.97, a, a + TAU / 36 + 0.02); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1; [0.3, 0.52, 0.74].forEach((f) => { g.beginPath(); g.arc(0, 0, R * f, 0, TAU); g.stroke(); });
    g.strokeStyle = 'rgba(30,30,40,.24)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke(); g.restore(); } });
perlage.wrapS = perlage.wrapT = THREE.RepeatWrapping; perlage.repeat.set(1 / (4 * PERL), 1 / (4 * 0.866 * PERL));
const frost = tex(256, (g, s) => { g.fillStyle = '#808080'; g.fillRect(0, 0, s, s); for (let i = 0; i < 9000; i++) { const v = Math.floor(rnd() * 255); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(rnd() * s, rnd() * s, 1.6, 1.6); } }, { repeat: 1.2, data: true });
const streak = tex(256, (g, s) => { g.fillStyle = '#909090'; g.fillRect(0, 0, s, s); for (let i = 0; i < 1600; i++) { const v = Math.floor(90 + rnd() * 120); g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',.5)'; g.fillRect(rnd() * s, rnd() * s, 40 + rnd() * 200, 1); } }, { data: true });
streak.wrapS = streak.wrapT = THREE.RepeatWrapping;
function arcText(g, S, k, str, r, a0, a1, font, up = 1) { g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; const n = str.length; for (let i = 0; i < n; i++) { const a = rad(lerp(a0, a1, n > 1 ? i / (n - 1) : 0.5)); g.save(); g.translate(S / 2 + r * k * Math.cos(a), S / 2 - r * k * Math.sin(a)); g.rotate(-a + up * Math.PI / 2); g.fillText(str[i], 0, 0); g.restore(); } }
/* frosted German silver for the bridges: no stripes, a fine hand-grained surface. A small tile, repeated, with its own relief. */
const speck = (g, s, n, r0, r1, col) => { for (let i = 0; i < n; i++) { const x = frnd() * s, y = frnd() * s, r = r0 + frnd() * (r1 - r0); g.fillStyle = col(frnd()); for (let ox = -s; ox <= s; ox += s) for (let oy = -s; oy <= s; oy += s) { if (x + ox < -r || x + ox > s + r || y + oy < -r || y + oy > s + r) continue; g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill(); } } };
const bridgeTex = tex(256, (g, s) => { g.fillStyle = '#ece8dd'; g.fillRect(0, 0, s, s);
  speck(g, s, 900, 2, 4.5, (q) => q > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(84,74,52,.06)');
  speck(g, s, 5200, 0.6, 1.7, (q) => q > 0.5 ? 'rgba(255,255,255,' + (0.1 + q * 0.3) + ')' : 'rgba(84,74,52,' + (0.04 + q * 0.2) + ')'); }, { repeat: 1 / 4.2 });
const grainBump = tex(256, (g, s) => { g.fillStyle = '#808080'; g.fillRect(0, 0, s, s); speck(g, s, 4200, 0.8, 2.3, (q) => { const v = Math.floor(q * 255); return 'rgba(' + v + ',' + v + ',' + v + ',.8)'; }); }, { repeat: 1 / 3.1, data: true });
/* which way the grain runs on a turned part: the tangent frame is spun to follow the lathe, so light sweeps round a wheel as a bow tie */
const polarDir = tex(128, (g, s) => { const im = g.createImageData(s, s), d = im.data; for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const a = Math.atan2(s / 2 - 0.5 - y, x - s / 2 + 0.5), i = (y * s + x) * 4; d[i] = 127.5 + 127.5 * Math.cos(a); d[i + 1] = 127.5 + 127.5 * Math.sin(a); d[i + 2] = 255; d[i + 3] = 255; } g.putImageData(im, 0, 0); }, { span: 8, data: true });
/* circular graining for wheel faces and the barrel */
const cercTex = tex(512, (g, s) => { g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, s, s); const c = s / 2; for (let r = 1; r < s * 0.72; r += 0.9) { g.strokeStyle = frnd() > 0.5 ? 'rgba(255,255,255,' + (0.1 + frnd() * 0.4) + ')' : 'rgba(40,34,20,' + (0.05 + frnd() * 0.24) + ')'; g.lineWidth = 0.6 + frnd() * 1.3; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); } }, { span: 6.6 });
/* snailing for the winding wheels: spiral strokes from the hub, the Glashütte sunburst */
const snailTex = tex(512, (g, s) => { g.fillStyle = '#dedede'; g.fillRect(0, 0, s, s); const c = s / 2, n = 64; for (let k = 0; k < n * 3; k++) { const a0 = (k < n ? k : frnd() * n) * TAU / n, w = k < n ? s * 0.5 * TAU / n * 0.5 : 0.6 + frnd() * 1.6; g.beginPath(); for (let i = 0; i <= 40; i++) { const r = i / 40 * s * 0.52, a = a0 + (i / 40) * 1.35, x = c + r * Math.cos(a), y = c + r * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = k < n ? (k % 2 ? 'rgba(255,255,255,.3)' : 'rgba(26,26,34,.2)') : (frnd() > 0.5 ? 'rgba(255,255,255,.22)' : 'rgba(20,20,30,.16)'); g.lineWidth = w; g.stroke(); } }, { span: 4.7 });
seed = 997550894;   // hand the shared dice on exactly as the stripes used to leave them

/* ---------- content for the three complications ---------- */
const DATA = {
  date: { kicker: 'Film', hint: 'Next brings up the next frame.', items: ['Husky crossing', 'Counter seat', 'Snow platform', 'No parking', 'Limit 40', 'Carrera', 'Departures'].map((t, i) => ({ t, d: '[WHERE AND WHEN]. 35mm film.', r: i === 4 ? 1.418 : 0.705 })) },
  moon: { kicker: 'Projects', hint: 'Next turns the disc to the next project.', items: [
    { t: 'Notch', d: 'A Mac notch app with agents built in. Drop in a resume or an article and get a summary.', link: 'See it' },
    { t: 'Overflow clone', d: '[ONE OR TWO LINES ON WHAT IT DOES]', link: 'See it' },
    { t: 'On device agents', d: 'Open source models running locally, on my own data.', link: 'See it' }] },
  sec: { kicker: 'Articles', hint: 'Next steps the hand to the next article.', note: 'These are the bylined ones. I have ghostwritten many more.', items: [
    { t: "A Rare Vintage Panerai Radiomir 'Type A' ref.6152 Watch Auctioned For 226.000€", d: "Wrist Review, February 2019. A 1953 Radiomir that belonged to an Italian rear admiral sold for nearly twice its top estimate, and its case and movement came from Rolex.", link: 'Read it', url: 'https://wristreview.com/a-rare-vintage-panerai-radiomir-type-a-ref-6152-watch-auctioned-for-226-000e/' },
    { t: 'Ulysse Nardin Freak X Silicium Marquetry Watch', d: "Wrist Review, February 2019. Dials set from about 120 hand-fitted silicon pieces, on a watch with no hands: the movement itself turns once an hour and points to the minutes.", link: 'Read it', url: 'https://wristreview.com/ulysse-nardin-freak-x-silicium-marquetry-watch/' },
    { t: 'SIHH 2019: Piaget Polo S Green Dial Limited Edition Watch (Live Pics)', d: "Wrist Review, January 2019. The green dial Polo S from SIHH, limited to 500 pieces, on Piaget's thin in-house automatic.", link: 'Read it', url: 'https://wristreview.com/sihh-2019-piaget-polo-s-green-dial-limited-edition-watch-live-pics/' },
    { t: 'Introducing The Oris Aquis Date Relief Watch', d: "Wrist Review, February 2019. A diver made to back a swimmer's planned 800 km crossing of Lake Baikal, for water conservation.", link: 'Read it', url: 'https://wristreview.com/introducing-the-oris-aquis-date-relief-watch/' },
    { t: 'Everything on Wrist Review', d: 'The rest of my pieces for them, in one list.', link: 'See them all', url: 'https://wristreview.com/?s=NIKHIL+KURMALA' }] }
};
/* content.js, loaded before this script, holds everything the owner edits. Whatever it sets replaces the built-in text above; whatever it leaves out, or a file that fails to load, falls back to it */
const CT = (typeof window !== 'undefined' && window.CONTENT) || {};
if (Array.isArray(CT.projects) && CT.projects.length) DATA.moon.items = CT.projects.map((p) => ({ t: p.title || '', d: p.text || '', link: p.linkText || 'See it', url: p.link || '' }));
if (Array.isArray(CT.articles) && CT.articles.length) DATA.sec.items = CT.articles.map((p) => ({ t: p.title || '', d: p.text || '', link: p.linkText || 'Read it', url: p.link || '' }));
if (typeof CT.articlesNote === 'string') DATA.sec.note = CT.articlesNote;
if (Array.isArray(CT.film) && CT.film.length) DATA.date.items = CT.film.map((p) => ({ t: p.title || '', d: p.caption || '', r: p.landscape ? 1.418 : 0.705, file: p.file || '' }));
const NPROJ = DATA.moon.items.length;

/* ---------- dimensions (mm), from the build spec: 39 x 10.6, 46.5 lug to lug, 20 lugs ---------- */
const DR = 15.5, SUN = 12.4, DX = 10.4, MC = -7.0, AR = 2.6, DM = 2.8, MDR = 5.75, SX = -8.0, SR = 3.4, AP = 0.16;
const ZD = 1.6, ZB = -3.7, ZTOP = ZB + 8.0, ZBACK = ZB - 2.6, MZ = 0.1;
const inDate = (x, y) => Math.abs(x - DX) < 1.3 && Math.abs(y) < 1.3;
const inMoon = (x, y) => Math.hypot(x, y - MC) < AR + AP;
const inSub = (x, y) => Math.hypot(x - SX, y) < SR + AP;
const hex3 = (h) => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
/* polar texture: u runs around the dial, v runs centre to edge, so brushing can be truly radial */
function polarTex(R, c0, c1, holes, rings) {
  const W = 2048, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  const a = new Float32Array(rings ? H : W); let lo = 0; for (let i = 0; i < a.length; i++) { lo = lo * 0.9 + (rnd() - 0.5) * 0.1; a[i] = 1 + (rnd() - 0.5) * 0.22 + lo * 0.6; }
  const A = hex3(c0), B = hex3(c1);
  for (let y = 0; y < H; y++) { const v = 1 - y / (H - 1), r = v * R, t = Math.pow(v, 1.7); for (let x = 0; x < W; x++) { const an = x / W * TAU, px = r * Math.cos(an), py = r * Math.sin(an), s = rings ? a[y] : a[x], i = (y * W + x) * 4; d[i] = clamp(lerp(A[0], B[0], t) * s, 0, 255); d[i + 1] = clamp(lerp(A[1], B[1], t) * s, 0, 255); d[i + 2] = clamp(lerp(A[2], B[2], t) * s, 0, 255); d[i + 3] = holes && holes(px, py) ? 0 : 255; } }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; return t;
}
function polarDisc(R, rings, segs) { const pos = [], uv = [], idx = []; for (let i = 0; i <= rings; i++) { const r = R * i / rings; for (let j = 0; j <= segs; j++) { const a = j / segs * TAU; pos.push(r * Math.cos(a), r * Math.sin(a), 0); uv.push(j / segs, i / rings); } } for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function printTex(col, track, nums) { return tex(2048, (g, S) => { const k = S / 2 / DR, X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k; g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'butt';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '56px Georgia, "Times New Roman", serif'; const w = 'KURMALA'; for (let i = 0; i < w.length; i++) g.fillText(w[i], X((i - (w.length - 1) / 2) * 1.02), Y(5.6));
  if (nums) { g.font = '600 ' + Math.round(1.95 * k) + 'px Georgia, "Times New Roman", serif'; for (let h = 1; h <= 12; h++) { const a = h * Math.PI / 6; g.fillText(String(h), X(13.2 * Math.sin(a)), Y(13.2 * Math.cos(a)) + 0.08 * k); }
    g.lineWidth = 0.035 * k; [14.72, 15.12].forEach((r) => { g.beginPath(); g.arc(S / 2, S / 2, r * k, 0, TAU); g.stroke(); }); for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180; g.lineWidth = (i % 5 ? 0.035 : 0.09) * k; g.beginPath(); g.moveTo(X(14.72 * Math.sin(a)), Y(14.72 * Math.cos(a))); g.lineTo(X(15.12 * Math.sin(a)), Y(15.12 * Math.cos(a))); g.stroke(); } }
  else if (track) for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180; g.beginPath(); g.arc(X(15.0 * Math.sin(a)), Y(15.0 * Math.cos(a)), (i % 5 ? 0.065 : 0.11) * k, 0, TAU); g.fill(); } }); }
const ROM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
/* brush-painted numerals: heavy and hairline strokes, hairline serifs, each stroke a touch uneven like ink laid by hand */
function roman(g, str, h) { const W = { I: 0.3, V: 0.7, X: 0.7 }, gap = 0.08, thick = 0.15 * h, thin = 0.045 * h, sw = 0.14 * h; let tw = -gap; for (const ch of str) tw += W[ch] + gap; let x = -tw * h / 2; const t = -h / 2, b = h / 2;
  const st = (x0, y0, x1, y1, w) => { g.lineWidth = w * (0.9 + rnd() * 0.22); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }, sf = (cx, y) => st(cx - sw, y, cx + sw, y, thin);
  g.lineCap = 'butt'; for (const ch of str) { const w = W[ch] * h;
    if (ch === 'I') { st(x + w / 2, t, x + w / 2, b, thick); sf(x + w / 2, t); sf(x + w / 2, b); }
    if (ch === 'V') { st(x + thick * 0.7, t, x + w / 2, b, thick); st(x + w - thin, t, x + w / 2, b, thin); sf(x + thick * 0.7, t); sf(x + w - thin, t); }
    if (ch === 'X') { st(x + thick * 0.7, t, x + w - thick * 0.7, b, thick); st(x + w - thin, t, x + thin, b, thin); sf(x + thick * 0.7, t); sf(x + w - thin, t); sf(x + thin, b); sf(x + w - thick * 0.7, b); }
    x += w + gap * h; } }
const mixHex = (a, b, t) => { const A = hex3(a), B = hex3(b); return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')'; };
/* a day and night ring: noon sky at twelve, dusk and dawn at the quarters, stars and a moon at six */
function skyRing(g, S, k) { const c = S / 2, n = 720; for (let i = 0; i < n; i++) { const a = i / n * TAU, d = 0.5 + 0.5 * Math.cos(a); g.fillStyle = d < 0.42 ? mixHex('#131c44', '#d8a089', Math.pow(d / 0.42, 2.4)) : mixHex('#d8a089', '#c6dbee', Math.pow((d - 0.42) / 0.58, 0.55)); g.beginPath(); g.moveTo(c, c); g.arc(c, c, DR * k, a - Math.PI / 2 - 0.006, a - Math.PI / 2 + TAU / n + 0.006); g.closePath(); g.fill(); }
  seed = 88; for (let i = 0; i < 260; i++) { const a = Math.PI + (rnd() - 0.5) * 2.1, r = (12.6 + rnd() * 2.7) * k; g.fillStyle = 'rgba(255,244,214,' + (0.3 + rnd() * 0.7) + ')'; g.beginPath(); g.arc(c + r * Math.sin(a), c - r * Math.cos(a), (0.02 + rnd() * 0.05) * k, 0, TAU); g.fill(); }
  g.fillStyle = '#e9b64f'; g.beginPath(); g.arc(c, c - 13.95 * k, 0.5 * k, 0, TAU); g.fill(); g.strokeStyle = '#e9b64f'; g.lineWidth = 0.07 * k; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.beginPath(); g.moveTo(c + 0.66 * k * Math.cos(a), c - 13.95 * k + 0.66 * k * Math.sin(a)); g.lineTo(c + 0.9 * k * Math.cos(a), c - 13.95 * k + 0.9 * k * Math.sin(a)); g.stroke(); }
  g.fillStyle = '#f2e6c0'; g.beginPath(); g.arc(c, c + 13.95 * k, 0.5 * k, 0, TAU); g.fill(); g.fillStyle = '#131c44'; g.beginPath(); g.arc(c + 0.22 * k, c + 13.87 * k, 0.44 * k, 0, TAU); g.fill(); }
function chapterTex(bg, col, rom, sky) { return tex(2048, (g, S) => { const k = S / 2 / DR; g.fillStyle = bg; g.fillRect(0, 0, S, S); if (sky) { skyRing(g, S, k); col = '#b8935a'; } for (let i = 0; i < 26000; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '0,0,0') + ',' + (rnd() * 0.07) + ')'; g.fillRect(rnd() * S, rnd() * S, 2, 2); } g.fillStyle = col; for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180; g.beginPath(); g.arc(S / 2 + 15.15 * k * Math.sin(a), S / 2 - 15.15 * k * Math.cos(a), (i % 5 ? 0.085 : 0.13) * k * (rom ? 0.75 : 1), 0, TAU); g.fill(); }
  if (rom) { g.strokeStyle = col; seed = 31; ROM.forEach((str, i) => { const a = i * Math.PI / 6; g.save(); g.translate(S / 2 + 13.82 * k * Math.sin(a), S / 2 - 13.82 * k * Math.cos(a)); g.rotate(a); roman(g, str, 1.9 * k); g.restore(); }); } }); }
const DSTEP = TAU / 31;
function dateTexFor(bg, fg) { return tex(2048, (g, S) => { const k = S / 2 / 12.6; g.fillStyle = bg; g.fillRect(0, 0, S, S); g.fillStyle = fg; g.font = '700 124px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let d = 1; d <= 31; d++) { const a = -(d - 1) * DSTEP; g.save(); g.translate(S / 2, S / 2); g.rotate(-a); g.translate(DX * k, 0); g.fillText(String(d), 0, 6); g.restore(); } }); }
const aventurine = (g, S, bump, n) => { if (bump) { g.fillStyle = '#404040'; g.fillRect(0, 0, S, S); } else { const gr = g.createRadialGradient(S * 0.42, S * 0.4, 0, S / 2, S / 2, S * 0.62); gr.addColorStop(0, '#14286c'); gr.addColorStop(0.6, '#0a1646'); gr.addColorStop(1, '#040a24'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) { const x = rnd() * S, y = rnd() * S, R = S * (0.1 + rnd() * 0.2), cg = g.createRadialGradient(x, y, 0, x, y, R); cg.addColorStop(0, rnd() > 0.5 ? 'rgba(40,70,170,.22)' : 'rgba(0,0,20,.3)'); cg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = cg; g.fillRect(x - R, y - R, 2 * R, 2 * R); } }
  for (let i = 0; i < n; i++) { const x = rnd() * S, y = rnd() * S, q = rnd(), big = rnd() > 0.93, s = big ? 3.2 + rnd() * 3.6 : 0.9 + q * 2.1, c = rnd(); g.fillStyle = bump ? 'rgba(255,255,255,' + (0.3 + q * 0.6) + ')' : (c > 0.62 ? 'rgba(255,198,120,' : c > 0.3 ? 'rgba(236,160,96,' : c > 0.1 ? 'rgba(255,240,214,' : 'rgba(150,180,255,') + (0.35 + q * 0.65) + ')'; g.save(); g.translate(x, y); g.rotate(rnd() * TAU); g.fillRect(-s / 2, -s / 2, s, s * (0.5 + rnd() * 0.5)); g.restore();
    if (big && !bump && rnd() > 0.5) { g.strokeStyle = 'rgba(255,226,170,.55)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - s * 2.2, y); g.lineTo(x + s * 2.2, y); g.moveTo(x, y - s * 2.2); g.lineTo(x, y + s * 2.2); g.stroke(); } } };
const sky = (g, S) => aventurine(g, S, false, 2200);
const TILE = [['#243b6b', '#0e1830'], ['#5b3a1d', '#20140a'], ['#1f4a3d', '#0b1d18']];
/* the moon disc carries one round screen per project; each is drawn so it sits upright when it reaches the aperture */
const moonTex = tex(1024, (g, S) => { const k = S / 2 / MDR; sky(g, S);
  DATA.moon.items.forEach((it, i) => { const a = Math.PI / 2 + i * TAU / NPROJ, r = 2.2 * k; g.save(); g.translate(S / 2 + DM * k * Math.cos(a), S / 2 - DM * k * Math.sin(a)); g.rotate(-(a - Math.PI / 2)); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
    const c = TILE[i % TILE.length], gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(-r * 0.16, -r * 0.3); g.lineTo(r * 0.3, -r * 0.02); g.lineTo(-r * 0.16, r * 0.26); g.closePath(); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 ' + Math.round(r * 0.19) + 'px Helvetica, Arial, sans-serif'; g.fillText(it.t, 0, r * 0.52); g.font = '500 ' + Math.round(r * 0.1) + 'px Helvetica, Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('[PROJECT VIDEO]', 0, -r * 0.55); g.restore(); }); });
const moonAge = (((Date.now() / 86400000 - 10962.76) % 29.530588) + 29.530588) % 29.530588 / 29.530588;
/* at rest a moon covers the screens: a hand engraved gold crescent with a calm face in profile, on aventurine glass (deep blue, shot through with copper flecks) */
const moonCoverDraw = (bump, trick) => (g, S) => { seed = 606; const r = S * 0.34, cx = S * (trick ? 0.455 : 0.47), cy = S / 2, qx = cx + r * (trick ? 0.6 : 0.46), qy = cy - r * (trick ? 0.1 : 0.04), Rc = r * (trick ? 0.84 : 0.9); aventurine(g, S, bump, 2600);
  const o = document.createElement('canvas'); o.width = o.height = S; const h = o.getContext('2d'), ink = (a) => bump ? 'rgba(0,0,0,' + Math.min(1, a * 1.5) + ')' : 'rgba(96,62,12,' + a + ')', lip = (a) => bump ? 'rgba(255,255,255,' + a + ')' : 'rgba(255,244,200,' + a + ')';
  const mg = h.createRadialGradient(cx - r * 0.45, cy - r * 0.4, r * 0.05, cx, cy, r * 1.05); if (bump) { mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.8, '#d8d8d8'); mg.addColorStop(1, '#9a9a9a'); } else { mg.addColorStop(0, '#fff0b4'); mg.addColorStop(0.55, '#e6c06a'); mg.addColorStop(1, '#b88a36'); } h.fillStyle = mg; h.beginPath(); h.arc(cx, cy, r, 0, TAU); h.fill();
  /* the graver's work: a frosted ground, limb shading cut as short strokes, a few shallow craters, and a line border inside the edge */
  h.save(); h.beginPath(); h.arc(cx, cy, r, 0, TAU); h.clip(); for (let i = 0; i < 5200; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * r; h.fillStyle = rnd() > 0.5 ? ink(0.1) : lip(0.12); h.fillRect(cx + d * Math.cos(a), cy + d * Math.sin(a), 1.4, 1.4); }
  for (let i = 0; i < 170; i++) { const a = Math.PI * 0.5 + (i / 170) * Math.PI + (rnd() - 0.5) * 0.01, l = r * (0.07 + 0.13 * Math.pow(Math.sin((i / 170) * Math.PI), 0.7) * (0.6 + rnd() * 0.4)); h.strokeStyle = ink(0.34); h.lineWidth = S * 0.0022; h.beginPath(); h.moveTo(cx + r * 0.955 * Math.cos(a), cy + r * 0.955 * Math.sin(a)); h.lineTo(cx + (r * 0.955 - l) * Math.cos(a + 0.05), cy + (r * 0.955 - l) * Math.sin(a + 0.05)); h.stroke(); }
  [[-0.62, -0.38, 0.07], [-0.74, 0.12, 0.05], [-0.5, 0.52, 0.06], [-0.3, -0.74, 0.045], [-0.16, 0.8, 0.04]].forEach((c) => { const x = cx + c[0] * r, y = cy + c[1] * r, R = c[2] * r; h.fillStyle = ink(0.26); h.beginPath(); h.arc(x, y, R, 0, TAU); h.fill(); h.strokeStyle = lip(0.7); h.lineWidth = R * 0.22; h.beginPath(); h.arc(x, y, R, 0.3, 0.3 + Math.PI); h.stroke(); h.strokeStyle = ink(0.5); h.beginPath(); h.arc(x, y, R, 0.3 + Math.PI, 0.3 + TAU); h.stroke(); });
  h.strokeStyle = ink(0.55); h.lineWidth = S * 0.003; h.beginPath(); h.arc(cx, cy, r * 0.965, 0, TAU); h.stroke(); h.restore();
  /* the face: the inner edge of the crescent is a profile (brow, nose, lips, chin), looking into the sky */
  const prof = (t) => { const d = t - Math.PI, gs = (c, w, a) => a * Math.exp(-(d - c) * (d - c) / (w * w)); return 1 - gs(0.42, 0.2, 0.05) - gs(0.02, 0.1, 0.13) - gs(0.1, 0.16, 0.06) - gs(-0.2, 0.05, 0.045) - gs(-0.31, 0.05, 0.04) - gs(-0.52, 0.13, 0.07) + gs(0.24, 0.07, 0.03) + gs(-0.11, 0.035, 0.02) + gs(-0.255, 0.02, 0.02) + gs(-0.4, 0.05, 0.02); };
  const at = (t, k) => [qx + Rc * k * prof(t) * Math.cos(t), qy + Rc * k * prof(t) * Math.sin(t)];
  h.globalCompositeOperation = 'destination-out'; h.beginPath(); for (let n = 0; n <= 720; n++) { const p = at(n / 720 * TAU, 1); n ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1]); } h.closePath(); h.fill(); h.globalCompositeOperation = 'source-over';
  h.save(); h.globalCompositeOperation = 'source-atop'; h.lineCap = 'round';
  h.strokeStyle = lip(0.8); h.lineWidth = S * 0.006; h.beginPath(); for (let n = 0; n <= 300; n++) { const p = at(Math.PI - 1.15 + n / 300 * 2.3, 1.012); n ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1]); } h.stroke();
  h.strokeStyle = ink(0.5); h.lineWidth = S * 0.003; h.beginPath(); for (let n = 0; n <= 300; n++) { const p = at(Math.PI - 1.15 + n / 300 * 2.3, 1.035); n ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1]); } h.stroke();
  if (trick) { const e = at(Math.PI + 0.3, 1.27), b = at(Math.PI + 0.47, 1.3), mo = at(Math.PI - 0.255, 1.0), m1 = at(Math.PI - 0.42, 1.3), m2 = at(Math.PI - 0.2, 1.5), ck = at(Math.PI + 0.02, 1.42), u = r * 0.01, W = S * 0.001;
    /* a sidelong eye under a heavy lid, the pupil slid toward the sky */
    h.fillStyle = lip(0.9); h.beginPath(); h.moveTo(e[0] - 12 * u, e[1] + 1 * u); h.quadraticCurveTo(e[0], e[1] - 8 * u, e[0] + 12 * u, e[1] - 1 * u); h.quadraticCurveTo(e[0], e[1] + 6 * u, e[0] - 12 * u, e[1] + 1 * u); h.fill();
    h.fillStyle = ink(1); h.beginPath(); h.arc(e[0] + 4.5 * u, e[1] - 0.6 * u, 3.6 * u, 0, TAU); h.fill();
    h.strokeStyle = ink(0.95); h.lineWidth = 7 * W; h.beginPath(); h.moveTo(e[0] - 13 * u, e[1] + 1.5 * u); h.quadraticCurveTo(e[0], e[1] - 9 * u, e[0] + 13.5 * u, e[1] - 1.5 * u); h.stroke(); h.lineWidth = 3.5 * W; h.beginPath(); h.moveTo(e[0] - 12 * u, e[1] + 1 * u); h.quadraticCurveTo(e[0], e[1] + 6 * u, e[0] + 12 * u, e[1] - 1 * u); h.stroke();
    h.strokeStyle = ink(0.6); h.lineWidth = 3 * W; h.beginPath(); h.moveTo(e[0] - 9 * u, e[1] + 7 * u); h.quadraticCurveTo(e[0], e[1] + 10.5 * u, e[0] + 9 * u, e[1] + 6 * u); h.stroke();
    /* one brow cocked high */
    h.strokeStyle = ink(0.95); h.lineWidth = 8 * W; h.beginPath(); h.moveTo(b[0] - 15 * u, b[1] + 7 * u); h.quadraticCurveTo(b[0] - 2 * u, b[1] - 9 * u, b[0] + 15 * u, b[1] - 3 * u); h.stroke();
    /* a closed smirk, pulled far up into the cheek, with a dimple where it ends */
    h.lineWidth = 6.5 * W; h.beginPath(); h.moveTo(mo[0] + 1 * u, mo[1]); h.quadraticCurveTo(m1[0], m1[1] + 2 * u, m2[0], m2[1]); h.stroke(); h.lineWidth = 4 * W; h.beginPath(); h.arc(m2[0] - 2.5 * u, m2[1] - 3 * u, 5 * u, 0.3, 2.3); h.stroke();
    h.strokeStyle = ink(0.4); h.lineWidth = 2.6 * W; for (let n = 0; n < 5; n++) { h.beginPath(); h.moveTo(ck[0] - 10 * u + n * 3.2 * u, ck[1] + 5 * u); h.lineTo(ck[0] - 6 * u + n * 3.2 * u, ck[1] - 4 * u); h.stroke(); } }
  else { const e = at(Math.PI + 0.24, 1.15), b = at(Math.PI + 0.36, 1.13), c = at(Math.PI - 0.06, 1.2), mo = at(Math.PI - 0.255, 1.0), u = r * 0.01;
    h.strokeStyle = ink(0.85); h.lineWidth = S * 0.0045; h.beginPath(); h.moveTo(e[0] - 7 * u, e[1] - 1 * u); h.quadraticCurveTo(e[0], e[1] + 5 * u, e[0] + 8 * u, e[1] - 2 * u); h.stroke();
    h.lineWidth = S * 0.0022; for (let n = 0; n < 5; n++) { const f = n / 4, x = e[0] - 5 * u + f * 11 * u, y = e[1] + (1 - Math.pow(2 * f - 1, 2)) * 3.4 * u; h.beginPath(); h.moveTo(x, y); h.lineTo(x - 1.2 * u + f * 2.4 * u, y + 3.6 * u); h.stroke(); }
    h.lineWidth = S * 0.0034; h.beginPath(); h.moveTo(b[0] - 10 * u, b[1] + 1 * u); h.quadraticCurveTo(b[0] - 1 * u, b[1] - 5 * u, b[0] + 9 * u, b[1] - 1 * u); h.stroke();
    h.strokeStyle = ink(0.5); h.lineWidth = S * 0.003; h.beginPath(); h.arc(c[0] - 6 * u, c[1] + 4 * u, 9 * u, 0.5, 2.2); h.stroke(); h.beginPath(); h.moveTo(mo[0] - 1 * u, mo[1]); h.quadraticCurveTo(mo[0] - 8 * u, mo[1] + 1.5 * u, mo[0] - 13 * u, mo[1] - 2 * u); h.stroke(); }
  h.restore(); g.drawImage(o, 0, 0); };
/* every dial wears the calm crescent; the ecru sector dial gets its mischievous cousin */
const moonCoverTex = tex(1024, moonCoverDraw(false)), moonCoverBump = tex(1024, moonCoverDraw(true), { data: true }), moonAvTex = tex(1024, moonCoverDraw(false, true)), moonAvBump = tex(1024, moonCoverDraw(true, true), { data: true });
const RI = 13.2, RO = 15.3;
function ringDraw(bump) { return (g, S) => { const k = S / 2 / RO; g.fillStyle = bump ? '#808080' : '#d0d3d6'; g.fillRect(0, 0, S, S);
  g.fillStyle = bump ? '#000' : '#2c333b'; const str = 'NIKHIL KURMALA  ✦  MADE IN SINGAPORE  ✦  FINISHED AT UCLA  ✦  SAN FRANCISCO  ✦  NO. 28  ✦  '; g.font = '600 76px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; /* letters are spaced by their own widths, like a hand engraver's, so a narrow I no longer leaves a gap beside it */ const cw = [...str].map((ch) => g.measureText(ch).width + 13), tot = cw.reduce((s, v) => s + v, 0); let acc = 0; for (let i = 0; i < str.length; i++) { const ang = TAU * (acc + cw[i] / 2) / tot; acc += cw[i]; g.save(); g.translate(S / 2, S / 2); g.rotate(ang); g.translate(0, -14.25 * k); g.fillText(str[i], 0, 0); g.restore(); } }; }
const ringTex = tex(2048, ringDraw(false)), ringBump = tex(2048, ringDraw(true), { data: true });

/* ---------- shapes ---------- */
function gearShape(N, rp, o = {}) {
  const m = 2 * rp / N, ro = rp + m * (o.add ?? 1), rr = rp - m * 1.2, st = TAU / N, s = new THREE.Shape();
  for (let i = 0; i < N; i++) { const a = i * st; [[rr, -0.32], [ro, -0.14], [ro, 0.14], [rr, 0.32]].forEach((p, j) => { const x = p[0] * Math.cos(a + p[1] * st), y = p[0] * Math.sin(a + p[1] * st); (i === 0 && j === 0) ? s.moveTo(x, y) : s.lineTo(x, y); }); }
  s.closePath(); if (o.spokes) windows(s, o.ri ?? rr - m * 2.2, o.rh ?? rp * 0.22, o.spokes, o.sw ?? 0.16);
  return s;
}
function sector(ri, ro, a0, a1) { const p = new THREE.Path(); p.absarc(0, 0, ro, a0, a1, false); p.absarc(0, 0, ri, a1, a0, true); p.closePath(); return p; }
function windows(s, ri, rh, n, sw) { for (let i = 0; i < n; i++) { const a0 = i * TAU / n, a1 = (i + 1) * TAU / n; const p = new THREE.Path(); p.absarc(0, 0, ri, a0 + sw / ri, a1 - sw / ri, false); p.absarc(0, 0, rh, a1 - sw / rh, a0 + sw / rh, true); p.closePath(); s.holes.push(p); } }
function disc(ro) { const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, TAU, false); return s; }
const ext = (shape, depth, bevel = 0, seg = 20) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg });
function poly(pts) { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; }
function capsule(p0, p1, w0, w1) { const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), s = new THREE.Shape(); s.absarc(p0[0], p0[1], w0, a + Math.PI / 2, a + Math.PI * 1.5, false); s.absarc(p1[0], p1[1], w1, a - Math.PI / 2, a + Math.PI / 2, false); s.closePath(); return s; }
function lathe(pts, seg = 128) { const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg); g.rotateX(Math.PI / 2); return g; }
const cyl = (r, h, seg = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg).rotateX(Math.PI / 2);
const hole = (s, p, r) => { const h = new THREE.Path(); h.absarc(p[0], p[1], r, 0, TAU, true); s.holes.push(h); };


/* ---------- case: bowl shaped mid-case, coin edge bezel, down-turned drilled lugs ---------- */
const STEEL = 0xc8cacc;
/* the steel and strap finishes draw from their own random source, so nothing here disturbs the dial's */
const prng = (a) => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const uvMap = (g, f) => { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) { const p = f(u.getX(i), u.getY(i)); u.setXY(i, p[0], p[1]); } return g; };
/* every steel part carries its uv in millimetres with the grain along u, so one 25.6 mm tile of finish fits them all */
const TILE_MM = 25.6;
const steelTex = (draw) => { const t = tex(512, draw, { data: true }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / TILE_MM, 1 / TILE_MM); return t; };
/* satin: hairlines laid along u. Green is both the cross-grain slope of the normal and the roughness, so one texture does both jobs */
const hairTex = steelTex((g, S) => { const r = prng(5), im = g.createImageData(S, S), d = im.data, h = new Float32Array(S * S), row = new Float32Array(S);
  for (let y = 0; y < S; y++) row[y] = r() - 0.5;
  for (let y = 0; y < S; y++) { const base = row[y] * 0.5 + (row[(y + 1) % S] + row[(y + S - 1) % S]) * 0.2; for (let x = 0; x < S; x++) h[y * S + x] = base; }
  for (let i = 0; i < 5200; i++) { const y = (r() * S) | 0, x0 = (r() * S) | 0, l = 30 + r() * r() * 420, v = (r() - 0.5) * 1.3, w = r() > 0.93 ? 2 : 1; for (let k = 0; k < l; k++) { const e = Math.min(1, k / 12, (l - k) / 12); for (let q = 0; q < w; q++) h[((y + q) % S) * S + (x0 + k) % S] += v * e; } }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x, s = clamp(h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x], -1.6, 1.6) / 1.6, j = i * 4; d[j] = 128; d[j + 1] = 128 + 30 * s; d[j + 2] = 255; d[j + 3] = 255; }
  g.putImageData(im, 0, 0); });
/* mirror polish that has been worn and wiped: a low even roughness, a little haze and a few hairline swirls */
const scuffTex = steelTex((g, S) => { const r = prng(8); g.fillStyle = '#383838'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) { const x = r() * S, y = r() * S, R = 30 + r() * 90, al = 0.06 + r() * 0.12; [-S, 0, S].forEach((ox) => [-S, 0, S].forEach((oy) => { const q = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, R); q.addColorStop(0, 'rgba(110,110,110,' + al + ')'); q.addColorStop(1, 'rgba(110,110,110,0)'); g.fillStyle = q; g.fillRect(x + ox - R, y + oy - R, 2 * R, 2 * R); })); }
  g.lineCap = 'round'; for (let i = 0; i < 260; i++) { const x = r() * S, y = r() * S, a = (r() - 0.5) * 0.9 + (r() > 0.8 ? 1.3 : 0), l = 20 + r() * r() * 260, bend = (r() - 0.5) * 0.25 * l, dx = Math.cos(a) * l, dy = Math.sin(a) * l, v = Math.round(120 + r() * 135); g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.03 + r() * r() * 0.2) + ')'; g.lineWidth = 0.6 + r() * 0.6;
    [-S, 0, S].forEach((ox) => [-S, 0, S].forEach((oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + dx / 2 - Math.sin(a) * bend, y + oy + dy / 2 + Math.cos(a) * bend, x + ox + dx, y + oy + dy); g.stroke(); })); } });
const mPolish = M('case', { color: STEEL, metalness: 1, roughness: 0.34, roughnessMap: scuffTex, side: THREE.DoubleSide });
const brushP = { color: 0xbfc2c5, metalness: 1, roughness: 0.84, roughnessMap: hairTex, normalMap: hairTex, anisotropy: 0.55, anisotropyRotation: Math.PI / 2, envMapIntensity: 0.9, side: THREE.DoubleSide };
const mBrush = M('case', Object.assign({}, brushP)); mBrush.normalScale.set(0.3, 0.3);
const mBrushLug = M('case', Object.assign({}, brushP)); mBrushLug.normalScale.set(0.3, 0.3);
const mCoin = M('case', { color: STEEL, metalness: 1, roughness: 0.4, roughnessMap: scuffTex });
const mDark = M('case', { color: 0x08090b, metalness: 0.5, roughness: 0.6 });
const gCase = LAY.case.g;
/* a lathe turning whose uv is in mm: u round the part (a whole number of tiles, so the grain closes), v along the profile */
const turned = (pts, seg = 256) => { const cum = [0]; let rm = 0; pts.forEach((p, i) => { if (i) cum.push(cum[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])); rm = Math.max(rm, p[0]); }); const n = Math.max(1, Math.round(TAU * rm / TILE_MM)), last = pts.length - 1; return uvMap(lathe(pts, seg), (u, v) => [u * n * TILE_MM, cum[Math.round(v * last)]]); };
add(gCase, turned([[15.7, ZB + 5.2], [15.7, ZB], [16.0, ZB]]), mBrush);                                                                                          // inside wall and the seat for the back
add(gCase, turned([[16.0, ZB], [17.4, ZB + 0.45], [18.6, ZB + 1.2], [19.3, ZB + 1.85], [19.5, ZB + 2.1], [19.5, ZB + 4.86]]), mBrush);                       // bowl and band, satin round the case
add(gCase, turned([[19.5, ZB + 4.86], [19.2, ZB + 5.2]]), mPolish);                                                                                             // a polished chamfer under the bezel
add(gCase, turned([[19.2, ZB + 5.2], [15.7, ZB + 5.2]]), mBrush);
add(gCase, turned([[16.2, ZB + 5.2], [19.0, ZB + 5.2], [19.04, ZB + 5.5], [18.9, ZB + 5.95], [18.4, ZB + 6.4], [17.5, ZB + 6.72], [16.5, ZB + 6.82], [16.2, ZB + 6.7], [16.2, ZB + 5.2]]), mPolish);
add(gCase, turned([[DR + 0.02, ZD + 0.02], [16.15, ZB + 6.3]], 128), mBrush); // rehaut
const lugPts = [[14.0, 1.2], [17.5, 0.6], [20.5, -1.2], [22.6, -3.3], [23.25, -4.9], [22.4, -5.5], [19.5, -4.4], [16.5, -3.4], [14.0, -3.0]];
const lugShape = (() => { const s = new THREE.Shape(); s.moveTo(14.0, 1.2); s.quadraticCurveTo(17.4, 1.0, 19.9, -1.4); s.quadraticCurveTo(21.4, -3.0, 21.9, -4.9); s.quadraticCurveTo(21.9, -5.7, 21.1, -5.6); s.quadraticCurveTo(18.8, -4.6, 16.5, -3.5); s.lineTo(14.0, -3.0); s.closePath(); return s; })(), LH = [20.5, -4.0];
const lugBasis = (sy) => new THREE.Matrix4().makeBasis(new THREE.Vector3(0, sy, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
[[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => {
  const g = ext(lugShape, 2.2, 0.4); g.applyMatrix4(lugBasis(sy)); add(gCase, g, mPolish, sx * 11.5 - 1.1, 0, 0);           // polished body: only its chamfers stay visible
  [-0.42, 2.62].forEach((dx) => { const f = new THREE.ShapeGeometry(lugShape); f.applyMatrix4(lugBasis(sy)); add(gCase, f, mBrushLug, sx * 11.5 - 1.1 + dx, 0, 0); });   // brushed flanks, grain along the lug
  const top = [[14.0, 1.2], [15.8, 1.1], [17.2, 0.7], [18.6, -0.1], [19.9, -1.4], [20.8, -2.5], [21.5, -3.8]].map((p) => [p[0], p[1] + 0.43]); const tg = uvMap(ribbonGeo(top, () => 2.2, () => 0.02, sy, null, true), (u, v) => [v * 19.7, u * 2.2]); add(gCase, tg, mBrushLug, sx * 11.5, 0, 0);   // brushed top, grain along the lug
  const h = new THREE.CylinderGeometry(0.55, 0.55, 3.06, 16); h.rotateZ(Math.PI / 2); add(gCase, h, mDark, sx * 11.5, sy * LH[0], LH[1]);                       // drilled lug hole
});
/* a round brilliant set flush into the case at six, between the lugs. A mirror ball is not a diamond: this one has its own shader. Each flat facet lets the view ray in,
   bends it (a little differently for red, green and blue), bounces it off two pavilion facets and back out into a field of hard lights and darks. That is what makes a diamond scintillate as it turns */
{ const R = 0.92, y0 = -19.3, z0 = ZB + 3.5, md = new THREE.ShaderMaterial({ extensions: { derivatives: true },
    vertexShader: 'varying vec3 vP; varying vec3 vC; varying vec3 vW; varying mat3 vM; void main() { vP = position; vC = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz; vM = mat3(modelMatrix); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; varying vec3 vC; varying vec3 vW; varying mat3 vM; vec3 vH;
      float env(vec3 l) { vec3 d = normalize(vM * vec3(l.x, -l.y, l.z)); float v = 0.2 + 0.34 * smoothstep(-0.4, 0.9, d.y);
        v += 2.6 * smoothstep(0.92, 0.96, dot(d, normalize(vec3(0.5, 0.75, 0.45)))); v += 1.8 * smoothstep(0.94, 0.975, dot(d, normalize(vec3(-0.7, 0.4, 0.6)))); v += 1.4 * smoothstep(0.9, 0.94, dot(d, normalize(vec3(0.1, 0.3, -0.95)))); v += 1.2 * smoothstep(0.93, 0.96, dot(d, normalize(vec3(-0.3, -0.5, 0.8))));
        v += 1.1 * smoothstep(0.45, 0.6, sin(d.x * 11.0 + 1.0) * sin(d.y * 9.0 + 2.0) * sin(d.z * 10.0 + 0.5)); v *= 1.0 - 0.94 * smoothstep(0.78, 0.9, dot(d, vH)); return v; }
      vec3 trace(vec3 o, vec3 d) { vec3 col = vec3(0.0); float w = 1.0;
        for (int b = 0; b < 7; b++) { float tm = 1e9; vec3 nm = vec3(0.0, 1.0, 0.0); float pav = 0.0;
          for (int k = 0; k < 8; k++) { float a = float(k) * 0.7853982, a2 = a + 0.3926991, ca = cos(a), sa = sin(a), cb = cos(a2), sb = sin(a2); vec3 n; float dn, t;
            n = vec3(0.6528 * ca, -0.7576, 0.6528 * sa); dn = dot(n, d); if (dn > 1e-4) { t = (0.6515 - dot(n, o)) / dn; if (t < tm) { tm = t; nm = n; pav = 1.0; } }
            n = vec3(0.6756 * cb, -0.7373, 0.6756 * sb); dn = dot(n, d); if (dn > 1e-4) { t = (0.6756 - dot(n, o)) / dn; if (t < tm) { tm = t; nm = n; pav = 1.0; } }
            n = vec3(0.5592 * ca, 0.8290, 0.5592 * sa); dn = dot(n, d); if (dn > 1e-4) { t = (0.5592 - dot(n, o)) / dn; if (t < tm) { tm = t; nm = n; pav = 0.0; } }
            n = vec3(0.6428 * cb, 0.7660, 0.6428 * sb); dn = dot(n, d); if (dn > 1e-4) { t = (0.6428 - dot(n, o)) / dn; if (t < tm) { tm = t; nm = n; pav = 0.0; } } }
          if (d.y > 1e-4) { float t = (0.355 - o.y) / d.y; if (t < tm) { tm = t; nm = vec3(0.0, 1.0, 0.0); pav = 0.0; } }
          o += d * max(tm, 0.0); vec3 r = refract(d, -nm, 2.42);
          if (dot(r, r) < 0.5) { d = reflect(d, nm); continue; }
          float fr = 0.17 + 0.83 * pow(1.0 - abs(dot(r, nm)), 5.0);
          if (pav > 0.5) col += w * (1.0 - fr) * vec3(0.05, 0.055, 0.065); else { vec3 rr = refract(d, -nm, 2.37), rb = refract(d, -nm, 2.5); if (dot(rr, rr) < 0.5) rr = r; if (dot(rb, rb) < 0.5) rb = r; col += w * (1.0 - fr) * vec3(env(rr), env(r), env(rb)); }
          w *= fr; d = reflect(d, nm); if (w < 0.02) break; }
        return col; }
      void main() { vec3 N = normalize(cross(dFdx(vP), dFdy(vP))); vec3 I = normalize(vP - vC); if (dot(N, I) > 0.0) N = -N; vH = normalize(cameraPosition - vW);
        vec3 o = vec3(vP.x, -vP.y, vP.z) / ${R.toFixed(3)}, n = vec3(N.x, -N.y, N.z), i = vec3(I.x, -I.y, I.z);
        float f = 0.17 + 0.83 * pow(1.0 - max(dot(-i, n), 0.0), 5.0); vec3 T = refract(i, n, 1.0 / 2.42); vec3 inner = trace(o - n * 0.002, T); float white = env(reflect(i, n));
        vec3 col = inner * (1.0 - f) + vec3(white) * f * 0.9; col = col / (1.0 + 0.25 * col); gl_FragColor = vec4(pow(clamp(col * 1.25, 0.0, 1.0), vec3(0.75)), 1.0); }` });
  const cut = (pts, seg, turn) => { const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0] * R, p[1] * R)), seg).toNonIndexed(); g.rotateY(turn); g.rotateX(Math.PI); return g; };
  [cut([[1, 0.0], [0.86, 0.13]], 16, 0), cut([[0.86, 0.13], [0.7, 0.25]], 16, Math.PI / 16), cut([[0.7, 0.25], [0.56, 0.33]], 8, Math.PI / 8), cut([[0.56, 0.33], [0.5, 0.35]], 8, 0), cut([[0.5, 0.35], [0.001, 0.355]], 8, 0)].forEach((g) => { const me = new THREE.Mesh(g, md); me.position.set(0, y0, z0); gCase.add(me); });
  const seat = new THREE.LatheGeometry([[R * 0.99, 0.02], [R * 1.1, 0.0], [R * 1.14, -0.12], [R * 1.14, -0.5]].map((p) => new THREE.Vector2(p[0], p[1])), 48); seat.rotateX(Math.PI); add(gCase, seat, mPolish, 0, y0, z0); }
const xBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
const gCrown = new THREE.Group(); gCrown.position.set(19.7, 0, ZB + 3.5); gCase.add(gCrown);
{ const g = ext(gearShape(24, 3.1, { add: 0.55 }), 2.5, 0.12); g.applyMatrix4(xBasis); add(gCrown, g, mCoin); const cap = uvMap(new THREE.CylinderGeometry(2.45, 3.05, 0.5, 40), (u, v) => [u * TILE_MM, v * 0.8]); cap.rotateZ(-Math.PI / 2); add(gCrown, cap, mPolish, 2.95, 0, 0); const stem = new THREE.CylinderGeometry(0.7, 0.7, 6, 12); stem.rotateZ(Math.PI / 2); add(gCrown, stem, mPolish, -3, 0, 0);
  const nk = (bump) => tex(512, (g, S) => { const hi = bump ? '#fff' : '#f6f7f8'; g.fillStyle = bump ? '#303030' : '#7d838a'; g.fillRect(0, 0, S, S);
    if (!bump) for (let i = 0; i < 9000; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '0,0,0') + ',' + rnd() * 0.14 + ')'; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
    g.strokeStyle = hi; g.fillStyle = hi; g.lineWidth = 8; g.beginPath(); g.arc(256, 256, 232, 0, TAU); g.stroke(); for (let i = 0; i < 56; i++) { const a = i * TAU / 56; g.beginPath(); g.arc(256 + 211 * Math.cos(a), 256 + 211 * Math.sin(a), 4, 0, TAU); g.fill(); }
    // a cipher: the N has a hairline stem and a heavy diagonal, the K borrows the heavy stem, throws a hairline arm with a ball and a heavy curved leg
    g.fillRect(128, 146, 12, 220); g.fillRect(106, 146, 56, 9); g.fillRect(106, 357, 56, 9);
    g.beginPath(); g.moveTo(128, 146); g.lineTo(168, 146); g.lineTo(264, 366); g.lineTo(226, 366); g.closePath(); g.fill();
    g.fillRect(236, 146, 32, 220); g.fillRect(214, 146, 76, 9); g.fillRect(214, 357, 76, 9);
    g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(268, 276); g.quadraticCurveTo(322, 236, 372, 164); g.stroke(); g.beginPath(); g.arc(376, 160, 14, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(288, 250); g.quadraticCurveTo(344, 272, 376, 366); g.lineTo(418, 366); g.quadraticCurveTo(370, 252, 310, 228); g.closePath(); g.fill(); g.fillRect(356, 357, 80, 9); }, { data: bump });
  const face = add(gCrown, new THREE.CircleGeometry(2.42, 48), M('case', { map: nk(false), bumpMap: nk(true), bumpScale: 2.2, metalness: 1, roughness: 0.22 }), 3.22, 0, 0); face.rotation.y = Math.PI / 2; }

/* ---------- box sapphire with a faint AR tint ---------- */
const glassP = { color: 0x11131d, metalness: 1, roughness: 0.02, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
add(LAY.crystal.g, lathe([[0, ZTOP], [14.6, ZTOP - 0.06], [15.7, ZTOP - 0.2], [16.1, ZTOP - 0.6], [16.2, ZB + 6.4], [0, ZB + 6.4]], 128), M('crystal', glassP));

/* ---------- dial: five dial types, not five colours ---------- */
const gDial = LAY.dial.g;
const BLUED = 0x1c2f8c, RHOD = 0xeceef0, GOLD = 0xe3bd6a;
/* silver is the classic plate (kind 'sun'). The others are built up from their own parts in DIALS further down.
   pair is the strap a dial asks for; strap is the tint its calf leather takes. */
const WAYS = {
  silver: { name: 'Opaline silver', pair: 'consulting', kind: 'sun', idx: 'facet', dot: ['#f1eee6', '#bdb9ae'], c0: '#ece9e1', c1: '#d2cec4', ring: '#e2dfd6', print: '#16181d', date: ['#e9e7e0', '#16181d'], sub: '#dcd9d0', hands: 'breguet', hcol: BLUED },
  snow: { name: 'Snowdrift', pair: 'quant', kind: 'own', dot: ['#ffffff', '#c9d3e2'], date: ['#f4f5f7', '#16181d'], hands: 'blade', hcol: RHOD, hmet: 0.95, hr: 0.05, sec: BLUED, strap: 0x3a4250 },
  orge: { name: "Grain d'orge", pair: 'engineering', kind: 'own', dot: ['#727985', '#262a31'], date: ['#2c3037', '#f2f3f4'], hands: 'spear', hcol: RHOD, hmet: 0.72, hr: 0.07, strap: 0x2c3037 },
  sky: { name: 'Day and night', pair: 'consulting', kind: 'own', dot: ['#c9dcee', '#18224f'], date: ['#e6e9ee', '#1b2748'], hands: 'dauphine', hcol: RHOD, hmet: 0.72, hr: 0.07, sec: BLUED, strap: 0x7186ad },
  ecru: { name: 'Sector, \u00e9cru', pair: 'writing', kind: 'own', dot: ['#f1ead9', '#b9ad92'], date: ['#e9e1ce', '#1c2647'], hands: 'feuille', hcol: BLUED, hmet: 0.85, hr: 0.14, sec: 0xb02a2e, secmet: 0.1, secr: 0.45, strap: 0x1d2c52 }
};
const mDial = M('dial', { metalness: 0.28, roughness: 0.42, anisotropy: 0.85, clearcoat: 0.4, clearcoatRoughness: 0.08, alphaTest: 0.5 });
const mSub = M('dial', { metalness: 0.28, roughness: 0.38, anisotropy: 0.8, anisotropyRotation: Math.PI / 2 });
const mPrint = M('dial', { metalness: 0, roughness: 0.7, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const mDialSide = M('dial', { color: 0x15171a, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
const mApplied = M('dial', { color: 0xf4f5f7, metalness: 0.72, roughness: 0.1, side: THREE.DoubleSide });
const mIdx = M('dial', { color: 0xf7f8fa, metalness: 0.7, roughness: 0.06, envMapIntensity: 1.4, flatShading: true });
const mDate = M('dial', { metalness: 0, roughness: 0.55 });
const mMoon = M('dial', { map: moonTex, metalness: 0.2, roughness: 0.45 });
const mCover = new THREE.MeshStandardMaterial({ map: moonCoverTex, bumpMap: moonCoverBump, bumpScale: 1.6, metalness: 0.5, roughness: 0.36, transparent: true });
/* flat dials (lacquer, hammered, enamel) use plain x/y texture space with the three apertures cut out */
function cutApertures(g, S, R = SUN, m = 0) { const k = S / 2 / R, X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k; g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(X(DX - 1.3), Y(1.3), 2.6 * k, 2.6 * k); g.beginPath(); g.arc(X(0), Y(MC), (AR + AP + m) * k, 0, TAU); g.fill(); g.beginPath(); g.arc(X(SX), Y(0), (SR + AP + m) * k, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
const cTex = (c, data) => { const t = new THREE.CanvasTexture(c); t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const cnv = (S, H = S) => { const c = document.createElement('canvas'); c.width = S; c.height = H; return c; };
/* value noise and its octaves, for snow, nacre and anything else that should not repeat */
const hash2 = (x, y) => { const q = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return q - Math.floor(q); };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); };
const fbm = (x, y, oct = 4) => { let n = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { n += amp * vnoise(x * f + o * 17.3, y * f + o * 9.1); f *= 2.07; amp *= 0.5; } return n; };

/* ----- the two classic plates: a sunburst centre over a lower frosted chapter ring ----- */
const gClassic = new THREE.Group(); gDial.add(gClassic);
add(gDial, new THREE.CylinderGeometry(DR, DR, 0.4, 128, 1, true).rotateX(Math.PI / 2), mDialSide, 0, 0, ZD - 0.2);
const dialP = add(gClassic, polarDisc(SUN, 36, 256), mDial, 0, 0, ZD);
const mChap = M('dial', { metalness: 0.1, roughness: 0.75, bumpMap: frost, bumpScale: 0.25, clearcoat: 0, clearcoatRoughness: 0.04 });
const chapM = add(gClassic, new THREE.RingGeometry(SUN - 0.02, DR, 160), mChap, 0, 0, ZD - 0.15);
const stepM = add(gClassic, new THREE.CylinderGeometry(SUN, SUN, 0.15, 160, 1, true).rotateX(Math.PI / 2), mApplied, 0, 0, ZD - 0.075);
add(gClassic, new THREE.CircleGeometry(DR, 128), mPrint, 0, 0, ZD + 0.012).castShadow = false;
add(gDial, new THREE.CircleGeometry(DR - 0.05, 64), mDialSide, 0, 0, ZD - 0.52).rotation.y = Math.PI;
const dateDisc = add(gDial, new THREE.RingGeometry(8.3, 12.6, 128), mDate, 0, 0, ZD - 0.45);
const moonDisc = add(gDial, new THREE.CircleGeometry(MDR, 96), mMoon, 0, MC - DM, ZD - 0.24);
const moonCover = new THREE.Mesh(new THREE.CircleGeometry(AR + 0.03, 64), mCover); moonCover.position.set(0, MC, ZD - 0.2); gDial.add(moonCover);
/* the small seconds is sunk 0.3 with a polished chamfer, snailed, and carries its own railway track down in the recess */
add(gClassic, polarDisc(SR, 14, 96), mSub, SX, 0, ZD - 0.3);
add(gClassic, lathe([[SR + AP, ZD + 0.004], [SR, ZD - 0.3]], 96), mApplied, SX, 0, 0);
const mSubPrint = M('dial', { metalness: 0, roughness: 0.7, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
add(gClassic, new THREE.CircleGeometry(SR, 64), mSubPrint, SX, 0, ZD - 0.292).castShadow = false;
function subPrintTex(col) { return tex(512, (g, S) => { const k = S / 2 / SR, c = S / 2; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6; [3.18, 2.78].forEach((r) => { g.beginPath(); g.arc(c, c, r * k, 0, TAU); g.stroke(); });
  for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180; g.lineWidth = i % 5 ? 1.6 : 4.5; g.beginPath(); g.moveTo(c + 3.18 * k * Math.sin(a), c - 3.18 * k * Math.cos(a)); g.lineTo(c + (i % 5 ? 2.78 : 2.6) * k * Math.sin(a), c - (i % 5 ? 2.78 : 2.6) * k * Math.cos(a)); g.stroke(); }
  g.font = '500 ' + Math.round(0.52 * k) + 'px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; [['60', 0], ['15', 90], ['30', 180], ['45', 270]].forEach(([t, d]) => { const a = rad(d); g.fillText(t, c + 2.08 * k * Math.sin(a), c - 2.08 * k * Math.cos(a) + 2); }); }); }
dateDisc.receiveShadow = false; moonDisc.receiveShadow = false;
/* applied indices: a narrow mirror table, two 43 degree flanks, low walls, and a hip facet falling toward the centre.
   Every facet is its own flat plane with unshared corners, so the ridges stay sharp. */
const idxGeo = (() => { const L = 2.0, sec = [[-0.35, 0], [-0.35, 0.16], [-0.09, 0.40], [0.09, 0.40], [0.35, 0.16], [0.35, 0]], hip = 0.34, p = [];
  const y0 = (z) => -L / 2 + (z > 0.16 ? hip * (z - 0.16) / 0.24 : 0), A = sec.map((s) => [s[0], y0(s[1]), s[1]]), B = sec.map((s) => [s[0], L / 2, s[1]]);
  const quad = (a, b, c, d) => p.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < 5; i++) quad(A[i], A[i + 1], B[i + 1], B[i]);
  quad(B[1], B[4], B[3], B[2]); quad(B[0], B[5], B[4], B[1]);        // outer end: square cut
  quad(A[1], A[2], A[3], A[4]); quad(A[0], A[1], A[4], A[5]);        // inner end: wall, then the hip
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; })();
mIdx.side = THREE.DoubleSide;
/* IDX keeps the marker meshes by type; the built-up dials further down merge their own markers into one mesh each */
const gIdx = new THREE.Group(); gClassic.add(gIdx); const IDX = { facet: [] };
for (let h = 1; h <= 12; h++) { const a = rad(h * 30); Object.keys(IDX).forEach((t) => { (h === 12 ? [-0.5, 0.5] : [0]).forEach((off) => { const rr = 13.9, b = add(gIdx, idxGeo, mIdx, rr * Math.sin(a) + off * Math.cos(a), rr * Math.cos(a) - off * Math.sin(a), ZD - 0.15); b.rotation.z = -a; IDX[t].push(b); }); }); }
const dateFrame = (() => { const f = new THREE.Shape(); f.moveTo(DX - 1.55, -1.55); f.lineTo(DX + 1.55, -1.55); f.lineTo(DX + 1.55, 1.55); f.lineTo(DX - 1.55, 1.55); f.closePath(); const h = new THREE.Path(); h.moveTo(DX - 1.3, -1.3); h.lineTo(DX - 1.3, 1.3); h.lineTo(DX + 1.3, 1.3); h.lineTo(DX + 1.3, -1.3); h.closePath(); f.holes.push(h); return ext(f, 0.2, 0.08); })();
add(gClassic, dateFrame, mApplied, 0, 0, ZD + 0.02);
add(gClassic, lathe([[AR + AP, ZD + 0.004], [AR, ZD - 0.2]], 96), mApplied, 0, MC, 0);   // moonphase aperture: polished chamfer down to the disc
/* film frames live inside the date window itself. The window never changes; the camera goes right up to it. */
function photoTex(n) { const S = 1024, c = cnv(S), g = c.getContext('2d'), t = cTex(c), m = 12; g.fillStyle = '#0a0b0e'; g.fillRect(0, 0, S, S);
  t.userData.load = () => { const img = new Image(); img.onload = () => { const r = img.naturalWidth / img.naturalHeight; let w = S - 2 * m, h = w / r; if (h > S - 2 * m) { h = S - 2 * m; w = h * r; } g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h); t.needsUpdate = true; }; img.src = 'photos/' + ((DATA.date.items[n - 1] || {}).file || String(n).padStart(2, '0') + '.jpg'); }; return t; }
const photos = DATA.date.items.map((it, i) => photoTex(i + 1));
let photosAsked = false; function loadPhotos() { if (photosAsked) return; photosAsked = true; photos.forEach((t) => t.userData.load()); }
const photoMat = () => new THREE.MeshBasicMaterial({ map: photos[0], transparent: true, toneMapped: false });
const photoA = new THREE.Mesh(new THREE.PlaneGeometry(2.64, 2.64), photoMat()), photoB = new THREE.Mesh(photoA.geometry, photoMat());
[photoA, photoB].forEach((p) => { p.position.set(DX, 0, ZD - 0.4); gDial.add(p); }); photoB.visible = false;
/* the date itself travels with the dial: when the dial is lifted off the movement for a closer look, the window still shows today's date and never an empty hole */
const mDateCap = M('dial', { metalness: 0, roughness: 0.55 }), dateCap = new THREE.Mesh(new THREE.PlaneGeometry(2.64, 2.64), mDateCap); dateCap.position.set(DX, 0, ZD - 0.42); gDial.add(dateCap);
function dateCapTex(bg, fg) { return tex(256, (g, S) => { g.fillStyle = bg; g.fillRect(0, 0, S, S); g.fillStyle = fg; g.font = '700 148px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(new Date().getDate()), S / 2, S / 2 + 6); }); }

/* ----- tools for the built-up dials -----
   These dials are assembled the way a dial maker would: separate plates at different heights, polished bevels between them,
   turned collars round the apertures, applied markers. Heights below are in mm relative to the classic dial plane ZD. */
const inAp = (x, y, mm = 0, ms = mm, md = 0) => (Math.abs(x - DX) < 1.3 + md && Math.abs(y) < 1.3 + md) || Math.hypot(x, y - MC) < AR + mm || Math.hypot(x - SX, y) < SR + ms;
/* a strip of surface swept round the dial axis between two (radius, height) rings: flats, cones, bevels and walls are all this.
   u runs clockwise from twelve, v from the first ring to the second. Facing up when the second ring is the outer one. */
function band(r0, z0, r1, z1, a0 = 0, a1 = TAU, n = 0) { n = n || Math.max(6, Math.ceil(192 * (a1 - a0) / TAU)); const pos = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) { const a = a0 + (a1 - a0) * j / n, s = Math.sin(a), c = Math.cos(a); pos.push(r0 * s, r0 * c, z0, r1 * s, r1 * c, z1); uv.push(a / TAU, 0, a / TAU, 1); }
  for (let j = 0; j < n; j++) { const a = j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
/* the spans of a circle (clockwise from twelve) that stay clear of whatever test(x, y) marks as taken */
function arcs(r, test) { const N = 720, out = [], clear = (i) => { const a = i / N * TAU; return !test(r * Math.sin(a), r * Math.cos(a)); }; let i0 = 0; while (i0 < N && clear(i0)) i0++; if (i0 === N) return [[0, TAU]];
  let st = -1; for (let j = 1; j <= N; j++) { const c = clear((i0 + j) % N); if (c && st < 0) st = i0 + j; if (!c && st >= 0) { out.push([st / N * TAU, (i0 + j - 1) / N * TAU]); st = -1; } } return out; }
/* several geometries as one mesh. Unshared corners keep their flat facets, shared ones stay smooth. */
function merge(list) { let n = 0; const parts = list.map((g) => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
  const P = new Float32Array(n * 3), Q = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  parts.forEach((q) => { P.set(q.attributes.position.array, o * 3); Q.set(q.attributes.normal.array, o * 3); if (q.attributes.uv) U.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Q, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return g; }
const place = (geo, x = 0, y = 0, z = 0, rz = 0, sx = 1, sy = sx, sz = sx) => { const g = geo.clone(); g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; };
const atHour = (geo, h, r, z = 0, off = 0, s = 1) => { const a = rad(h * 30); return place(geo, r * Math.sin(a) + off * Math.cos(a), r * Math.cos(a) - off * Math.sin(a), z, -a, s); };
/* a turned profile, every step with its own crisp edge. With a test, each step is broken wherever the apertures get in its way. */
function prof(pts, test, a0, a1) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; (test ? arcs((p[0] + q[0]) / 2, test) : [[a0 ?? 0, a1 ?? TAU]]).forEach((s) => out.push(band(p[0], p[1], q[0], q[1], s[0], s[1]))); } return merge(out); }
/* a diamond cut marker lying along y with its inner end at -L/2: a mirror table (or a ridge when tab is 0), two flanks, low walls, a hip at either end */
function baton(o) { const L = o.L, w = o.w / 2, h = o.h, wl = o.wall ?? 0.14, t = (o.tab ?? 0.18) / 2, hi = o.hipIn ?? 0.3, ho = o.hipOut ?? 0, p = [];
  const sec = [[-w, 0], [-w, wl], [-t, h], [t, h], [w, wl], [w, 0]], sl = (z) => (z > wl ? (z - wl) / (h - wl) : 0), A = sec.map((s) => [s[0], -L / 2 + hi * sl(s[1]), s[1]]), B = sec.map((s) => [s[0], L / 2 - ho * sl(s[1]), s[1]]);
  const quad = (a, b, c, d) => p.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < 5; i++) quad(A[i], A[i + 1], B[i + 1], B[i]);
  quad(B[1], B[4], B[3], B[2]); quad(B[0], B[5], B[4], B[1]); quad(A[1], A[2], A[3], A[4]); quad(A[0], A[1], A[4], A[5]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.length / 3 * 2), 2)); g.computeVertexNormals(); return g; }
/* a canvas unrolled round the dial: x is the angle clockwise from twelve, y the radius from r0 at the bottom to r1 at the top.
   px(x, y) may then visit every texel in dial millimetres and return -1 to cut it away or a factor to shade it by. */
function polar(W, H, r0, r1, draw, px, data) { const c = cnv(W, H), g = c.getContext('2d'); draw(g, W, H, (r) => H * (1 - (r - r0) / (r1 - r0)));
  if (px) { const im = g.getImageData(0, 0, W, H), d = im.data; for (let y = 0; y < H; y++) { const r = r1 - (y + 0.5) / H * (r1 - r0); for (let x = 0; x < W; x++) { const a = (x + 0.5) / W * TAU, f = px(r * Math.sin(a), r * Math.cos(a), r, a), i = (y * W + x) * 4; if (f < 0) d[i + 3] = 0; else if (f !== 1) { d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; } } } g.putImageData(im, 0, 0); }
  const t = cTex(c, data); t.wrapS = THREE.RepeatWrapping; return t; }
const ramp = (stops, t) => { let i = 1; while (i < stops.length - 1 && t > stops[i][0]) i++; const a = stops[i - 1], b = stops[i]; return mixHex(a[1], b[1], clamp((t - a[0]) / (b[0] - a[0]), 0, 1)); };
/* soft contact shadow painted on a lower plate where a wall or collar stands on it */
const shadeRing = (g, cx, cy, r, w, al) => { const q = g.createRadialGradient(cx, cy, Math.max(0, Math.min(r, r + w)), cx, cy, Math.max(r, r + w)); q.addColorStop(w > 0 ? 0 : 1, 'rgba(0,0,10,' + al + ')'); q.addColorStop(w > 0 ? 1 : 0, 'rgba(0,0,10,0)'); g.fillStyle = q; g.beginPath(); g.arc(cx, cy, Math.max(r, r + w), 0, TAU); g.arc(cx, cy, Math.max(0, Math.min(r, r + w)), 0, TAU, true); g.fill(); };
const logo = (g, X, Y, k, col, y = 5.6) => { g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = Math.round(0.85 * k) + 'px Georgia, "Times New Roman", serif'; const w = 'KURMALA'; for (let i = 0; i < w.length; i++) g.fillText(w[i], X((i - (w.length - 1) / 2) * 1.02), Y(y)); };
/* fine circular graining for a satin ring, drawn on an unrolled canvas so every stroke runs true round the dial */
const satin = (g, W, H, base, R, n = 1400, al = 0.5) => { g.fillStyle = base; g.fillRect(0, 0, W, H); for (let i = 0; i < n; i++) { const v = R() > 0.5 ? 255 : 0, y = R() * H, x = R() * W, l = W * (0.15 + R() * 0.6); g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (R() * al * 0.16) + ')'; g.fillRect(x, y, l, 1); if (x + l > W) g.fillRect(0, y, x + l - W, 1); } };
/* a small seconds track for a sunk sub-dial, with or without numerals */
function secTrack(col, o = {}) { return tex(512, (g, S) => { const k = S / 2 / SR, c = S / 2, ro = o.ro ?? 3.12, ri = o.ri ?? 2.74; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.5; (o.rail === false ? [] : [ro, ri]).forEach((r) => { g.beginPath(); g.arc(c, c, r * k, 0, TAU); g.stroke(); });
  for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180, r2 = i % 5 ? ri : ri - 0.2; g.lineWidth = i % 5 ? 1.5 : 4.2; g.beginPath(); g.moveTo(c + ro * k * Math.sin(a), c - ro * k * Math.cos(a)); g.lineTo(c + r2 * k * Math.sin(a), c - r2 * k * Math.cos(a)); g.stroke(); }
  if (o.nums !== false) { g.font = '500 ' + Math.round(0.5 * k) + 'px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; [['60', 0], ['15', 90], ['30', 180], ['45', 270]].forEach(([t, d]) => { const a = rad(d); g.fillText(t, c + 2.02 * k * Math.sin(a), c - 2.02 * k * Math.cos(a) + 2); }); }
  if (o.cross) { g.lineWidth = 1.2; g.beginPath(); g.moveTo(c - 1.5 * k, c); g.lineTo(c + 1.5 * k, c); g.moveTo(c, c - 1.5 * k); g.lineTo(c, c + 1.5 * k); g.stroke(); } }); }
/* mother of pearl: slow flowing bands of nacre, cream with a breath of rose, green and blue, under a thin iridescent film */
function mopMaps(S, sd, base = [243, 239, 237], amp = 10) { const c = cnv(S), g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data, ct = cnv(S), gt = ct.getContext('2d'), it = gt.createImageData(S, S), e = it.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x / S * 2.2 + sd, v = y / S * 2.2, wx = fbm(u * 0.8 + 3.1, v * 0.8, 3), wy = fbm(u * 0.8, v * 0.8 + 7.7, 3), n = fbm(u * 0.6 + wx * 1.7, v * 1.1 + wy * 1.7, 3), m = fbm(u * 2 + wy * 4, v * 9 + wx * 4, 3), i = (y * S + x) * 4, ph = n * 7 + m * 0.8, l = 0.9 + 0.11 * Math.sin(n * 17 + m * 1.6) + 0.04 * (m - 0.5);
    d[i] = clamp((base[0] + amp * Math.cos(ph)) * l, 0, 255); d[i + 1] = clamp((base[1] + amp * Math.cos(ph + 2.1)) * l, 0, 255); d[i + 2] = clamp((base[2] + amp * Math.cos(ph + 4.2)) * l, 0, 255); d[i + 3] = 255; e[i] = e[i + 1] = e[i + 2] = clamp(128 + 120 * Math.sin(n * 12 + m * 2), 0, 255); e[i + 3] = 255; }
  g.putImageData(im, 0, 0); gt.putImageData(it, 0, 0); return { map: cTex(c), film: cTex(ct, true) }; }
const mopMat = () => M('dial', { metalness: 0.0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.35, iridescenceIOR: 1.3, iridescenceThicknessRange: [260, 420], bumpScale: 0.25 }, true);
/* every built-up dial keeps its own group and makes its textures only while it is the one on the watch */
const DIALS = {}, live = [];
const keep = (t) => { live.push(t); return t; };
const wear = (m, p) => { Object.keys(p).forEach((k) => { m[k] = keep(p[k]); }); m.needsUpdate = true; };
function strip() { live.forEach((t) => t.dispose()); live.length = 0; }
/* the furniture every built-up dial shares: a turned collar round the moon, the bevelled date frame, a sunk seconds dial inside its own ring */
function furniture(g, o) { const mt = o.metal || mApplied, zl = o.low ?? 0, zt = o.top ?? 0.08, zs = o.subZ ?? -0.34, cw = o.cw ?? 0.18;
  add(g, prof([[AR, -0.22], [AR + 0.15, zt], [AR + 0.15 + cw, zt], [AR + 0.25 + cw + (zt - zl) * 0.5, zl]]), mt, 0, MC, ZD);
  add(g, prof([[SR, zs], [SR + 0.15, zt], [SR + 0.15 + cw, zt], [SR + 0.25 + cw + (zt - zl) * 0.5, zl]]), mt, SX, 0, ZD);
  const df = add(g, dateFrame, mt, 0, 0, ZD + 0.02 + (o.dateZ ?? 0)); df.scale.z = o.dateS ?? 1;
  if (o.dateZ) { const q = new THREE.Shape(); q.moveTo(DX - 1.42, -1.42); q.lineTo(DX + 1.42, -1.42); q.lineTo(DX + 1.42, 1.42); q.lineTo(DX - 1.42, 1.42); q.closePath(); const h = new THREE.Path(); h.moveTo(DX - 1.3, -1.3); h.lineTo(DX - 1.3, 1.3); h.lineTo(DX + 1.3, 1.3); h.lineTo(DX + 1.3, -1.3); h.closePath(); q.holes.push(h); add(g, ext(q, o.dateZ + 0.4), mt, 0, 0, ZD - 0.38); }   // a thick plate gives the date a well: line it
  const sub = add(g, new THREE.CircleGeometry(SR + 0.02, 72), o.sub, SX, 0, ZD + zs), pr = add(g, new THREE.CircleGeometry(SR, 64), o.subPrint, SX, 0, ZD + zs + 0.008); pr.castShadow = false; return { sub, pr }; }
const printMat = () => M('dial', { metalness: 0, roughness: 0.7, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });

/* ----- Day and night: built like a stepped case back, every level its own plate. A petrol sunray centre sunk below a raised satin hour ring,
   the two joined by a polished chamfer over a dark wall; past the ring a second wall drops into a channel sunk half a millimetre, where an enamel
   sky with an applied gold sun, a crescent and stars turns once a day; then a third wall climbs to the sloping minute flange ----- */
let skyTurn = null;
DIALS.sky = (() => { const g = new THREE.Group(); gDial.add(g); g.visible = false;
  const RC = 8.2, ZC = -0.16, ZR = 0.36, CH = 0.3, R1 = 12.42, R2 = 14.62, ZS = -0.2, ZF0 = 0.32, ZF1 = 0.56, R = prng(5150);
  const mC = M('dial', { metalness: 0.35, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.35, bumpScale: 0.35, alphaTest: 0.5 });
  const mR = M('dial', { metalness: 0.2, roughness: 0.55, anisotropy: 0.5, anisotropyRotation: Math.PI / 2, specularIntensity: 0.6, alphaTest: 0.5 });
  const mS = M('dial', { metalness: 0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  const mF = M('dial', { metalness: 0.12, roughness: 0.7 });
  const mWall = M('dial', { color: 0x16263a, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide });
  const mGold = M('dial', { color: GOLD, metalness: 0.8, roughness: 0.18, side: THREE.DoubleSide }), mGoldF = M('dial', { color: 0xd9b566, metalness: 0.6, roughness: 0.55 });
  const mMop = mopMat(), mSP = printMat();
  const taken = (x, y) => Math.hypot(x, y - MC) < AR + 0.4 || Math.hypot(x - SX, y) < SR + 0.4;
  add(g, new THREE.CircleGeometry(RC + 0.06, 128), mC, 0, 0, ZD + ZC);                                  // the sunk centre
  add(g, prof([[RC, ZC], [RC, ZR - CH]], taken), mWall, 0, 0, ZD);                                      // the wall up to the hour ring
  add(g, prof([[RC, ZR - CH], [RC + CH, ZR]], taken), mApplied, 0, 0, ZD);                              // and its polished chamfer
  add(g, band(RC + CH, ZR, R1 - 0.24, ZR), mR, 0, 0, ZD);                                               // hour ring
  add(g, prof([[R1 - 0.24, ZR], [R1, ZR - 0.24]]), mApplied, 0, 0, ZD);                                 // its outer chamfer
  add(g, prof([[R1, ZR - 0.24], [R1, ZS]]), mWall, 0, 0, ZD);                                           // the wall down into the channel
  add(g, prof([[R2, ZS], [R2, ZF0 - 0.13]]), mWall, 0, 0, ZD);                                          // the wall up out of it
  add(g, prof([[R2, ZF0 - 0.13], [R2 + 0.13, ZF0]]), mApplied, 0, 0, ZD);                               // the flange's chamfer
  add(g, band(R2 + 0.13, ZF0, DR, ZF1), mF, 0, 0, ZD);                                                  // minute flange, rising to the rehaut
  add(g, band(DR, 0, DR, ZF1), mDialSide, 0, 0, ZD);
  const turn = new THREE.Group(); turn.position.z = ZD + ZS; g.add(turn);
  add(turn, band(R1 - 0.06, 0, R2 + 0.06, 0), mS);
  /* the sun: a frosted gold boss inside a crown of twelve mirror cut rays */
  const RM = (R1 + R2) / 2 + 0.02, ray = (L) => { const w = 0.13, g2 = new THREE.BufferGeometry(), b0 = [-w, 0, 0], b1 = [w, 0, 0], tip = [0, L, 0], top = [0, 0.02, 0.2]; g2.setAttribute('position', new THREE.Float32BufferAttribute([...b0, ...top, ...tip, ...tip, ...top, ...b1, ...b1, ...top, ...b0], 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(18), 2)); g2.computeVertexNormals(); return g2; };
  const rays = []; for (let i = 0; i < 12; i++) { const a = i * TAU / 12, L = i % 2 ? 0.28 : 0.42; rays.push(place(ray(L), 0.57 * Math.sin(a), RM + 0.57 * Math.cos(a), 0.01, -a)); }
  add(turn, merge(rays), mGold);
  const boss = add(turn, new THREE.SphereGeometry(0.5, 28, 10, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), mGoldF, 0, RM, 0.01); boss.scale.z = 0.5;
  add(turn, prof([[0.5, 0.1], [0.6, 0]]), mGold, 0, RM, 0.01);
  /* the moon: a domed crescent in polished white metal, and a handful of applied stars thinning toward dawn and dusk */
  { const s = new THREE.Shape(), r = 0.56, d = 0.3, r2 = 0.5, x = (r * r - r2 * r2 + d * d) / (2 * d), yy = Math.sqrt(r * r - x * x), a = Math.atan2(yy, x), b = Math.atan2(yy, x - d);
    s.absarc(0, 0, r, a, TAU - a, false); s.absarc(d, 0, r2, TAU - b, b, true); s.closePath();
    const m = add(turn, new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 4, curveSegments: 28 }), mApplied, 0.02, -RM, 0.01); m.rotation.z = rad(-24); }
  const star = (r) => { const p = [], q = r * 0.36; for (let i = 0; i < 4; i++) { const a = i * TAU / 4, b = a + TAU / 8, c = a - TAU / 8; p.push(r * Math.cos(a), r * Math.sin(a), 0, q * Math.cos(b), q * Math.sin(b), 0, 0, 0, r * 0.5, q * Math.cos(c), q * Math.sin(c), 0, r * Math.cos(a), r * Math.sin(a), 0, 0, 0, r * 0.5); } const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.length / 3 * 2), 2)); g2.computeVertexNormals(); return g2; };
  const stars = []; for (let i = 0; i < 22; i++) { let a, rr; do { a = rad(112 + R() * 136); rr = R1 + 0.32 + R() * (R2 - R1 - 0.64); } while (Math.abs(a - Math.PI) < 0.075); const sz = (0.1 + R() * R() * 0.16) * (1 - 0.5 * Math.abs(a - Math.PI) / rad(70)); stars.push(place(star(sz), rr * Math.sin(a), rr * Math.cos(a), 0.01, R() * 1.5)); }
  add(turn, merge(stars), mGold);
  skyTurn = turn;
  /* applied markers on the hour ring: tall diamond cut batons on real walls, so each throws its own shadow; doubled at twelve, none where the date and the seconds sit */
  const bp = { w: 0.66, h: 0.42, wall: 0.2, tab: 0.15, hipIn: 0.34, hipOut: 0.14 }, bt = baton(Object.assign({ L: 2.3 }, bp)), ix = [];
  [1, 2, 4, 5, 7, 8, 10, 11].forEach((h) => ix.push(atHour(bt, h, 10.95))); ix.push(atHour(bt, 12, 10.95, 0, -0.46), atHour(bt, 12, 10.95, 0, 0.46), atHour(baton(Object.assign({ L: 1.1 }, bp, { hipIn: 0.3 })), 6, 11.55));
  add(g, merge(ix), mIdx, 0, 0, ZD + ZR);
  { const p = [], w = 0.3, y0 = 15.34, y1 = 14.84, z0 = ZF0 + (y0 - R2) / (DR - R2) * (ZF1 - ZF0), z1 = ZF0 + (y1 - R2) / (DR - R2) * (ZF1 - ZF0); p.push(-w, y0, z0, 0, y1, z1, 0, y0 - 0.05, z0 + 0.16, 0, y1, z1, w, y0, z0, 0, y0 - 0.05, z0 + 0.16, w, y0, z0, -w, y0, z0, 0, y0 - 0.05, z0 + 0.16); const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g2.computeVertexNormals(); add(g, g2, mGold, 0, 0, ZD); }   // the pointer at twelve: whatever sky sits under it is now
  furniture(g, { low: ZC, top: ZR + 0.06, subZ: -0.16, dateZ: ZR, dateS: 0.35, sub: mMop, subPrint: mSP });
  return { g, secZ: -0.16, on() {
    const S = 1024, k = S / 2 / (RC + 0.06), c = cnv(S), q = c.getContext('2d'), X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k, P = prng(77);
    /* the centre: the same grained blue, a breath greener, in shade toward the wall that stands round it and where the collars stand on it */
    const gr = q.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, '#294c72'); gr.addColorStop(0.7, '#22416a'); gr.addColorStop(1, '#1c3456'); q.fillStyle = gr; q.fillRect(0, 0, S, S);
    for (let i = 0; i < 60000; i++) { q.fillStyle = P() > 0.5 ? 'rgba(255,255,255,' + P() * 0.1 + ')' : 'rgba(0,0,20,' + P() * 0.14 + ')'; q.fillRect(P() * S, P() * S, 1.5, 1.5); }
    shadeRing(q, S / 2, S / 2, RC * k, -1.1 * k, 0.55); shadeRing(q, S / 2, S / 2, RC * k, -0.3 * k, 0.35); shadeRing(q, X(0), Y(MC), (AR + 0.36) * k, 0.7 * k, 0.45); shadeRing(q, X(SX), Y(0), (SR + 0.36) * k, 0.7 * k, 0.45);
    logo(q, X, Y, k, '#e9edf3'); cutApertures(q, S, RC + 0.06, 0.1); wear(mC, { map: cTex(c) }); mC.bumpMap = frost;
    wear(mR, { map: polar(2048, 192, RC + CH, R1 - 0.24, (q2, W, H) => { satin(q2, W, H, '#22375e', P, 2600, 0.45); const e = q2.createLinearGradient(0, 0, 0, H); e.addColorStop(0, 'rgba(255,255,255,.12)'); e.addColorStop(0.2, 'rgba(255,255,255,0)'); e.addColorStop(0.85, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(255,255,255,.08)'); q2.fillStyle = e; q2.fillRect(0, 0, W, H); },
      (x, y) => { if (inAp(x, y, 0.22, 0.22)) return -1; const dm = Math.hypot(x, y - MC) - AR - 0.4, ds = Math.hypot(x - SX, y) - SR - 0.4, dd = Math.max(Math.abs(x - DX), Math.abs(y)) - 1.6, m = Math.min(dm, ds, dd); return m < 0.5 ? 0.78 + 0.22 * clamp(m / 0.5, 0, 1) : 1; }) });
    const dawn = [[0, '#d3e6f4'], [0.14, '#a3c8e6'], [0.205, '#b9d2e6'], [0.238, '#f0d9cf'], [0.258, '#dfa9b0'], [0.282, '#8a6fa6'], [0.31, '#34377a'], [0.36, '#161f52'], [0.5, '#0a1232']];
    const dusk = [[0, '#d3e6f4'], [0.14, '#a3c8e6'], [0.205, '#bfd2e2'], [0.238, '#f1d3b0'], [0.258, '#dd9f86'], [0.282, '#93648f'], [0.31, '#38326f'], [0.36, '#161f52'], [0.5, '#0a1232']];
    wear(mS, { map: polar(2048, 128, R1 - 0.06, R2 + 0.06, (q2, W, H) => { for (let x = 0; x < W; x++) { const f2 = x / W; q2.fillStyle = f2 < 0.5 ? ramp(dawn, f2) : ramp(dusk, 1 - f2); q2.fillRect(x, 0, 1, H); }
      for (let i = 0; i < 480; i++) { q2.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,10,40,.07)'; q2.fillRect(i / 480 * W, 0, W / 480 * 0.55, H); }
      for (let i = 0; i < 520; i++) { const f2 = 0.3 + P() * 0.4, al = (0.25 + P() * 0.7) * clamp((0.2 - Math.abs(f2 - 0.5)) / 0.08, 0, 1), s = 0.6 + P() * P() * 1.6; q2.fillStyle = P() > 0.3 ? 'rgba(235,240,255,' + al + ')' : 'rgba(255,226,170,' + al + ')'; q2.fillRect(f2 * W, P() * H, s * 0.6, s); }
      const e = q2.createLinearGradient(0, 0, 0, H); e.addColorStop(0, 'rgba(0,0,12,.6)'); e.addColorStop(0.24, 'rgba(0,0,12,0)'); e.addColorStop(0.72, 'rgba(0,0,12,0)'); e.addColorStop(1, 'rgba(0,0,12,.72)'); q2.fillStyle = e; q2.fillRect(0, 0, W, H); }) });
    wear(mF, { map: polar(2048, 96, R2 + 0.13, DR, (q2, W, H) => { q2.fillStyle = '#1f2f50'; q2.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { q2.fillStyle = 'rgba(' + (P() > 0.5 ? '255,255,255' : '0,0,0') + ',' + P() * 0.06 + ')'; q2.fillRect(P() * W, P() * H, 2, 2); }
      q2.fillStyle = '#eef1f5'; for (let i = 1; i < 60; i++) { const x = i / 60 * W, w = i % 5 ? 2.2 : 5; q2.fillRect(x - w / 2, H * (i % 5 ? 0.34 : 0.2), w, H * (i % 5 ? 0.36 : 0.62)); } }) });
    const mp = mopMaps(256, 3.7); wear(mMop, { map: mp.map, iridescenceThicknessMap: mp.film }); wear(mSP, { map: secTrack('#1b2748') });
  } }; })();

/* a height field shaded into colour (lit from the upper left, like the key light) with the relief kept as a bump map.
   col(x, y, out) fills in the flat colour of a texel; tint says how much of each channel the shadows take away, so snow can shade to blue */
function emboss(h, S, col, gain, lo, hi, tint = [1, 1, 1]) { const c = cnv(S), g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data, cb = cnv(S), gb = cb.getContext('2d'), ib = gb.createImageData(S, S), e = ib.data, A = [0, 0, 0];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x, xl = h[i - (x > 0 ? 1 : 0)], xr = h[i + (x < S - 1 ? 1 : 0)], yu = h[i - (y > 0 ? S : 0)], yd = h[i + (y < S - 1 ? S : 0)], sh = clamp(1 + gain * ((xr - xl) + (yd - yu)), lo, hi), o = i * 4, dk = 1 - sh; col(x, y, A);
    for (let j = 0; j < 3; j++) d[o + j] = clamp(A[j] * (sh < 1 ? 1 - dk * tint[j] : sh), 0, 255); d[o + 3] = 255; e[o] = e[o + 1] = e[o + 2] = h[i] * 255; e[o + 3] = 255; }
  g.putImageData(im, 0, 0); gb.putImageData(ib, 0, 0); return { c, g, bump: cTex(cb, true) }; }
/* a height field worked out at half size and enlarged: soft relief does not need every texel computed */
function grow(h, s) { const S = s * 2, o = new Float32Array(S * S); for (let y = 0; y < S; y++) { const fy = Math.min(s - 1.001, Math.max(0, (y - 0.5) / 2)), y0 = Math.floor(fy), ty = fy - y0; for (let x = 0; x < S; x++) { const fx = Math.min(s - 1.001, Math.max(0, (x - 0.5) / 2)), x0 = Math.floor(fx), tx = fx - x0, i = y0 * s + x0; o[y * S + x] = lerp(lerp(h[i], h[i + 1], tx), lerp(h[i + s], h[i + s + 1], tx), ty); } } return o; }
/* distance to the nearest of a scatter of points, one per cell: hammer strikes, each a shallow bowl with a ridge where two meet */
const worley = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y); let s = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const px = xi + a + 0.15 + 0.7 * hash2(xi + a, yi + b), py = yi + b + 0.15 + 0.7 * hash2(yi + b + 31.7, xi + a + 11.3), dd = (x - px) * (x - px) + (y - py) * (y - py); s += Math.exp(-9 * dd); } return -Math.log(s) / 9; };
/* an arrowhead marker: two mirror flanks meeting on a ridge that falls to the point, the point toward the centre */
function dart(L, w, h) { const oL = [-w / 2, L / 2, 0], oR = [w / 2, L / 2, 0], tip = [0, -L / 2, 0], top = [0, L * 0.38, h], g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...oL, ...tip, ...top, ...tip, ...oR, ...top, ...oR, ...oL, ...top], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(18), 2)); g.computeVertexNormals(); return g; }
/* a drop: a polished teardrop with a rounded back, its point toward the centre */
function drop(L, w, h, n = 22, m = 8) { const pos = [], idx = []; for (let i = 0; i <= n; i++) { const th = Math.PI * i / n, wy = Math.sin(th) * Math.pow(Math.sin(th / 2), 1.6) / 0.77, y = -Math.cos(th) * L / 2, hw = Math.max(1e-4, wy * w / 2), hh = h * Math.pow(Math.min(1, wy), 0.7); for (let j = 0; j <= m; j++) { const f = Math.PI * j / m; pos.push(-hw * Math.cos(f), y, hh * Math.sin(f)); } }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
const rrect = (w, h, r) => { const s = new THREE.Shape(), x = w / 2, y = h / 2; s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false); s.lineTo(x, y - r); s.absarc(x - r, y - r, r, 0, Math.PI / 2, false); s.lineTo(-x + r, y); s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-x, -y + r); s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false); return s; };

/* ----- Grain d'orge: a graphite plate engine turned in barleycorn, inside a raised satin chapter ring with a polished bevel.
   The name sits on its own applied plaque, as it must on a turned dial, and the markers are arrowheads ----- */
DIALS.orge = (() => { const g = new THREE.Group(); gDial.add(g); g.visible = false; const RG = 12.3, ZR = 0.17;
  const mG = M('dial', { metalness: 0.4, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.12, bumpScale: 0.8, alphaTest: 0.5 });
  const mRing = M('dial', { metalness: 0.2, roughness: 0.62 });
  const mSubG = M('dial', { metalness: 0.5, roughness: 0.34 }), mSP = printMat(), mPlq = M('dial', { metalness: 0.15, roughness: 0.6 });
  add(g, new THREE.CircleGeometry(RG + 0.06, 128), mG, 0, 0, ZD);
  add(g, prof([[RG, 0], [RG + 0.14, ZR]]), mApplied, 0, 0, ZD);
  add(g, band(RG + 0.14, ZR, DR, ZR), mRing, 0, 0, ZD); add(g, band(DR, 0, DR, ZR), mDialSide, 0, 0, ZD);
  const d1 = dart(2.1, 0.96, 0.44), ix = []; for (let h = 1; h <= 11; h++) ix.push(atHour(d1, h, 13.55)); ix.push(atHour(dart(2.1, 0.78, 0.44), 12, 13.55, 0, -0.5), atHour(dart(2.1, 0.78, 0.44), 12, 13.55, 0, 0.5));
  add(g, merge(ix), mIdx, 0, 0, ZD + ZR);
  add(g, new THREE.ExtrudeGeometry(rrect(6.2, 1.4, 0.3), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, curveSegments: 10 }), mApplied, 0, 5.6, ZD + 0.07);
  add(g, new THREE.ShapeGeometry(rrect(6.2, 1.4, 0.3), 10), mPlq, 0, 5.6, ZD + 0.185);
  furniture(g, { low: 0, top: 0.1, subZ: -0.3, sub: mSubG, subPrint: mSP });
  return { g, secZ: -0.3, on() { const S = 1024, RR = RG + 0.06, k = S / 2 / RR, h = new Float32Array(S * S), P = prng(808);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (x - S / 2) / k, dy = (y - S / 2) / k, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx), inner = r < 4.5, p = inner ? 0.3 : 0.36, s = 0.5 * p * Math.sin((inner ? 40 : 80) * th), fa = (r - s) / (2 * p), fb = (r + s) / (2 * p) + 0.5, da = Math.abs(fa - Math.round(fa)), db = Math.abs(fb - Math.round(fb));
      h[y * S + x] = Math.abs(r - 4.5) < 0.09 || r < 1.2 ? 0.25 : Math.pow(Math.min(1, Math.min(da, db) * 4.4), 0.7); }
    const A = hex3('#767e8b'), B = hex3('#4f555f'), e = emboss(h, S, (x, y, o) => { const t = clamp(Math.hypot(x - S / 2, y - S / 2) / (S / 2), 0, 1), q = t * t; o[0] = lerp(A[0], B[0], q); o[1] = lerp(A[1], B[1], q); o[2] = lerp(A[2], B[2], q); }, 1.9, 0.6, 1.5);
    const X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k; shadeRing(e.g, S / 2, S / 2, RG * k, -0.6 * k, 0.45); shadeRing(e.g, X(0), Y(MC), (AR + 0.45) * k, 0.5 * k, 0.4); shadeRing(e.g, X(SX), Y(0), (SR + 0.45) * k, 0.5 * k, 0.4);
    cutApertures(e.g, S, RR, 0.12); wear(mG, { map: cTex(e.c), bumpMap: e.bump });
    wear(mRing, { map: polar(2048, 160, RG + 0.14, DR, (q, W, H, ry) => { q.fillStyle = '#343941'; q.fillRect(0, 0, W, H); for (let i = 0; i < 26000; i++) { q.fillStyle = 'rgba(' + (P() > 0.5 ? '255,255,255' : '0,0,0') + ',' + P() * 0.09 + ')'; q.fillRect(P() * W, P() * H, 1.4, 2); } q.fillStyle = '#f2f3f4';
      for (let i = 0; i < 60; i++) { const x = i / 60 * W, w = i % 5 ? 2 : 4.4, y0 = ry(15.22), y1 = ry(i % 5 ? 14.86 : 14.7); q.fillRect(x - w / 2, y0, w, y1 - y0); if (i === 0) q.fillRect(W - w / 2, y0, w, y1 - y0); } }) });
    wear(mSubG, { map: tex(512, (q, T) => { q.fillStyle = '#3b4049'; q.fillRect(0, 0, T, T); for (let r = 2; r < T * 0.5; r += 2.6) { q.strokeStyle = P() > 0.5 ? 'rgba(255,255,255,' + (0.05 + P() * 0.16) + ')' : 'rgba(0,0,0,' + (0.08 + P() * 0.2) + ')'; q.lineWidth = 1.4; q.beginPath(); q.arc(T / 2, T / 2, r, 0, TAU); q.stroke(); } shadeRing(q, T / 2, T / 2, T / 2, -T * 0.07, 0.45); }) });
    wear(mSP, { map: secTrack('#f2f3f4') });
    { const c = cnv(512, 128), q = c.getContext('2d'); q.fillStyle = '#c9ccd2'; q.fillRect(0, 0, 512, 128); for (let i = 0; i < 5000; i++) { q.fillStyle = 'rgba(' + (P() > 0.5 ? '255,255,255' : '0,0,0') + ',' + P() * 0.07 + ')'; q.fillRect(P() * 512, P() * 128, 1.5, 1.5); }
      q.fillStyle = '#1d2026'; q.font = '62px Georgia, "Times New Roman", serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; const w = 'KURMALA'; for (let i = 0; i < w.length; i++) q.fillText(w[i], 256 + (i - 3) * 62, 68); const t = cTex(c); t.repeat.set(1 / 6.2, 1 / 1.4 * 0.25 * 4); t.offset.set(0.5, 0.5); wear(mPlq, { map: t }); }
  } }; })();

/* ----- Snowdrift: a white plate pressed with wind blown drifts whose shadows fall blue, tall diamond cut blocks, a frosted sunk seconds ----- */
DIALS.snow = (() => { const g = new THREE.Group(); gDial.add(g); g.visible = false;
  const mW = M('dial', { metalness: 0.06, roughness: 0.58, clearcoat: 0.15, clearcoatRoughness: 0.4, bumpScale: 0.8, alphaTest: 0.5 });
  const mSubW = M('dial', { metalness: 0.2, roughness: 0.5 }), mSP = printMat();
  add(g, new THREE.CircleGeometry(DR - 0.02, 128), mW, 0, 0, ZD);
  const bl = baton({ L: 2.3, w: 0.84, h: 0.46, wall: 0.2, tab: 0.34, hipIn: 0.34, hipOut: 0.2 }), b12 = baton({ L: 2.3, w: 0.7, h: 0.46, wall: 0.2, tab: 0.26, hipIn: 0.34, hipOut: 0.2 }), ix = [];
  for (let h = 1; h <= 11; h++) ix.push(atHour(bl, h, 13.55)); ix.push(atHour(b12, 12, 13.55, 0, -0.47), atHour(b12, 12, 13.55, 0, 0.47));
  add(g, merge(ix), mIdx, 0, 0, ZD);
  furniture(g, { low: 0, top: 0.07, cw: 0.14, subZ: -0.3, sub: mSubW, subPrint: mSP });
  return { g, secZ: -0.3, on() { const S = 1024, k = S / 2 / DR, s2 = S / 2, k2 = k / 2, h0 = new Float32Array(s2 * s2), ca = Math.cos(rad(24)), sa = Math.sin(rad(24)), P = prng(303);
    for (let y = 0; y < s2; y++) for (let x = 0; x < s2; x++) { const dx = (x - s2 / 2) / k2, dy = (y - s2 / 2) / k2, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, wv = fbm(u * 0.22 + 9, v * 0.4, 2), a = fbm(u * 0.26 + wv * 1.6, v * 0.85 + 4, 4), b = fbm(u * 0.5 + 20, v * 1.7 + wv * 2.4, 3), rg = 1 - Math.abs(2 * b - 1); h0[y * s2 + x] = clamp(0.82 * a + 0.18 * rg * rg * rg, 0, 1); }
    const h = grow(h0, s2); for (let i = 0; i < h.length; i++) h[i] = clamp(h[i] + 0.035 * (P() - 0.5), 0, 1);   // and a little crystal sparkle on top
    const e = emboss(h, S, (x, y, o) => { o[0] = 239; o[1] = 242; o[2] = 246; }, 6.6, 0.68, 1.07, [1.4, 1.1, 0.72]);
    const X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k, q = e.g; q.strokeStyle = '#2a2e35'; for (let i = 0; i < 60; i++) { if (i % 5 === 0) continue; const a = i * TAU / 60; q.lineWidth = 0.05 * k; q.beginPath(); q.moveTo(X(14.55 * Math.sin(a)), Y(14.55 * Math.cos(a))); q.lineTo(X(15.1 * Math.sin(a)), Y(15.1 * Math.cos(a))); q.stroke(); }
    logo(q, X, Y, k, '#14161a'); shadeRing(q, X(0), Y(MC), (AR + 0.4) * k, 0.45 * k, 0.22); shadeRing(q, X(SX), Y(0), (SR + 0.4) * k, 0.45 * k, 0.22);
    cutApertures(q, S, DR, 0.12); wear(mW, { map: cTex(e.c), bumpMap: e.bump });
    wear(mSubW, { map: tex(512, (q2, T) => { q2.fillStyle = '#eceef1'; q2.fillRect(0, 0, T, T); for (let r = 2; r < T * 0.5; r += 2.2) { q2.strokeStyle = P() > 0.5 ? 'rgba(255,255,255,' + (0.2 + P() * 0.4) + ')' : 'rgba(40,50,70,' + (0.03 + P() * 0.1) + ')'; q2.lineWidth = 1.3; q2.beginPath(); q2.arc(T / 2, T / 2, r, 0, TAU); q2.stroke(); } shadeRing(q2, T / 2, T / 2, T / 2, -T * 0.08, 0.3); }) });
    wear(mSP, { map: secTrack('#23262b') });
  } }; })();

/* ----- Sector, écru: no applied markers at all. A raised vertically grained centre, and round it a grained ivory plate printed in navy
   with a scientific sector: hour bars between two circles, a railway minute track, one red triangle at twelve ----- */
DIALS.ecru = (() => { const g = new THREE.Group(); gDial.add(g); g.visible = false; const RC = 8.6, ZC = 0.14;
  const mC = M('dial', { metalness: 0.2, roughness: 0.5, anisotropy: 0.5, alphaTest: 0.5 }), mP = M('dial', { metalness: 0.12, roughness: 0.62, alphaTest: 0.5 });
  const mSubE = M('dial', { metalness: 0.2, roughness: 0.5 }), mSP = printMat();
  const taken = (x, y) => Math.hypot(x, y - MC) < AR + 0.4 || Math.hypot(x - SX, y) < SR + 0.4;
  add(g, new THREE.CircleGeometry(RC, 128), mC, 0, 0, ZD + ZC);
  add(g, prof([[RC, ZC], [RC + 0.16, 0]], taken), mApplied, 0, 0, ZD);
  add(g, band(RC + 0.1, 0, DR, 0), mP, 0, 0, ZD);
  furniture(g, { low: 0, top: ZC + 0.06, subZ: -0.3, dateZ: 0, sub: mSubE, subPrint: mSP });
  return { g, secZ: -0.3, on() { const S = 1024, k = S / 2 / RC, c = cnv(S), q = c.getContext('2d'), X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k, P = prng(1931), INK = '#1c2647';
    q.fillStyle = '#ece4d2'; q.fillRect(0, 0, S, S); for (let i = 0; i < 5200; i++) { const v = P() > 0.5 ? 255 : 60; q.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 20) + ',' + P() * 0.07 + ')'; q.fillRect(P() * S, P() * S - 200, 1, 120 + P() * 500); }
    logo(q, X, Y, k, INK); cutApertures(q, S, RC, 0.12); wear(mC, { map: cTex(c) });
    wear(mP, { map: polar(2048, 384, RC + 0.1, DR, (q2, W, H, ry) => { q2.fillStyle = '#ded4bd'; q2.fillRect(0, 0, W, H); for (let i = 0; i < 60000; i++) { q2.fillStyle = 'rgba(' + (P() > 0.5 ? '255,255,250' : '70,60,40') + ',' + P() * 0.07 + ')'; q2.fillRect(P() * W, P() * H, 1.3, 2.4); }
      const e = q2.createLinearGradient(0, ry(RC + 0.1), 0, ry(RC + 0.9)); e.addColorStop(0, 'rgba(60,45,20,.3)'); e.addColorStop(1, 'rgba(60,45,20,0)'); q2.fillStyle = e; q2.fillRect(0, ry(RC + 0.9), W, ry(RC + 0.1) - ry(RC + 0.9));
      q2.fillStyle = INK; const line = (r, w) => q2.fillRect(0, ry(r) - w / 2, W, w), bar = (a, w, r0, r1) => { const x = a / 360 * W; q2.fillRect(x - w / 2, ry(r1), w, ry(r0) - ry(r1)); if (x < w) q2.fillRect(W + x - w / 2, ry(r1), w, ry(r0) - ry(r1)); };
      line(10.05, 2.4); line(13.55, 2.4); line(14.3, 2); line(15.05, 2);
      for (let i = 0; i < 60; i++) bar(i * 6, i % 5 ? 2.2 : 4.6, 14.3, 15.05);
      for (let h = 1; h < 12; h++) bar(h * 30, 12, 10.05, 13.55);
      q2.fillStyle = '#b02a2e'; [0, W].forEach((x) => { q2.beginPath(); q2.moveTo(x - 17, ry(13.55)); q2.lineTo(x + 17, ry(13.55)); q2.lineTo(x, ry(10.05)); q2.closePath(); q2.fill(); }); },
      (x, y) => { if (inAp(x, y, 0.22, 0.22)) return -1; const m = Math.min(Math.hypot(x, y - MC) - AR - 0.4, Math.hypot(x - SX, y) - SR - 0.4, Math.max(Math.abs(x - DX), Math.abs(y)) - 1.6); return m < 0.45 ? 0.82 + 0.18 * clamp(m / 0.45, 0, 1) : 1; }) });
    wear(mSubE, { map: tex(512, (q2, T) => { q2.fillStyle = '#e2d9c4'; q2.fillRect(0, 0, T, T); for (let r = 2; r < T * 0.5; r += 2.2) { q2.strokeStyle = P() > 0.5 ? 'rgba(255,255,250,' + (0.15 + P() * 0.35) + ')' : 'rgba(70,55,30,' + (0.03 + P() * 0.1) + ')'; q2.lineWidth = 1.3; q2.beginPath(); q2.arc(T / 2, T / 2, r, 0, TAU); q2.stroke(); } shadeRing(q2, T / 2, T / 2, T / 2, -T * 0.08, 0.3); }) });
    wear(mSP, { map: secTrack(INK, { cross: true }) });
  } }; })();

/* ---------- hands: heat blued Breguet hands, or ridged rhodium leaves on the dark dials ---------- */
const gHands = LAY.hands.g;
const mHandA = M('hands', { color: BLUED, metalness: 1, roughness: 0.16 });   // polished: facets, chamfers, bosses
const mBlue = M('hands', { color: BLUED, metalness: 1, roughness: 0.16 });
const mHandT = M('hands', { color: RHOD, metalness: 0.6, roughness: 0.34 });   // the grained top of a hand whose chamfers stay polished
/* Breguet: a slim shaft, an open ring with the hollow set a touch toward the tip, then a short point */
function breguet(o, z) { const s = new THREE.Shape(), a1 = Math.acos(o.w0 / o.rb), b0 = -Math.acos(o.w1 / o.ro), b1 = Math.acos(o.wt / o.ro);
  s.moveTo(0, -o.rb); s.absarc(0, 0, o.rb, -Math.PI / 2, a1, false); s.lineTo(o.w1, o.yc + o.ro * Math.sin(b0)); s.absarc(0, o.yc, o.ro, b0, b1, false); s.lineTo(o.wm, o.yc + o.ro + (o.L - o.yc - o.ro) * 0.45); s.lineTo(0, o.L);
  s.lineTo(-o.wm, o.yc + o.ro + (o.L - o.yc - o.ro) * 0.45); s.lineTo(-o.wt, o.yc + o.ro * Math.sin(b1)); s.absarc(0, o.yc, o.ro, Math.PI - b1, Math.PI - b0, false); s.lineTo(-o.w0, o.rb * Math.sin(a1)); s.absarc(0, 0, o.rb, Math.PI - a1, Math.PI * 1.5, false);
  const h = new THREE.Path(); h.absarc(0, o.yc + 0.07, o.rh, 0, TAU, true); s.holes.push(h);
  const m = add(new THREE.Group(), new THREE.ExtrudeGeometry(s, { depth: o.t - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 28 }), mHandA); m.position.z = z; return m; }
/* a hand cut from a solid blank the way a hand maker files one: an outline, hw(y) the half width from the tail (y = knots[0]) to the tip,
   and a section from the ridge out to the edge, [x as a share of the half width, z as a share of the height h(y)].
   Every facet of the section is its own strip and every knot starts a fresh one, so the edges stay knife sharp.
   fin[i] is the finish of facet i: 0 polished, 1 grained. A boss is a turned disc round the pivot: [radius, height, chamfer]. */
function cut(o, z) { const parts = [[], []], kn = o.knots, mk = (pos, uv, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  for (let k = 0; k < kn.length - 1; k++) { const n = Array.isArray(o.n) ? o.n[k] : (o.n ?? 1), ys = []; for (let i = 0; i <= n; i++) ys.push(lerp(kn[k], kn[k + 1], i / n));
    for (let s = 0; s < o.sec.length - 1; s++) [-1, 1].forEach((sd) => { const a = o.sec[s], b = o.sec[s + 1], pos = [], uv = [], idx = [];
      ys.forEach((y) => { const w = o.hw(y), h = o.h(y); pos.push(sd * a[0] * w, y, a[1] * h, sd * b[0] * w, y, b[1] * h); uv.push(a[0] * w, y, b[0] * w, y); });
      for (let i = 0; i < n; i++) { const p = i * 2; if (sd > 0) idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); else idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
      parts[o.fin ? o.fin[s] : 0].push(mk(pos, uv, idx)); }); }
  const y0 = kn[0], w0 = o.hw(y0), h0 = o.h(y0);
  if (w0 > 1e-3) { const pos = [0, y0, 0], idx = [], ring = []; for (let i = o.sec.length - 1; i >= 0; i--) ring.push([-o.sec[i][0] * w0, o.sec[i][1] * h0]); o.sec.forEach((p) => ring.push([p[0] * w0, p[1] * h0]));   // the tail end, filed square
    ring.forEach((p) => pos.push(p[0], y0, p[1])); for (let i = 1; i < ring.length; i++) idx.push(0, i + 1, i); parts[0].push(mk(pos, new Array(pos.length / 3 * 2).fill(0), idx)); }
  const sh = new THREE.Shape(), all = []; kn.forEach((y, k) => { if (k < kn.length - 1) { const n = Array.isArray(o.n) ? o.n[k] : (o.n ?? 1); for (let i = 0; i < n; i++) all.push(lerp(y, kn[k + 1], i / n)); } }); all.push(kn[kn.length - 1]);
  all.forEach((y, i) => i ? sh.lineTo(o.hw(y), y) : sh.moveTo(o.hw(y), y)); for (let i = all.length - 1; i >= 0; i--) if (o.hw(all[i]) > 1e-4) sh.lineTo(-o.hw(all[i]), all[i]);
  parts[0].push(new THREE.ShapeGeometry(sh).rotateY(Math.PI));   // the underside
  if (o.boss) { const [r, h, c] = o.boss; parts[o.fin ? o.fin[0] : 0].push(prof([[0, h], [r - c, h]])); parts[0].push(prof([[r - c, h], [r, h * 0.3], [r, 0]])); }
  const grp = new THREE.Group(); parts.forEach((p, i) => { if (p.length) add(grp, merge(p), i ? mHandT : mHandA); }); grp.position.z = z; return grp; }
/* the spear: a slim neck that flares from the boss into a long blade, widest well out toward the point, then an ogee run to a needle tip.
   Its top is grained and pitched very low, so each half takes the light a little differently; the chamfers round it are diamond polished */
const spearW = (L, wm, um, wn, un, q) => (y) => { const u = y / L; if (u <= un) return wn; const t = (u - un) / (1 - un), tm = (um - un) / (1 - un); return t < tm ? wn + (wm - wn) * (0.5 - 0.5 * Math.cos(Math.PI * t / tm)) : wm * Math.pow(Math.max(0, Math.cos((t - tm) / (1 - tm) * Math.PI / 2)), q); };
const spear = (L, wm, um, wn, un, ht, boss, z) => cut({ knots: [0, L], n: 90, hw: spearW(L, wm, um, wn, un, 1.35), h: () => ht, sec: [[0, 1], [0.56, 0.84], [1, 0.3], [1, 0]], fin: [1, 0, 0], boss }, z);
/* the blade: a broad dauphine cut flat and straight, in the Japanese manner. No curve anywhere; the ridge, two mirror flanks a side and a steep
   diamond cut edge, every one a true plane, so the whole hand flashes at once and goes dark at once like a blade turned in the hand */
const bladeW = (L, wm, yw, tail, wt) => (y) => y < yw ? lerp(wt, wm, (y + tail) / (yw + tail)) : wm * (L - y) / (L - yw);
const blade = (L, wm, yw, tail, wt, hm, z) => { const hw = bladeW(L, wm, yw, tail, wt); return cut({ knots: [-tail, yw, L], hw, h: (y) => 0.03 + hm * hw(y) / wm, sec: [[0, 1], [0.62, 0.62], [1, 0.1], [1, 0]] }, z); };
/* the plain dauphine: a four sided pyramid widest at the pivot. The ridge runs tail to tip, so one flank is always in the light and the other in the dark */
const dauph = (L, wm, tail, hm, z) => { const hw = bladeW(L, wm, 0, tail, 0); return cut({ knots: [-tail, 0, L], hw, h: (y) => 0.02 + hm * hw(y) / wm, sec: [[0, 1], [1, 0.14], [1, 0]] }, z); };
/* the feuille: a willow leaf widest a third of the way out, filed flat and polished before it goes into the bluing pan, so the whole face turns one
   even blue; a narrow bevel all round and a turned boss */
const leafW = (L, wm) => (y) => { const u = clamp(y / L, 0, 1); return wm * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.85) * (1 - 0.25 * u) + 0.26 * wm * (1 - u) * (1 - u); };
const feuille = (L, wm, ht, boss, z) => cut({ knots: [0, L], n: 80, hw: leafW(L, wm), h: () => ht, sec: [[0, 1], [0.72, 1], [1, 0.38], [1, 0]], boss }, z);
const hHour = new THREE.Group(), hMin = new THREE.Group(); gHands.add(hHour, hMin);
const HSET = {
  breguet: [breguet({ L: 10.0, rb: 1.05, yc: 6.9, ro: 0.92, rh: 0.56, w0: 0.34, w1: 0.24, wt: 0.2, wm: 0.13, t: 0.2 }, ZD + 0.55), breguet({ L: 14.5, rb: 0.8, yc: 10.7, ro: 0.86, rh: 0.53, w0: 0.3, w1: 0.19, wt: 0.17, wm: 0.11, t: 0.18 }, ZD + 0.9)],
  feuille: [feuille(9.8, 0.56, 0.16, [0.92, 0.16, 0.1], ZD + 0.5), feuille(14.6, 0.37, 0.14, [0.72, 0.14, 0.09], ZD + 0.86)],
  dauphine: [dauph(9.5, 0.82, 1.5, 0.24, ZD + 0.52), dauph(14.9, 0.64, 1.7, 0.2, ZD + 0.86)],
  spear: [spear(10.9, 0.8, 0.6, 0.22, 0.12, 0.17, [0.95, 0.17, 0.12], ZD + 0.5), spear(14.7, 0.56, 0.64, 0.17, 0.08, 0.15, [0.72, 0.15, 0.1], ZD + 0.86)],
  blade: [blade(12.0, 0.92, 2.1, 1.5, 0.26, 0.25, ZD + 0.5), blade(14.8, 0.66, 2.3, 1.9, 0.2, 0.2, ZD + 0.86)]
};
Object.values(HSET).forEach((p) => { hHour.add(p[0]); hMin.add(p[1]); });
{ const cap = add(gHands, new THREE.SphereGeometry(0.5, 24, 12, 0, TAU, 0, Math.PI / 2), mHandA, 0, 0, ZD + 1.18); cap.rotation.x = Math.PI / 2; cap.scale.z = 0.6; add(gHands, cyl(0.48, 0.7, 24), mHandA, 0, 0, ZD + 0.84); }
const hSec = new THREE.Group(); add(hSec, ext(poly([[-0.11, -0.7], [0.11, -0.7], [0.04, 2.9], [-0.04, 2.9]]), 0.08), mBlue); add(hSec, cyl(0.28, 0.08, 20), mBlue, 0, -0.9, 0.04); add(hSec, cyl(0.35, 0.14, 20), mBlue, 0, 0, 0.05); hSec.position.set(SX, 0, ZD - 0.24); gHands.add(hSec);

/* per frame hook for dial parts that move: t is local time in seconds, hr the hour hand angle.
   The sky ring turns once in twenty four hours, clockwise: the sun stands at twelve at noon, sets at three, and the moon is up at midnight. */
function dialTick(t, hr) { if (skyTurn && way === 'sky') skyTurn.rotation.z = -((((t / 86400) % 1) + 1) % 1 - 0.5) * TAU; }
let way = 'silver';
const NAVY = 0x1d2c52;
function setWay(k) { way = k; const w = WAYS[k], own = w.kind === 'own';
  [mDial.map, mSub.map, mPrint.map, mSubPrint.map, mDate.map, mChap.map].forEach((t) => t && t.dispose()); strip();
  mDial.map = mChap.map = mSub.map = mPrint.map = mSubPrint.map = null;
  gClassic.visible = !own; Object.keys(DIALS).forEach((d) => { DIALS[d].g.visible = d === k; });
  if (own) DIALS[k].on();
  else { mDial.map = polarTex(SUN, w.c0, w.c1, (x, y) => inDate(x, y) || inMoon(x, y) || inSub(x, y)); mChap.map = chapterTex(w.ring, w.print, false, w.sky);
    mSub.map = polarTex(SR, w.sub, w.sub, null, true); mPrint.map = printTex(w.print, false); mSubPrint.map = subPrintTex(w.print); }
  mDate.map = dateTexFor(w.date[0], w.date[1]); mDateCap.map = dateCapTex(w.date[0], w.date[1]); mDateCap.needsUpdate = true;
  [mDial, mSub, mPrint, mSubPrint, mDate, mChap].forEach((m) => { m.needsUpdate = true; });
  mHandA.color.setHex(w.hcol); mHandT.color.setHex(w.hcol); mHandA.roughness = w.hr ?? 0.16; mHandA.metalness = w.hmet ?? 1; mBlue.color.setHex(w.sec ?? w.hcol); mBlue.metalness = w.sec ? (w.secmet ?? 1) : (w.hmet ?? 1); mBlue.roughness = w.secr ?? 0.16;
  Object.keys(HSET).forEach((t) => HSET[t].forEach((m) => { m.visible = t === w.hands; }));
  hSec.position.z = ZD + (own ? DIALS[k].secZ + 0.1 : -0.24);
  if (STRAPS.consulting.mat) retint(k === 'upcycle' ? NAVY : (w.strap ?? NAVY)); if (k === 'upcycle' && STRAPS.upcycle.mat) { STRAPS.upcycle.mat.color.setHex(w.strap ?? 0x1f5482); STRAPS.upcycle.matEnd.color.setHex(w.strap ?? 0x1f5482); } { const av = k === 'ecru'; mCover.map = av ? moonAvTex : moonCoverTex; mCover.bumpMap = av ? moonAvBump : moonCoverBump; }   // each dial brings its own leather
}

/* ---------- upcycled dial: unlocked by putting the box in the recycling bin. Recycled bottle plastic, melted and swirled,
   so every visitor gets a different one, under a glossy coat, with polished batons and an orange seconds hand ---------- */
WAYS.upcycle = { name: 'Upcycled plastic', pair: 'consulting', kind: 'own', dot: ['#1f5482', '#10294a'], dotCss: 'radial-gradient(circle at 70% 30%,#f5c043 0 7%,transparent 9%),radial-gradient(circle at 30% 74%,#f26b3a 0 6%,transparent 8%),radial-gradient(circle at 8% 108%,transparent 0 56%,rgba(238,243,245,.9) 58% 62%,transparent 65%),radial-gradient(circle at 100% 0%,transparent 0 60%,rgba(127,180,214,.75) 62% 66%,transparent 69%),radial-gradient(ellipse 60% 40% at 72% 74%,#3f9a9c 0 30%,transparent 70%),radial-gradient(ellipse 50% 35% at 24% 30%,#5f9fcc 0 25%,transparent 70%),linear-gradient(135deg,#10294a,#1f5482 55%,#123a4c)', date: ['#0b1b2e', '#eef1f4'], hands: 'spear', hcol: RHOD, hmet: 0.72, hr: 0.07, sec: 0xf26b3a, secmet: 0.1, secr: 0.4, strap: 0x1d3150 };
DIALS.upcycle = (() => { const g = new THREE.Group(); gDial.add(g); g.visible = false;
  const mU = M('dial', { metalness: 0, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.03, bumpScale: 0.4, alphaTest: 0.5 });
  const mSubU = M('dial', { metalness: 0.05, roughness: 0.5 }), mSP = printMat(), mLume = M('dial', { color: 0xf0f1ea, metalness: 0, roughness: 0.62 });
  add(g, new THREE.CircleGeometry(DR - 0.02, 128), mU, 0, 0, ZD);
  /* applied batons, diamond cut, each table filled white so it reads over whatever the melt put under it */
  const B = { L: 2.3, w: 0.92, h: 0.44, wall: 0.2, tab: 0.5, hipIn: 0.3, hipOut: 0.2 }, B12 = Object.assign({}, B, { w: 0.74, tab: 0.4 }), ix = [], lu = [];
  const plot = (b) => place(new THREE.PlaneGeometry(b.tab - 0.14, b.L - b.hipIn - b.hipOut - 0.14), 0, (b.hipIn - b.hipOut) / 2, b.h + 0.01);
  const bl = baton(B), b12 = baton(B12), pl = plot(B), p12 = plot(B12);
  for (let h = 1; h <= 11; h++) if (h % 3) { ix.push(atHour(bl, h, 13.4)); lu.push(atHour(pl, h, 13.4)); }
  [-0.47, 0.47].forEach((o) => { ix.push(atHour(b12, 12, 13.4, 0, o)); lu.push(atHour(p12, 12, 13.4, 0, o)); });
  add(g, merge(ix), mIdx, 0, 0, ZD); add(g, merge(lu), mLume, 0, 0, ZD).castShadow = false;
  furniture(g, { low: 0, top: 0.07, cw: 0.14, subZ: -0.3, sub: mSubU, subPrint: mSP });
  const seedU = (Math.random() * 2147483647) | 0;   // a different melt for every visitor
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], css = (c, a = 1) => 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a + ')';
  /* the batches: which bottles went into the melt. Mostly cool bottle blues and greens and clear PET gone milky, a little warm from caps and labels */
  const BATCH = [
    { name: 'Bottle blue', tier: 0, w: 34, base: ['#10294a', '#173d66', '#1f5482', '#123a4c'], light: ['#5f9fcc', '#a9cde3', '#eef3f5', '#3f8f9c', '#89c2b0'], warm: ['#f26b3a', '#f5c043', '#d8363b'], dark: '#0a1420', ring: '#0b1b2e', strap: 0x1d3150 },
    { name: 'Sea glass', tier: 1, w: 14, base: ['#0f3a40', '#175157', '#226a63', '#163450'], light: ['#6fc2b3', '#bfe3d8', '#f0f5f2', '#4d9cb2', '#93bfe0'], warm: ['#f28c38', '#f6cd4c', '#d94a3d'], dark: '#0a1c20', ring: '#0a2226', strap: 0x1d3a3c },
    { name: 'Slate', tier: 0, w: 32, base: ['#253a50', '#30506c', '#1c2e44', '#3c5f78'], light: ['#8fb0c8', '#cfdce6', '#f3f5f6', '#6a9cc4', '#8fc2b4'], warm: ['#ef6a3a', '#f2bd3b', '#c9353f'], dark: '#10161e', ring: '#141f2e', strap: 0x2a3442 },
    { name: 'Lagoon', tier: 1, w: 14, base: ['#0e436c', '#145b88', '#0b3358', '#11707c'], light: ['#4fb6d2', '#a8deea', '#f2f7f8', '#2fa39b', '#8fd3c3'], warm: ['#ff7b42', '#ffd25e', '#e6455a'], dark: '#081a2a', ring: '#082038', strap: 0x173556 },
    /* the ultra rares: a run of sunset coloured bottles, and one that came out like the northern lights */
    { name: 'Sunset', tier: 2, w: 3, base: ['#2a1236', '#3d1846', '#55204f', '#331a4a'], light: ['#ff8a5c', '#ffb672', '#ffd6a5', '#fff1e3', '#ff9eb5'], warm: ['#ffd23f', '#2ec4b6', '#e63946'], dark: '#160a1d', ring: '#1e0d27', strap: 0x3b1d3f },
    { name: 'Aurora', tier: 2, w: 3, base: ['#071a24', '#0b2633', '#0a1f3a', '#10303d'], light: ['#3dffb0', '#7cf2d0', '#b388ff', '#e9fbff', '#4fc3f7'], warm: ['#ff4fa3', '#ffd166', '#c77dff'], dark: '#03090f', ring: '#06121b', strap: 0x0e2a33 }];
  /* which batch you get is the luck of the draw: two common, two rare, two ultra rare */
  let pick = null; const WT = BATCH.reduce((s, b) => s + b.w, 0);
  const roll = (i) => { if (i == null) { let u = Math.random() * WT; i = 0; while (i < BATCH.length - 1 && (u -= BATCH[i].w) > 0) i++; } pick = BATCH[i]; pick.odds = Math.round(pick.w / WT * 100); return pick; };
  const swatch = (b) => 'radial-gradient(circle at 70% 30%,' + b.warm[1] + ' 0 7%,transparent 9%),radial-gradient(circle at 30% 74%,' + b.warm[0] + ' 0 6%,transparent 8%),radial-gradient(circle at 8% 108%,transparent 0 56%,' + b.light[2] + ' 58% 62%,transparent 65%),radial-gradient(ellipse 60% 40% at 72% 74%,' + b.light[3] + ' 0 30%,transparent 70%),radial-gradient(ellipse 50% 35% at 24% 30%,' + b.light[0] + ' 0 25%,transparent 70%),linear-gradient(135deg,' + b.base[0] + ',' + b.base[2] + ' 55%,' + b.base[3] + ')';
  return { g, secZ: -0.3, roll, css: swatch, on() {
    const S = 1024, G = 256, k = S / 2 / DR, kg = G / S, R = prng(seedU), bt = pick || roll();
    WAYS.upcycle.date = [bt.ring, '#eef1f4']; WAYS.upcycle.strap = bt.strap;   // the date disc and the leather follow the batch
    /* seeded gradient noise: smooth, so the melt flows in long curves instead of the ragged coastlines of a map */
    const perm = new Uint16Array(512), gxs = new Float32Array(256), gys = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; const a = R() * TAU; gxs[i] = Math.cos(a); gys[i] = Math.sin(a); }
    for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; } for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const pn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), X = xi & 255, Y = yi & 255, xf = x - xi, yf = y - yi, u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10), a = perm[X] + Y, b = perm[X + 1] + Y, h0 = perm[a], h1 = perm[b], h2 = perm[a + 1], h3 = perm[b + 1],
      n0 = gxs[h0] * xf + gys[h0] * yf, n1 = gxs[h1] * (xf - 1) + gys[h1] * yf, n2 = gxs[h2] * xf + gys[h2] * (yf - 1), n3 = gxs[h3] * (xf - 1) + gys[h3] * (yf - 1); return n0 + (n1 - n0) * u + (n2 - n0 + (n3 - n2 - n1 + n0) * u) * v; };
    const pf = (x, y, o) => { let n = 0, a = 1, s = 0; for (let i = 0; i < o; i++) { n += a * pn(x, y); s += a; x = x * 2.03 + 17.1; y = y * 2.03 + 31.7; a *= 0.5; } return n / s; };
    /* the flow, worked out on a coarse grid in dial millimetres: a slow swirl, a second warp on top, and a vortex or two where the melt was stirred */
    const dir = R() * TAU, dcx = Math.cos(dir), dcy = Math.sin(dir), lam = 0.9 + R() * 1.0, wq = 10 + R() * 8, wr = 5 + R() * 4, pS = 0.3 + R() * 0.25, fD = 0.65 + R() * 0.6, o = []; for (let i = 0; i < 16; i++) o.push(R() * 200);
    const vort = []; for (let i = 0, n = (R() * 3) | 0; i < n; i++) vort.push([(R() - 0.5) * 22, (R() - 0.5) * 22, 3 + R() * 5, (R() > 0.5 ? 1 : -1) * (1.2 + R() * 2)]);
    const PH = new Float32Array(G * G), P2 = new Float32Array(G * G), BE = new Float32Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let x = ((i + 0.5) / G * 2 - 1) * DR, y = (1 - (j + 0.5) / G * 2) * DR;
      const qx = pf(x * 0.08 + o[0], y * 0.08 + o[1], 2), qy = pf(x * 0.08 + o[2], y * 0.08 + o[3], 2); x += wq * qx; y += wq * qy;
      const rx = pf(x * 0.16 + o[4], y * 0.16 + o[5], 3), ry = pf(x * 0.16 + o[6], y * 0.16 + o[7], 3); x += wr * rx; y += wr * ry;
      for (const v of vort) { const ex = x - v[0], ey = y - v[1], th = v[3] * Math.exp(-(ex * ex + ey * ey) / (v[2] * v[2])), c = Math.cos(th), s = Math.sin(th); x = v[0] + ex * c - ey * s; y = v[1] + ex * s + ey * c; }
      const id = j * G + i; PH[id] = (x * dcx + y * dcy) / lam + 1.6 * pf(x * 0.3 + o[8], y * 0.3 + o[9], 2); P2[id] = PH[id] * 2.7 + 1.3 * pf(x * 0.5 + o[10], y * 0.5 + o[11], 2); BE[id] = pf(x * 0.1 + o[12], y * 0.1 + o[13], 2); }
    const GA = new Float32Array(G * G), GB = new Float32Array(G * G);   // how fast each phase runs, per grid cell
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const id = j * G + i, l = i ? id - 1 : id, r = i < G - 1 ? id + 1 : id, u = j ? id - G : id, w = j < G - 1 ? id + G : id, fx = i && i < G - 1 ? 0.5 : 1, fy = j && j < G - 1 ? 0.5 : 1;
      GA[id] = Math.hypot((PH[r] - PH[l]) * fx, (PH[w] - PH[u]) * fy); GB[id] = Math.hypot((P2[r] - P2[l]) * fx, (P2[w] - P2[u]) * fy); }
    /* layers: each one a fold of the melt, now and then carrying a streak of another bottle */
    const NL = 1024, lay = (pStreak, wMin, wMax, warmP) => { const L = { on: new Uint8Array(NL), c: new Float32Array(NL), w: new Float32Array(NL), a: new Float32Array(NL), s: new Float32Array(NL), col: [] };
      for (let i = 0; i < NL; i++) { const warm = R() < warmP; L.on[i] = R() < pStreak ? 1 : 0; L.w[i] = (wMin + (wMax - wMin) * R() * R()) * (warm ? 0.3 : 1); L.c[i] = L.w[i] + 0.04 + R() * (0.92 - 2 * L.w[i]); const deep = R(); L.a[i] = deep < 0.35 ? 0.45 + deep : 1; L.s[i] = deep < 0.35 ? 4 : 1;
        L.col.push(rgb(warm ? bt.warm[(R() * bt.warm.length) | 0] : R() < 0.12 ? bt.dark : bt.light[(R() * bt.light.length) | 0])); } return L; };   // warm streaks stay thin: caps and labels, never a river
    const L1 = lay(pS, 0.03, 0.28, 0.05), L2 = lay(pS * 0.55, 0.02, 0.11, 0.08), NB = 3, baseOf = []; let gmM = 0; for (let i = 0; i < 4000; i++) { const id = (1 + (R() * (G - 2)) | 0) * G + 1 + ((R() * (G - 2)) | 0); gmM += Math.hypot(PH[id + 1] - PH[id - 1], PH[id + G] - PH[id - G]) / 4000; } for (let i = 0; i < 64; i++) baseOf.push(rgb(bt.base[(R() * bt.base.length) | 0]));
    const calm = (x, y) => { const ex = x / 4.4, ey = (y - 5.6) / 1.6, e = ex * ex + ey * ey; return Math.exp(-e * e); }, dk = rgb(bt.base[0]);   // keep the name's patch of melt quiet
    const c = cnv(S), q = c.getContext('2d'), im = q.createImageData(S, S), d = im.data;
    const streak = (L, ph, ga, col, f) => { const li = Math.floor(ph), t = ph - li, i = ((li % NL) + NL) % NL; if (!L.on[i]) return; f *= clamp(1.6 - 1.05 * ga, 0, 1); const ww = L.w[i], e = (0.7 * ga * kg + 1e-4) * L.s[i], cov = clamp((ww + e - Math.abs(t - L.c[i])) / (2 * e), 0, 1) * L.a[i] * f; if (cov <= 0) return; const s = L.col[i]; col[0] += (s[0] - col[0]) * cov; col[1] += (s[1] - col[1]) * cov; col[2] += (s[2] - col[2]) * cov; };
    const col = [0, 0, 0];
    for (let y = 0; y < S; y++) { const gy = (y + 0.5) * kg - 0.5, j0 = clamp(Math.floor(gy), 0, G - 2), ty = clamp(gy - j0, 0, 1), my = DR - (y + 0.5) / k;
      for (let x = 0; x < S; x++) { const gx = (x + 0.5) * kg - 0.5, i0 = clamp(Math.floor(gx), 0, G - 2), tx = clamp(gx - i0, 0, 1), id = j0 * G + i0, mx = (x + 0.5) / k - DR, o4 = (y * S + x) * 4;
        const a0 = PH[id], a1 = PH[id + 1], a2 = PH[id + G], a3 = PH[id + G + 1], ph = a0 + (a1 - a0) * tx + (a2 - a0 + (a3 - a2 - a1 + a0) * tx) * ty, c0 = GA[id], c1 = GA[id + 1], c2 = GA[id + G], ga = c0 + (c1 - c0) * tx + (c2 - c0 + (GA[id + G + 1] - c2 - c1 + c0) * tx) * ty;
        const b0 = P2[id], b1 = P2[id + 1], b2 = P2[id + G], b3 = P2[id + G + 1], p2 = b0 + (b1 - b0) * tx + (b2 - b0 + (b3 - b2 - b1 + b0) * tx) * ty, d0 = GB[id], d1 = GB[id + 1], d2 = GB[id + G], gb = d0 + (d1 - d0) * tx + (d2 - d0 + (GB[id + G + 1] - d2 - d1 + d0) * tx) * ty;
        const e0 = BE[id], e1 = BE[id + 1], e2 = BE[id + G], e3 = BE[id + G + 1], be = (e0 + (e1 - e0) * tx + (e2 - e0 + (e3 - e2 - e1 + e0) * tx) * ty + 1) * NB * 2, bi = Math.floor(be), fr = be - bi, m = clamp((fr - 0.82) / 0.18, 0, 1), mm = m * m * (3 - 2 * m), A = baseOf[bi & 63], Bc = baseOf[(bi + 1) & 63];
        const tl = 0.94 + 0.1 * fr * (1 - mm) + 0.035 * Math.sin(TAU * p2) * clamp(1.6 - 1.05 * gb, 0, 1); col[0] = (A[0] + (Bc[0] - A[0]) * mm) * tl; col[1] = (A[1] + (Bc[1] - A[1]) * mm) * tl; col[2] = (A[2] + (Bc[2] - A[2]) * mm) * tl;
        const cm = calm(mx, my), f = 1 - 0.96 * cm; if (cm > 0.01) { const w = 0.55 * cm; col[0] += (dk[0] - col[0]) * w; col[1] += (dk[1] - col[1]) * w; col[2] += (dk[2] - col[2]) * w; } streak(L1, ph, ga, col, f); streak(L2, p2, gb, col, f);
        d[o4] = col[0]; d[o4 + 1] = col[1]; d[o4 + 2] = col[2]; d[o4 + 3] = 255; } }
    q.putImageData(im, 0, 0);
    /* flakes that never fully melted: shredded bits pulled long along the flow. The deep ones sit under a haze of clear plastic, the top ones are crisp */
    const cb = cnv(S), qb = cb.getContext('2d'); qb.fillStyle = '#808080'; qb.fillRect(0, 0, S, S);
    const flakeCol = () => { const u = R(); return u < 0.07 ? bt.warm[(R() * bt.warm.length) | 0] : u < 0.13 ? bt.dark : u < 0.5 ? bt.light[(R() * bt.light.length) | 0] : bt.base[(R() * bt.base.length) | 0]; };
    const flakes = (ctx, n, r0, r1, al, round, bump, halo = 0, drag = 1, stain = 0) => { for (let i = 0; i < n; i++) { const px = R() * S, py = R() * S, mx = px / k - DR, my = DR - py / k; if (mx * mx + my * my > DR * DR || R() < calm(mx, my) * 0.98 || R() > 0.2 + 0.8 * clamp(0.5 + 2.4 * pf(mx * 0.14 + o[14], my * 0.14 + o[15], 2), 0, 1)) continue;
        const gi = clamp((px * kg) | 0, 1, G - 2), gj = clamp((py * kg) | 0, 1, G - 2), gxv = PH[gj * G + gi + 1] - PH[gj * G + gi - 1], gyv = PH[(gj + 1) * G + gi] - PH[(gj - 1) * G + gi], gm = Math.hypot(gxv, gyv), an = Math.atan2(gyv, gxv) + Math.PI / 2, st = (1.3 + clamp((gm / gmM - 0.7) * 1.6, 0, 2.4)) * drag;
        const r = (r0 + (r1 - r0) * Math.pow(R(), 2.2)) * k, n2 = round ? 5 + ((R() * 3) | 0) : R() < 0.6 ? 4 : R() < 0.75 ? 5 : 3, ca = Math.cos(an), sa = Math.sin(an), pts = [];
        for (let j = 0; j < n2; j++) { const th = (j + (R() - 0.5) * (round ? 0.6 : 0.9)) * TAU / n2, rr = r * (round ? 0.55 + 0.45 * R() : 0.6 + 0.4 * R()), lx = rr * Math.cos(th) * st, ly = rr * Math.sin(th) / Math.sqrt(st); pts.push([px + lx * ca - ly * sa, py + lx * sa + ly * ca]); }
        const p = new Path2D(); if (round) { const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(pts[n2 - 1], pts[0]); p.moveTo(m0[0], m0[1]); for (let j = 0; j < n2; j++) { const m1 = mid(pts[j], pts[(j + 1) % n2]); p.quadraticCurveTo(pts[j][0], pts[j][1], m1[0], m1[1]); } } else { pts.forEach((pt, j) => j ? p.lineTo(pt[0], pt[1]) : p.moveTo(pt[0], pt[1])); }
        p.closePath(); const fc = rgb(flakeCol()); if (stain) { const b = baseOf[(R() * 64) | 0]; for (let j = 0; j < 3; j++) fc[j] += (b[j] - fc[j]) * stain; } if (halo) { ctx.strokeStyle = css(fc, 0.22 * al); ctx.lineWidth = halo; ctx.lineJoin = 'round'; ctx.stroke(p); } ctx.fillStyle = css(fc, al * (0.75 + 0.25 * R())); ctx.fill(p); if (bump) { qb.fillStyle = bump; qb.fill(p); } } };
    { const cd = cnv(S / 2), qd = cd.getContext('2d'); qd.scale(0.5, 0.5); flakes(qd, 950 * fD, 0.12, 0.9, 1, true, null, 0, 1.4, 0.3); q.save(); q.globalAlpha = 0.38; q.drawImage(cd, 0, 0, S, S); q.restore(); }   // drawn at half size, so enlarging it softens them in any browser
    { const cm = cnv(S), qm = cm.getContext('2d'); flakes(qm, 720 * fD, 0.1, 0.75, 0.85, false, '#8e8e8e', 2.2); q.save(); q.filter = 'blur(0.45px)'; q.drawImage(cm, 0, 0); q.restore(); } flakes(q, 330 * fD, 0.08, 0.7, 1, false, '#a0a0a0', 1.6);
    for (let i = 0; i < 1500 * fD; i++) { const px = R() * S, py = R() * S, u = R(); q.fillStyle = u < 0.12 ? css(rgb(bt.light[2]), 0.75) : u < 0.42 ? css(rgb(bt.dark), 0.8) : u < 0.62 ? css(rgb(bt.warm[(R() * bt.warm.length) | 0]), 0.9) : css(rgb(bt.light[(R() * bt.light.length) | 0]), 0.8); q.beginPath(); q.arc(px, py, 0.4 + R() * R() * 1.4, 0, TAU); q.fill(); }
    /* a smoked lacquer ring round the edge and a crisp white minute track printed over it */
    const X = (x) => S / 2 + x * k, Y = (y) => S / 2 - y * k, rc = rgb(bt.ring);
    q.fillStyle = css(rc, 0.66); q.beginPath(); q.arc(S / 2, S / 2, DR * k + 4, 0, TAU); q.arc(S / 2, S / 2, 14.72 * k, 0, TAU, true); q.fill();
    q.strokeStyle = 'rgba(242,244,246,.95)'; q.lineWidth = 0.04 * k; q.beginPath(); q.arc(S / 2, S / 2, 14.72 * k, 0, TAU); q.stroke();
    for (let i = 0; i < 60; i++) { const a = i * TAU / 60; q.lineWidth = (i % 5 ? 0.06 : 0.16) * k; q.beginPath(); q.moveTo(X((i % 5 ? 14.98 : 14.84) * Math.sin(a)), Y((i % 5 ? 14.98 : 14.84) * Math.cos(a))); q.lineTo(X(15.38 * Math.sin(a)), Y(15.38 * Math.cos(a))); q.stroke(); }
    /* a soft seat under every applied marker, so it stands off the melt: only the blurred shadow of each footprint lands on the dial */
    { q.save(); q.fillStyle = '#000'; q.shadowColor = 'rgba(0,0,10,.5)'; q.shadowBlur = 0.36 * k; q.shadowOffsetX = 2 * S;
      const seat = (h, r, off, w, L) => { const a = h * Math.PI / 6; q.setTransform(1, 0, 0, 1, X(r * Math.sin(a) + off * Math.cos(a) + 0.1) - 2 * S, Y(r * Math.cos(a) - off * Math.sin(a) - 0.12)); q.rotate(a); q.fillRect(-(w / 2 + 0.12) * k, -(L / 2 + 0.12) * k, (w + 0.24) * k, (L + 0.24) * k); };
      for (let h = 1; h <= 11; h++) if (h % 3) seat(h, 13.4, 0, B.w, B.L); seat(12, 13.4, -0.47, B12.w, B12.L); seat(12, 13.4, 0.47, B12.w, B12.L); q.restore(); }
    logo(q, X, Y, k, '#f4f5f6');
    shadeRing(q, X(0), Y(MC), (AR + 0.4) * k, 0.45 * k, 0.3); shadeRing(q, X(SX), Y(0), (SR + 0.4) * k, 0.45 * k, 0.3); cutApertures(q, S, DR, 0.12);
    wear(mU, { map: cTex(c), bumpMap: cTex(cb, true) });
    wear(mSubU, { map: tex(512, (q2, T) => { q2.fillStyle = bt.ring; q2.fillRect(0, 0, T, T); for (let r = 2; r < T * 0.5; r += 2.2) { q2.strokeStyle = R() > 0.5 ? 'rgba(255,255,255,' + (0.03 + R() * 0.07) + ')' : 'rgba(0,0,0,' + (0.05 + R() * 0.12) + ')'; q2.lineWidth = 1.3; q2.beginPath(); q2.arc(T / 2, T / 2, r, 0, TAU); q2.stroke(); } shadeRing(q2, T / 2, T / 2, T / 2, -T * 0.08, 0.4); }) });
    wear(mSP, { map: secTrack('#e9edf0') });
  } }; })();

/* ---------- movement (local +z points to the caseback) ---------- */
const gMov = LAY.mov.g, gBr = LAY.bridges.g, gRot = LAY.rotor.g; gMov.rotation.y = Math.PI;
const mov = new THREE.Group(); mov.position.z = -MZ; gMov.add(mov); mov.add(gBr); mov.add(gRot);
const mvTurned = (p, a = 0.75) => Object.assign(p, { anisotropy: a, anisotropyMap: polarDir });   // a face finished on the lathe
const tri3 = (face, edge, flank) => { const m = [face, edge, flank]; m.userData = { bt: false, layer: face.userData.layer }; return m; };
const mPlate = M('mov', { color: 0xd4cfc2, map: perlage, metalness: 0.72, roughness: 0.36 });
const mPlateEdge = M('mov', { color: 0xf0ede4, metalness: 1, roughness: 0.12 });
const mPlateWall = M('mov', { color: 0xa39e92, metalness: 0.8, roughness: 0.5 });
const mFrost = M('mov', { color: 0xcdc3a6, metalness: 0.8, roughness: 0.55, bumpMap: frost, bumpScale: 0.6 });
const mBrass = M('mov', mvTurned({ color: 0xdcae4e, map: cercTex, metalness: 0.9, roughness: 0.32 }));       // gilt, circular grained
const mBrassP = M('mov', { color: 0xf0c868, metalness: 1, roughness: 0.1 });                                // gilt, polished: the bevels on the spokes
const mBrassW = M('mov', { color: 0xc49b44, metalness: 0.9, roughness: 0.38 });
const mMovSteel = M('mov', { color: 0xe4e7ea, metalness: 0.95, roughness: 0.12 });
const mSteelG = M('mov', mvTurned({ color: 0xe6e9ee, map: cercTex, metalness: 0.9, roughness: 0.26 }, 0.6));
const mRuby = M('mov', { color: 0xc20a3a, metalness: 0, roughness: 0.06, clearcoat: 1, emissive: 0x52000f, emissiveIntensity: 0.6 });
const mSpring = M('mov', { color: 0x3a6cf0, metalness: 1, roughness: 0.25 });
const mBal = M('mov', { color: 0xd9ae55, metalness: 0.95, roughness: 0.18 });
const mBalG = M('mov', mvTurned({ color: 0xdfb458, map: cercTex, metalness: 0.92, roughness: 0.28 }));
const mBridge = M('bridges', { color: 0xebe6d8, map: bridgeTex, bumpMap: grainBump, bumpScale: 0.45, metalness: 0.5, roughness: 0.5, envMapIntensity: 1.15 });   // frosted German silver
const mBrEdge = M('bridges', { color: 0xf6f2e8, metalness: 1, roughness: 0.09 });      // anglage: the wide polished bevel
const mBrWall = M('bridges', { color: 0xc4bdaa, metalness: 0.85, roughness: 0.42 });   // straight grained flanks
const mBrSink = M('bridges', { color: 0xd2ccba, metalness: 0.8, roughness: 0.34 });
const mBrSteel = M('bridges', { color: 0xe4e7ea, metalness: 0.95, roughness: 0.12 });
const mBrSteelF = M('bridges', { color: 0xf3f5f8, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.25 });   // flat polished steel: cores, click, regulator
const mWheelS = M('bridges', mvTurned({ color: 0xeef1f5, map: snailTex, metalness: 0.92, roughness: 0.24 }, 0.85));   // snailed steel
const mBrBlue = M('bridges', { color: 0xd9dce0, metalness: 1, roughness: 0.04 });
const mBlueScrew = M('bridges', { color: 0x2f52d6, metalness: 0.82, roughness: 0.2, envMapIntensity: 1.3 });   // heat blued
const mBrGold = M('bridges', { color: 0xe0b45c, metalness: 1, roughness: 0.14 });
const mBrRuby = M('bridges', { color: 0xc20a3a, metalness: 0, roughness: 0.06, clearcoat: 1, emissive: 0x3a0010, emissiveIntensity: 0.45 });
const mBrDark = M('bridges', { color: 0x0c1020, metalness: 0.6, roughness: 0.5 });
const P = (r, d) => [r * Math.cos(rad(d)), r * Math.sin(rad(d))];

/* --- the finisher's kit. Outlines are drawn as distance fields and traced, so pockets can run into one another, bridges can be
   blended out of arms and bosses, and every edge gets a true bevel with its own polished material. --- */
const sdC = (c, r) => (x, y) => Math.hypot(x - c[0], y - c[1]) - r;
const sdS = (a, b, r0, r1 = r0) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9; return (x, y) => { const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) - lerp(r0, r1, t); }; };
const sdU = (k, ...f) => (x, y) => { let m = Infinity; const v = f.map((fn) => { const q = fn(x, y); if (q < m) m = q; return q; }); if (!k) return m; let s = 0; for (const q of v) s += Math.exp(-(q - m) / k); return m - k * Math.log(s); };
const loopArea = (L) => { let a = 0; for (let i = 0, n = L.length; i < n; i++) { const p = L[i], q = L[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function thin(L, tol) { const n = L.length, out = [L[0]]; let a = 0; for (let i = 1; i < n; i++) { const p = L[a], q = L[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1e-9; let ok = len < 0.8; for (let k = a + 1; ok && k <= i; k++) if (Math.abs((L[k][0] - p[0]) * dy - (L[k][1] - p[1]) * dx) / len > tol) ok = false; if (!ok) { out.push(L[i]); a = i; } } return out; }
/* marching squares: the inside (f < 0) is kept on the left, so solids come out counter-clockwise and their holes clockwise */
function trace2d(f, x0, y0, x1, y1, h, tol = 0.0018) {
  const W = Math.ceil((x1 - x0) / h) + 1, H = Math.ceil((y1 - y0) / h) + 1, v = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) v[j * W + i] = f(x0 + i * h, y0 + j * h);
  const nx = new Map(), TB = [[], [0, 3], [1, 0], [1, 3], [2, 1], [0, 3, 2, 1], [2, 0], [2, 3], [3, 2], [0, 2], [1, 0, 3, 2], [1, 2], [3, 1], [0, 1], [3, 0], []];
  const pt = (id) => { const k = id >> 1, i = k % W, j = (k - i) / W, a = v[k]; if (id & 1) { const b = v[k + W]; return [x0 + i * h, y0 + (j + a / (a - b)) * h]; } const b = v[k + 1]; return [x0 + (i + a / (a - b)) * h, y0 + j * h]; };
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) { const k = j * W + i, m = (v[k] < 0 ? 1 : 0) | (v[k + 1] < 0 ? 2 : 0) | (v[k + W + 1] < 0 ? 4 : 0) | (v[k + W] < 0 ? 8 : 0); if (!m || m === 15) continue; const t = TB[m], E = [2 * k, 2 * (k + 1) + 1, 2 * (k + W), 2 * k + 1]; for (let q = 0; q < t.length; q += 2) nx.set(E[t[q]], E[t[q + 1]]); }
  const loops = []; while (nx.size) { const s = nx.keys().next().value; let e = s; const L = []; do { L.push(pt(e)); const n = nx.get(e); nx.delete(e); e = n; } while (e !== s && e !== undefined); if (L.length > 8) loops.push(thin(L, tol)); }
  return loops.sort((a, b) => Math.abs(loopArea(b)) - Math.abs(loopArea(a)));
}
const ringLoop = (c, r, n = 48, cw = false) => Array.from({ length: n }, (_, i) => { const a = (cw ? -i : i) * TAU / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
const meet = (c1, r1, c2, r2, s) => { const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a)), ux = (c2[0] - c1[0]) / d, uy = (c2[1] - c1[1]) / d; return [c1[0] + a * ux - s * h * uy, c1[1] + a * uy + s * h * ux]; };
/* a solid cut from loops: group 0 is the flat face, 1 the bevel (shaded as a slightly domed, hand polished chamfer), 2 the flanks and the underside */
function solid() { const P3 = [[], [], []], N3 = [[], [], []], U3 = [[], [], []];
  const put = (g, x, y, z, nx, ny, nz) => { P3[g].push(x, y, z); N3[g].push(nx, ny, nz); U3[g].push(x, y); };
  const cap = (LL, z, up, g) => { const v2 = LL.map((L) => L.map((p) => new THREE.Vector2(p[0], p[1]))), all = v2.flat(), tris = THREE.ShapeUtils.triangulateShape(v2[0], v2.slice(1));
    for (const t of tris) { const a = all[t[0]]; let b = all[t[1]], c = all[t[2]]; if (((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y) > 0) !== up) { const s = b; b = c; c = s; } put(g, a.x, a.y, z, 0, 0, up ? 1 : -1); put(g, b.x, b.y, z, 0, 0, up ? 1 : -1); put(g, c.x, c.y, z, 0, 0, up ? 1 : -1); } };
  const S = { add(loops, z0, z1, o = {}) { const t0 = rad(o.t0 ?? 22), t1 = rad(o.t1 ?? 64), s0 = Math.sin(t0), c0 = Math.cos(t0), s1 = Math.sin(t1), c1 = Math.cos(t1), caps = [];
      loops.forEach((L, li) => { const n = L.length, b = Array.isArray(o.bevel) ? (o.bevel[li] ?? o.bevel[o.bevel.length - 1]) : (o.bevel || 0), zt = z1 - b * (o.drop ?? 1), en = [], vn = [], sh = [], I = [];
        for (let i = 0; i < n; i++) { const p = L[i], q = L[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1e-9; en.push([dy / l, -dx / l]); }
        for (let i = 0; i < n; i++) { const a = en[(i + n - 1) % n], c = en[i]; let x = a[0] + c[0], y = a[1] + c[1]; const l = Math.hypot(x, y) || 1e-9; x /= l; y /= l; vn.push([x, y]); sh.push(a[0] * c[0] + a[1] * c[1] < 0.8); const mi = b / Math.max(x * c[0] + y * c[1], 0.42); I.push([L[i][0] - x * mi, L[i][1] - y * mi]); }
        caps.push(I);
        for (let i = 0; i < n; i++) { const j = (i + 1) % n, na = sh[i] ? en[i] : vn[i], nb = sh[j] ? en[i] : vn[j], A = I[i], B = L[i], C = L[j], D = I[j];
          if (b > 0) { put(1, A[0], A[1], z1, na[0] * s0, na[1] * s0, c0); put(1, B[0], B[1], zt, na[0] * s1, na[1] * s1, c1); put(1, C[0], C[1], zt, nb[0] * s1, nb[1] * s1, c1);
            put(1, A[0], A[1], z1, na[0] * s0, na[1] * s0, c0); put(1, C[0], C[1], zt, nb[0] * s1, nb[1] * s1, c1); put(1, D[0], D[1], z1, nb[0] * s0, nb[1] * s0, c0); }
          if (!o.noWall) { put(2, B[0], B[1], zt, na[0], na[1], 0); put(2, B[0], B[1], z0, na[0], na[1], 0); put(2, C[0], C[1], z0, nb[0], nb[1], 0);
            put(2, B[0], B[1], zt, na[0], na[1], 0); put(2, C[0], C[1], z0, nb[0], nb[1], 0); put(2, C[0], C[1], zt, nb[0], nb[1], 0); } } });
      cap(caps, z1, true, 0); if (!o.noBase) cap(loops, z0, false, 2); return S; },
    geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P3[0].concat(P3[1], P3[2]), 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N3[0].concat(N3[1], N3[2]), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U3[0].concat(U3[1], U3[2]), 2));
      let s = 0; for (let k = 0; k < 3; k++) { const c = P3[k].length / 3; if (c) g.addGroup(s, c, k); s += c; } return g; } };
  return S; }
const slab = (loops, z0, z1, o) => solid().add(loops, z0, z1, o).geo();
/* small repeated parts (screws, jewels, chatons) are stamped into one geometry per material, so sixty screws cost two draw calls */
const pile = [];
function stamp(parent, mat, geo, x = 0, y = 0, z = 0, rz = 0, s = 1) { let b = pile.find((q) => q.parent === parent && q.mat === mat); if (!b) pile.push(b = { parent, mat, list: [] }); const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (s !== 1) g.scale(s, s, s); if (rz) g.rotateZ(rz); g.translate(x, y, z); b.list.push(g); }
function unpile() { for (const b of pile) { let n = 0; b.list.forEach((g) => { n += g.attributes.position.count; }); const A = new Float32Array(n * 3), B = new Float32Array(n * 3), C = new Float32Array(n * 2); let o = 0; for (const g of b.list) { A.set(g.attributes.position.array, o * 3); B.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) C.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(A, 3)); m.setAttribute('normal', new THREE.BufferAttribute(B, 3)); m.setAttribute('uv', new THREE.BufferAttribute(C, 2)); add(b.parent, m, b.mat); } pile.length = 0; }
/* teeth with rounded tips; a tooth sits on angle zero, as the meshing sums in mechanism() expect */
function cogs(N, rp, o = {}) { const m = 2 * rp / N, ro = rp + m * (o.add ?? 1), rr = rp - m * (o.ded ?? 1.2), rm = rp + m * 0.2, st = TAU / N, L = []; for (let i = 0; i < N; i++) for (const q of [[rr, -0.3], [rm, -0.2], [ro, -0.07], [ro, 0.07], [rm, 0.2], [rr, 0.3]]) L.push([q[0] * Math.cos((i + q[1]) * st), q[0] * Math.sin((i + q[1]) * st)]); return L; }
/* the crossings of a wheel: n tapered spokes, every inside corner radiused, returned as holes */
/* boss (optional): each arm swells into a round boss of radius R, centred r out along it; the first arm points at angle a */
function crossings(n, rh, ri, w0, w1, rho = 0.12, boss) { const A = [Math.sqrt(rh * rh - w0 * w0), w0], B = [Math.sqrt(ri * ri - w1 * w1), w1], ex = B[0] - A[0], ey = B[1] - A[1], el = Math.hypot(ex, ey), w = TAU / n, a0 = boss ? boss.a : 0;
  const f = (x, y) => { const r = Math.hypot(x, y); let t = (((Math.atan2(y, x) - a0) % w) + w) % w; t = Math.min(t, w - t); const px = r * Math.cos(t), py = r * Math.sin(t), a1 = r - ri + rho, a2 = rh - r + rho, a3 = -(ex * (py - A[1]) - ey * (px - A[0])) / el + rho, a4 = boss ? boss.R + rho - Math.hypot(px - boss.r, py) : -Infinity;
    return Math.min(Math.max(a1, a2, a3, a4), 0) + Math.hypot(Math.max(a1, 0), Math.max(a2, 0), Math.max(a3, 0), Math.max(a4, 0)) - rho; };
  return trace2d(f, -ri - 0.13, -ri - 0.11, ri + 0.1, ri + 0.1, ri / 64).map((L) => L.reverse()); }

/* --- where everything sits. The going train is as it was; the barrel has moved round to seven o'clock so the micro-rotor has room,
   and the crown wheel now reaches the ratchet through an intermediate wheel, three snailed wheels in a row as in a Glashütte watch. --- */
const DZ = 1.2, BZ = 2.62, BT = 0.98, BTOP = BZ + BT;    // floor of the pockets, the face of the plate the bridges stand on, bridge thickness
const PC = [0, 0], PB = P(7.14, 246), PT = [4.49, -1.31], PF = [8.0, 0], PE = [8.88, 3.29], PP = [6.58, 4.36], PBAL = [5.18, 6.76];
const MW = 2 * 4.3 / 52, NRAT = 52, NCRW = 18, NINT = 30, NDRV = 10, PCW = [-10.9, 0];          // winding wheels share one module
const PINT = meet(PCW, MW * (NCRW + NINT) / 2, PB, MW * (NRAT + NINT) / 2, -1);                  // intermediate winding wheel
const MR = [-5.5, 5.2], RROT = 4.8, RWELL = 5.1;                                                  // micro-rotor and the well it turns in
const MA = 0.12, NROT = 24, NA1 = 36, NAP = 10, NB1 = 48;                                         // automatic train: rotor gear, first wheel, its clutch pinion, second wheel
const PWB = [PB[0] + MW * (NRAT + NDRV) / 2 * Math.cos(rad(112)), PB[1] + MW * (NRAT + NDRV) / 2 * Math.sin(rad(112))];
const PWA = meet(MR, MA * (NROT + NA1) / 2, PWB, MA * (NAP + NB1) / 2, -1);
const RBAL = 4.08, RBS = 4.4;

/* --- the plate: a base, a middle level that is the floor of every pocket, and the upper face with the pockets milled through it --- */
add(mov, ext(disc(14.9), 0.55, 0.06, 48), mPlate, 0, 0, -0.54);
add(mov, lathe([[14.9, -0.85], [15.5, -0.85], [15.5, 2.4], [14.9, 2.4], [14.9, -0.85]], 128), mFrost);
const edgeF = (x, y) => Math.hypot(x, y) - 14.9;
{ const hole = sdU(0.2, sdC(PB, 6.64), sdC(PC, 1.75)); add(mov, slab(trace2d((x, y) => Math.max(edgeF(x, y), -hole(x, y)), -15.1, -15.1, 15.1, 15.1, 0.11, 0.004), 0.07, DZ), tri3(mPlate, mPlateEdge, mPlateWall));
  const pockets = sdU(0.22, sdC(PC, 4.66), sdC(PT, 3.76), sdC(PF, 3.58), sdC(PE, 2.64), sdC(PP, 1.62), sdS(PP, PBAL, 0.85), sdC(PBAL, 1.3), sdC(MR, RWELL), sdC(PWA, MA * NA1 / 2 + 0.45), sdC(PWB, MA * NB1 / 2 + 0.45), sdC(PB, 6.64));
  add(mov, slab(trace2d((x, y) => Math.max(edgeF(x, y), -pockets(x, y)), -15.1, -15.1, 15.1, 15.1, 0.075), DZ, BZ, { bevel: [0, 0.1] }), tri3(mPlate, mPlateEdge, mPlateWall)); }

/* --- the going train --- */
function arbor(g, z0, z1, r = 0.17) { add(g, cyl(r, z1 - z0, 12), mMovSteel, 0, 0, (z0 + z1) / 2); }
function leaves(g, N, rp, z0, z1) { add(g, slab([cogs(N, rp, { add: 0.95, ded: 1.25 })], z0, z1), mMovSteel); }
function gilt(pos, N, rp, z, t, sp) { const g = new THREE.Group(); g.position.set(pos[0], pos[1], 0); add(g, slab([cogs(N, rp)].concat(sp ? crossings(sp.n, sp.rh, sp.ri, sp.w0, sp.w1, sp.rho) : []), z, z + t, { bevel: [0, 0.055] }), tri3(mBrass, mBrassP, mBrassW)); if (sp) add(g, lathe([[sp.rh * 0.62, 0], [sp.rh * 0.62, 0.05], [sp.rh * 0.5, 0.09], [0.1, 0.09]], 24), mBrassP, 0, 0, z + t); mov.add(g); return g; }
const gBarrel = gilt(PB, 72, 6.12, 0.35, 0.5);
add(gBarrel, slab([ringLoop([0, 0], 5.74, 96)], 0.3, 1.42, { bevel: 0.08 }), tri3(mBrass, mBrassP, mBrassW)); arbor(gBarrel, 0, 3.2, 0.55);
const gCenter = gilt(PC, 64, 4.16, 1.62, 0.3, { n: 5, rh: 0.95, ri: 3.5, w0: 0.25, w1: 0.16, rho: 0.16 }); leaves(gCenter, 12, 1.02, 0.3, 1.5); arbor(gCenter, 0, 3.45, 0.3);
const gThird = gilt(PT, 60, 3.3, 2.12, 0.28, { n: 5, rh: 0.78, ri: 2.74, w0: 0.21, w1: 0.14, rho: 0.14 }); leaves(gThird, 8, 0.52, 1.4, 2.1); arbor(gThird, 0.1, 3.45);
const gFourth = gilt(PF, 84, 3.15, 1.5, 0.26, { n: 5, rh: 0.74, ri: 2.68, w0: 0.2, w1: 0.13, rho: 0.14 }); leaves(gFourth, 8, 0.44, 1.8, 2.55); arbor(gFourth, -1.2, 3.45);
/* escape wheel: fifteen club teeth that lean into the turn (clockwise seen from the back), locking face leading */
const escLoop = (() => { const L = [], st = TAU / 15; for (let i = 0; i < 15; i++) for (const q of [[1.5, 0.0], [1.52, 0.27], [2.26, 0.2], [2.19, 0.37], [1.78, 0.6]]) L.push([q[0] * Math.cos((i + q[1]) * st), q[0] * Math.sin((i + q[1]) * st)]); return L; })();
const gEsc = new THREE.Group(); gEsc.position.set(PE[0], PE[1], 0); mov.add(gEsc);
add(gEsc, slab([escLoop].concat(crossings(5, 0.46, 1.3, 0.12, 0.09, 0.09)), 2.15, 2.35, { bevel: [0, 0.035] }), tri3(mSteelG, mMovSteel, mMovSteel)); leaves(gEsc, 7, 0.26, 1.3, 2.0); arbor(gEsc, 0.1, 2.85, 0.13);
/* the lever: arms out to the two pallet stones where they really meet the wheel, sixty degrees apart on its rim, and a fork to the balance */
const gPal = new THREE.Group(); gPal.position.set(PP[0], PP[1], 0); mov.add(gPal);
{ const dl = Math.hypot(PBAL[0] - PP[0], PBAL[1] - PP[1]), u = [(PBAL[0] - PP[0]) / dl, (PBAL[1] - PP[1]) / dl], n = [-u[1], u[0]], aE = Math.atan2(PP[1] - PE[1], PP[0] - PE[0]), tl = dl - 0.5;
  const st = [-1, 1].map((s) => { const a = aE + s * rad(30); return [PE[0] + 2.36 * Math.cos(a) - PP[0], PE[1] + 2.36 * Math.sin(a) - PP[1], a]; }), at = (q, w) => [u[0] * q + n[0] * w, u[1] * q + n[1] * w];
  const f = sdU(0.06, sdC([0, 0], 0.36), sdS([0, 0], at(tl - 0.3, 0), 0.2, 0.13), sdS([0, 0], [st[0][0] * 0.9, st[0][1] * 0.9], 0.2, 0.16), sdS([0, 0], [st[1][0] * 0.9, st[1][1] * 0.9], 0.2, 0.16), sdS(at(tl - 0.38, 0.19), at(tl + 0.16, 0.27), 0.075), sdS(at(tl - 0.38, -0.19), at(tl + 0.16, -0.27), 0.075));
  add(gPal, slab([trace2d(f, -2.7, -2.7, 2.7, 2.7, 0.03)[0]], 2.2, 2.38, { bevel: 0.03 }), tri3(mMovSteel, mMovSteel, mMovSteel));
  st.forEach((s, k) => { const b = add(gPal, new THREE.BoxGeometry(0.5, 0.2, 0.26), mRuby, s[0] * 0.97, s[1] * 0.97, 2.3); b.rotation.z = s[2] + (k ? 0.25 : -0.25); }); arbor(gPal, 0.3, 2.85, 0.12); }
/* balance: raised half a millimetre so the escape wheel and lever cocks can pass beneath its rim. Its three arms swell into round bosses
   on the rim, the same on each arm so the wheel stays in poise, and one boss carries the soccer ball (below). */
const BAL_BOSS = { r: 3.2, R: 0.85, a: rad(40) };
const gBal = new THREE.Group(); gBal.position.set(PBAL[0], PBAL[1], 0); mov.add(gBal);
{ add(gBal, slab([ringLoop([0, 0], RBAL, 96)].concat(crossings(3, 0.62, 3.5, 0.3, 0.2, 0.22, BAL_BOSS)), 3.1, 3.52, { bevel: [0.05, 0.06] }), tri3(mBalG, mBal, mBal)); arbor(gBal, 1.3, 4.5, 0.12);
  const sc = new THREE.CylinderGeometry(0.19, 0.19, 0.36, 10); for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + 0.26; stamp(gBal, mBal, sc, (RBAL + 0.15) * Math.cos(a), (RBAL + 0.15) * Math.sin(a), 3.31, a - Math.PI / 2); }
  add(gBal, cyl(0.75, 0.14), mMovSteel, 0, 0, 2.55); add(gBal, cyl(0.1, 0.36, 8), mRuby, 0.52, 0, 2.33); add(gBal, cyl(0.42, 0.2, 16), mBal, 0, 0, 3.72); }
const hair = (() => { const pts = []; for (let i = 0; i <= 420; i++) { const a = i / 420 * TAU * 9.5, r = 0.5 + i / 420 * 1.88; pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0)); } return add(mov, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 840, 0.03, 5, false), mSpring, PBAL[0], PBAL[1], 3.82); })();

/* soccer: the boss on the arm that points away from the cock (the balance's centre lies under the cock) carries a small domed enamel inlay of a
   soccer ball, black pentagons and white hexagons, polished, in a gold bezel. It turns with the balance. */
let soccerGeo, soccerMat;   // the ball is made here and set into the rotor, further down
const BAL_BALL = { rb: 3.02, hc: 1.25 };   // footprint radius and height of the dome
{ const c = [BAL_BOSS.r * Math.cos(BAL_BOSS.a), BAL_BOSS.r * Math.sin(BAL_BOSS.a)], S = 1024, { rb, hc } = BAL_BALL;
  /* the panels are the truncated icosahedron projected from its centre onto the sphere: a direction belongs to whichever face plane it meets
     first. Pentagons sit on the icosahedron's vertices, hexagons on its faces; one pentagon faces up, and the view is a hemisphere seen
     from above, so the five pentagons round it show at the rim the way a ball does. */
  const ph = (1 + Math.sqrt(5)) / 2, un = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const IV = [[-1, ph, 0], [1, ph, 0], [-1, -ph, 0], [1, -ph, 0], [0, -1, ph], [0, 1, ph], [0, -1, -ph], [0, 1, -ph], [ph, 0, -1], [ph, 0, 1], [-ph, 0, -1], [-ph, 0, 1]], F = [];
  const near = (a, b) => Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) < 1e-6;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) if (near(IV[i], IV[j]) && near(IV[j], IV[k]) && near(IV[i], IV[k])) F.push(un([IV[i][0] + IV[j][0] + IV[k][0], IV[i][1] + IV[j][1] + IV[k][1], IV[i][2] + IV[j][2] + IV[k][2]]));
  const up = un(IV[5]), ax = un([up[1], -up[0], 0]), ang = Math.acos(up[2]), spin = rad(9);   // turn the ball so pentagon 5 looks straight up, then give it a quarter twist
  const rot = (v) => { const cA = Math.cos(ang), sA = Math.sin(ang), d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2], cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]];
    const w = [v[0] * cA + cr[0] * sA + ax[0] * d * (1 - cA), v[1] * cA + cr[1] * sA + ax[1] * d * (1 - cA), v[2] * cA + cr[2] * sA + ax[2] * d * (1 - cA)], cs = Math.cos(spin), sn = Math.sin(spin); return [w[0] * cs - w[1] * sn, w[0] * sn + w[1] * cs, w[2]]; };
  const N = IV.map((v) => [rot(un(v)), 1 / 2.32744]).concat(F.map((v) => [rot(v), 1 / 2.26728]));   // face normals, each over its distance from the centre (edge 1)
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), im = g.createImageData(S, S), D = im.data, sm = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) { const x = (px + 0.5) / S * 2 - 1, y = 1 - (py + 0.5) / S * 2, q = x * x + y * y, o = (py * S + px) * 4; if (q > 1.0) { D[o] = 238; D[o + 1] = 235; D[o + 2] = 228; D[o + 3] = 255; continue; }
    const z = Math.sqrt(1 - q); let b1 = -9, b2 = -9, k1 = 0; for (let k = 0; k < 32; k++) { const n = N[k][0], sc = (n[0] * x + n[1] * y + n[2] * z) * N[k][1]; if (sc > b1) { b2 = b1; b1 = sc; k1 = k; } else if (sc > b2) b2 = sc; }
    const seam = 1 - sm(0.0035, 0.009, (b1 - b2) / b1 * Math.max(z, 0.25)), pent = k1 < 12, c0 = pent ? [16, 17, 19] : [240, 237, 230];
    D[o] = lerp(c0[0], 52, seam * (pent ? 0.25 : 0.85)); D[o + 1] = lerp(c0[1], 52, seam * (pent ? 0.25 : 0.85)); D[o + 2] = lerp(c0[2], 56, seam * (pent ? 0.25 : 0.85)); D[o + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  /* the dome: a spherical cap, with the hemisphere's picture laid on it from above */
  const Rs = (rb * rb + hc * hc) / (2 * hc), z0 = Rs - hc, pos = [], nor = [], uv = [], ix = [], nr = 12, ns = 56;
  for (let i = 0; i <= nr; i++) { const r = rb * i / nr, z = Math.sqrt(Rs * Rs - r * r) - z0; for (let j = 0; j <= ns; j++) { const a = j / ns * TAU, x = r * Math.cos(a), y = r * Math.sin(a); pos.push(x, y, z); nor.push(x / Rs, y / Rs, (z + z0) / Rs); uv.push(0.5 + x / (2 * rb), 0.5 + y / (2 * rb)); } }
  for (let i = 0; i < nr; i++) for (let j = 0; j < ns; j++) { const a = i * (ns + 1) + j, b = a + ns + 1; ix.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix);
  soccerGeo = geo; soccerMat = M('rotor', { map: t, metalness: 0, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1 }); }   // white and black enamel, polished
const cbDice = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;   // my own dice, so nobody else's grain moves

/* --- screws and jewels --- */
const gScrew = lathe([[1, -0.44], [1, -0.16], [0.95, -0.06], [0.8, 0], [0, 0]], 20), gSlot = new THREE.BoxGeometry(1.94, 0.22, 0.1);
function screw(parent, x, y, z, r = 0.62, mat = mBlueScrew) { const a = frnd() * Math.PI; stamp(parent, mat, gScrew, x, y, z, a, r); stamp(parent, mBrDark, gSlot, x, y, z - 0.035 * r, a, r); }   // z is the top of the head
const gChaton = lathe([[2.05, -0.7], [2.05, -0.14], [1.9, 0], [1.24, 0], [1.02, -0.2], [1.02, -0.7]], 28), gStone = lathe([[1.04, -0.22], [0.8, -0.06], [0.42, 0], [0.24, -0.1], [0, -0.13]], 20), gPivot = cyl(0.2, 0.1, 8);
function jewel(x, y, z, r = 0.42, set = true, parent = gBr) { if (set) stamp(parent, mBrGold, gChaton, x, y, z, 0, r); stamp(parent, mBrRuby, gStone, x, y, z - (set ? 0.06 * r : 0), 0, r); stamp(parent, mBrSteel, gPivot, x, y, z - 0.16 * r, 0, r); }   // z is the top of the gold chaton
/* a gold chaton held by three small blued screws whose heads lap over its rim */
function chaton(p, z, r) { jewel(p[0], p[1], z, r); for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.5; screw(gBr, p[0] + 2.2 * r * Math.cos(a), p[1] + 2.2 * r * Math.sin(a), z + 0.1, 0.2); } }

/* --- winding wheels: crown wheel, intermediate wheel and ratchet, snailed steel in sinks cut into the bridge --- */
const ZW = BTOP - 0.3, WSINK = 0.13 + 0.26;
function windWheel(pos, N, core, sr) { const g = new THREE.Group(); g.position.set(pos[0], pos[1], 0); const rp = MW * N / 2; add(g, slab([cogs(N, rp, { add: 0.85, ded: 1.1 }), ringLoop([0, 0], core, 40, true)], ZW, ZW + 0.34, { bevel: [0, 0.13] }), tri3(mWheelS, mBrSteel, mBrSteel));
  add(g, lathe([[core, 0], [core, 0.2], [core - 0.06, 0.24], [0, 0.24]], 32), mBrSteelF, 0, 0, ZW); screw(g, 0, 0, ZW + 0.38, sr, mBlueScrew); arbor(g, BZ - 0.3, ZW, core * 0.5); gBr.add(g); return g; }
const gRat = windWheel(PB, NRAT, 1.3, 0.72), gInt = windWheel(PINT, NINT, 0.85, 0.5), gCrw = windWheel(PCW, NCRW, 0.62, 0.4);

/* --- the bridges --- */
const BR = solid();   // everything in frosted German silver goes into one piece of geometry
const tanAt = (V, c, r, s) => Math.atan2(V[1] - c[1], V[0] - c[0]) + s * Math.acos(r / Math.hypot(V[0] - c[0], V[1] - c[1]));
/* the winding and rotor bridge: the whole left of the movement. Its edge runs down past the balance, round the rotor's well, cuts in to a
   sharp inward corner, runs round the ratchet and out to the rim again. */
const chain = (pts, r) => sdU(0, ...pts.slice(1).map((p, i) => sdS(pts[i], p, r)));
const clickArc = Array.from({ length: 9 }, (_, i) => { const a = rad(lerp(231, 184, i / 8)); return [PB[0] + 5.22 * Math.cos(a), PB[1] + 5.22 * Math.sin(a)]; }), clickTip = [PB[0] - 4.18, PB[1]];   // a blade click: screwed down at one end, its beak in the ratchet
/* the bridge's four big screws. The top one sits midway between the bridge's edge by the balance cock and the rotor's well, so its whole head lies on the frosted face with a margin all round */
const NOTCH = [-2.9, -0.85], BIGS = [[-2.8, 11.05], [-12.15, 2.45], [-9.6, -8.2], [5.25, -10.45]];
{ const L = [], arc = (c, r, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); L.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } }, spl = (pts, n) => { new THREE.SplineCurve([L[L.length - 1]].concat(pts).map((p) => new THREE.Vector2(p[0], p[1]))).getPoints(n).slice(1).forEach((p) => L.push([p.x, p.y])); };
  const RL = 5.4, WL = 6.0, BC = RBS + 0.42, J = meet(MR, WL, PBAL, BC, -1), ang = (p, c) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  arc(PC, 14.55, rad(99), rad(301), 110);
  spl([[6.6, -10.9], [5.9, -9.7], [4.7, -8.95], [3.3, -8.9], [PB[0] + RL * Math.cos(rad(-27)), PB[1] + RL * Math.sin(rad(-27))]], 18);
  arc(PB, RL, rad(-27) + 0.03, tanAt(NOTCH, PB, RL, -1), 44); L.push(NOTCH);
  arc(MR, WL, tanAt(NOTCH, MR, WL, 1), ang(J, MR), 34);
  arc(PBAL, BC, ang(J, PBAL) + TAU - 0.03, rad(165), 12);
  spl([[0.35, 9.0], [-0.5, 10.3], [-1.6, 11.6], [-2.1, 13.0], P(14.55, 99)], 22); L.pop();
  const sinks = sdU(0, sdC(PB, MW * NRAT / 2 + WSINK), sdC(PINT, MW * NINT / 2 + WSINK), sdC(PCW, MW * NCRW / 2 + WSINK), sdC(PWB, MW * NDRV / 2 + WSINK - 0.04), chain(clickArc, 0.56), sdC(clickArc[0], 0.86)), sl = trace2d(sinks, -13.5, -12, 3, 3, 0.05);
  const loops = [L, ringLoop(MR, RWELL, 128, true)].concat(sl.map((q) => q.slice().reverse()), BIGS.map((p) => ringLoop(p, 0.7, 20, true)));
  BR.add(loops, BZ, BTOP, { bevel: [0.3, 0.3].concat(sl.map(() => 0.14), BIGS.map(() => 0.1)) });
  sl.forEach((q) => add(gBr, slab([q], BZ, ZW - 0.04, { noWall: true, noBase: true }), mBrSink));
  BIGS.forEach((p) => screw(gBr, p[0], p[1], BTOP - 0.04, 0.62)); }
/* the train bridge: a two-screw foot on the edge of the plate and two fingers, one over the third wheel and on to the centre, one to the fourth wheel */
const TF = [[7.5, -8.55], [11.0, -4.3]], RCEN = 0.44, RTR = 0.4;
{ const f = sdU(0.3, sdS(TF[0], TF[1], 1.12), sdS([9.0, -6.7], PT, 0.74, 0.6), sdC(PT, 1.36), sdS(PT, PC, 0.6, 0.58), sdC(PC, 1.28), sdS(TF[1], PF, 0.8, 0.6), sdC(PF, 1.36));
  const loops = [trace2d(f, -2, -10.5, 13, 2, 0.06)[0], ringLoop(PC, RCEN * 2.05 + 0.05, 32, true), ringLoop(PT, RTR * 2.05 + 0.05, 32, true), ringLoop(PF, RTR * 2.05 + 0.05, 32, true)].concat(TF.map((p) => ringLoop(p, 0.68, 20, true)));
  BR.add(loops, BZ, BTOP, { bevel: [0.23, 0.1] }); TF.forEach((p) => screw(gBr, p[0], p[1], BTOP - 0.04, 0.6));
  chaton(PC, BTOP - 0.03, RCEN); chaton(PT, BTOP - 0.03, RTR); chaton(PF, BTOP - 0.03, RTR); }
/* low cocks for the escape wheel and the lever, under the rim of the balance where they belong */
const EF = [12.0, 2.15], LF = [4.55, 3.0], ZLOW = BZ + 0.33;
/* a small mesh kit: triangles carry their own normals and are turned to face the way those normals say */
function gbuild() { const P = [], N = [], U = []; return {
  tri(A, B, C) { const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2], d = (uy * vz - uz * vy) * (A[3] + B[3] + C[3]) + (uz * vx - ux * vz) * (A[4] + B[4] + C[4]) + (ux * vy - uy * vx) * (A[5] + B[5] + C[5]);
    for (const V of d >= 0 ? [A, B, C] : [A, C, B]) { P.push(V[0], V[1], V[2]); N.push(V[3], V[4], V[5]); U.push(V[6] ?? V[0], V[7] ?? V[1]); } },
  quad(A, B, C, D) { this.tri(A, B, C); this.tri(A, C, D); },
  arrays: () => [P, N, U],
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g; } }; }
function groupsOf(B) { const g = new THREE.BufferGeometry(), A = B.map((b) => b.arrays()), cat = (k) => A.reduce((o, a) => o.concat(a[k]), []); g.setAttribute('position', new THREE.Float32BufferAttribute(cat(0), 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(cat(1), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(cat(2), 2));
  let s = 0; A.forEach((a, k) => { const c = a[0].length / 3; if (c) g.addGroup(s, c, k); s += c; }); return g; }
/* a binding strap, w wide and th thick, that follows an arch given as [x, z] points */
function bindStrap(pts, w, th) { const b = gbuild(), n = pts.length, nr = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)], tx = c[0] - a[0], tz = c[1] - a[1], l = Math.hypot(tx, tz) || 1; return [-tz / l, tx / l]; });
  const V = (i, s, d, nx, ny, nz) => [pts[i][0] - nr[i][0] * d, s * w / 2, pts[i][1] - nr[i][1] * d, nx, ny, nz];
  for (let i = 0; i < n - 1; i++) { const j = i + 1;
    b.quad(V(i, -1, 0, nr[i][0], 0, nr[i][1]), V(j, -1, 0, nr[j][0], 0, nr[j][1]), V(j, 1, 0, nr[j][0], 0, nr[j][1]), V(i, 1, 0, nr[i][0], 0, nr[i][1]));
    b.quad(V(i, -1, th, -nr[i][0], 0, -nr[i][1]), V(j, -1, th, -nr[j][0], 0, -nr[j][1]), V(j, 1, th, -nr[j][0], 0, -nr[j][1]), V(i, 1, th, -nr[i][0], 0, -nr[i][1]));
    for (const s of [-1, 1]) b.quad(V(i, s, 0, 0, s, 0), V(j, s, 0, 0, s, 0), V(j, s, th, 0, s, 0), V(i, s, th, 0, s, 0)); }
  return b.geo(); }
/* snowboarding: the escape wheel cock is cut as a snowboard. A waisted outline with a true sidecut, nose and tail rounded and turned up, a top
   sheet of white enamel with one bold blued stripe, polished steel edges and black sidewalls. The escape pivot runs in a jewel in the nose, the
   foot screw goes through the tail, and two bindings sit between them at a 32% stance, +15 and -6 degrees. The nose stays low: the balance
   screws sweep over it. */
const SBU = (() => { const d = [PE[0] - EF[0], PE[1] - EF[1]], l = Math.hypot(d[0], d[1]); return [d[0] / l, d[1] / l]; })(), SBN = 0.9, SBT = 0.78, SBW = 0.66;
const SBL = Math.hypot(PE[0] - EF[0], PE[1] - EF[1]) + SBN + SBT, SBC = [(PE[0] + SBN * SBU[0] + EF[0] - SBT * SBU[0]) / 2, (PE[1] + SBN * SBU[1] + EF[1] - SBT * SBU[1]) / 2];
const gBoard = new THREE.Group(); gBoard.position.set(SBC[0], SBC[1], 0); gBoard.rotation.z = Math.atan2(SBU[1], SBU[0]); gBr.add(gBoard);
function boardGeo(o) { const { L, w: wC, dep, sC, p, kN, kT, sKN, sKT, z0, z1, b } = o, a = L / 2 - sC, ch = [];
  for (let i = 0; i < 16; i++) { const th = i / 16 * Math.PI / 2; ch.push([-(sC + a * Math.pow(Math.cos(th), 2 / p)), wC * Math.pow(Math.sin(th), 2 / p)]); }
  for (let i = 0; i <= 26; i++) { const s = lerp(-sC, sC, i / 26); ch.push([s, wC - dep * (1 - (s / sC) ** 2)]); }
  for (let i = 15; i >= 0; i--) { const th = i / 16 * Math.PI / 2; ch.push([sC + a * Math.pow(Math.cos(th), 2 / p), wC * Math.pow(Math.sin(th), 2 / p)]); }
  const n = ch.length, nr = ch.map((q, i) => { const A = ch[Math.max(0, i - 1)], B = ch[Math.min(n - 1, i + 1)], tx = B[0] - A[0], ty = B[1] - A[1], l = Math.hypot(tx, ty) || 1; return [-ty / l, tx / l]; });
  const ins = ch.map((q, i) => [q[0] - b * nr[i][0], Math.max(0, q[1] - b * nr[i][1])]);
  const kick = (s) => { const sK = s > 0 ? sKN : sKT, q = Math.abs(s); if (q <= sK) return [0, 0]; const H = s > 0 ? kN : kT, e = L / 2 - sK, f = (q - sK) / e; return [H * f * f, Math.sign(s) * 2 * H * f / e]; };
  const V = (s, t, z, nx, ny, nz) => { const k = kick(s), c = 1 / Math.sqrt(1 + k[1] * k[1]), si = k[1] * c; return [s, t, z + k[0], nx * c - nz * si, ny, nx * si + nz * c, (s + L / 2) / L, (t + wC) / (2 * wC)]; };
  const B3 = [gbuild(), gbuild(), gbuild()], s0 = Math.sin(rad(22)), c0 = Math.cos(rad(22)), s1 = Math.sin(rad(64)), c1 = Math.cos(rad(64));
  for (let i = 0; i < n - 1; i++) { const j = i + 1, A = ins[i], Bq = ins[j], Pa = ch[i], Pb = ch[j], na = nr[i], nb = nr[j];
    B3[0].quad(V(A[0], -A[1], z1, 0, 0, 1), V(Bq[0], -Bq[1], z1, 0, 0, 1), V(Bq[0], Bq[1], z1, 0, 0, 1), V(A[0], A[1], z1, 0, 0, 1));
    for (const g of [1, -1]) {
      B3[1].quad(V(A[0], g * A[1], z1, na[0] * s0, g * na[1] * s0, c0), V(Pa[0], g * Pa[1], z1 - b, na[0] * s1, g * na[1] * s1, c1), V(Pb[0], g * Pb[1], z1 - b, nb[0] * s1, g * nb[1] * s1, c1), V(Bq[0], g * Bq[1], z1, nb[0] * s0, g * nb[1] * s0, c0));
      B3[2].quad(V(Pa[0], g * Pa[1], z1 - b, na[0], g * na[1], 0), V(Pa[0], g * Pa[1], z0, na[0], g * na[1], 0), V(Pb[0], g * Pb[1], z0, nb[0], g * nb[1], 0), V(Pb[0], g * Pb[1], z1 - b, nb[0], g * nb[1], 0)); }
    B3[2].quad(V(Pa[0], -Pa[1], z0, 0, 0, -1), V(Pb[0], -Pb[1], z0, 0, 0, -1), V(Pb[0], Pb[1], z0, 0, 0, -1), V(Pa[0], Pa[1], z0, 0, 0, -1)); }
  return groupsOf(B3); }
/* the top sheet: u runs tail to nose, v across the board */
const sbTex = (() => { const W = 512, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), X = (s) => (s / SBL + 0.5) * W, Y = (t) => (0.5 - t / (2 * SBW)) * H;
  g.fillStyle = '#eef2f5'; g.fillRect(0, 0, W, H); const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(196,210,224,.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(196,210,224,.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const band = (s0, wd, col) => { const k = 1 / Math.tan(rad(58)); g.fillStyle = col; g.beginPath(); g.moveTo(X(s0 - wd / 2 + k * SBW), Y(SBW)); g.lineTo(X(s0 + wd / 2 + k * SBW), Y(SBW)); g.lineTo(X(s0 + wd / 2 - k * SBW), Y(-SBW)); g.lineTo(X(s0 - wd / 2 - k * SBW), Y(-SBW)); g.closePath(); g.fill(); };
  band(0.02, 0.5, '#2342b4'); band(0.42, 0.07, '#2342b4');
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
const mSBTop = M('bridges', { map: sbTex, metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 });   // white enamel
const mSBSide = M('bridges', { color: 0x15171c, metalness: 0.2, roughness: 0.42 });                                                   // black sidewall and base
const mSBBind = M('bridges', { color: 0x17191f, metalness: 0.45, roughness: 0.36 });                                                  // black anodised bindings
const mSBStrap = M('bridges', { color: 0x3b4049, metalness: 0.3, roughness: 0.45 });                                                  // and their straps
{ add(gBoard, boardGeo({ L: SBL, w: SBW, dep: 0.1, sC: 1.95, p: 2.5, kN: 0.09, kT: 0.13, sKN: 1.86, sKT: 1.96, z0: BZ, z1: ZLOW, b: 0.06 }), tri3(mSBTop, mBrSteel, mSBSide));
  jewel(PE[0], PE[1], ZLOW + 0.06, 0.24); screw(gBr, EF[0], EF[1], ZLOW + 0.08, 0.38);
  /* a binding, x along the board, y from heel to toe: footbed, heel cup and highback raked forward, ankle and toe straps, a steel disc and buckles */
  const rr = (w, h, r) => { const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2; s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0); s.lineTo(x0 + w, y0 + h - r); s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2); s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5); return s; };
  const hb = new THREE.Shape(); hb.absarc(0, -0.3, 0.235, rad(198), rad(342), false); hb.absarc(0, -0.3, 0.185, rad(342), rad(198), true); hb.closePath();
  const hbg = ext(hb, 0.42, 0.012, 12); { const q = hbg.attributes.position; for (let i = 0; i < q.count; i++) q.setY(i, q.getY(i) + 0.22 * Math.max(0, q.getZ(i))); hbg.computeVertexNormals(); }
  const arch = (a, h, z0, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const f = Math.PI * (1 - i / n); return [a * Math.cos(f), z0 + h * Math.pow(Math.sin(f), 0.7)]; });
  const parts = [ext(rr(0.42, 1.0, 0.12), 0.045, 0.01, 6), hbg], straps = [bindStrap(arch(0.235, 0.25, 0.05), 0.17, 0.045).translate(0, -0.08, 0), bindStrap(arch(0.225, 0.16, 0.05), 0.11, 0.04).translate(0, 0.33, 0)];
  const steel = [cyl(0.13, 0.02, 24).translate(0, 0.12, 0.06), new THREE.BoxGeometry(0.075, 0.07, 0.05).translate(0.19, -0.08, 0.26), new THREE.BoxGeometry(0.07, 0.05, 0.045).translate(0.18, 0.33, 0.17)];
  [[0.8, rad(-15)], [-0.8, rad(6)]].forEach(([sb, be]) => { parts.forEach((q) => stamp(gBoard, mSBBind, q, sb, 0, ZLOW, be)); straps.forEach((q) => stamp(gBoard, mSBStrap, q, sb, 0, ZLOW, be)); steel.forEach((q) => stamp(gBoard, mBrSteel, q, sb, 0, ZLOW, be)); });
  const fl = sdU(0.18, sdC(LF, 0.76), sdS(LF, PP, 0.48, 0.4), sdC(PP, 0.6));
  BR.add([trace2d(fl, 3.3, 1.8, 7.6, 5.4, 0.04)[0], ringLoop(LF, 0.46, 16, true)], BZ, ZLOW, { bevel: [0.09, 0.06] });
  jewel(PP[0], PP[1], ZLOW + 0.05, 0.24, false); stamp(gBr, mBrGold, new THREE.TorusGeometry(0.3, 0.07, 8, 20), PP[0], PP[1], ZLOW); screw(gBr, LF[0], LF[1], ZLOW, 0.38); }

/* ---------- under the dial: what the date, the moonphase and the small seconds actually run on.
   These stay with the movement when the dial lifts away. ---------- */
const gUnder = new THREE.Group(); root.add(gUnder); gUnder.add(dateDisc, moonDisc);
const UZ = 0.7;   // dial side face of the main plate
const mUSteel = M('mov', { color: 0xdfe2e6, metalness: 0.95, roughness: 0.24, anisotropy: 0.5 });
const mUBlue = M('mov', { color: 0x1c2f8c, metalness: 1, roughness: 0.14 });
const uwheel = (N, rp, x, y, z, t, mat, o) => { const g = new THREE.Group(); g.position.set(x, y, z); add(g, ext(gearShape(N, rp, o), t, 0.02, 6), mat); gUnder.add(g); return g; };
const uscrew = (x, y, z, r = 0.38) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = x * 3 + y; add(g, cyl(r, 0.16, 18, r * 0.84), mUBlue); add(g, new THREE.BoxGeometry(r * 1.8, r * 0.22, 0.06), mDark, 0, 0, 0.07); gUnder.add(g); };
const ujewel = (x, y, r = 0.4) => { add(gUnder, new THREE.TorusGeometry(r * 1.55, r * 0.34, 10, 28), mBal, x, y, UZ + 0.02); const j = add(gUnder, new THREE.SphereGeometry(r * 1.1, 20, 12), mRuby, x, y, UZ); j.scale.z = 0.4; };
// motion works: cannon pinion 12, minute wheel 36 with a pinion of 10, hour wheel 40. Twelve to one.
add(gUnder, cyl(0.3, 1.6, 16), mMovSteel, 0, 0, UZ + 0.8);
const uCannon = uwheel(12, 0.7, 0, 0, UZ + 0.06, 0.12, mMovSteel), uMinute = uwheel(36, 2.1, 2.63, 0.96, UZ + 0.06, 0.12, mBrass, { spokes: 4 }), uHour = uwheel(40, 2.24, 0, 0, UZ + 0.22, 0.12, mBrass);
add(uMinute, ext(gearShape(10, 0.56), 0.22), mMovSteel, 0, 0, 0.1); add(uMinute, cyl(0.2, 0.5, 12), mMovSteel, 0, 0, 0.1);
add(uHour, ext(gearShape(24, 1.2), 0.1, 0.01, 6), mMovSteel, 0, 0, 0.14);
// date: the hour wheel turns a 24 hour wheel whose finger flicks the ring's 31 inside teeth once a night; a jumper holds each day
const uDay = uwheel(48, 2.4, -3.12, 1.8, UZ + 0.36, 0.1, mBrass, { spokes: 4 }); add(uDay, ext(poly([[0, -0.36], [3.9, -0.16], [4.42, 0], [3.9, 0.16], [0, 0.36]]), 0.1, 0.01), mUSteel, 0, 0, 0.02); add(uDay, cyl(0.45, 0.2, 16), mMovSteel, 0, 0, 0.1);
const uRing = new THREE.Group(); gUnder.add(uRing);
{ const s = disc(8.8), h = new THREE.Path(), st = TAU / 31; for (let i = 0; i < 31; i++) { const a = i * st, b = a + st * 0.72; i ? h.lineTo(8.42 * Math.cos(a), 8.42 * Math.sin(a)) : h.moveTo(8.42, 0); h.lineTo(7.9 * Math.cos(b), 7.9 * Math.sin(b)); } h.closePath(); s.holes.push(h); add(uRing, ext(s, 0.1, 0.01, 48), mUSteel, 0, 0, UZ + 0.34); }
{ const a0 = rad(197), s = new THREE.Shape(); s.absarc(0, 0, 7.32, a0 + 0.03, a0 + 0.8, false); s.absarc(0, 0, 7.06, a0 + 0.8, a0 + 0.03, true); s.lineTo(7.84 * Math.cos(a0), 7.84 * Math.sin(a0)); s.closePath(); add(gUnder, ext(s, 0.1, 0.01, 24), mUSteel, 0, 0, UZ + 0.34); uscrew(7.2 * Math.cos(a0 + 0.76), 7.2 * Math.sin(a0 + 0.76), UZ + 0.48, 0.3); add(gUnder, cyl(0.3, 0.34, 12), mMovSteel, 7.2 * Math.cos(a0 + 0.76), 7.2 * Math.sin(a0 + 0.76), UZ + 0.17); }
// moonphase: 59 teeth for two lunations, advanced through an intermediate wheel off the hour wheel, held by its own jumper
const uMoon = new THREE.Group(); uMoon.position.set(0, MC - DM, 0); gUnder.add(uMoon); add(uMoon, ext(gearShape(59, MDR - 0.3, { add: 0.8 }), 0.1, 0.01, 4), mBrass, 0, 0, ZD - 0.37); add(uMoon, cyl(0.5, 0.5, 16), mMovSteel, 0, 0, UZ + 0.25);
const uMoonDrive = uwheel(20, 1.05, 0, -3.3, UZ + 0.22, 0.34, mMovSteel);
{ const a = rad(127), tip = [5.66 * Math.cos(a), MC - DM + 5.66 * Math.sin(a)], an = [-5.3, -3.2]; add(gUnder, ext(capsule(tip, an, 0.1, 0.34), 0.1, 0.01), mUSteel, 0, 0, ZD - 0.37); add(gUnder, cyl(0.3, 0.6, 12), mMovSteel, an[0], an[1], UZ + 0.3); uscrew(an[0], an[1], ZD - 0.3, 0.28); }
// small seconds: the fourth wheel's arbor comes straight up through a jewel. Other pivots get theirs too.
ujewel(SX, 0, 0.46); [[-4.49, -1.31], [-8.88, 3.29], [-PB[0], PB[1]], [-5.18, 6.76], [-6.58, 4.36]].forEach((p) => ujewel(p[0], p[1], 0.34));
// keyless works by the crown: setting lever spring, yoke and their screws
{ add(gUnder, ext(capsule([9.4, -2.3], [12.6, 1.5], 1.25, 0.95), 0.14, 0.02), mUSteel, 0, 0, UZ); add(gUnder, ext(capsule([8.2, 2.6], [12.4, 3.4], 0.32, 0.5), 0.12, 0.02), mUSteel, 0, 0, UZ); uscrew(9.6, -2.2, UZ + 0.2, 0.36); uscrew(12.4, 1.3, UZ + 0.2, 0.3); uscrew(12.3, 3.4, UZ + 0.18, 0.26); }
[[-2.2, -6.6], [1.2, 6.9], [6.4, 6.2], [-9.6, -5.0], [3.2, -6.4], [-1.4, 11.6], [-11.8, 3.6]].forEach((p) => uscrew(p[0], p[1], UZ + 0.06, 0.4));

/* ---------- finishing on the back: an engraved balance cock, a swan neck, screwed gold chatons, the click, and the automatic train on its own bridge ---------- */
const CK = { x0: -2.5, w: 10.5, y0: 4, h: 12 };
const CB0 = P(13.0, 86), CKL = Math.hypot(CB0[0] - PBAL[0], CB0[1] - PBAL[1]), CKU = [(CB0[0] - PBAL[0]) / CKL, (CB0[1] - PBAL[1]) / CKL], CQ = (q, v) => [PBAL[0] + CKU[0] * q - CKU[1] * v, PBAL[1] + CKU[1] * q + CKU[0] * v], CKS = CKL - 0.95;
/* the cock is cut with Indian ornament: a lotus round the balance jewel, three boteh (paisley) down the body, a rosette round the foot screw, and beaded borders like mehndi */
const cockMap = (bump) => { const t = tex(1024, (g, S) => { const X = (x) => (x - CK.x0) / CK.w * S, Y = (y) => S - (y - CK.y0) / CK.h * S, k = S / CK.w; seed = 2024;
    g.fillStyle = bump ? '#a8a8a8' : '#e2dbc6'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 22000; i++) { g.fillStyle = bump ? 'rgba(0,0,0,' + rnd() * 0.4 + ')' : 'rgba(70,60,40,' + rnd() * 0.24 + ')'; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1.3, 0, TAU); g.fill(); }
    const L = CKL, Q = CQ;
    const draw = (col, lw, off) => { g.strokeStyle = col; g.fillStyle = col; g.lineCap = g.lineJoin = 'round';
      const path = (pts, close, w = 1) => { g.beginPath(); pts.forEach((p, i) => { const q = Q(p[0], p[1]); i ? g.lineTo(X(q[0]) + off, Y(q[1]) + off) : g.moveTo(X(q[0]) + off, Y(q[1]) + off); }); if (close) g.closePath(); g.lineWidth = lw * w * k; g.stroke(); };
      const dot = (q0, v0, r) => { const q = Q(q0, v0); g.beginPath(); g.arc(X(q[0]) + off, Y(q[1]) + off, r * k, 0, TAU); g.fill(); };
      const ring = (q0, v0, r) => path(Array.from({ length: 49 }, (_, i) => [q0 + r * Math.cos(i * TAU / 48), v0 + r * Math.sin(i * TAU / 48)]));
      const turn = (pts, q0, v0, a) => pts.map((p) => [q0 + p[0] * Math.cos(a) - p[1] * Math.sin(a), v0 + p[0] * Math.sin(a) + p[1] * Math.cos(a)]);
      const petal = (q0, v0, a, r0, len, wd) => { const pts = []; for (let i = 0; i <= 12; i++) pts.push([r0 + i / 12 * len, wd * Math.pow(Math.sin(Math.PI * Math.pow(i / 12, 0.75)), 0.9)]); for (let i = 12; i >= 0; i--) pts.push([r0 + i / 12 * len, -wd * Math.pow(Math.sin(Math.PI * Math.pow(i / 12, 0.75)), 0.9)]); path(turn(pts, q0, v0, a), true, 0.8); path(turn([[r0 + len * 0.15, 0], [r0 + len * 0.8, 0]], q0, v0, a), false, 0.5); };
      const flower = (q0, v0, n, r0, len, wd, rr) => { for (let i = 0; i < n; i++) petal(q0, v0, i * TAU / n + 0.2, r0, len, wd); if (rr) { ring(q0, v0, rr); for (let i = 0; i < n * 2; i++) dot(q0 + (rr + 0.14) * Math.cos(i * TAU / (n * 2)), v0 + (rr + 0.14) * Math.sin(i * TAU / (n * 2)), 0.05); } };
      const boteh = (q0, v0, size, flip) => { [1, 0.7, 0.4].forEach((m, j) => { const pts = []; for (let i = 0; i <= 56; i++) { const f = i / 56 * TAU, y = -Math.cos(f), x = Math.sin(f) * Math.pow(Math.abs(Math.sin(f / 2)), 1.6) * 0.64 + flip * 0.55 * Math.pow(Math.max(0, -y), 2.2); pts.push([x * size * m, (y + j * 0.16) * size * m]); } path(turn(pts, q0, v0, -Math.PI / 2), true, j ? 0.7 : 1.25); });
        flower(q0 + 0.42 * size, v0, 6, 0.05, 0.2 * size, 0.08 * size, 0); dot(q0 + 0.42 * size, v0, 0.06); for (let i = 0; i < 9; i++) { const a = -1.9 + i * 0.475; dot(q0 + 0.42 * size + 0.86 * size * Math.cos(a), v0 + 0.86 * size * Math.sin(a) * 0.82, 0.05); } };
      const hw = (q) => lerp(1.78, 2.28, clamp(q / L, 0, 1));
      [1, -1].forEach((sg) => { path(Array.from({ length: 41 }, (_, i) => { const q = 1.5 + (L - 2.4) * i / 40; return [q, sg * (hw(q) - 0.2)]; })); for (let q = 1.6; q < L - 1.0; q += 0.3) dot(q, sg * (hw(q) - 0.36), 0.05);
        path(Array.from({ length: 61 }, (_, i) => { const q = 1.9 + (L - 3.6) * i / 60; return [q, sg * (hw(q) - 0.62 - 0.08 * Math.sin(q * 5.2))]; }), false, 0.6); });
      flower(0, 0, 12, 1.2, 0.42, 0.15, 0); for (let i = 0; i < 12; i++) petal(0, 0, i * TAU / 12 + 0.2 + TAU / 24, 1.22, 0.24, 0.08); ring(0, 0, 1.15);
      boteh(2.75, 0.3, 0.84, 1); boteh(4.4, -0.36, 0.9, -1); boteh(5.85, 0.36, 0.74, 1);
      flower(CKS, 0, 8, 0.86, 0.5, 0.18, 1.46); ring(CKS, 0, 0.8);
      for (let q = 1.95; q < L - 2.6; q += 0.62) [1, -1].forEach((sg) => { const v0 = sg * (hw(q) - 1.0), pts = []; for (let i = 0; i <= 26; i++) { const u = i / 26, a = sg * (0.4 + u * 5.8), r = 0.26 * (1 - 0.8 * u); pts.push([q + r * Math.cos(a), v0 + r * Math.sin(a)]); } path(pts, false, 0.7); });
      [[3.5, 0.95], [5.1, 1.0], [3.6, -1.0], [2.2, 1.05], [4.9, -1.15], [3.55, 0.05], [5.1, -0.05]].forEach((p) => { flower(p[0], p[1], 5, 0.03, 0.16, 0.06, 0); dot(p[0], p[1], 0.045); }); };
    if (bump) draw('#000', 0.115, 0); else { draw('rgba(255,255,255,.9)', 0.075, 2.2); draw('#2f2513', 0.1, 0); } }, { data: bump });
  t.repeat.set(1 / CK.w, 1 / CK.h); t.offset.set(-CK.x0 / CK.w, -CK.y0 / CK.h); return t; };
const mCock = M('bridges', { map: cockMap(false), bumpMap: cockMap(true), bumpScale: 3.2, metalness: 0.52, roughness: 0.42, envMapIntensity: 1.3 });
const mCBBlack = M('bridges', { color: 0x0a0b0e, metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 });   // black enamel: hob, burner cap, tonearm
const mGrate = M('bridges', { color: 0x464a52, metalness: 0.8, roughness: 0.34 });                                                  // the grate, cast and satin finished
const ZCK = 4.22, ZCT = 4.92, ZHOB = ZCT + 0.165, GRATE = Math.atan2(CKU[1], CKU[0]) + Math.PI / 4;   // hob face; first grate finger, 45 degrees off the cock
{ const f = sdS(CB0, PBAL, 2.5, 2.0), body = trace2d(f, -2.2, 4.2, 7.8, 15.8, 0.06)[0], foot = trace2d((x, y) => Math.max(f(x, y), Math.hypot(x - CB0[0], y - CB0[1]) - 3.3), -2.2, 9, 4.6, 15.8, 0.07)[0], fs = CQ(CKS, 0);
  add(gBr, slab([body, ringLoop(PBAL, 0.96, 32, true), ringLoop(fs, 0.72, 20, true)], ZCK, ZCT, { bevel: [0.18, 0.09] }), tri3(mCock, mBrEdge, mBrWall)); BR.add([foot], BZ, ZCK, {});
  screw(gBr, fs[0], fs[1], ZCT - 0.03, 0.64);
  /* cooking: the balance jewel is set in a gas burner. A black enamel hob with a polished steel trim lies round it, a gilt burner head carries
     a black enamelled cap with the ruby at its centre, and a slim four finger grate stands over the flames (they are drawn further down) */
  frnd(); frnd();   // the two chaton screws have gone: keep the finisher's dice where they were
  { const hx = PBAL[0], hy = PBAL[1];
    stamp(gBr, mCBBlack, lathe([[1.69, ZHOB], [0.96, ZHOB]], 72), hx, hy, 0);                                                                   // the hob, over the regulator's ring
    stamp(gBr, mBrGold, lathe([[1.77, ZCT - 0.02], [1.77, ZHOB - 0.045], [1.69, ZHOB]], 72), hx, hy, 0);                                         // its gilt trim; the index arms run out under it
    stamp(gBr, mBrGold, lathe([[0.95, ZCT - 0.3], [0.95, ZHOB + 0.025], [0.88, ZHOB + 0.055], [0.88, ZHOB + 0.195], [0.78, ZHOB + 0.215], [0.3, ZHOB + 0.215]], 48), hx, hy, 0);   // burner head
    stamp(gBr, mCBBlack, lathe([[0.8, ZHOB + 0.185], [0.93, ZHOB + 0.205], [0.95, ZHOB + 0.23], [0.9, ZHOB + 0.265], [0.72, ZHOB + 0.305], [0.48, ZHOB + 0.325], [0.41, ZHOB + 0.315], [0.4, ZHOB + 0.235]], 48), hx, hy, 0);   // cap
    stamp(gBr, mBrRuby, gStone, hx, hy, ZHOB + 0.315, 0, 0.36); stamp(gBr, mBrGold, new THREE.TorusGeometry(0.41, 0.045, 8, 32), hx, hy, ZHOB + 0.315);
    for (let i = 0; i < 4; i++) { const a = GRATE + i * Math.PI / 2, c = Math.cos(a), si = Math.sin(a);   // a cast grate, its fingers between the flames and clear of the index
      stamp(gBr, mGrate, new RoundedBoxGeometry(0.76, 0.1, 0.08, 1, 0.025), hx + 1.29 * c, hy + 1.29 * si, ZHOB + 0.7, a); stamp(gBr, mGrate, cyl(0.05, 0.72, 8), hx + 1.62 * c, hy + 1.62 * si, ZHOB + 0.34); } }
  /* swan neck: the regulator index rides round the jewel setting, a curved steel spring holds its tail against a fine screw */
  const q2 = (q, v) => { const p = CQ(q, v); return [p[0], p[1]]; }, ro = sdC(PBAL, 1.13), ri = sdC(PBAL, 0.93), idx = sdU(0.05, (x, y) => Math.max(ro(x, y), -ri(x, y)), sdS(q2(1.05, 0.1), q2(2.75, 0.42), 0.17, 0.08), sdS(q2(-1.0, -0.2), q2(-1.62, -0.42), 0.15, 0.12));
  const np = new THREE.SplineCurve([[3.55, -1.05], [3.98, -0.72], [4.2, -0.05], [4.02, 0.62], [3.5, 0.98], [2.98, 0.92], [2.72, 0.6]].map((p) => new THREE.Vector2(p[0], p[1]))).getPoints(28).map((p) => q2(p.x, p.y)), neck = sdU(0.03, sdC(np[0], 0.36), ...np.slice(1).map((p, i) => sdS(np[i], p, lerp(0.16, 0.07, i / 28), lerp(0.16, 0.07, (i + 1) / 28))));
  const ST = solid(); ST.add(trace2d(idx, 2.6, 4.6, 7.4, 9.6, 0.03), ZCT + 0.02, ZCT + 0.14, { bevel: 0.03 }); ST.add([trace2d(neck, 0.5, 6.5, 6.5, 12, 0.03)[0]], ZCT, ZCT + 0.14, { bevel: 0.03 });
  const blk = q2(2.62, 0.02); ST.add([ringLoop(blk, 0.26, 16)], ZCT, ZCT + 0.2, { bevel: 0.03 }); add(gBr, ST.geo(), tri3(mBrSteelF, mBrSteel, mBrSteel));
  const s1 = np[0]; screw(gBr, s1[0], s1[1], ZCT + 0.24, 0.24); screw(gBr, blk[0], blk[1], ZCT + 0.28, 0.14);
  const pin = q2(-1.62, -0.42); stamp(gBr, mBrSteel, cyl(0.05, 0.9, 6), pin[0], pin[1], ZCT - 0.4);
  /* the stud that holds the outer end of the hairspring */
  const sd = q2(-0.95, 1.75); stamp(gBr, mBrSteel, cyl(0.2, 0.97, 10), sd[0], sd[1], ZCK - 0.135); }   // its foot stops above the balance arms
/* the click: one blade of steel in its own sink beside the ratchet. It gives as each tooth passes and drops behind it. */
const gClick = new THREE.Group(); gClick.position.set(clickArc[0][0], clickArc[0][1], 0); gBr.add(gClick);
{ const o = clickArc[0], rel = (p) => [p[0] - o[0], p[1] - o[1]], pts = clickArc.map(rel), tip = rel(clickTip), f = sdU(0.04, sdC([0, 0], 0.5), chain(pts, 0.11), sdS(pts[8], tip, 0.2, 0.07));
  add(gClick, slab([trace2d(f, -3.2, -0.8, 1.0, 5.2, 0.025)[0]], ZW + 0.02, ZW + 0.3, { bevel: 0.035 }), tri3(mBrSteelF, mBrSteel, mBrSteel)); screw(gBr, o[0], o[1], ZW + 0.42, 0.3); }
/* music: the ratchet is the platter, its teeth the strobe dots of a DJ deck, and on it lies a record: fine grooves, the bright ring of the run
   out, a saffron label and a steel spindle. A tonearm stands on the bridge below it: counterweight, slim tube, and a headshell set at the
   offset angle so the stylus sits square in the lead in groove. caseFX spins the record, and for music brings it up to 33 1/3 and lowers the arm. */
const RREC = 3.86, ZREC = ZW + 0.345, ZGRV = ZREC + 0.058;   // the record lies on the ratchet's face; the grooved surface
const gRec = new THREE.Group(); gRec.position.set(PB[0], PB[1], 0); gBr.add(gRec);
{ const vinyl = (rough) => tex(512, (g, S) => { const k = S / 2 / RREC, c = S / 2, r = cbDice(rough ? 5 : 3), ring = (r0, r1, col) => { g.strokeStyle = col; g.lineWidth = (r1 - r0) * k; g.beginPath(); g.arc(c, c, (r0 + r1) / 2 * k, 0, TAU); g.stroke(); };
    g.fillStyle = rough ? 'rgb(0,60,0)' : '#0e0e10'; g.fillRect(0, 0, S, S); ring(3.6, 3.9, rough ? 'rgb(0,50,0)' : '#141417');
    for (let q = 1.8; q < 3.6; q += 1 / k) { const v = r(); ring(q, q + 0.6 / k, rough ? 'rgb(0,' + Math.round(96 + v * 40) + ',0)' : 'rgb(' + (16 + v * 10 | 0) + ',' + (16 + v * 10 | 0) + ',' + (19 + v * 10 | 0) + ')'); }
    [2.12, 2.49, 2.83, 3.2].forEach((q) => ring(q - 0.025, q + 0.025, rough ? 'rgb(0,40,0)' : '#0a0a0c'));   // the gaps between the tracks
    ring(1.44, 1.78, rough ? 'rgb(0,28,0)' : '#2c2c32'); }, { span: RREC, data: rough });   // the run out: smooth, so it shows as a light ring
  const vg = lathe([[3.84, ZREC], [3.86, ZREC + 0.025], [3.86, ZREC + 0.05], [3.83, ZREC + 0.07], [3.76, ZREC + 0.07], [3.72, ZREC + 0.07], [3.66, ZGRV], [3.62, ZGRV], [1.48, ZGRV], [1.44, ZGRV], [1.38, ZREC + 0.07], [1.34, ZREC + 0.07], [0.76, ZREC + 0.07]], 128);
  { const q = vg.attributes.position, uv = vg.attributes.uv; for (let i = 0; i < q.count; i++) uv.setXY(i, q.getX(i), q.getY(i)); }
  add(gRec, vg, M('bridges', { map: vinyl(false), roughnessMap: vinyl(true), roughness: 1, metalness: 0, anisotropy: 0.85, anisotropyMap: polarDir, envMapIntensity: 1.3 }));
  const label = tex(256, (g, S) => { const c = S / 2, R = S / 2; const gr = g.createRadialGradient(c, c, 0, c, c, R); gr.addColorStop(0, '#e6a838'); gr.addColorStop(1, '#cf8a22'); g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
    g.strokeStyle = '#3a2207'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, R * 0.93, 0, TAU); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, R * 0.36, 0, TAU); g.stroke(); g.beginPath(); g.arc(c, c, R * 0.12, 0, TAU); g.stroke();
    g.fillStyle = '#3a2207'; g.textAlign = 'center'; g.textBaseline = 'middle'; const arc = (str, rr, a0, a1, font, up) => { g.font = font; for (let i = 0; i < str.length; i++) { const a = lerp(a0, a1, str.length > 1 ? i / (str.length - 1) : 0.5); g.save(); g.translate(c + rr * Math.cos(a), c + rr * Math.sin(a)); g.rotate(a + (up ? Math.PI / 2 : -Math.PI / 2)); g.fillText(str[i], 0, 0); g.restore(); } };
    arc('NK RECORDS', R * 0.72, rad(-150), rad(-30), '700 19px Georgia, serif', true); arc('33 1/3  SIDE A', R * 0.72, rad(155), rad(25), '600 15px Georgia, serif', false);
    g.font = 'italic 600 22px Georgia, serif'; g.fillText('Kurmala', c, c + R * 0.52); });
  add(gRec, cyl(1.33, 0.008, 64), M('bridges', { map: label, metalness: 0, roughness: 0.55 }), 0, 0, ZREC + 0.074);
  stamp(gBr, mBrSteel, lathe([[0.12, 0], [0.12, 0.13], [0.1, 0.17], [0.05, 0.19], [0, 0.195]], 16), PB[0], PB[1], ZREC + 0.078); }   // the spindle stands still
const TAP = [PB[0] + 5.8 * Math.cos(rad(-40)), PB[1] + 5.8 * Math.sin(rad(-40))], TAS = [PB[0] + 3.5 * Math.cos(rad(-115)), PB[1] + 3.5 * Math.sin(rad(-115))];   // pivot, stylus
const TAH = 0.55, TAO = rad(-20), TAZ = ZGRV + 0.297, TAL = Math.hypot(TAS[0] - TAP[0], TAS[1] - TAP[1]), TAE = Math.sqrt(TAL * TAL - (TAH * Math.sin(TAO)) ** 2) - TAH * Math.cos(TAO);   // the tube ends at TAE
const gTone = new THREE.Group(); gTone.position.set(TAP[0], TAP[1], TAZ); gTone.rotation.z = Math.atan2(TAS[1] - TAP[1], TAS[0] - TAP[0]) - Math.atan2(TAH * Math.sin(TAO), TAE + TAH * Math.cos(TAO)); gBr.add(gTone);
const gToneT = new THREE.Group(); gToneT.rotation.y = -0.017; gTone.add(gToneT);   // tilts about the bearing: cued up at rest
{ const along = (r, x0, x1, seg = 14) => new THREE.CylinderGeometry(r, r, x1 - x0, seg).rotateZ(-Math.PI / 2).translate((x0 + x1) / 2, 0, 0), hs = (geo, x, y, z) => geo.translate(x, y, z).rotateZ(TAO).translate(TAE, 0, 0);
  stamp(gToneT, mBrSteel, along(0.072, -0.42, TAE)); stamp(gToneT, mBrSteel, along(0.21, -1.0, -0.56, 28)); stamp(gToneT, mCBBlack, along(0.215, -0.84, -0.74, 28)); stamp(gToneT, mCBBlack, along(0.1, TAE - 0.12, TAE + 0.02, 16));
  stamp(gToneT, mBrSteel, hs(new RoundedBoxGeometry(0.86, 0.3, 0.04, 2, 0.015), 0.34, 0, -0.055)); stamp(gToneT, mCBBlack, hs(new THREE.BoxGeometry(0.42, 0.22, 0.14), TAH - 0.12, 0, -0.145));
  stamp(gToneT, mBrSteel, hs(cyl(0.022, 0.09, 6), TAH, 0, -0.25)); stamp(gToneT, mBrSteel, hs(along(0.02, 0, 0.3, 6).rotateZ(rad(62)), 0.72, 0.1, -0.05));   // stylus, finger lift
  stamp(gBr, mBrSteel, lathe([[0.62, BTOP], [0.62, BTOP + 0.06], [0.58, BTOP + 0.1], [0, BTOP + 0.1]], 40), TAP[0], TAP[1], 0);
  stamp(gBr, mCBBlack, lathe([[0.44, BTOP + 0.09], [0.44, BTOP + 0.19], [0.4, BTOP + 0.21], [0, BTOP + 0.21]], 32), TAP[0], TAP[1], 0);
  stamp(gBr, mBrSteel, lathe([[0.22, BTOP + 0.2], [0.22, TAZ + 0.1], [0.17, TAZ + 0.15], [0, TAZ + 0.16]], 24), TAP[0], TAP[1], 0); }
/* automatic winding by micro-rotor. A gear under the rotor turns the first wheel, which lies in the well beneath it and shows through the pierced web.
   That wheel carries a one-way clutch pinion: it drives the second wheel when the rotor swings one way and slips when it swings back.
   The second wheel's arbor comes up through the bridge and its pinion turns the ratchet; the crown wheel winds the same ratchet through the intermediate wheel. */
const autoWheel = (pos, N, z, t, sp, face) => { const g = new THREE.Group(); g.position.set(pos[0], pos[1], 0); const r = MA * N / 2; add(g, slab([cogs(N, r)].concat(sp ? crossings(5, r * 0.26, r - 0.42, 0.15, 0.1, 0.1) : []), z, z + t, { bevel: [0, 0.04] }), tri3(face, mMovSteel, mMovSteel)); mov.add(g); return g; };
const aPin = autoWheel(MR, NROT, 2.3, 0.3, false, mSteelG), aR1 = autoWheel(PWA, NA1, 2.36, 0.14, true, mSteelG), aR1p = autoWheel(PWA, NAP, 1.98, 0.38, false, mMovSteel), aR2 = autoWheel(PWB, NB1, 2.06, 0.16, true, mBrass);
arbor(aR1, DZ, 2.56, 0.16); arbor(aR2, 1.5, ZW, 0.2);
add(aR2, slab([cogs(NDRV, MW * NDRV / 2, { add: 0.85, ded: 1.1 })], ZW, ZW + 0.34), mBrSteel); add(aR2, lathe([[0.5, 0], [0.5, 0.05], [0.42, 0.1], [0, 0.1]], 20), mBrSteelF, 0, 0, ZW + 0.34); screw(aR2, 0, 0, ZW + 0.56, 0.26);
/* engraving, cut and filled with gold: each inscription is its own small strip so the letters stay crisp */
function engrave(str, c, r, a0, a1, h, z, font) { const len = Math.abs(rad(a1 - a0)) * r, Hc = 96, Wc = Math.round(len / h * Hc), cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc; const g = cv.getContext('2d'); g.font = font || '600 74px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = str.length, pad = 40, xs = (i) => pad + (Wc - 2 * pad) * (n > 1 ? i / (n - 1) : 0.5), put = (col, dx, dy) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillText(str[i], xs(i) + dx, Hc / 2 + 4 + dy); };
  put('rgba(36,26,8,.95)', -2, -2); put('rgba(255,250,228,.8)', 1.6, 1.6); const gr = g.createLinearGradient(0, 14, 0, Hc - 10); gr.addColorStop(0, '#b98a2a'); gr.addColorStop(0.5, '#e3bb5c'); gr.addColorStop(1, '#c1922f'); put(gr, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; const pos = [], uv = [], idx = [], m = 40, out = a1 < a0 ? 1 : 0;
  for (let i = 0; i <= m; i++) { const a = rad(lerp(a0, a1, i / m)), cx = Math.cos(a), sy = Math.sin(a); pos.push(c[0] + (r - h / 2) * cx, c[1] + (r - h / 2) * sy, z, c[0] + (r + h / 2) * cx, c[1] + (r + h / 2) * sy, z); uv.push(i / m, 1 - out, i / m, out); if (i < m) { const k = i * 2; out ? idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3) : idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  return add(gBr, geo, M('bridges', { map: t, transparent: true, depthWrite: false, metalness: 0.85, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); }
engrave('KURMALA', PC, 12.12, 259, 295, 1.3, BTOP + 0.004);
{ const m = [(TF[0][0] + TF[1][0]) / 2, (TF[0][1] + TF[1][1]) / 2], d = Math.hypot(TF[1][0] - TF[0][0], TF[1][1] - TF[0][1]), n = [(TF[1][1] - TF[0][1]) / d, -(TF[1][0] - TF[0][0]) / d], a = Math.atan2(-n[1], -n[0]) * 180 / Math.PI, w = 2.05 / 200 * 180 / Math.PI;
  engrave('CAL. 327', [m[0] + n[0] * 200, m[1] + n[1] * 200], 200, a + w, a - w, 0.8, BTOP + 0.004, '600 60px Georgia, "Times New Roman", serif'); }
add(gBr, BR.geo(), tri3(mBridge, mBrEdge, mBrWall));
/* the flames: twelve blue gas flames round the burner, soft additive cards with a white core, and a faint blue glow on the hob under them.
   One mesh and one draw call; caseFX moves its few hundred vertices to make them flicker. */
const FLN = 12, FLR = 0.9, FLZ = ZHOB + 0.2, FLV = FLN * 10 + 4;
const flameTex = (() => { const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H), d = im.data, sm = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = 1 - (y + 0.5) / H; let R = 0, G = 0, B = 0;
    if (x < 128) { const h = Math.abs((x + 0.5) / 64 - 1), wo = 0.9 * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, 0.08 + 0.92 * v), 0.8)), 0.6), base = sm(0, 0.06, v);
      const e = wo > 0.01 ? h / wo : 9, io = sm(1, 0.78, e) * (0.5 + 0.5 * Math.min(1, e)) * Math.pow(1 - v, 0.6) * base;   // the mantle, a little brighter at its edge
      const wi = 0.5 * Math.pow(Math.max(0, 1 - v / 0.48), 0.8), ii = wi > 0.01 ? sm(1, 0.55, h / wi) * sm(0, 0.04, v) : 0;   // the inner cone
      R = io * lerp(0.1, 0.3, v) + ii * 0.3 + Math.pow(ii, 4) * 0.42; G = io * lerp(0.32, 0.2, v) + ii * 0.7 + Math.pow(ii, 4) * 0.2; B = io * 1.0 + ii * 1.0; }
    else { const q = Math.hypot(x + 0.5 - 192, y + 0.5 - 64) / 64, I = Math.exp(-Math.pow((q - 0.7) / 0.16, 2)) * sm(1, 0.88, q); R = 0.05 * I; G = 0.17 * I; B = 0.7 * I; }
    d[i] = clamp(R, 0, 1) * 255; d[i + 1] = clamp(G, 0, 1) * 255; d[i + 2] = clamp(B, 0, 1) * 255; d[i + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const mFlame = new THREE.MeshBasicMaterial({ map: flameTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
mFlame.userData = { bo: 1, bt: true, layer: 'bridges' }; LAY.bridges.mats.push(mFlame);   // fades with the bridges like everything else on them
const flameGeo = (() => { const g = new THREE.BufferGeometry(), uv = [], ix = [];
  for (let i = 0; i < FLN; i++) for (let k = 0; k <= 4; k++) { uv.push(0, k / 4, 0.5, k / 4); if (k < 4) { const a = i * 10 + k * 2, b = a + 2; ix.push(a, b, a + 1, a + 1, b, b + 1); } }
  const o = FLN * 10; uv.push(0.5, 0, 1, 0, 1, 1, 0.5, 1); ix.push(o, o + 1, o + 2, o, o + 2, o + 3);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLV * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(FLV * 3), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); return g; })();
function flameSet(t, boost) { const P = flameGeo.attributes.position.array, C = flameGeo.attributes.color.array; let v = 0;
  const put = (x, y, z, c) => { P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; C[v * 3] = C[v * 3 + 1] = C[v * 3 + 2] = c; v++; };
  for (let i = 0; i < FLN; i++) { const a = GRATE + (i + 0.5) * TAU / FLN, ca = Math.cos(a), sa = Math.sin(a), ph = i * 2.39996;
    const len = 0.74 * (1 + 0.28 * boost) * (1 + 0.08 * Math.sin(t * 11.3 + ph) + 0.05 * Math.sin(t * 17.9 + ph * 2.1) + 0.035 * Math.sin(t * 27.7 + ph * 3.3));
    const wob = 0.045 * Math.sin(t * 8.3 + ph * 1.7), br = (1 + 0.35 * boost) * (0.92 + 0.08 * Math.sin(t * 14.1 + ph * 1.3)), w = 0.2 * (1 + 0.1 * boost);
    for (let k = 0; k <= 4; k++) { const u = k / 4, rr = FLR + len * (0.9 * u - 0.12 * u * u), zz = FLZ + len * (0.06 * u + 0.36 * u * u), tw = wob * u * u, cx = rr * ca - tw * sa, cy = rr * sa + tw * ca;
      put(cx - w * sa, cy + w * ca, zz, br); put(cx + w * sa, cy - w * ca, zz, br); } }   // a card across the flame: out of the port, then curling up
  const gl = 0.14 * (1 + 0.9 * boost) * (0.94 + 0.06 * Math.sin(t * 9.1)), R = 1.78;
  put(-R, -R, ZHOB + 0.005, gl); put(R, -R, ZHOB + 0.005, gl); put(R, R, ZHOB + 0.005, gl); put(-R, R, ZHOB + 0.005, gl);
  flameGeo.attributes.position.needsUpdate = true; flameGeo.attributes.color.needsUpdate = true; }
flameSet(0, 0);
{ const m = add(gBr, flameGeo, mFlame, PBAL[0], PBAL[1], 0); m.frustumCulled = false; }

/* the four interests, for the pins: a parent that holds still and a point on it (movement coordinates, z towards the caseback) */
const CB_PINS = {
  soccer: { g: gBr, p: [PBAL[0] + BAL_BOSS.r * Math.cos(BAL_BOSS.a), PBAL[1] + BAL_BOSS.r * Math.sin(BAL_BOSS.a), 3.52 + BAL_BALL.hc + 0.06] },   // over the ball, where it rests
  cooking: { g: gBr, p: [PBAL[0], PBAL[1], ZHOB + 0.45] },                                                   // the burner
  snow: { g: gBr, p: [SBC[0], SBC[1], ZLOW + 0.06] },                                                       // the middle of the board
  music: { g: gBr, p: [PB[0], PB[1], ZREC + 0.12] }                                                         // the record's label
};
/* called every frame: t seconds, dt frame seconds, sel the chosen interest or null */
let cbBoost = 0, cbW = 0.6, cbWv = 0, cbA = 0, cbLift = 1;
function caseFX(t, dt, sel) { dt = clamp(dt || 0, 0, 0.1); const ease = (k) => 1 - Math.exp(-dt * k);
  cbBoost += ((sel === 'cooking' ? 1 : 0) - cbBoost) * ease(4); flameSet(t, cbBoost);                                  // the flames always flicker; turned up for cooking
  const k = 2.4; cbWv += (k * k * ((sel === 'music' ? TAU * 100 / 180 : 0.6) - cbW) - 2 * k * cbWv) * dt; cbW += cbWv * dt;   // the platter eases up to 33 1/3, and back
  cbA = (cbA - cbW * dt) % TAU; gRec.rotation.z = cbA;                                                                 // clockwise, as a deck turns
  cbLift += ((sel === 'music' ? 0 : 1) - cbLift) * ease(2.5); gToneT.rotation.y = -0.017 * cbLift; }                   // the arm comes down onto the record

/* ---------- rotor: a real pendulum on the centre post ---------- */
const ZR = BTOP;   // the upper face of the rotor lies level with the bridges: it turns down in its well, not above the movement
const rotorTex = tex(1024, (g, S) => { const k = S / 10.4, c = S / 2, A = rad(90); g.fillStyle = '#f3ead2'; g.fillRect(0, 0, S, S);
  for (let r = 2; r < S * 0.72; r += 1.1) { g.strokeStyle = frnd() > 0.5 ? 'rgba(255,255,255,' + (0.1 + frnd() * 0.3) + ')' : 'rgba(90,60,10,' + (0.05 + frnd() * 0.16) + ')'; g.lineWidth = 0.7 + frnd() * 1.2; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); }
  const cut = (dx, col) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 0.045 * k; [3.47, 4.46].forEach((r) => { g.beginPath(); g.arc(c + dx, c + dx, r * k, -A + 0.06, A - 0.06); g.stroke(); });
    for (let a = -87; a <= 87; a += 3) { g.beginPath(); g.arc(c + dx + 4.57 * k * Math.cos(rad(a)), c + dx - 4.57 * k * Math.sin(rad(a)), 0.04 * k, 0, TAU); g.fill(); }
    g.save(); g.translate(dx, dx); arcText(g, S, k, 'LIVERPOOL  ✦  VOLO SOCCER', 3.96, -78, 78, '600 56px Georgia, "Times New Roman", serif', -1); g.restore();
    g.lineWidth = 0.03 * k; [1.14, 3.1].forEach((r) => { g.beginPath(); g.arc(c + dx, c + dx, r * k, 0, TAU); g.stroke(); }); };
  cut(2, 'rgba(255,252,236,.85)'); cut(0, '#3c2a0a');
  { const r = prng(4242); for (let i = 0; i < 46; i++) { const x = r() * S, y = r() * S, a = r() * TAU, l = (6 + r() * r() * 110), w = 0.5 + r() * 1.1; g.strokeStyle = r() > 0.45 ? 'rgba(255,250,225,' + (0.12 + r() * 0.3) + ')' : 'rgba(70,45,8,' + (0.1 + r() * 0.22) + ')'; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 14, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 14, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } } }, { span: 5.2 });   // hairlines from years of wear: no two alike
const mRotPlate = M('rotor', mvTurned({ color: 0xf7c65e, map: rotorTex, metalness: 0.95, roughness: 0.27, envMapIntensity: 1.35 }, 0.6));   // 22 carat gold, circular grained and engraved
const mRotGold = M('rotor', { color: 0xf8d070, metalness: 1, roughness: 0.09, envMapIntensity: 1.2 });                                    // its polished bevels
const mRotWall = M('rotor', { color: 0xc9a046, metalness: 0.95, roughness: 0.36 });
const mRotSteel = M('rotor', { color: 0xe4e7ea, metalness: 0.95, roughness: 0.1 });
const mRotBlue = M('rotor', { color: 0x2338ae, metalness: 1, roughness: 0.16 });
gRot.position.set(MR[0], MR[1], 0);
{ const A = rad(90), arcPts = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return [r * Math.cos(a), r * Math.sin(a)]; });
  /* the heavy half: a thick crescent of gold on the outside, where weight does the most work */
  add(gRot, slab([arcPts(RROT, -A, A, 72).concat(arcPts(3.15, A, -A, 56))], 2.68, ZR, { bevel: 0.13 }), tri3(mRotPlate, mRotGold, mRotWall));
  /* the web: a thin plate pierced as an eight petalled lotus round the hub, with three slots to lighten the far side */
  const w = TAU / 8, pet = sdS([1.72, 0], [3.0, 0], 0.47, 0.05), petals = (x, y) => { const r = Math.hypot(x, y), t = (((Math.atan2(y, x) + w / 2) % w) + w) % w - w / 2; return pet(r * Math.cos(t), r * Math.sin(t)); };
  const slots = sdU(0, ...[[118, 152], [163, 197], [208, 242]].map((q) => chain(arcPts(3.92, rad(q[0]), rad(q[1]), 8), 0.36)));
  const holes = [ringLoop([0, 0], 1.0, 40, true)];   // the web is a plain gold flange now: the ball sits on it
  add(gRot, slab([arcPts(3.62, 0, TAU - TAU / 96, 95)].concat(holes), 3.06, ZR - 0.3, { bevel: [0.05, 0.06] }), tri3(mRotPlate, mRotGold, mRotWall));
  /* ball bearing (under the ball now): the outer race turns with the rotor, the inner race and its blued screw stay with the plate */
  add(gRot, lathe([[1.06, 3.0], [1.06, 3.4], [1.0, 3.46], [0.76, 3.46], [0.72, 3.4], [0.72, 3.0]], 40), mRotSteel);
  for (let i = 0; i < 7; i++) stamp(gRot, mRotSteel, new THREE.SphereGeometry(0.105, 10, 8), 0.61 * Math.cos(i * TAU / 7), 0.61 * Math.sin(i * TAU / 7), 3.34);
  stamp(gBr, mBrDark, new THREE.RingGeometry(0.46, 0.74, 28), MR[0], MR[1], 3.26); stamp(gBr, mBrSteel, lathe([[0.5, DZ], [0.5, 3.41], [0.45, 3.46], [0, 3.46]], 28), MR[0], MR[1], 0); screw(gBr, MR[0], MR[1], 3.56, 0.3); }
/* soccer: the hub of the rotor is the ball itself, a tall enamel dome of black pentagons and white hexagons rising out of a gold collar, turning with the rotor */
add(gRot, soccerGeo, soccerMat, 0, 0, ZR - 0.3); add(gRot, lathe([[BAL_BALL.rb + 0.2, ZR - 0.3], [BAL_BALL.rb + 0.2, ZR - 0.12], [BAL_BALL.rb + 0.1, ZR - 0.04], [BAL_BALL.rb - 0.02, ZR - 0.04], [BAL_BALL.rb - 0.02, ZR - 0.3]], 72), mRotGold);
CB_PINS.soccer = { g: gRot, p: [3.96 * Math.cos(rad(-6)), 3.96 * Math.sin(rad(-6)), ZR + 0.12] };
let rotA = -Math.PI / 2, rotV = 0;
unpile();
seed = 42485802;   // and the shared dice go on from where the old movement left them

/* ---------- sapphire caseback with a frosted, engraved steel ring ---------- */
const gBack = LAY.back.g;
const mBack = M('back', { color: STEEL, metalness: 1, roughness: 0.34, roughnessMap: scuffTex, side: THREE.DoubleSide });
/* the ring face in one data texture: red is height (letters cut in, a blasted grain on the field), green is roughness (frosted field, brighter cut letters, polished rims) */
const ringOrm = (() => { const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.scale(S / 2048, S / 2048); ringDraw(true)(g, 2048); g.setTransform(1, 0, 0, 1, 0, 0);
  const im = g.getImageData(0, 0, S, S), d = im.data, r = prng(21), k = S / 2 / RO, cut = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) cut[i] = clamp(1 - d[i * 4] / 128, 0, 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x, j = i * 4, rr = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5) / k; let c0 = 0; if (rr < RI - 0.2 || rr > RO + 0.2) { d[j] = 205; d[j + 1] = 34; d[j + 2] = 0; d[j + 3] = 255; continue; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c0 += cut[clamp(y + dy, 0, S - 1) * S + clamp(x + dx, 0, S - 1)]; c0 /= 9;
    const rim = rr < RI + 0.3 || rr > RO - 0.3, gr = r(), g2 = r();
    d[j] = clamp(205 - 160 * c0 + (rim ? 0 : (gr - 0.5) * 30 * (1 - c0)), 0, 255); d[j + 1] = rim ? 34 : lerp(150 + (g2 - 0.5) * 36, 84, c0); d[j + 2] = 0; d[j + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t; })();
ringBump.image.width = ringBump.image.height = 1;   // ringOrm carries the engraving now; let the big canvas go
const mBackFace = M('back', { map: ringTex, bumpMap: ringOrm, bumpScale: 2.6, roughnessMap: ringOrm, metalness: 1, roughness: 1 });
add(gBack, turned([[14.6, ZB - 0.02], [16.0, ZB - 0.02], [16.0, ZB - 1.2], [15.55, ZB - 2.4], [RO, ZB - 2.6], [RI, ZB - 2.6], [13.0, ZB - 2.45], [13.0, ZB - 1.9], [14.6, ZB - 1.9], [14.6, ZB - 0.02]]), mBack);
{ const s = gearShape(150, 16.02, { add: 0.4 }); hole(s, [0, 0], 15.4); add(gBack, ext(s, 0.7, 0.02, 4), M('back', { color: STEEL, metalness: 1, roughness: 0.5, roughnessMap: scuffTex }), 0, 0, ZB - 1.0); }
add(gBack, new THREE.RingGeometry(RI, RO, 160), mBackFace, 0, 0, ZBACK - 0.02).rotation.y = Math.PI;
add(gBack, new THREE.CircleGeometry(13.05, 96), M('back', Object.assign({}, glassP, { color: 0x090b10 })), 0, 0, ZB - 2.25).rotation.y = Math.PI;

/* ---------- straps: one watch, many jobs ---------- */
const RAIL = true;   // the straps wait on a pegboard beside the watch. false brings back the row of chips
let natoP = 1;
const gStrap = LAY.strap.g;
/* strap surfaces are baked per pixel, in mm: a height field (it becomes the normal map), a colour and a roughness, then the seam and the scratches are drawn on top.
   A stitched strap has one texture for its whole length (512 x 1024, 26 px per mm) so creases, wear and the box stitch sit where they would on a real one; webbing tiles. */
const SPX = 512 / 19.7, sSmooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const sLat = (() => { const r = prng(9), t = new Float32Array(65536); for (let i = 0; i < 65536; i++) t[i] = r(); return t; })();
const sNoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8, a = sLat[x0 + y0], b = sLat[x1 + y0], c = sLat[x0 + y1], d = sLat[x1 + y1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const sFbm = (x, y, o) => { let s = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { s += a * sNoise(x, y); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; } return s / n; };
/* leather grain as a tile of cells: e is 0 on the fine creases between cells, f the distance to the cell's pore, v one value per cell */
function grainTile(cell, sd) { const N = 256, n = Math.round(N / cell), r = prng(sd), px = new Float32Array(n * n), py = new Float32Array(n * n), pv = new Float32Array(n * n), e = new Float32Array(N * N), f = new Float32Array(N * N), v = new Float32Array(N * N);
  for (let i = 0; i < n * n; i++) { px[i] = r(); py[i] = r(); pv[i] = r(); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const gx = x * n / N, gy = y * n / N, ix = Math.floor(gx), iy = Math.floor(gy); let f1 = 9, f2 = 9, id = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const jx = ix + dx, jy = iy + dy, k = ((jx % n + n) % n) + ((jy % n + n) % n) * n, d = Math.hypot(jx + px[k] - gx, jy + py[k] - gy); if (d < f1) { f2 = f1; f1 = d; id = k; } else if (d < f2) f2 = d; }
    const i = y * N + x; e[i] = f2 - f1; f[i] = f1; v[i] = pv[id]; }
  return { e, f, v }; }
function strapBake(H, tile, fill, draw) {
  const W = 512, n = W * H, h = new Float32Array(n), mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cC = mk(), gC = cC.getContext('2d'), iC = gC.createImageData(W, H), cR = mk(), gR = cR.getContext('2d'), iR = gR.createImageData(W, H), cF = mk(), gF = cF.getContext('2d', { willReadFrequently: true });
  fill(h, iC.data, iR.data, W, H); gC.putImageData(iC, 0, 0); gR.putImageData(iR, 0, 0);
  if (draw) { gF.fillStyle = '#808080'; gF.fillRect(0, 0, W, H); draw(gC, gF, gR, W, H); const f = gF.getImageData(0, 0, W, H).data; for (let i = 0; i < n; i++) h[i] += (f[i * 4] - 128) * 0.0016; }   // drawn height: 128 is level, one step is 1.6 microns
  const cN = mk(), gN = cN.getContext('2d'), iN = gN.createImageData(W, H), d = iN.data;
  for (let y = 0; y < H; y++) { const ya = tile ? (y + H - 1) % H : Math.max(0, y - 1), yb = tile ? (y + 1) % H : Math.min(H - 1, y + 1);
    for (let x = 0; x < W; x++) { const xa = Math.max(0, x - 1), xb = Math.min(W - 1, x + 1), dx = (h[y * W + xb] - h[y * W + xa]) * SPX * 0.5, dy = (h[yb * W + x] - h[ya * W + x]) * SPX * 0.5, l = 127.5 / Math.hypot(dx, dy, 1), j = (y * W + x) * 4; d[j] = 127.5 - dx * l; d[j + 1] = 127.5 - dy * l; d[j + 2] = 127.5 + l; d[j + 3] = 255; } }
  gN.putImageData(iN, 0, 0);
  const T = (c, data) => { const t = new THREE.CanvasTexture(c); t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.repeat.set(1, W / H); return t; };
  return { map: T(cC), normalMap: T(cN, true), roughnessMap: T(cR, true) };
}
const sPut = (C, R, i, r, g, b, ro) => { const j = i * 4; C[j] = r; C[j + 1] = g; C[j + 2] = b; C[j + 3] = 255; R[j] = R[j + 1] = R[j + 2] = ro * 255; R[j + 3] = 255; };
/* creases across the strap where it bends: a soft valley with slightly raised shoulders, wandering, fading at both ends. Each is [mm from the lug, depth mm, width mm, how much it shows in colour] */
function sCrease(list, sd, h, L, ro, W, H) { const r = prng(sd); list.forEach((c) => { const xa = W * (0.14 + r() * 0.2), xb = W * (0.86 - r() * 0.2), ph = r() * 9, fq = 0.006 + r() * 0.012, am = (0.12 + 0.3 * r()) * SPX, wd = c[2] * SPX;
  for (let x = xa | 0; x < xb; x++) { const t = clamp((x - xa) / (xb - xa), 0, 1), s = Math.pow(Math.sin(Math.PI * t), 0.6) * (0.55 + 0.9 * sNoise(x / 34, ph * 7)), yc = c[0] * SPX + am * Math.sin(x * fq + ph) + 7 * (sNoise(x / 46, ph * 3) - 0.5), r0 = Math.ceil(wd * 3.2);
    for (let y = Math.max(0, (yc - r0) | 0); y <= Math.min(H - 1, yc + r0); y++) { const q = (y - yc) / wd, v = Math.exp(-q * q), sh = Math.exp(-(Math.abs(q) - 1.7) * (Math.abs(q) - 1.7) * 1.5), i = y * W + x; h[i] += c[1] * s * (0.4 * sh - v); L[i] += c[3] * s * (0.55 * sh - v); ro[i] += 0.1 * s * v - 0.06 * s * sh; } } }); }
/* the seam: a row down each side and a box row under the lug, a hole every 3 mm, each stitch leaning a little the way saddle stitching does */
const SEAM = [2.15 * SPX, 512 - 2.15 * SPX];
function seam(H, fn, cross) { const r = prng(31), P = 2.8 * SPX, j = () => (r() - 0.5) * 0.12 * SPX;
  SEAM.forEach((x) => { let a = [x + j(), 3.2 * SPX]; for (let y = 3.2 * SPX + P; y < H + P; y += P) { const b = [x + j(), y + j()]; fn(a, b); a = b; } });
  [6.0].concat(cross || []).forEach((mm) => { let a = [SEAM[0], mm * SPX]; for (let i = 1; i <= 6; i++) { const b = [lerp(SEAM[0], SEAM[1], i / 6) + (i < 6 ? j() : 0), mm * SPX + (i < 6 ? j() : 0)]; fn(a, b); a = b; } }); }
function sew(gC, gF, gR, H, col, tw, shade = 1, cross, proud = 1) { const w = tw * SPX, rd = prng(47); [gC, gF, gR].forEach((g) => { g.lineCap = 'round'; });
  const chan = (g, style, lw) => { g.strokeStyle = style; g.lineWidth = lw; g.beginPath(); SEAM.forEach((x) => { g.moveTo(x, 2.8 * SPX); g.lineTo(x, H); }); [6].concat(cross || []).forEach((mm) => { g.moveTo(SEAM[0], mm * SPX); g.lineTo(SEAM[1], mm * SPX); }); g.stroke(); };
  chan(gF, 'rgba(0,0,0,.06)', 1.5 * SPX); chan(gF, 'rgba(0,0,0,.08)', 0.9 * SPX); chan(gF, 'rgba(0,0,0,.09)', 0.45 * SPX);     // the channel the thread pulls the leather into
  chan(gC, 'rgba(0,0,0,' + 0.07 * shade + ')', 1.3 * SPX); chan(gC, 'rgba(0,0,0,' + 0.09 * shade + ')', 0.6 * SPX);
  seam(H, (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, s = 0.06 * SPX, inn = 0.13 * SPX, x0 = a[0] + ux * inn + uy * s, y0 = a[1] + uy * inn - ux * s, x1 = b[0] - ux * inn - uy * s, y1 = b[1] - uy * inn + ux * s;
    const line = (g, style, lw, o = 0) => { g.strokeStyle = style; g.lineWidth = lw; g.beginPath(); g.moveTo(x0 - uy * o, y0 + ux * o); g.lineTo(x1 - uy * o, y1 + ux * o); g.stroke(); };
    [a, b].forEach((p) => { [[gF, 'rgba(0,0,0,.4)'], [gC, 'rgba(0,0,0,' + 0.3 * shade + ')']].forEach(([g, c]) => { g.fillStyle = c; g.beginPath(); g.arc(p[0], p[1], 0.19 * SPX, 0, TAU); g.fill(); }); });
    [[48, 1], [86, 0.62], [114, 0.26]].forEach(([q, k]) => { const v = Math.round(128 + q * proud); line(gF, 'rgb(' + v + ',' + v + ',' + v + ')', w * k); });                                         // a round thread, standing a little proud
    line(gC, col, w); line(gC, 'rgba(40,28,14,' + (0.04 + 0.16 * rd()) * shade + ')', w); line(gC, 'rgba(0,0,0,.16)', w * 0.3, w * 0.36); line(gC, 'rgba(255,255,255,.12)', w * 0.25, -w * 0.2);
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (0.34 * SPX))), ca = Math.cos(1.0), sa = Math.sin(1.0), tx = (ux * ca - uy * sa) * w * 0.5, ty = (ux * sa + uy * ca) * w * 0.5; gC.strokeStyle = 'rgba(0,0,0,.13)'; gC.lineWidth = 1;     // the twist of the thread
    for (let k = 1; k < n; k++) { const cx = lerp(x0, x1, k / n), cy = lerp(y0, y1, k / n); gC.beginPath(); gC.moveTo(cx - tx, cy - ty); gC.lineTo(cx + tx, cy + ty); gC.stroke(); }
    line(gR, '#d4d4d4', w); }, cross); }
/* a few fine scratches: the finish broken to a lighter, duller tone, skipping where the grain dips. Colour and sheen only; nothing deep enough to catch the light */
function sScratch(gC, gR, H, n, sd, tone) { const r = prng(sd); for (let i = 0; i < n; i++) { const x = 512 * (0.18 + 0.64 * r()), y = H * (0.14 + 0.76 * r()), a = (r() > 0.5 ? 0.9 : 2.2) + (r() - 0.5) * 0.9, l = SPX * (1 + 4.5 * r() * r()), k = (r() - 0.5) * 0.35 * l, al = 0.1 + 0.16 * r(), lw = 1.3 + r() * 1.3, x1 = x + Math.cos(a) * l, y1 = y + Math.sin(a) * l, cx = (x + x1) / 2 - Math.sin(a) * k, cy = (y + y1) / 2 + Math.cos(a) * k, seg = 6 + (r() * 6 | 0);
  const at = (t) => [(1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * y1];
  for (let q = 0; q < seg; q++) { const fa = al * Math.sqrt(Math.sin(Math.PI * (q + 0.5) / seg)) * (0.5 + 0.5 * r()); if (r() < 0.22) continue; const p0 = at(q / seg), p1 = at((q + 0.92) / seg);
    [[gC, 'rgba(' + tone + ',' + fa + ')', lw], [gR, 'rgba(255,255,255,' + fa * 0.6 + ')', lw * 1.6]].forEach(([g, c, w]) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }); } } }
/* buckle holes: punched ovals, 1.8 across by 2.2 along, their rims pressed in and burnished dark. The texture is drawn for a 19.7 mm strap and squeezed onto the 16 mm tail */
const sHoles = (gC, gF, gR, list, lin) => list.forEach((mm) => { const y = mm * SPX, rx = 0.9 * SPX * 19.7 / 16, ry = 1.1 * SPX; [[gF, 'rgba(0,0,0,.4)', 1.4], [gF, '#000', 1], [gC, 'rgba(0,0,0,.3)', 1.35], [gC, lin ? '#160f08' : '#03050a', 1], [gR, '#f4f4f4', 1]].forEach(([g, c, k]) => { g.fillStyle = c; g.beginPath(); g.ellipse(256, y, rx * k, ry * k, 0, 0, TAU); g.fill(); }); });
/* leather: fine grain and pores, tone that wanders, pull-up where the padding is rubbed, burnished dark at the edges and at the lug, creased where it bends */
function leatherMaps(o) { const T = grainTile(o.cell, o.sd);
  return strapBake(o.H || 1024, false, (h, C, R, W, H) => { const n = W * H, L = new Float32Array(n), wr = new Float32Array(n), ro = new Float32Array(n);
    const cr = new Float32Array(W); if (o.crown) for (let x = 0; x < W; x++) { const d = x / SPX - 9.85; cr[x] = o.crown * Math.exp(-d * d / 14); }
    const Q = W >> 2, b1 = new Float32Array(Q), b2 = new Float32Array(Q), bx = new Float32Array(Q), by = new Float32Array(Q);   // the slow-moving terms are worked out once per 4 x 4 block
    for (let y = 0; y < H; y++) { const lug = Math.exp(-y / SPX / 2.4); if (!(y & 3)) for (let q = 0; q < Q; q++) { const x = q * 4 + 2; b1[q] = sFbm(x / 64, y / 64, 2); b2[q] = sFbm(x / 190 + 40, y / 190, 2); bx[q] = 6 * (sNoise(x / 26, y / 26) - 0.5); by[q] = 6 * (sNoise(x / 26 + 31, y / 26 + 7) - 0.5); }
      for (let x = 0; x < W; x++) { const i = y * W + x, q = x >> 2, xm = x / SPX, e = Math.min(xm, 19.7 - xm), ti = ((x + bx[q]) & 255) + (((y + by[q]) & 255) << 8);
      const val = (1 - sSmooth(T.e[ti] / o.gw)) * sSmooth(sNoise(x / 11 + 3, y / 11 + 8) * 2.6 - 0.75), dome = 1 - Math.min(1, T.f[ti] * T.f[ti] * 3), pore = T.f[ti] < 0.17 && T.v[ti] > 0.45 ? o.pore : 0, n1 = b1[q], n2 = b2[q], mic = sLat[(x * 3 + y * 1021) & 65535] - 0.5, pad = sSmooth((e - 2.4) / 4), edge = 1 - sSmooth(e / 1.7);
      wr[i] = clamp(o.wear * (0.3 + 1.6 * (n2 - 0.5) + 0.45 * pad + 0.8 * (n1 - 0.5) + cr[x] * (0.5 + n1)) * (1 - 0.55 * val), 0, 1);
      L[i] = 1 + o.mottle * (n1 - 0.5) + o.mottle * 0.7 * (n2 - 0.5) - o.edge * edge * edge - o.lug * lug - o.gcol * val - 0.3 * pore + 0.04 * mic;
      h[i] = -o.gh * val + o.gh * 0.5 * dome - 0.035 * pore + 0.004 * mic; ro[i] = o.ro + 0.12 * val - o.shine * wr[i] - 0.1 * lug + 0.06 * mic + 0.06 * (n1 - 0.5); } }
    sCrease(o.creases, o.sd + 5, h, L, ro, W, H); if (o.growth) sGrowth(o.growth, o.sd + 3, h, L, ro, W, H);
    for (let i = 0; i < n; i++) { const t = wr[i], l = L[i]; sPut(C, R, i, lerp(o.base[0], o.hi[0], t) * l, lerp(o.base[1], o.hi[1], t) * l, lerp(o.base[2], o.hi[2], t) * l, clamp(ro[i], 0.2, 1)); }
  }, (gC, gF, gR, W, H) => {
    if (o.line) [1.05 * SPX, W - 1.05 * SPX].forEach((x) => { [[gF, 'rgba(0,0,0,.2)'], [gC, 'rgba(0,0,0,.16)']].forEach(([g, c]) => { g.fillStyle = c; g.fillRect(x - 1.5, 0, 3, H); }); });   // the creased line a dress strap carries inside its edge
    if (o.foll) sPores(gC, gF, gR, H, o.sd + 13, o.foll[0], o.foll[1]);
    sew(gC, gF, gR, H, o.thread, 0.4, o.shade, o.cross); if (o.holes) sHoles(gC, gF, gR, o.holes); sScratch(gC, gR, H, o.scratches, o.sd + 9, o.tone); }); }
/* sailcloth: a tight plain weave over padding. Every thread is a little different, which is what still reads when the weave itself is too fine to see */
function sailMaps(o) { return strapBake(o.H || 1024, false, (h, C, R, W, H) => { const n = W * H, L = new Float32Array(n), ro = new Float32Array(n), P = W / 72; let pn = 0.5;
    for (let y = 0; y < H; y++) { const lug = Math.exp(-y / SPX / 2.4); for (let x = 0; x < W; x++) { const i = y * W + x, xm = x / SPX, e = Math.min(xm, 19.7 - xm), cx = x / P, cy = y / P, ix = cx | 0, iy = cy | 0, sx = Math.sin(Math.PI * (cx - ix)), sy = Math.sin(Math.PI * (cy - iy)), over = (ix + iy) & 1;
      const top = over ? sx * (0.5 + 0.5 * sy) : sy * (0.5 + 0.5 * sx), tv = over ? sLat[(ix * 131 + 7) & 65535] : sLat[(iy * 197 + 30011) & 65535], cv = sLat[(ix * 71 + iy * 1237) & 65535], n1 = (x & 3) ? pn : (pn = sFbm(x / 90, y / 90, 2)), pad = sSmooth((e - 2.4) / 4), edge = 1 - sSmooth(e / 1.5);
      L[i] = (0.7 + 0.36 * top) * (1 + 0.22 * (tv - 0.5) + 0.1 * (cv - 0.5) + 0.14 * (n1 - 0.5) + 0.05 * pad * n1) * (1 - 0.16 * edge * edge - 0.1 * lug);
      h[i] = 0.04 * top; ro[i] = 0.9 - 0.2 * top - 0.06 * lug; } }
    sCrease(o.creases, 61, h, L, ro, W, H);
    for (let i = 0; i < n; i++) sPut(C, R, i, o.base[0] * L[i], o.base[1] * L[i], o.base[2] * L[i], clamp(ro[i], 0.3, 1));
  }, (gC, gF, gR, W, H) => { sew(gC, gF, gR, H, o.thread, 0.4); if (o.holes) { sHoles(gC, gF, gR, o.holes);   // punched hot: the cut threads melt into a narrow, smooth, slightly raised bead round each hole
      o.holes.forEach((mm) => { const y = mm * SPX, rx = 0.9 * SPX * 19.7 / 16, ry = 1.1 * SPX; [[gC, 'rgba(0,0,0,.3)', 1.4, 0.44], [gC, 'rgba(255,255,255,.07)', 1.46, 0.1], [gF, 'rgba(255,255,255,.3)', 1.42, 0.42], [gF, 'rgba(255,255,255,.3)', 1.42, 0.2], [gR, 'rgba(0,0,0,.5)', 1.42, 0.5]].forEach(([g, c, k, lw]) => { g.strokeStyle = c; g.lineWidth = lw * SPX; g.beginPath(); g.ellipse(256, y, rx * k, ry * k, 0, 0, TAU); g.stroke(); }); }); } }); }
/* recycled bottle webbing for the upcycled dial: a fine herringbone twill of heathered yarn, baked in neutral grey so the strap takes whatever colour the batch came out, with the odd pale fleck of another bottle */
function petMaps(o) { return strapBake(o.H || 1024, false, (h, C, R, W, H) => { const n = W * H, L = new Float32Array(n), ro = new Float32Array(n), P = W / 60; let pn = 0.5;
    for (let y = 0; y < H; y++) { const lug = Math.exp(-y / SPX / 2.4); for (let x = 0; x < W; x++) { const i = y * W + x, xm = x / SPX, e = Math.min(xm, 19.7 - xm), cx = x / P, cy = y / P, ix = cx | 0, iy = cy | 0, sx = Math.sin(Math.PI * (cx - ix)), sy = Math.sin(Math.PI * (cy - iy)), band = (ix / 10) | 0, ph = (((band & 1 ? ix : -ix) + iy) % 4 + 4) % 4, over = ph < 2;
      const top = over ? sx * (0.45 + 0.55 * sy) : sy * (0.45 + 0.55 * sx), tv = over ? sLat[(ix * 131 + 7) & 65535] : sLat[(iy * 197 + 30011) & 65535], cv = sLat[(ix * 71 + iy * 1237) & 65535], fl = sLat[(ix * 53 + iy * 911 + 77) & 65535], n1 = (x & 3) ? pn : (pn = sFbm(x / 110, y / 110, 2)), edge = 1 - sSmooth(e / 1.3), rib = ix % 10 === 0 ? 0.9 : 1;
      L[i] = (0.62 + 0.4 * top) * (over ? 1.04 : 0.88) * rib * (1 + 0.3 * (tv - 0.5) + 0.12 * (cv - 0.5) + 0.12 * (n1 - 0.5)) * (fl > 0.988 ? 1.5 : fl < 0.01 ? 0.7 : 1) * (1 - 0.2 * edge * edge - 0.1 * lug);
      h[i] = 0.05 * top * rib; ro[i] = 0.86 - 0.22 * top - 0.05 * lug; } }
    sCrease(o.creases || [], 71, h, L, ro, W, H);
    for (let i = 0; i < n; i++) { const v = clamp(214 * L[i], 0, 255); sPut(C, R, i, v, v, v, clamp(ro[i], 0.3, 1)); }
  }, (gC, gF, gR, W, H) => { sew(gC, gF, gR, H, o.thread, 0.4); if (o.holes) { sHoles(gC, gF, gR, o.holes);
      o.holes.forEach((mm) => { const y = mm * SPX, rx = 0.9 * SPX * 19.7 / 16, ry = 1.1 * SPX; [[gC, 'rgba(0,0,0,.3)', 1.4, 0.44], [gF, 'rgba(255,255,255,.3)', 1.42, 0.42], [gR, 'rgba(0,0,0,.5)', 1.42, 0.5]].forEach(([g, c, k, lw]) => { g.strokeStyle = c; g.lineWidth = lw * SPX; g.beginPath(); g.ellipse(256, y, rx * k, ry * k, 0, 0, TAU); g.stroke(); }); }); } }); }
/* nylon webbing: ribs across, each one a row of warp ends, the next row set half a step over. Navy / grey / navy with a red pinstripe, woven selvedges */
function natoMaps() { return strapBake(512, true, (h, C, R, W, H) => { const cols = [[22, 35, 63], [126, 131, 138], [176, 40, 46]], ribs = 44, ends = 62, rh = H / ribs, cw = W / ends;
    for (let y = 0; y < H; y++) { const ry = y / rh, j = ry | 0, sy = Math.pow(Math.sin(Math.PI * (ry - j)), 0.7), rv = sLat[(j * 613 + 11) & 65535];
      for (let x = 0; x < W; x++) { const cx = x / cw + (j & 1) * 0.5, ix = Math.floor(cx), sx = Math.sin(Math.PI * (cx - ix)), top = sy * (0.6 + 0.4 * sx), en = Math.floor(x / cw * 2), tv = sLat[(en * 389 + 77) & 65535], fz = sLat[(x * 7 + y * 3001) & 65535];
        const u = (en + 0.5) / (ends * 2), xm = x / SPX, sel = 1 - sSmooth(Math.min(xm, 19.7 - xm) / 0.8), c = cols[Math.abs(u - 0.5) < 0.017 ? 2 : Math.abs(u - 0.5) < 0.125 ? 1 : 0];
        const l = (0.58 + 0.52 * top) * (1 + 0.16 * (tv - 0.5) + 0.07 * (rv - 0.5) + 0.12 * (fz - 0.5)) * (1 - 0.22 * sel);
        h[y * W + x] = 0.06 * top * (1 - 0.5 * sel) + 0.035 * sel; sPut(C, R, y * W + x, c[0] * l, c[1] * l, c[2] * l, 0.95 - 0.16 * top - 0.18 * sel); } } }); }
/* the lining: tan nubuck with the seam coming through, darkened where it sits on the wrist, and a maker's stamp pressed in */
function liningMaps(HH = 1024, holes, cross) { let p2 = 0.5; const m = strapBake(HH, false, (h, C, R, W, H) => {
    for (let y = 0; y < H; y++) { const lug = Math.exp(-y / SPX / 4); for (let x = 0; x < W; x++) { const i = y * W + x, xm = x / SPX, e = Math.min(xm, 19.7 - xm), n0 = sLat[(x * 5 + y * 2053) & 65535] - 0.5, n1 = sNoise(x / 7, y / 7) - 0.5, n2 = (x & 3) ? p2 : (p2 = sFbm(x / 150 + 9, y / 150, 3)), pad = sSmooth((e - 1.5) / 5);
      const l = 0.97 + 0.09 * n0 + 0.1 * n1 - 0.2 * pad * n2 - 0.12 * lug - 0.1 * (1 - sSmooth(e / 1.2));
      h[i] = 0.02 * n0 + 0.015 * n1; sPut(C, R, i, 178 * l, 151 * l, 112 * l, 0.9); } }
  }, (gC, gF, gR, W, H) => { sew(gC, gF, gR, H, '#c9b48c', 0.4, 0.8, cross); if (holes) sHoles(gC, gF, gR, holes, true);
    [[gC, 'rgba(58,38,18,.4)'], [gF, 'rgba(0,0,0,.28)']].forEach(([g, c]) => { g.fillStyle = c; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 ' + Math.round(1.3 * SPX) + 'px Georgia, "Times New Roman", serif'; 'KURMALA'.split('').forEach((ch, i) => g.fillText(ch, 256 + (i - 3) * 1.32 * SPX, 16.6 * SPX));
      g.font = '600 ' + Math.round(1.05 * SPX) + 'px Helvetica, Arial, sans-serif'; g.fillText('20', 256, 18.9 * SPX); g.fillRect(256 - 3.4 * SPX, 18.85 * SPX, 2.2 * SPX, 2); g.fillRect(256 + 1.2 * SPX, 18.85 * SPX, 2.2 * SPX, 2); }); });
  m.roughnessMap.image.width = m.roughnessMap.image.height = 1; delete m.roughnessMap; return m; }   // the lining is evenly matte: it needs no roughness map
/* suede: the flesh side of the hide, buffed to a short nap. No pores and no gloss. What reads is the way the nap lies: broad soft strokes where a finger has brushed it one way or the other,
   fibres at the scale of a pixel, and nap pressed flat and dark wherever something bears on it: along the seam, under the lug, round the buckle holes. Baked in greys, so the material's colour dyes it */
function suedeMaps(o) { const HO = (o.holes || []).map((mm) => mm * SPX), XC = [6].concat(o.cross || []).map((mm) => mm * SPX), ca = Math.cos(o.ang), sa = Math.sin(o.ang);
  return strapBake(o.H || 1024, false, (h, C, R, W, H) => { const n = W * H, L = new Float32Array(n), ro = new Float32Array(n), QW = (W >> 2) + 2, QH = (H >> 2) + 2, B = new Float32Array(QW * QH), Tn = new Float32Array(QW * QH), cS = new Float32Array(W), cI = new Float32Array(W), cE = new Float32Array(W);
    for (let x = 0; x < W; x++) { const xm = x / SPX, ds = Math.min(Math.abs(x - SEAM[0]), Math.abs(x - SEAM[1])) / SPX; cS[x] = Math.exp(-ds * ds / 0.56); cI[x] = x > SEAM[0] && x < SEAM[1] ? 1 : Math.exp(-ds * ds / 0.5); cE[x] = 1 - sSmooth(Math.min(xm, 19.7 - xm) / 1.5); }   /* what depends only on the distance from the seam and the edge */
    /* the lie of the nap and the slow drift of tone, worked out on a quarter-size grid and interpolated */
    for (let qy = 0; qy < QH; qy++) for (let qx = 0; qx < QW; qx++) { const x = qx * 4, y = qy * 4, wx = 46 * (sNoise(x / 120 + 5, y / 120) - 0.5), wy = 46 * (sNoise(x / 120 + 50, y / 120 + 20) - 0.5), u = (x + wx) * ca + (y + wy) * sa, v = (y + wy) * ca - (x + wx) * sa;
      const s1 = sFbm(u / 250 + 3, v / 62 + 7, 2), s2 = sFbm(u / 120 + 30, v / 30 + 11, 2), s3 = sNoise(v / 240 + 9, u / 70 + 2);
      B[qy * QW + qx] = 0.62 * sSmooth((s1 - 0.36) / 0.28) + 0.26 * sSmooth((s2 - 0.38) / 0.28) + 0.12 * sSmooth((s3 - 0.4) / 0.25); Tn[qy * QW + qx] = sFbm(x / 170 + 60, y / 170 + 3, 2); }
    for (let y = 0; y < H; y++) { const ym = y / SPX, lug = Math.exp(-ym / 2.6), qy = y >> 2, fy = (y & 3) / 4, r0 = qy * QW, r1 = r0 + QW; let hy = 1e9, xr = 1e9; for (let k = 0; k < HO.length; k++) hy = Math.min(hy, Math.abs(y - HO[k])); for (let k = 0; k < XC.length; k++) xr = Math.min(xr, Math.abs(y - XC[k])); const xh = Math.exp(-xr * xr / (0.75 * SPX * 0.75 * SPX)), sOn = sSmooth((ym - 2.2) / 1.2);
      for (let x = 0; x < W; x++) { const i = y * W + x, qx = x >> 2, fx = (x & 3) / 4;
        const br = lerp(lerp(B[r0 + qx], B[r0 + qx + 1], fx), lerp(B[r1 + qx], B[r1 + qx + 1], fx), fy), tn = lerp(lerp(Tn[r0 + qx], Tn[r0 + qx + 1], fx), lerp(Tn[r1 + qx], Tn[r1 + qx + 1], fx), fy);
        const u = x * ca + y * sa, v = y * ca - x * sa, mic = sLat[(x * 3 + y * 1021) & 65535] - 0.5, lie = br + 0.7 * mic > 0.5, fib = (lie ? sNoise(u / 1.25 + 71, v / 4.4 + 29) : sNoise(u / 4.4 + 13, v / 1.25 + 4)) - 0.5, cl = (lie ? sNoise(u / 3.1 + 5, v / 11 + 40) : sNoise(u / 11 + 21, v / 3.1 + 90)) - 0.5, sk = sNoise(u / 90 + 8, v / 5.5 + 60) - 0.5;   /* the fibres lie one way or the other; where the two meet they are mixed pixel by pixel */
        const edge = cE[x]; let halo = Math.max(cS[x] * sOn, xh * cI[x]);
        if (hy < 4.2 * SPX) { const q = Math.hypot((x - 256) / (0.9 * SPX * 19.7 / 16), hy / (1.1 * SPX)); halo = Math.max(halo, 0.85 * Math.exp(-(q - 1) * (q - 1) / 0.5)); }
        L[i] = (1 + o.brush * (br - 0.5) + o.mottle * (tn - 0.5) + o.fib * fib + o.fib * 0.65 * cl + o.brush * 0.3 * sk + o.fib * 0.55 * mic * (1 + 1.2 * edge)) * (1 - o.press * halo) * (1 - o.edge * edge * edge) * (1 - o.lug * lug);
        h[i] = o.nh * (fib + 0.7 * cl + 0.4 * mic) * (1 - 0.6 * halo) - 0.045 * halo - 0.02 * lug + 0.006 * (br - 0.5); ro[i] = 0.98 - 0.07 * halo - 0.05 * lug + 0.04 * mic; } }
    sCrease(o.creases, 71, h, L, ro, W, H);
    for (let i = 0; i < n; i++) { const g = o.base * L[i]; sPut(C, R, i, g, g, g, clamp(ro[i], 0.6, 1)); }
  }, (gC, gF, gR, W, H) => { sew(gC, gF, gR, H, o.thread, 0.4, o.shade, o.cross, 0.4); if (o.holes) sHoles(gC, gF, gR, o.holes); }); }
/* cowhide keeps its hair follicles: fine round pores, never evenly spread but gathered in loose groups and short curving rows. Each is a shallow pit, a touch darker, with the faintest raised lip */
function sPores(gC, gF, gR, H, sd, den, str) { const r = prng(sd), nC = Math.round(H / SPX * den);
  for (let c = 0; c < nC; c++) { const cx = 512 * (0.16 + 0.68 * r()), cy = H * (0.05 + 0.92 * r()), row = r() < 0.42, m = row ? 3 + (r() * 5 | 0) : 4 + (r() * 9 | 0), a = (r() - 0.5) * 2.4, sp = (0.4 + 0.22 * r()) * SPX, bend = (r() - 0.5) * 0.3, rad = (0.7 + 0.9 * r()) * SPX, s = str * (0.45 + 0.55 * r());
    for (let k = 0; k < m; k++) { let x, y; if (row) { const t = k - (m - 1) / 2, an = a + bend * t; x = cx + Math.cos(an) * sp * t + (r() - 0.5) * 0.12 * SPX; y = cy + Math.sin(an) * sp * t + (r() - 0.5) * 0.12 * SPX; } else { const an = r() * TAU, d = rad * Math.sqrt(r()); x = cx + Math.cos(an) * d; y = cy + Math.sin(an) * d * 0.8; }
      const pr = (0.07 + 0.055 * r()) * SPX, k2 = s * (0.6 + 0.4 * r()); if (x < 0.14 * 512 || x > 0.86 * 512) continue;
      [[gF, 'rgba(255,255,255,' + 0.07 * k2 + ')', pr * 2.1], [gC, 'rgba(255,214,170,' + 0.07 * k2 + ')', pr * 2.0], [gF, 'rgba(0,0,0,' + 0.22 * k2 + ')', pr * 1.25], [gF, 'rgba(0,0,0,' + 0.25 * k2 + ')', pr * 0.7], [gC, 'rgba(34,15,6,' + 0.2 * k2 + ')', pr * 1.2], [gC, 'rgba(24,10,4,' + 0.26 * k2 + ')', pr * 0.65], [gR, 'rgba(255,255,255,' + 0.22 * k2 + ')', pr * 1.2]].forEach(([g, col, q]) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, q, 0, TAU); g.fill(); }); } } }
/* growth lines: the fine fat wrinkles a hide carries from the animal's neck and belly. Two or three hair-thin strands running across together, slightly aslant, breaking up and coming back. Each is [mm from the lug, depth mm, how much it shows in colour] */
function sGrowth(list, sd, h, L, ro, W, H) { const r = prng(sd); list.forEach((c) => { const ns = 2 + (r() * 2 | 0), tilt = (r() - 0.5) * 0.22; for (let s = 0; s < ns; s++) { const off = (s - (ns - 1) / 2) * (0.55 + 0.5 * r()) * SPX, ph = r() * 40, wd = (0.07 + 0.05 * r()) * SPX, k = 0.6 + 0.4 * r(), x0 = W * (0.02 + 0.2 * r() * s), x1 = W * (0.98 - 0.2 * r() * s);
    for (let x = x0 | 0; x < x1; x++) { const t = clamp((x - x0) / (x1 - x0), 0, 1), a = k * Math.pow(Math.sin(Math.PI * t), 0.4) * sSmooth(sNoise(x / 38 + ph, ph) * 2.4 - 0.5), yc = c[0] * SPX + off + tilt * (x - 256) + 9 * (sNoise(x / 70 + ph, 3) - 0.5) + 2.2 * (sNoise(x / 13, ph + 5) - 0.5), r0 = Math.ceil(wd * 3); if (a < 0.02) continue;
      for (let y = Math.max(0, (yc - r0) | 0); y <= Math.min(H - 1, yc + r0); y++) { const q = (y - yc) / wd, v = Math.exp(-q * q), sh = Math.exp(-(Math.abs(q) - 1.8) * (Math.abs(q) - 1.8) * 1.4), i = y * W + x; h[i] += c[1] * a * (0.35 * sh - v); L[i] += c[2] * a * (0.5 * sh - v); ro[i] += 0.05 * a * v; } } } }); }
const STRAPS = {
  consulting: { name: 'Navy suede', base: 0x16213d, back: 0xffffff, rest: rad(-55), rests: [rad(-62), rad(-50)], droop: 0.3, k: 110, c: 15, th: [3.4, 2.2], w: [19.7, 16], len: true, nap: true, sheen: 1, sheenR: 0.55, edgeRo: 0.82,
    maps: (i) => suedeMaps({ H: Math.ceil(CALF.L[i] * SPX), holes: i ? CALF.holes : null, cross: i ? null : [CALF.L[0] - 4.6], ang: 0.5, base: 204, brush: 0.15, mottle: 0.1, fib: 0.27, nh: 0.016, press: 0.2, edge: 0.2, lug: 0.16, thread: '#e4e4e4', shade: 0.9, creases: [[3.4, 0.03, 0.55, 0.05], [8.7, 0.015, 0.6, 0.03]].concat(i ? [[58.2, 0.03, 0.9, 0.07], [64.6, 0.025, 0.8, 0.05]] : []) }) },
  engineering: { name: 'Steel bracelet', links: true, dz: 1.3, rest: rad(0), droop: 1.0, k: 182, c: 4.9 },
  quant: { name: 'Grey sailcloth', base: 0x54585e, back: 0x4b4c50, rest: rad(-45), rests: [rad(-58), rad(-46)], len: true, droop: 0.4, k: 110, c: 14, th: [3.8, 2.4], w: [19.7, 17], sheen: 0.35, sheenC: 0xaab0b8,
    maps: (i) => sailMaps({ H: Math.ceil(CALF.L[i] * SPX), holes: i ? CALF.holes : null, base: [102, 106, 112], thread: '#b4b7bc', creases: [[3.4, 0.03, 0.4, 0.05], [8.8, 0.02, 0.45, 0.04]] }) },
  upcycle: { name: 'Recycled bottle webbing', base: 0x1f5482, back: 0x2c3036, rest: rad(-48), rests: [rad(-60), rad(-48)], len: true, droop: 0.45, k: 105, c: 14, th: [3.0, 2.0], w: [19.7, 16], sheen: 0.4, sheenC: 0xd0dae6,
    maps: (i) => petMaps({ H: Math.ceil(CALF.L[i] * SPX), holes: i ? CALF.holes : null, thread: '#dfe4e8', creases: [[3.4, 0.03, 0.4, 0.05]] }) },
  banking: { name: 'Brown cowhide', base: 0x5f3319, back: 0xffffff, rest: rad(-75), rests: [rad(-70), rad(-56)], len: true, droop: 0.42, k: 100, c: 16, th: [3.4, 2.0], w: [19.7, 16],
    maps: (i) => leatherMaps({ H: Math.ceil(CALF.L[i] * SPX), holes: i ? CALF.holes : null, cross: i ? null : [CALF.L[0] - 4.6], sd: 23, cell: 9, gw: 0.3, gh: 0.02, gcol: 0.04, pore: 0.16, foll: [0.7, 1], crown: 0.3, growth: i ? [[17, 0.022, 0.09], [34.5, 0.018, 0.08], [88, 0.018, 0.07]] : [[19.5, 0.022, 0.09], [47, 0.018, 0.08]], base: [112, 62, 33], hi: [158, 99, 56], wear: 0.9, mottle: 0.2, edge: 0.34, lug: 0.2, ro: 0.62, shine: 0.2, thread: '#d2c19c', shade: 1, scratches: 9, tone: '214,160,110', creases: [[3.2, 0.07, 0.34, 0.1], [4.6, 0.05, 0.3, 0.08], [7.9, 0.035, 0.3, 0.06], [9.6, 0.045, 0.4, 0.07], [12.4, 0.03, 0.4, 0.05], [24, 0.03, 0.45, 0.05], [27.5, 0.025, 0.4, 0.04]] }) },
  writing: { name: 'Striped nylon', base: 0x16233f, rest: rad(-10), droop: 0.85, k: 290, c: 34, under: true, sn: [26, 44], dz: 0.85, dy: 0.95, th: [1.3, 1.3], w: [19.7, 19.7], sheen: 0.3, sheenC: 0x9fb0d0, maps: natoMaps }
};
/* the cross-section, as [across, height]: a padded strap is domed between its seams and thin at its edges, webbing is flat with a rolled selvedge. Faces are one smooth sheet; groups are face, lining, edges (with the cut ends) */
function ribbonGeo(center, width, thick, sy = 1, into, flat) {
  const half = flat ? [[0, 1], [0.93, 1], [0.975, 0.9], [1, 0.55]] : [[0, 1], [0.2, 0.99], [0.4, 0.95], [0.56, 0.87], [0.68, 0.76], [0.76, 0.67], [0.82, 0.635], [0.9, 0.64], [0.96, 0.625], [0.985, 0.57], [1, 0.47]], be = flat ? -0.55 : -0.8;
  const top = half.slice(1).reverse().map((p) => [-p[0], p[1]]).concat(half), bot = [[1, be], [0.975, -0.94], [0.93, -1], [-0.93, -1], [-0.975, -0.94], [-1, be]], te = half[half.length - 1][1], eb = (x) => { const a = Math.abs(x); return a <= 0.93 ? -1 : a <= 0.975 ? lerp(-1, -0.94, (a - 0.93) / 0.045) : lerp(-0.94, be, (a - 0.975) / 0.025); };
  const pos = [], uv = [], idx = [], n = center.length, rows = []; let len = 0;
  for (let i = 0; i < n; i++) { const p = center[i], a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)]; let ty = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l; if (i) len += Math.hypot(p[0] - center[i - 1][0], p[1] - center[i - 1][1]); const t = i / (n - 1); rows.push({ p, ny: -tz, nz: ty, w: width(t) / 2, h: thick(t) / 2, len }); }
  const pt = (r, x, e) => { pos.push(x * r.w, sy * (r.p[0] + e * r.ny * r.h), r.p[1] + e * r.nz * r.h); };
  const grid = (prof, uf) => { const base = pos.length / 3, m = prof.length; rows.forEach((r) => prof.forEach((p) => { pt(r, p[0], p[1]); if (!into) uv.push(uf(p[0]), r.len / 19.7); })); if (!into) for (let i = 0; i < n - 1; i++) for (let j = 0; j < m - 1; j++) { const a = base + i * m + j, b = a + m; idx.push(a, a + 1, b, a + 1, b + 1, b); } return (n - 1) * (m - 1) * 6; };
  const cap = (r, fwd) => { const base = pos.length / 3, m = top.length; top.forEach((p) => { pt(r, p[0], p[1]); pt(r, p[0], eb(p[0])); if (!into) uv.push(0.015, r.len / 19.7, 0.015, r.len / 19.7); }); if (!into) for (let j = 0; j < m - 1; j++) { const a = base + j * 2; fwd ? idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) : idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } return (m - 1) * 6; };
  const nf = grid(top, (x) => (x + 1) / 2), nl = grid(bot, (x) => (x + 1) / 2), ne = grid([[-1, be], [-1, te]], () => 0.015) + grid([[1, te], [1, be]], () => 0.015) + cap(rows[0], false) + cap(rows[n - 1], true);
  if (into) { into.attributes.position.array.set(pos); into.attributes.position.needsUpdate = true; into.computeVertexNormals(); return into; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.addGroup(0, nf, 0); g.addGroup(nf, nl, 1); g.addGroup(nf + nl, ne, 2); return g;   // face, lining, edges
}
/* a strap is a bending beam: it has a set curve, droops toward gravity by an amount that depends on the material, and settles with a little overshoot */
const SN = 25, SSTEP = 1.5, TH0 = rad(-36), HEAD = [Math.cos(TH0), Math.sin(TH0)];
function strapCenter(turn, wob, lift = 0, dz = 0, dy = 0, N = SN, step = SSTEP) { const pts = [[LH[0] - 0.6 + dy + HEAD[0] * lift, LH[1] + 0.2 + dz + HEAD[1] * lift]]; let p = pts[0]; for (let i = 0; i < N; i++) { const u = (i + 0.5) / N, th = TH0 + turn * Math.pow(u, 1.2) + wob * Math.sin(Math.PI * u); p = [p[0] + step * Math.cos(th), p[1] + step * Math.sin(th)]; pts.push(p); } return pts; }
/* a point and a direction at distance s along the centreline. The direction is blended between neighbouring segments, so a link sitting
   exactly on a joint between two segments no longer flips between their two angles from frame to frame */
const along = (c, s) => { const n = c.length, sa = (j) => Math.atan2(c[j][1] - c[j - 1][1], c[j][0] - c[j - 1][0]), wrap = (x) => x - TAU * Math.round(x / TAU); let d = 0;
  for (let i = 1; i < n; i++) { const a = c[i - 1], b = c[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6; if (d + l >= s || i === n - 1) { const t = clamp((s - d) / l, 0, 1), A = sa(i); let ang = A;
      if (t < 0.5 && i > 1) ang = A + wrap(sa(i - 1) - A) * (0.5 - t); else if (t >= 0.5 && i < n - 1) ang = A + wrap(sa(i + 1) - A) * (t - 0.5);
      return { y: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), ang }; } d += l; } };
/* ----- the calf strap is a real two-piece strap: a buckle half of about 72 mm and a hole half of 105 mm. In its box it is buckled round a soft wedge pillow.
   The pillow's cross-section (y toward twelve, z up, its top plane at z = 0) is the hull of a back bolster of radius 18 and a front nose of radius 8.5, both touching the top plane ----- */
const CALF = { L: [80, 105], n: [80, 105], hole: 60.5, holes: [41, 47.5, 54, 60.5, 67, 73.5, 80], zt0: -4.3, hc: 34, uc: 1.6, tau0: 0, t70: 0.4 };
const ubk = { on: false, u: -9, lift: 0, free: false, hold: false, fa: 0, tang: 0, rel: 0, relV: 0 };
const PAXY = -36 / 37.2324, PAXZ = 9.5 / 37.2324, PCB = 9.5 / 37.2324, PCA = Math.sqrt(1 - PCB * PCB);
function pilSD(y, z) { const dx = y - 18, dz = z + 18, py = dx * PAXY + dz * PAXZ, px = Math.abs(dx * PAXZ - dz * PAXY), k = -PCB * px + PCA * py; if (k < 0) return Math.hypot(px, py) - 18; if (k > PCA * 37.2324) return Math.hypot(px, py - 37.2324) - 8.5; return px * PCA + py * PCB - 18; }
const cTh = (i, s) => i ? lerp(3.4, 2.2, sSmooth(s / 45)) * (1 - 0.2 * sSmooth((s - 94) / 11)) : lerp(3.4, 2.4, sSmooth(s / 45));
const cW = (i, s) => i ? lerp(19.7, 16, clamp(s / 70, 0, 1)) * (s > 93 ? Math.pow(Math.cos((s - 93) / 12 * 1.5), 0.7) : 1) : lerp(19.7, 16, clamp(s / CALF.L[0], 0, 1));
const cPt = [[], []], cTa = [[], []], sStep = (t) => t <= 0 ? 0 : 1 - Math.exp(-7.5 * t) * Math.cos(9 * t);
/* the direction a taut strap takes from a point: tangent to the pillow (grown by a clearance), wrapping it clockwise in the half's own frame */
function cAim(py, pz, th, sy, zt, c) { let best = -1e9;
  for (let k = 0; k < 2; k++) { const vy = (k ? -18 : 18) * sy - py, vz = zt - (k ? 8.5 : 18) - pz, d = Math.hypot(vy, vz) || 1e-6; let a = Math.atan2(vz, vy) + Math.asin(Math.min(1, ((k ? 8.5 : 18) + c) / d)); a -= TAU * Math.round((a - th) / TAU); if (a > th + 1.2) a -= TAU; if (a > best) best = a; }
  return best; }
/* one segment on from p: the nearest direction at or outside th that keeps the next point clear of the pillow */
function cStep(p, th, step, sy, zt, c) { const ok = (a) => pilSD(sy * (p[0] + step * Math.cos(a)), p[1] + step * Math.sin(a) - zt) >= c; if (ok(th)) return th;
  let lo = th, hi = th; for (let k = 0; k < 14; k++) { hi += 0.22; if (ok(hi)) break; lo = hi; }
  for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } return hi; }
/* a half laid taut round the pillow from its lug. bar: the buckle's spring bar seen in this half's frame; the hole half dives under the frame's end bar 9.5 mm before it,
   then climbs through the opening, over the bar and lies on the buckle half. Returns where it passed under the end bar */
function cTaut(i, zt, dent, bar, rock, thr) { const sy = i ? -1 : 1, n = CALF.n[i], step = CALF.L[i] / n, pts = cPt[i], ang = cTa[i]; let p = [LH[0] - 0.6, LH[1] + 0.2], sE = -1, jE = -1, thE = 0;
  let th = clamp(lerp(TH0, cAim(p[0], p[1], TH0, sy, zt, 0.7), 0.6), rad(-80), rad(-8)); pts.length = n + 1; ang.length = n; pts[0] = p;
  for (let j = 0; j < n; j++) { const s = (j + 0.5) * step; let cl = cTh(i, s) / 2 - lerp(2.4, dent, sSmooth(s / 10));
    if (bar && sE < 0) { const d = Math.hypot(p[0] - bar[0], p[1] - bar[1]); if (thr && s > 16 && d <= 9.5) { sE = s - step * 0.5; jE = j; thE = th; } else cl += rock * Math.exp(-(d - 9.5) * (d - 9.5) / 50); }
    if (sE >= 0) { const q = s - sE; cl += rock * Math.exp(-q * q / 50) + 3.05 * sSmooth((q + 1) / 10.6) - 0.6 * sSmooth((q - 9.6) / 6); }
    const want = cAim(p[0], p[1], th, sy, zt, cl), lim = step / 3.5 * sSmooth((s - 4) / 7); th = cStep(p, Math.min(Math.max(want, th - lim), th + step / 2.5), step, sy, zt, cl); ang[j] = th; p = [p[0] + step * Math.cos(th), p[1] + step * Math.sin(th)]; pts[j + 1] = p; }
  return { sE, jE, thE }; }
const cAt = (i, s) => { const st = CALF.L[i] / CALF.n[i], f = clamp(s / st, 0, CALF.n[i] - 0.001), j = Math.floor(f), a = cPt[i][j], b = cPt[i][j + 1]; return [lerp(a[0], b[0], f - j), lerp(a[1], b[1], f - j)]; };
/* how far the head has come up off the pillow, by the unbuckling clock: lifting it is what draws the tail back through the frame */
const cLift = (u) => (CALF.hc + 1.5) * sSmooth((u - 0.92) / 0.8) + (44.5 - CALF.hc) * sSmooth((u - 1.72) / 0.65);
/* the whole strap in its box at unbuckling time u. A, 0 to 0.35: the tail comes out of its keepers and springs off the buckle half. B, to 0.7: it swings out round the end bar,
   the loop draws tighter and the frame rocks up. C, to 0.88: the tang flicks out of its hole. D: the head lifts and the strap runs back under the end bar until the tail is out.
   E: each half lets go of the pillow from its tip toward the lug and springs to the curve it holds on its own */
function cIntro(S) { const u = ubk.u, zt = CALF.zt0 - ubk.lift, sB = sSmooth((u - 0.35) / 0.35), dent = lerp(1 + 0.6 * sB, 0.3, sSmooth((u - 0.9) / 0.5)), rock = 2 * sSmooth((u - 0.35) / 0.3) * (1 - sSmooth((u - 0.95) / 0.3)), wF = 0.5 * sB + 0.5 * sSmooth((u - 0.7) / 0.3);
  cTaut(0, zt, dent, null, 0, 0); const n0 = CALF.n[0], tip = cPt[0][n0], r = cTaut(1, zt, dent, [-tip[0], tip[1]], rock, 1), n1 = CALF.n[1], st1 = CALF.L[1] / n1; ubk.free = r.sE < 0;
  let fa = cTa[0][n0 - 1], tang = 0;
  if (!ubk.free) { const pE = cPt[1][r.jE], e = [pE[0] - Math.sin(r.thE) * 2.3, pE[1] + Math.cos(r.thE) * 2.3]; fa = Math.atan2(e[1] - tip[1], -e[0] - tip[0]); fa -= TAU * Math.round((fa - cTa[0][n0 - 1]) / TAU);
    if (wF > 0 || u > 0) { let p = cPt[1][r.jE + 1]; for (let j = r.jE + 1; j < n1; j++) { const q = (j + 0.5) * st1 - r.sE, fold = r.thE + Math.min(q / 2.3, 2.95) - 0.006 * Math.max(0, q - 6.8); let th = lerp(cTa[1][j], fold, wF);
        if (q > 22) th += sStep((u - (1 - (q - 22) / 42) * 0.16) * 1.6) * 0.25 * (q - 22) / 20.6 * (1 - wF); cTa[1][j] = th; p = [p[0] + st1 * Math.cos(th), p[1] + st1 * Math.sin(th)]; cPt[1][j + 1] = p; } }
    const h = cAt(1, CALF.hole), dy = -h[0] - tip[0], dz = h[1] - tip[1], raw = Math.atan2(-dy * Math.sin(fa) + dz * Math.cos(fa), dy * Math.cos(fa) + dz * Math.sin(fa)); ubk.raw = raw;
    tang = u < 0.7 ? Math.max(0, raw - CALF.tau0) : lerp(CALF.t70, 1.4, 1 - Math.exp(-18 * (u - 0.7)) * Math.cos(22 * (u - 0.7))); }
  else { const t = u - CALF.uc, x = t / 0.3, fall = x < 0 ? 0 : x < 1 ? x * x : 1 - 0.16 * Math.abs(Math.sin((x - 1) * 9)) * Math.exp(-(x - 1) * 5); tang = 1.4 * (1 - fall); fa += 0.22 * Math.exp(-4 * Math.max(0, t)) * Math.abs(Math.cos(13 * Math.max(0, t))); }
  /* letting go: per segment, tip first */
  if (ubk.free && u > CALF.uc) for (let i = 0; i < 2; i++) { const sy = i ? -1 : 1, n = CALF.n[i], step = CALF.L[i] / n, t0 = CALF.uc + (i ? 0.02 : 0.1), a0 = cTa[i][n - 1]; let p = cPt[i][0];
    for (let j = 0; j < n; j++) { const v = (j + 0.5) / n, s = (j + 0.5) * step, w = sStep(u - t0 - (1 - v) * 0.45), thF = TH0 + S[i].turn * Math.pow(v, 1.2) + S[i].wob * Math.sin(Math.PI * v);
      const th = cStep(p, cTa[i][j] + w * (thF - cTa[i][j]), step, sy, zt, cTh(i, s) / 2 - lerp(2.4, dent, sSmooth(s / 10))); cTa[i][j] = th; p = [p[0] + step * Math.cos(th), p[1] + step * Math.sin(th)]; cPt[i][j + 1] = p; }
    if (!i) fa += cTa[0][n - 1] - a0; }
  ubk.fa = fa; ubk.tang = tang; }
/* fit the buckle half to the pillow: its bar must land where the chosen hole lies, and find how far the head must lift before the tail is out */
{ cTaut(1, CALF.zt0, 1, null, 0, 0); const b = cAt(1, CALF.hole + 3.7); cTaut(0, CALF.zt0, 1, null, 0, 0); let best = 1e9, L = 72; for (let j = 40; j <= 80; j++) { const d = Math.hypot(cPt[0][j][0] + b[0], cPt[0][j][1] - b[1]); if (d < best) { best = d; L = j; } }
  const a = cPt[0][L - 1], c = cPt[0][L], e = cPt[0][Math.min(80, L + 1)], f = (x) => Math.hypot(x[0] + b[0], x[1] - b[1]), fr = clamp((f(a) - f(e)) / (2 * (f(a) + f(e) - 2 * f(c)) || 1), -0.5, 0.5); CALF.L[0] = L + fr; CALF.n[0] = 72;
  const thr = (h) => { cTaut(0, CALF.zt0 - h, 0.3, null, 0, 0); const t = cPt[0][72]; return cTaut(1, CALF.zt0 - h, 0.3, [-t[0], t[1]], 0, 1).sE >= 0; }; let lo = 0, hi = 70; for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (thr(m)) lo = m; else hi = m; } CALF.hc = hi;
  lo = 0.92; hi = 1.72; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (cLift(m) < CALF.hc) lo = m; else hi = m; } CALF.uc = hi + 0.02;
  const S0 = [{ turn: 0, wob: 0 }, { turn: 0, wob: 0 }]; ubk.u = -1; ubk.lift = 0; cIntro(S0); CALF.tau0 = ubk.raw; ubk.u = 0.7; cIntro(S0); CALF.t70 = Math.max(0, ubk.raw - CALF.tau0); ubk.u = -9; }
/* the pin buckle, polished steel, for a 16 mm strap end. Local axes: x across the strap, y along it from the spring bar toward the end bar, z away from the wrist */
const gBuckle = new THREE.Group(), gTang = new THREE.Group(), cKeep = [];
function cBuild(st, g) { const ms = M('strap', { color: 0xd4d6d9, metalness: 1, roughness: 0.14, envMapIntensity: 1.35, side: THREE.DoubleSide }), ml = st.ml = M('strap', { color: st.base, metalness: 0, roughness: 0.52, envMapIntensity: 0.5 });
  const put = (geo, mat, par) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; LAY.strap.meshes.push(m); par.add(m); return m; };
  /* the frame is one bar swept round a U: two rails 1.9 wide and 2.4 tall, and an end bar bowed 0.8 outward, D shaped, with a notch for the tang; the whole gently curved along the strap */
  const path = [], RX = 9.15, CR = 2.2, A0 = 6.5; for (let k = 0; k <= 8; k++) path.push([A0 * k / 8, -RX]); for (let k = 1; k <= 8; k++) { const f = k / 8 * Math.PI / 2; path.push([A0 + CR * Math.sin(f), -RX + CR - CR * Math.cos(f)]); }
  const XE = RX - CR; for (let k = 1; k < 28; k++) { const x = -XE + 2 * XE * k / 28; path.push([A0 + CR + 0.8 * Math.pow(Math.cos(Math.PI * x / (2 * XE)), 2), x]); } for (let k = path.length - 1 - 27; k >= 0; k--) path.push([path[k][0], -path[k][1]]);
  const sec = []; [[1, 1, 0.3], [-1, 1, 0.8], [-1, -1, 0.8], [1, -1, 0.3]].forEach(([su, sb, r], q) => { for (let k = 0; k <= 4; k++) { const f = (q + k / 4) * Math.PI / 2; sec.push([su * (0.95 - r) + r * Math.cos(f), sb * (1.2 - r) + r * Math.sin(f)]); } });
  const pos = [], idx = [], m = sec.length, np = path.length; for (let k = 0; k < np; k++) { const a = path[Math.max(0, k - 1)], b = path[Math.min(np - 1, k + 1)]; let ta = b[0] - a[0], tx = b[1] - a[1]; const l = Math.hypot(ta, tx); ta /= l; tx /= l;
    sec.forEach((q) => { const X = path[k][1] + q[0] * ta, Y = path[k][0] - q[0] * tx; let Z = q[1] + Y * (9.5 - Y) / 70; if (Y > 7.4 && Math.abs(X) < 1.15 && q[1] > 0.2) Z -= 0.5 * (1 - (X / 1.15) * (X / 1.15)) * Math.min(1, (q[1] - 0.2) / 0.6); pos.push(X, Y, Z); }); }
  for (let k = 0; k < np - 1; k++) for (let q = 0; q < m; q++) { const a = k * m + q, b = k * m + (q + 1) % m, c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals(); put(fg, ms, gBuckle);
  [-1, 1].forEach((sx) => { const ear = put(new THREE.CylinderGeometry(1.7, 1.7, 1.9, 28).rotateZ(Math.PI / 2), ms, gBuckle); ear.position.x = sx * RX; });
  put(new THREE.CylinderGeometry(0.75, 0.75, 20.3, 14).rotateZ(Math.PI / 2), ms, gBuckle);
  /* the tang: an eye round the bar, an arm with a slight S, its tip in the notch */
  { const cc = (a) => lerp(1.0, 1.22, sSmooth((a - 4.5) / 4.5)) - 0.12 * Math.sin(Math.PI * clamp((a - 1) / 4, 0, 1)), hh = (a) => 0.55 - 0.13 * sSmooth((a - 6) / 3.6), s = new THREE.Shape(), N = 18; s.moveTo(0.6, cc(0.6) - hh(0.6));
    for (let k = 1; k <= N; k++) { const a = 0.6 + 8.75 * k / N; s.lineTo(a, cc(a) - hh(a)); } s.quadraticCurveTo(9.72, cc(9.5), 9.35, cc(9.35) + hh(9.35)); for (let k = N - 1; k >= 0; k--) { const a = 0.6 + 8.75 * k / N; s.lineTo(a, cc(a) + hh(a)); } s.closePath();
    const eo = { depth: 1.26, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 20 }, arm = new THREE.ExtrudeGeometry(s, eo); arm.translate(0, 0, -0.63); arm.applyMatrix4(xBasis); put(arm, ms, gTang);
    const e = new THREE.Shape(); e.absarc(0, 0, 1.55, 0, TAU, false); const eh = new THREE.Path(); eh.absarc(0, 0, 0.78, 0, TAU, true); e.holes.push(eh); const eye = new THREE.ExtrudeGeometry(e, eo); eye.translate(0, 0, -0.63); eye.applyMatrix4(xBasis); put(eye, ms, gTang); gBuckle.add(gTang); }
  /* the buckle half's end, folded round the bar and slotted for the tang */
  [-1, 1].forEach((sx) => { const f = put(new THREE.CylinderGeometry(1.72, 1.72, 6.75, 20).rotateZ(Math.PI / 2), ml, gBuckle); f.position.x = sx * 4.5; });
  /* keepers: a fixed loop 9 mm behind the bar, a floating one parked at 24 */
  [[9, 4.0], [24, 4.5]].forEach(([d, wd]) => { const s = CALF.L[0] - d, hw = cW(0, s) / 2 + 0.3, b0 = -cTh(0, s) / 2 - 0.08, b1 = cTh(0, s) / 2 + 2.45, t = 1.2, sh = new THREE.Shape();
    const rr = (P, x0, y0, x1, y1, r, cw) => { if (cw) { P.moveTo(x0 + r, y0); P.quadraticCurveTo(x0, y0, x0, y0 + r); P.lineTo(x0, y1 - r); P.quadraticCurveTo(x0, y1, x0 + r, y1); P.lineTo(x1 - r, y1); P.quadraticCurveTo(x1, y1, x1, y1 - r); P.lineTo(x1, y0 + r); P.quadraticCurveTo(x1, y0, x1 - r, y0); P.closePath(); }
      else { P.moveTo(x0 + r, y0); P.lineTo(x1 - r, y0); P.quadraticCurveTo(x1, y0, x1, y0 + r); P.lineTo(x1, y1 - r); P.quadraticCurveTo(x1, y1, x1 - r, y1); P.lineTo(x0 + r, y1); P.quadraticCurveTo(x0, y1, x0, y1 - r); P.lineTo(x0, y0 + r); P.quadraticCurveTo(x0, y0, x0 + r, y0); } };
    rr(sh, -hw - t, b0 - t, hw + t, b1 + t, 1.5, false); const ho = new THREE.Path(); rr(ho, -hw, b0, hw, b1, 0.8, true); sh.holes.push(ho);
    const kg = keepUV(new THREE.ExtrudeGeometry(sh, { depth: wd - 0.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 2, curveSegments: 6 }), hw, b0, b1, t, wd); kg.translate(0, -b0, -(wd - 0.5) / 2); kg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)));
    cKeep.push({ m: put(kg, ml, g), s, b0 }); });
  g.add(gBuckle); }
/* where the buckle and the keepers sit: on the tip of the buckle half. Loose, the frame hangs from the strap end and swings a little; in the box the unbuckling places it */
function cBuckle(dt, c, box, sim) { const n = CALF.n[0], tip = c[n], ta = Math.atan2(tip[1] - c[n - 1][1], tip[0] - c[n - 1][0]);
  if (box) { ubk.rel = 0; ubk.relV = 0; gBuckle.rotation.x = ubk.fa; gTang.rotation.x = ubk.tang; }
  else { let d = Math.atan2(gv.z, gv.y) - ta; d -= TAU * Math.round(d / TAU); const tg = clamp(d * 0.3 * Math.min(1, Math.hypot(gv.y, gv.z)), -0.4, 0.4); if (sim) { const h = dt / 3; for (let q = 0; q < 3; q++) { ubk.relV += (160 * (tg - ubk.rel) - 8 * ubk.relV) * h; ubk.rel += ubk.relV * h; } } else ubk.rel = tg;
    gBuckle.rotation.x = ta + ubk.rel; gTang.rotation.x = 0; }
  /* a keeper with the tail through it stands open; empty, the loop relaxes flatter against its own strap */
  const full = box ? 1 - sSmooth((ubk.u - 0.05) / 0.3) : 0; gBuckle.position.set(0, tip[0], tip[1]); cKeep.forEach((K) => { const o = along(c, K.s); K.m.position.set(0, o.y - Math.sin(o.ang) * K.b0, o.z + Math.cos(o.ang) * K.b0); K.m.rotation.x = o.ang; K.m.scale.z = lerp(0.6, 1, full); }); }
/* bracelet: three-row links with satin tops brushed along the bracelet and polished flanks, each link rounded over at its ends, and a solid end link cut to the curve of the case */
const mLinkB = M('strap', Object.assign({}, brushP, { roughness: 0.9 })), mLinkP = M('strap', { color: STEEL, metalness: 0.9, roughness: 0.3, roughnessMap: scuffTex, envMapIntensity: 1.25 });   // polished flanks: a touch of diffuse so they never read as black holes against the dark backdrop
mLinkB.normalScale.set(0.24, 0.24);
const mBar = M('strap', { color: 0xd9dcdf, metalness: 1, roughness: 0.22 });
const barGeo = new THREE.CylinderGeometry(0.42, 0.42, 20.7, 16).rotateZ(Math.PI / 2), tipGeo = new THREE.CylinderGeometry(0.36, 0.36, 26.12, 12).rotateZ(Math.PI / 2);   // the spring bar, and its pivots showing in the drilled lugs
/* a link is its side profile (rounded over the top at both ends, so the joints read as grooves) pushed across the bracelet; the lids of that extrusion are the polished flanks */
const mkLink = (w) => { const bev = 0.12, a = 2.12 - bev, b = 1.5 - bev, rt = 0.62, rb = 0.4, s = new THREE.Shape(); s.moveTo(-a + rb, -b); s.lineTo(a - rb, -b); s.quadraticCurveTo(a, -b, a, -b + rb); s.lineTo(a, b - rt); s.quadraticCurveTo(a, b, a - rt, b); s.lineTo(-a + rt, b); s.quadraticCurveTo(-a, b, -a, b - rt); s.lineTo(-a, -b + rb); s.quadraticCurveTo(-a, -b, -a + rb, -b);
  const g = new THREE.ExtrudeGeometry(s, { depth: w - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 5 }); g.translate(0, 0, -(w - 2 * bev) / 2); g.applyMatrix4(xBasis); return g; };
const linkGeo = [mkLink(4.75), mkLink(9.6)];
const endGeo = (() => { const Rc = 19.62, hw = 9.82, a0 = Math.acos(hw / Rc), s = new THREE.Shape(); s.moveTo(hw, Rc * Math.sin(a0)); s.absarc(0, 0, Rc, a0, Math.PI - a0, false); s.lineTo(-hw, 20.95); s.lineTo(-4.72, 20.95); s.lineTo(-4.72, 22.6); s.lineTo(4.72, 22.6); s.lineTo(4.72, 20.95); s.lineTo(hw, 20.95); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 3.3, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.28, bevelSegments: 1, curveSegments: 32 }); g.translate(0, 0, -3.58); uvMap(g, (u, v) => [v, u]);   // grain along the bracelet
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + 1.0 - 0.75 * (y - 17)); } g.computeVertexNormals(); return g; })();
const steel2 = (geo, mats, parent) => { const m = new THREE.Mesh(geo, mats); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
/* ----- the bracelet, whole: an end link and rows of three piece links on each side, and between them a compact folding clasp, a short cover with a flip lock and two thin blades that fold away inside it.
   It is one chain of pins from the end link at twelve to the end link at six: end link, the twelve side's rows, blade 2, the middle hinge, blade 1, the cover, the six side's rows, end link.
   Closed round the wrist the two blades lie folded under the cover; opened they straighten out, and the bracelet becomes a strip. Every way it can lie is the same pins with the joints turned ----- */
const BRC = { p: 4.4, e: 1.2, nA: 12, nB: 12, Lc: 20.5, Lb1: 18.5, Lb2: 16.5, d1: 0.9, d2: 1.5 };   // link pitch, end link pin, rows each side, cover and blade lengths, how deep the blades lie under the cover
BRC.m = BRC.nA + 2; BRC.S = BRC.nA + BRC.nB + 5;   // the middle hinge's pin, and the number of pieces between pins
const brWrap = (x) => x - TAU * Math.round(x / TAU);
/* closed on the wrist: the pins on an oval that leaves each lug in the end link's own line and wraps the wrist; the oval is sized until the six side's end link lands exactly on its lug */
const BRSH = (() => { const P0 = [LH[0] - 0.6, LH[1] + 0.2], tn = Math.tan(-TH0), M = 2400;
  const lay = (k) => { const zc = P0[1] - k * k * P0[0] / tn, a = Math.hypot(P0[0], (P0[1] - zc) / k), b = k * a, f0 = Math.atan2((P0[1] - zc) / b, P0[0] / a), f1 = -Math.PI - f0, P = [], N = [], U = [0];
    for (let i = 0; i <= M; i++) { const f = lerp(f0, f1, i / M), c = Math.cos(f), s = Math.sin(f), gy = c / a, gz = s / b, gl = Math.hypot(gy, gz); P.push([a * c, zc + b * s]); N.push([-gy / gl, -gz / gl]); if (i) U.push(U[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); }
    const at = (u, d = 0) => { u = clamp(u, 0, U[M]); let lo = 0, hi = M; while (hi - lo > 1) { const md = (lo + hi) >> 1; if (U[md] <= u) lo = md; else hi = md; } const t = (u - U[lo]) / (U[hi] - U[lo] || 1); return [lerp(P[lo][0], P[hi][0], t) + d * lerp(N[lo][0], N[hi][0], t), lerp(P[lo][1], P[hi][1], t) + d * lerp(N[lo][1], N[hi][1], t)]; };
    const next = (q, u0, L, d = 0) => { let lo = u0, hi = u0 + L + 4; for (let it = 0; it < 40; it++) { const md = (lo + hi) / 2, p = at(md, d); if (Math.hypot(p[0] - q[0], p[1] - q[1]) < L) lo = md; else hi = md; } return hi; };
    const pts = [P0.slice()]; let u = next(P0, 0, BRC.e); pts.push(at(u));
    for (let r = 1; r < BRC.nA; r++) { u = next(pts[pts.length - 1], u, BRC.p); pts.push(at(u)); }
    const uH = next(pts[pts.length - 1], u, BRC.p, BRC.d2), u1 = uH - (BRC.Lb1 - BRC.Lb2); pts.push(at(uH, BRC.d2));   /* the last row dips under the cover to the end of blade 2 */
    pts.push(at(u1 + BRC.Lb1, (BRC.d1 + BRC.d2) / 2)); pts.push(at(u1, BRC.d1 / 2)); u = u1 + BRC.Lc; pts.push(at(u));
    for (let r = 0; r < BRC.nB; r++) { u = next(pts[pts.length - 1], u, BRC.p); pts.push(at(u)); }
    pts.push([-P0[0], P0[1]]); const m0 = at(u1 + BRC.Lc / 2), c0 = at(u1), c1 = at(u1 + BRC.Lc), cl = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), sag = Math.abs((c1[0] - c0[0]) * (m0[1] - c0[1]) - (c1[1] - c0[1]) * (m0[0] - c0[0])) / cl;
    return { pts, res: U[M] - u - BRC.e, a, b, zc, k, sag }; };
  let lo = 0.3, hi = 2.2, r = lay(1); for (let it = 0; it < 48; it++) { const md = (lo + hi) / 2; r = lay(md); if (r.res > 0) hi = md; else lo = md; }
  r.L = []; for (let j = 0; j < BRC.S; j++) r.L.push(Math.hypot(r.pts[j + 1][0] - r.pts[j][0], r.pts[j + 1][1] - r.pts[j][1])); return r; })();
/* a pose: where the middle hinge is, which way blade 1 points, and how much each joint is turned from the piece before it. The two hinges either side of blade 1 fold right over when the clasp is shut,
   one each way, so their turns are kept on the side they fold to and never read back from the points */
const brAng = (c, j) => Math.atan2(c[j + 1][1] - c[j][1], c[j + 1][0] - c[j][0]);
function brPose(c, fl) { const S = BRC.S, ph = new Float64Array(S); for (let j = 1; j < S; j++) ph[j] = brWrap(brAng(c, j) - brAng(c, j - 1)); return { r: c[BRC.m].slice(), a: brAng(c, BRC.m), ph, fl }; }
const brCopy = (P, Q) => { Q = Q || { r: [0, 0], a: 0, ph: new Float64Array(BRC.S), fl: 0 }; Q.r[0] = P.r[0]; Q.r[1] = P.r[1]; Q.a = P.a; Q.ph.set(P.ph); Q.fl = P.fl; return Q; };
function brPts(P, out) { const m = BRC.m, L = BRSH.L; out[m][0] = P.r[0]; out[m][1] = P.r[1]; let th = P.a;
  for (let j = m; j < BRC.S; j++) { if (j > m) th += P.ph[j]; out[j + 1][0] = out[j][0] + L[j] * Math.cos(th); out[j + 1][1] = out[j][1] + L[j] * Math.sin(th); }
  th = P.a; for (let j = m - 1; j >= 0; j--) { th -= P.ph[j + 1]; out[j][0] = out[j + 1][0] - L[j] * Math.cos(th); out[j][1] = out[j + 1][1] - L[j] * Math.sin(th); } return out; }
const BRWP = (() => { const P = brPose(BRSH.pts, 1), m = BRC.m; if (P.ph[m] < 0) P.ph[m] += TAU; if (P.ph[m + 1] > 0) P.ph[m + 1] -= TAU; return P; })();   // shut: blade 2 turns back under blade 1, blade 1 back under the cover
/* the pose on the watch, the end links lifted off the lugs by lift (the whole bracelet drops away from the case) */
const brWornP = (lift, Q) => { Q = brCopy(BRWP, Q); Q.r[1] -= lift; return Q; };
const brSeatP = (lift, Q) => { Q = brCopy(BCL.UP, Q); Q.r[1] -= lift; return Q; };   // seated on its bars, still open
/* between two poses: every joint turns with t (in the air the clasp stays open, so nothing of it keeps its own time), and the flip lock with it */
function brMix(A, B, t, on, Q) { Q.r[0] = lerp(A.r[0], B.r[0], t); Q.r[1] = lerp(A.r[1], B.r[1], t); Q.a = A.a + brWrap(B.a - A.a) * t; Q.fl = lerp(A.fl, B.fl, t);
  for (let j = 1; j < BRC.S; j++) Q.ph[j] = lerp(A.ph[j], B.ph[j], t); return Q; }
/* ----- putting the bracelet on, as these clasps really go on: it arrives open and its two end links are seated on their spring bars first, the two halves hanging under the case in a U,
   joined at the bottom by the open blades. Then the halves swing round under the case to the wrist, the blades fold in under the cover as they come together, the cover closes over them,
   and the flip lock shuts with a click. Off, it is the same backwards. cl runs 0 (seated, open) to 1 (shut). Each half turns about its own lug, every segment's direction eased from
   the U to the shut loop; the two blades are what is left to join them, worked out each frame from where the two halves have got to (two links, two lengths, one way to bend) ----- */
const brBuf = (n) => { const b = []; for (let i = 0; i < n; i++) b.push([0, 0]); return b; };   // a chain of n pins, all at the origin
const BCL = { cl: 1, clTo: 1, fl: 1, gap: 0, U12: [], W12: [], U6: [], W6: [], side: 1, UP: null, c: null };
{ const S = BRC.S, m = BRC.m, P = BRSH.pts, L = BRSH.L, unwrap = (arr) => { for (let k = 1; k < arr.length; k++) arr[k] = arr[k - 1] + brWrap(arr[k] - arr[k - 1]); return arr; };
  BCL.W12 = unwrap([...Array(m - 1).keys()].map((j) => brAng(P, j)));   /* segments 0 to m - 2, from the twelve lug out */
  BCL.W6 = unwrap([...Array(S - m - 1).keys()].map((k) => brAng(P, S - 1 - k)));   /* segments S - 1 down to m + 1, from the six lug out */
  const A = P[m - 1], B = P[m + 1], K = P[m]; BCL.side = Math.sign((B[0] - A[0]) * (K[1] - A[1]) - (B[1] - A[1]) * (K[0] - A[0])) || 1;
  const lay = (al) => { const h12 = -Math.PI / 2 - al, h6 = Math.PI / 2 + al; let s = 0; BCL.U12 = BCL.W12.map((w, j) => { const e = sSmooth(s / 14); s += L[j]; return lerp(w, w + brWrap(h12 - w), e); });
    s = 0; BCL.U6 = BCL.W6.map((w, k) => { const e = sSmooth(s / 14); s += L[S - 1 - k]; return lerp(w, w + brWrap(h6 - w), e); }); };
  const reach = L[m - 1] + L[m], c = brBuf(S + 1); let lo = 0, hi = 1.1;
  for (let it = 0; it < 40; it++) { const md = (lo + hi) / 2; lay(md); BCL.cl = 0; brClose(0, 0, c); const d = Math.hypot(c[m + 1][0] - c[m - 1][0], c[m + 1][1] - c[m - 1][1]); if (d > 0.86 * reach) lo = md; else hi = md; }
  lay(hi); BCL.U = brClose(0, 0, brBuf(S + 1)); BCL.UP = brPose(BCL.U, 0); BCL.c = brBuf(S + 1); BCL.cl = 1; }
/* the bracelet at cl, lowered by lift; returns its pins */
function brClose(cl, lift, out) { const S = BRC.S, m = BRC.m, P = BRSH.pts, L = BRSH.L, e = sSmooth(cl / 0.8);
  out[0][0] = P[0][0]; out[0][1] = P[0][1]; for (let j = 0; j < m - 1; j++) { const a = lerp(BCL.U12[j], BCL.W12[j], e); out[j + 1][0] = out[j][0] + L[j] * Math.cos(a); out[j + 1][1] = out[j][1] + L[j] * Math.sin(a); }
  out[S][0] = P[S][0]; out[S][1] = P[S][1]; for (let k = 0; k < S - m - 1; k++) { const j = S - 1 - k, a = lerp(BCL.U6[k], BCL.W6[k], e); out[j][0] = out[j + 1][0] - L[j] * Math.cos(a); out[j][1] = out[j + 1][1] - L[j] * Math.sin(a); }
  /* the blades: from the twelve half's last pin (A) to the cover's hinge (B), blade 2 then blade 1, folded the way they fold when the clasp is shut */
  const A = out[m - 1], B = out[m + 1], a = L[m - 1], b = L[m], dx = B[0] - A[0], dy = B[1] - A[1], d = Math.max(1e-6, Math.hypot(dx, dy)), ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), ph = Math.acos(ca) * BCL.side, th = Math.atan2(dy, dx) + ph;
  out[m][0] = A[0] + a * Math.cos(th); out[m][1] = A[1] + a * Math.sin(th); BCL.gap = Math.abs(Math.hypot(B[0] - out[m][0], B[1] - out[m][1]) - b);
  BCL.fl = sSmooth((cl - 0.82) / 0.16); if (lift) for (let j = 0; j <= S; j++) out[j][1] -= lift; return out; }
/* a clasp plate: w wide, t thick, L between its pins, bowed by sag toward its outer face (local z) to follow the wrist. Brushed faces, polished edges and ends */
function brPlate(w, L, t, sag, r) { const sec = []; [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], q) => { for (let k = 0; k <= 3; k++) { const f = (q + k / 3) * Math.PI / 2; sec.push([sx * (w / 2 - r) + r * Math.cos(f), sz * (t / 2 - r) + r * Math.sin(f)]); } });
  const ns = sec.length, ny = 16, pos = [], uv = [], iF = [], iE = [], bow = (y) => sag * (1 - 4 * y * y / (L * L)), flat = (k) => Math.abs(Math.abs(sec[k][1]) - t / 2) < 1e-4;
  for (let i = 0; i <= ny; i++) { const y = -L / 2 + L * i / ny; sec.forEach(([x, z]) => { pos.push(x, y, z + bow(y)); uv.push(y / 20, (x + z) / 20 + 0.5); }); }   /* x + z, so a narrow side face still has its texture running across it rather than one stretched texel */
  for (let i = 0; i < ny; i++) for (let k = 0; k < ns; k++) { const a = i * ns + k, b = i * ns + (k + 1) % ns, c = a + ns, d = b + ns; (flat(k) && flat((k + 1) % ns) ? iF : iE).push(a, c, b, b, c, d); }
  [0, ny].forEach((i) => { const o = pos.length / 3, y = -L / 2 + L * i / ny; pos.push(0, y, bow(y)); uv.push(0.5, 0.5); sec.forEach(([x, z]) => { pos.push(x, y, z + bow(y)); uv.push(0.5 + x / 20, 0.5 + z / 20); }); for (let k = 0; k < ns; k++) i ? iE.push(o, o + 1 + (k + 1) % ns, o + 1 + k) : iE.push(o, o + 1 + k, o + 1 + (k + 1) % ns); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(iF.concat(iE)); g.addGroup(0, iF.length, 0); g.addGroup(iF.length, iE.length, 1); g.computeVertexNormals(); return g; }
/* seen from the back, whatever of the bracelet lies between the eye and the caseback thins to a faint steel outline, so the back reads through it. A piece that may cover the back wears a twin of its
   material that works this out pixel by pixel: the line of sight through the pixel, carried on to the plane of the caseback, lands inside it or not. Everything else stays solid */
const GHU = { uGhM: { value: new THREE.Matrix4() }, uGhC: { value: new THREE.Vector3() }, uGhP: { value: new THREE.Vector4(0, ZBACK, 20.5, 3.5) } };   // world to the strap frame; the eye in that frame; [on, the back's plane, its radius, the soft edge]
const mLinkBG = M('strap', Object.assign({}, brushP, { roughness: 0.9, transparent: true, depthWrite: false })), mLinkPG = M('strap', { color: STEEL, metalness: 0.9, roughness: 0.3, roughnessMap: scuffTex, envMapIntensity: 1.25, transparent: true, depthWrite: false });
mLinkBG.normalScale.set(0.24, 0.24);
const ghostPatch = (m) => { m.customProgramCacheKey = () => 'brGhost'; m.onBeforeCompile = (s) => { Object.assign(s.uniforms, GHU);
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uGhM; varying vec3 vGhP;').replace('#include <project_vertex>', '#include <project_vertex>\nvGhP = (uGhM * modelMatrix * vec4(transformed, 1.0)).xyz;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGhC; uniform vec4 uGhP; varying vec3 vGhP;').replace('#include <opaque_fragment>', `{ float gh = 0.0; vec3 gd = vGhP - uGhC;
  if (uGhC.z < uGhP.y && vGhP.z < uGhP.y + 0.5 && gd.z > 1e-4) { vec3 gq = uGhC + gd * ((uGhP.y - uGhC.z) / gd.z); gh = (1.0 - smoothstep(uGhP.z - uGhP.w, uGhP.z + uGhP.w, length(gq.xy))) * smoothstep(0.02, 0.16, (uGhP.y - uGhC.z) / length(gd)); }
  float gr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition))); diffuseColor.a *= mix(1.0, 0.06 + 0.5 * gr * gr, gh * uGhP.x); }
#include <opaque_fragment>`); }; return m; };
[mLinkBG, mLinkPG].forEach(ghostPatch);
/* the NATO's own steel (its buckle and keepers), with its ghost twin */
const mNatoSt = M('strap', { color: 0xd4d6d9, metalness: 1, roughness: 0.16, envMapIntensity: 1.3, side: THREE.DoubleSide }), mNatoStG = ghostPatch(M('strap', { color: 0xd4d6d9, metalness: 1, roughness: 0.16, envMapIntensity: 1.3, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
const GHT = new Map([[mLinkB, mLinkBG], [mLinkP, mLinkPG], [mNatoSt, mNatoStG]]);
const edgeTint = tex(4, (g, S) => { g.fillStyle = '#b6b6b6'; g.fillRect(0, 0, S, S); });   // edge paint: the strap's own colour, a good deal darker
/* the bloom on a napped leather is its own dye, lifted and a little washed out: fibres standing on end scatter light back at grazing angles */
const napSheen = (out, c) => { const m = Math.max(c.r, c.g, c.b, 0.02), k = 0.75 / m; out.setRGB(lerp(c.r * k, 0.75, 0.35), lerp(c.g * k, 0.75, 0.35), lerp(c.b * k, 0.75, 0.35)); };
let liningTex = null; const sFlip = (t) => { const c = t.clone(); c.repeat.x = -1; c.offset.x = 1; c.needsUpdate = true; return c; };
/* baking a strap's surface takes a moment, so a strap is dressed when it is first shown; the rest are done in idle time after the page is up */
function dress(st) { if (st.dressed || !st.maps) return; st.dressed = true;
  if (st.len) { st.mats.forEach((m, i) => { Object.assign(m, st.maps(i)); if (st.nap) m.sheenColorMap = m.map; m.needsUpdate = true; });   /* the bloom follows the colour map, so it is lost in the holes and thins where the nap is pressed down */ st.backs.forEach((m, i) => { const t = liningMaps(Math.ceil(CALF.L[i] * SPX), i ? CALF.holes : null, i ? null : [CALF.L[0] - 4.6]); if (i) [t.map, t.normalMap].forEach((x) => { x.repeat.x = -1; x.offset.x = 1; }); m.map = t.map; m.normalMap = t.normalMap; m.needsUpdate = true; }); return; }
  Object.assign(st.mat, st.maps()); st.mat.needsUpdate = true;
  if (st.back) { liningTex = liningTex || liningMaps(); [st.matBack, st.matBackM].forEach((m, i) => { m.map = i ? sFlip(liningTex.map) : liningTex.map; m.normalMap = i ? sFlip(liningTex.normalMap) : liningTex.normalMap; m.needsUpdate = true; }); } }
function makeStrap(st, sy) {
  const g = new THREE.Group(); gStrap.add(g); const bar = add(g, barGeo, mBar), tips = add(g, tipGeo, mBar);
  const seat = (lift) => { bar.position.set(0, sy * (LH[0] + HEAD[0] * lift), LH[1] + HEAD[1] * lift); tips.position.copy(bar.position); tips.visible = lift < 0.05; };
  if (st.links) { bar.visible = tips.visible = false; if (sy < 0) return { sy, obj: g, update() {} };   /* the bracelet is one piece, built on the twelve side; the six side is an empty place holder */
    const L = BRSH.L, S = BRC.S, m = BRC.m, parts = [], twin = (x) => Array.isArray(x) ? x.map((y) => GHT.get(y) || y) : GHT.get(x) || x;
    const put = (geo, mats, par) => { const x = steel2(geo, mats, par); if (!geo.boundingSphere) geo.computeBoundingSphere(); parts.push({ m: x, sol: mats, gho: twin(mats), g: false, c: geo.boundingSphere.center, rad: geo.boundingSphere.radius }); return x; };   /* each piece's own middle and reach, for deciding which may cover the back */
    /* the end links, each with its spring bar, cut to the case: they ride rigidly on the first and the last piece of the chain */
    const ends = [0, 1].map((k) => { const e = new THREE.Group(); g.add(e); const end = put(endGeo, [mLinkB, mLinkP], e), b = add(e, barGeo, mBar), t = add(e, tipGeo, mBar); if (k) end.rotation.z = Math.PI; b.position.set(0, (k ? -1 : 1) * LH[0], LH[1]); t.position.copy(b.position); return { e, t }; });
    /* the rows: two outer links on each pitch, a centre link over each joint between them, tapering from the lugs to the clasp */
    const tA = (r, n) => lerp(1, 0.82, r / (n - 1)), rows = [], cens = [];
    for (let j = 1; j <= BRC.nA; j++) rows.push({ j, k: tA(j - 1, BRC.nA) });
    for (let j = m + 2; j <= S - 2; j++) rows.push({ j, k: tA(S - 2 - j, BRC.nB) });
    for (let p = 2; p <= BRC.nA; p++) cens.push({ p, k: (tA(p - 2, BRC.nA) + tA(p - 1, BRC.nA)) / 2 });
    for (let p = m + 3; p <= S - 2; p++) cens.push({ p, k: (tA(S - 2 - p, BRC.nB) + tA(S - 1 - p, BRC.nB)) / 2 });
    rows.forEach((R) => { R.o = [-1, 1].map((sx) => { const x = put(linkGeo[0], [mLinkP, mLinkB], g); x.scale.x = R.k; return { x, sx }; }); });
    cens.forEach((C) => { C.o = put(linkGeo[1], [mLinkP, mLinkB], g); C.o.scale.x = C.k; });
    /* the clasp, after the Oyster pattern: a short cover no longer than four or five links and no thicker than they are, its top flush with them, polished down the middle and satin on the
       shoulders, with shallow skirts down its sides. The two thin blades fold away inside it (blade 1 hinged to the cover, blade 2 to blade 1 and to the twelve side's last row), and a small
       polished flip lock lies on its end */
    const cover = new THREE.Group(), b1 = new THREE.Group(), b2 = new THREE.Group(), flap = new THREE.Group(); [cover, b1, b2].forEach((x) => g.add(x));
    const CL = L[m + 1], sg = BRSH.sag, cw = 16.4, mid = 7.9, sk = 0.7, sh = (cw - mid) / 2 - sk + 0.28;   /* the shoulders stop short of the skirts, so no two faces ever lie in one place */
    put(brPlate(mid, CL, 1.0, sg, 0.18), [mLinkP, mLinkP], cover).position.z = 1.0;
    [-1, 1].forEach((sx) => { put(brPlate(sh, CL, 1.0, sg, 0.18), [mLinkB, mLinkP], cover).position.set(sx * (mid / 2 - 0.3 + sh / 2), 0, 0.96);   /* tucked a hair under the polished centre, its top a hair lower */ put(brPlate(sk, CL - 0.6, 2.9, sg, 0.2), [mLinkP, mLinkP], cover).position.set(sx * (cw / 2 - sk / 2), 0, -0.35); });   /* the skirts are polished all over: a brushed grain has nothing to run along on a face this narrow */
    put(brPlate(9, L[m], 0.55, 0, 0.2), [mLinkB, mLinkP], b1); put(brPlate(9, L[m - 1], 0.55, 0, 0.2), [mLinkB, mLinkP], b2);
    [[0.5, 9.4, b1, L[m]], [0.55, 14.6, cover, CL], [0.5, 9.4, b2, L[m - 1]]].forEach(([r, w, par, l]) => { put(new THREE.CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2), mLinkP, par).position.y = -l / 2; });   // the hinge pins
    flap.position.set(0, -CL / 2 - 0.3, 1.2); cover.add(flap); put(brPlate(mid + 0.5, 4.8, 0.75, 0, 0.3), [mLinkP, mLinkP], flap).position.set(0, 2.4, 0.72); put(new THREE.CylinderGeometry(0.55, 0.55, mid + 0.5, 12).rotateZ(Math.PI / 2), mLinkP, flap);
    const ang = (c, j) => Math.atan2(c[j + 1][1] - c[j][1], c[j + 1][0] - c[j][0]), seg = (o, c, j) => { o.position.set(0, (c[j][0] + c[j + 1][0]) / 2, (c[j][1] + c[j + 1][1]) / 2); o.rotation.x = ang(c, j); };
    const P0 = BRSH.pts[0], PS = BRSH.pts[S];
    return { sy, obj: g, parts, ends, fl: 1, onW: false, update(c, lift) {
      [[0, 0, TH0, c[0], P0], [1, S - 1, -TH0, c[S], PS]].forEach(([k, j, a0, P, Q]) => { const E = ends[k].e, d = ang(c, j) - a0, cs = Math.cos(d), sn = Math.sin(d); E.rotation.x = d; E.position.set(0, P[0] - (Q[0] * cs - Q[1] * sn), P[1] - (Q[0] * sn + Q[1] * cs)); ends[k].t.visible = this.onW && lift < 0.05; });
      rows.forEach((R) => { const j = R.j, y = (c[j][0] + c[j + 1][0]) / 2, z = (c[j][1] + c[j + 1][1]) / 2, a = ang(c, j); R.o.forEach((o) => { o.x.position.set(o.sx * 7.35 * R.k, y, z); o.x.rotation.x = a; }); });
      cens.forEach((C) => { const a1 = ang(c, C.p - 1), a = a1 + brWrap(ang(c, C.p) - a1) / 2; C.o.position.set(0, c[C.p][0], c[C.p][1]); C.o.rotation.x = a; });
      seg(b2, c, m - 1); seg(b1, c, m); seg(cover, c, m + 1); flap.rotation.x = -2.5 * (1 - this.fl); } }; }   /* open, the flip lock stands back off the cover */
  if (!st.mat) { const cloth = st.sheen ? { sheen: st.sheen, sheenRoughness: st.sheenR || 0.5, sheenColor: new THREE.Color(st.sheenC ?? 0xffffff) } : {}, lp = { color: st.back, map: null, normalMap: null, metalness: 0, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.4 };
    st.mat = M('strap', Object.assign({ map: null, normalMap: null, roughnessMap: null, metalness: 0, roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.6 }, cloth), !!st.sheen);
    st.matEnd = M('strap', Object.assign({ color: st.base, metalness: 0, roughness: st.under ? 0.9 : st.edgeRo || 0.5, side: THREE.DoubleSide, envMapIntensity: 0.5 }, st.under ? {} : { map: edgeTint }));
    if (st.back) { st.matBack = M('strap', Object.assign({}, lp)); st.matBackM = M('strap', Object.assign({}, lp)); } else st.matBack = st.mat; }
  const w = (u) => lerp(st.w[0], st.w[1], u), th = (u) => lerp(st.th[0], st.th[1], u);
  if (st.len) { const i = sy > 0 ? 0 : 1, N = CALF.n[i], L = CALF.L[i], wf = (t) => cW(i, t * L), tf = (t) => cTh(i, t * L);
    if (!st.mats) { st.mats = [st.mat, M('strap', Object.assign({ map: null, normalMap: null, roughnessMap: null, metalness: 0, roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.6 }, st.nap ? { sheen: st.sheen, sheenRoughness: st.sheenR, sheenColor: new THREE.Color(0xffffff) } : {}), !!st.nap)]; st.backs = [st.matBack, st.matBackM]; }
    const geo = ribbonGeo(strapCenter(st.rest, 0, 0, 0, 0, N, L / N), wf, tf, sy), m = steel2(geo, [st.mats[i], st.backs[i], st.matEnd], g); m.frustumCulled = false; m.castShadow = false;
    const tr = st.th[0] * 0.47, tube = add(g, uvMap(new THREE.CylinderGeometry(tr, tr, st.w[0] - 0.1, 20).rotateZ(Math.PI / 2), (u, v) => [v, (0.25 + 2.2 * Math.abs(2 * u - 1)) / 19.7]), st.mats[i]);
    if (!i) { if (!cKeep.length) cBuild(st, g); else st.ml = STRAPS.consulting.ml; }
    return { sy, obj: g, update(c, lift) { seat(lift); tube.position.set(0, sy * (c[0][0] + 0.25), c[0][1]); ribbonGeo(c, wf, tf, sy, geo); } }; }
  if (st.under) {   // one piece of webbing: over the 12 o'clock bar, down behind it, flat under the caseback, up behind the 6 o'clock bar and away
    if (sy < 0) return { sy, obj: g, update(c, lift) { seat(lift); st.cs[-1] = c; st.thread(lift); } };
    st.cs = { 1: strapCenter(st.rest, 0, 0, st.dz, st.dy, st.sn[0]), [-1]: strapCenter(st.rest, 0, 0, st.dz, st.dy, st.sn[1]) }; const WR = 9, UN = 25;
    const loop = (lift) => { const zb = ZBACK - 0.78 - lift * 0.9, out = [], side = (sg) => { const c = st.cs[sg], p0 = [15.2, zb], p1 = c[0], dl = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]), m1 = [5 * (c[1][0] - c[0][0]) / dl, 5 * (c[1][1] - c[0][1]) / dl], pts = [];
        for (let i = 0; i < WR; i++) { const t = (i + 1) / (WR + 1), a = 2 * t * t * t - 3 * t * t + 1, b = t * t * t - 2 * t * t + t, d = -2 * t * t * t + 3 * t * t, e = t * t * t - t * t; pts.push([a * p0[0] + b * 5 + d * p1[0] + e * m1[0], a * p0[1] + d * p1[1] + e * m1[1]]); } return pts.concat(c).map((p) => [sg * p[0], p[1]]); };
      side(-1).reverse().forEach((p) => out.push(p)); for (let i = 0; i < UN; i++) out.push([-15.2 + 30.4 * i / (UN - 1), zb]); side(1).forEach((p) => out.push(p));
      if (natoP < 0.999) {   // the whole strap slides along its own path: down from above twelve, over the bar, under the case, up and out at six, tail following
        const F = out.slice().reverse(), n = F.length, d0 = [F[0][0] - F[1][0], F[0][1] - F[1][1]], dl = Math.hypot(d0[0], d0[1]) || 1, E = [[F[0][0] + d0[0] / dl * 64, F[0][1] + d0[1] / dl * 64]].concat(F), cum = [0];
        for (let i = 1; i < E.length; i++) cum.push(cum[i - 1] + Math.hypot(E[i][0] - E[i - 1][0], E[i][1] - E[i - 1][1]));
        const shift = (1 - natoP) * cum[cum.length - 1]; let j = 1;
        for (let i = 0; i < n; i++) { const a = Math.max(0, cum[i + 1] - shift); while (j < E.length - 1 && cum[j] < a) j++; const t = cum[j] > cum[j - 1] ? clamp((a - cum[j - 1]) / (cum[j] - cum[j - 1]), 0, 1) : 0; out[n - 1 - i] = [lerp(E[j - 1][0], E[j][0], t), lerp(E[j - 1][1], E[j][1], t)]; } }
      return out; };
    const geo = ribbonGeo(loop(0), () => st.w[0], () => st.th[0], 1, null, true), m = steel2(geo, [st.mat, st.mat, st.matEnd], g); m.frustumCulled = false; m.castShadow = false; st.natoMesh = m; st.thread = (lift) => { st.path = loop(lift); ribbonGeo(st.path, () => st.w[0], () => st.th[0], 1, geo, true); natoHard(st, false); }; st.loop = loop; st.geo = geo;
    /* its hardware, on the end at twelve (the end that never passes under the bars): a steel pin buckle with the webbing turned round its bar, and two flat steel keepers behind it */
    { const hw = st.hw = { parts: [], keeps: [] }, pt = (x) => { hw.parts.push({ m: x, sol: mNatoSt, gho: mNatoStG, g: false, c: (x.geometry.boundingSphere || (x.geometry.computeBoundingSphere(), x.geometry.boundingSphere)).center, rad: x.geometry.boundingSphere.radius }); return x; };
      const b = hw.buck = gBuckle.clone(true); b.children.slice().forEach((ch) => { if (ch.isMesh && ch.material === STRAPS.consulting.ml) b.remove(ch); }); b.traverse((x) => { if (x.isMesh) { x.material = mNatoSt; x.castShadow = false; pt(x); } }); b.scale.x = 1.27; m.add(b);
      const fold = hw.fold = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 19.7 / 1.27, 16).rotateZ(Math.PI / 2), st.matEnd); b.add(fold);
      const hw2 = 10.25, b0 = -0.85, b1 = 2.35, t = 0.9, sh = new THREE.Shape(), rr = (P, x0, y0, x1, y1, r) => { P.moveTo(x0 + r, y0); P.lineTo(x1 - r, y0); P.quadraticCurveTo(x1, y0, x1, y0 + r); P.lineTo(x1, y1 - r); P.quadraticCurveTo(x1, y1, x1 - r, y1); P.lineTo(x0 + r, y1); P.quadraticCurveTo(x0, y1, x0, y1 - r); P.lineTo(x0, y0 + r); P.quadraticCurveTo(x0, y0, x0 + r, y0); };
      rr(sh, -hw2 - t, b0 - t, hw2 + t, b1 + t, 1.1); const ho = new THREE.Path(); rr(ho, -hw2, b0, hw2, b1, 0.5); sh.holes.push(ho);
      const kg = new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1, curveSegments: 5 }); kg.translate(0, 0, -1.1); kg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)));
      [7, 15].forEach((d) => { const k = pt(new THREE.Mesh(kg, mNatoSt)); m.add(k); hw.keeps.push({ m: k, d }); }); st.matG = [st.mat, st.matEnd].map((x) => { const g2 = ghostPatch(x.clone()); g2.userData = { src: x }; g2.transparent = true; return g2; }); }
    return { sy, obj: g, update(c, lift) { seat(lift); st.cs[1] = c; } }; }
  const geo = ribbonGeo(strapCenter(st.rest, 0), w, th, sy), m = steel2(geo, [st.mat, sy > 0 ? st.matBack : st.matBackM, st.matEnd], g); m.frustumCulled = false; m.castShadow = false;   // a domed sheet shadowing itself only makes acne; the case still shades it
  const tr = st.th[0] * 0.47, tube = add(g, uvMap(new THREE.CylinderGeometry(tr, tr, st.w[0] - 0.1, 20).rotateZ(Math.PI / 2), (u, v) => [v, (0.25 + 2.2 * Math.abs(2 * u - 1)) / 19.7]), st.mat);   // the strap end folded round its spring bar, in the clean leather above the seam
  return { sy, obj: g, update(c, lift) { seat(lift); tube.position.set(0, sy * (c[0][0] + 0.25), c[0][1]); ribbonGeo(c, w, th, sy, geo); } };
}
Object.values(STRAPS).forEach((st) => { st.objs = [1, -1].map((sy) => { const o = makeStrap(st, sy); o.obj.visible = false; return o; }); });
const BRT0 = brCopy(BRWP), BRB0 = BRSH.pts.map((p) => p.slice());
/* every frame, the bracelet's ghost: eased on while it is worn; a piece that may lie over the back takes its ghost twin, with a margin each way so none flickers between the two, and casts no shadow on the back */
const brV = new THREE.Vector3(), brMi = new THREE.Matrix4();
/* the buckle and the keepers ride on the webbing's last rows, whichever way it is being laid: flat in the watch's own section (st.path), or row by row through space (the rows ribbon3 keeps) */
const nhM = new THREE.Matrix4(), nhT = new THREE.Vector3();
function natoHard(st, rows3) { const hw = st.hw; if (!hw) return; const n = rows3 ? NT.rows.length : st.path.length;
  const put = (obj, d, sx) => { const i = clamp(n - 1 - Math.round(d / SSTEP), 1, n - 1);
    if (rows3) { const R = NT.rows, r = R[i]; nhT.subVectors(R[Math.min(n - 1, i + 1)].p, R[i - 1].p).normalize(); nhM.makeBasis(r.x, nhT, r.n); obj.quaternion.setFromRotationMatrix(nhM); obj.position.copy(r.p); obj.scale.set(sx * NT.rG[i], NT.rG[i], NT.rG[i]); }
    else { const P = st.path, a = P[i - 1], b = P[Math.min(n - 1, i + 1)], p = P[i]; obj.position.set(0, p[0], p[1]); obj.rotation.set(Math.atan2(b[1] - a[1], b[0] - a[0]), 0, 0); obj.scale.set(sx, 1, 1); } };
  put(hw.buck, 0, 1.27); hw.keeps.forEach((K) => put(K.m, K.d, 1)); }
function braceTick(dt) { const o = STRAPS.engineering.objs[0], U = GHU.uGhP.value, sn = STRAPS.writing, wornB = o.onW && o.obj.parent === gStrap && o.obj.visible && LAY.strap.o > 0.01, wornN = strapNow === 'writing' && LAY.strap.o > 0.01 && (!RAIL || RS.writing.state === 'worn'), worn = wornB || wornN;
  U.x += ((worn ? 1 : 0) - U.x) * (snap ? 1 : 1 - Math.exp(-dt * 5)); if (U.x < 0.002) U.x = 0;
  gStrap.updateWorldMatrix(true, false); brMi.copy(gStrap.matrixWorld).invert(); GHU.uGhM.value.copy(brMi); const C = GHU.uGhC.value.copy(camera.position).applyMatrix4(brMi);
  const each = (parts, back) => { for (const P of parts) { let v = 0; if (back) { P.m.localToWorld(brV.copy(P.c)).applyMatrix4(brMi); const dz = brV.z - C.z; if (brV.z < ZBACK + 1 + P.rad && dz > 1e-3) { const t = (ZBACK - C.z) / dz, r = Math.hypot(C.x + (brV.x - C.x) * t, C.y + (brV.y - C.y) * t) - P.rad * Math.max(1, t); v = (1 - sSmooth((r - 19) / 8)) * sSmooth((ZBACK - C.z) / brV.distanceTo(C) / 0.12) * U.x; } }   /* the nearest the piece could come to the back's middle, seen along the line of sight */
    const g = P.g ? v > 0.004 : v > 0.015; if (g !== P.g) { P.g = g; P.m.material = g ? P.gho : P.sol; P.m.castShadow = !g && parts === o.parts; } } };
  each(o.parts, wornB && U.x > 0 && C.z < ZBACK); if (!sn.hw) return; const backN = wornN && U.x > 0 && C.z < ZBACK - 0.5; each(sn.hw.parts, backN);
  /* the webbing is one piece: seen from behind it wears its twin whole, which thins only where the line of sight lands on the back */
  const mesh = sn.natoMesh; if (backN !== !!sn.gOn) { sn.gOn = backN; mesh.material = backN ? [sn.matG[0], sn.matG[0], sn.matG[1]] : [sn.mat, sn.mat, sn.matEnd]; sn.hw.fold.material = backN ? sn.matG[1] : sn.matEnd; }
  if (backN) sn.matG.forEach((g) => { const x = g.userData.src; g.opacity = LAY.strap.o; g.depthWrite = true; if (g.map !== x.map) { g.map = x.map; g.normalMap = x.normalMap; g.roughnessMap = x.roughnessMap; g.needsUpdate = true; } g.color.copy(x.color); }); }
seed = 77;   // leave the shared random sequence where the dial expects it
dress(STRAPS.consulting); { const rest = Object.values(STRAPS), idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 2000 }) : (f) => setTimeout(f, 250), next = () => { if (intro.on || jump || performance.now() - (window.__act || 0) < 3000) { setTimeout(next, 700); return; } const st = rest.find((q) => q.maps && !q.dressed); if (st) { dress(st); idle(next); } }; setTimeout(() => idle(next), 1200); }
let pendTint = null, tintHold = false, strapNow = 'consulting', strapNext = null, swapT = -1, swapHold = false; STRAPS[strapNow].objs.forEach((o) => { o.obj.visible = true; });
/* the leather takes a new colour only when the strap tool has it off the watch: a dial that brings its own leather asks for it here, and the swap fits it */
function tintNow() { if (pendTint == null) return; const sc = STRAPS.consulting; sc.mat.color.setHex(pendTint); sc.matEnd.color.setHex(pendTint); pendTint = null; }
function retint(hex) { const sc = STRAPS.consulting; pendTint = sc.mat.color.getHex() === hex ? null : hex; if (pendTint == null) return; if (RAIL && !snap && railOff('consulting')) return;   /* hanging on the rail, the leather eases to its new colour there */ if (snap || !wayFlash || document.body.classList.contains('intro') || strapNow !== 'consulting') { tintNow(); return; } if (!tintHold) setStrap('consulting'); }
function showStrap(k) { if (RAIL) { railShow(k); return; } tintNow(); dress(STRAPS[k]); if (strapNow === 'consulting' && upGone && k !== 'consulting' && !snap) strapFall(STRAPS.consulting.objs.map((o) => o.obj), 0); STRAPS[strapNow].objs.forEach((o) => { o.obj.visible = false; }); strapNow = k; STRAPS[k].objs.forEach((o) => { o.obj.visible = true; }); const S0 = STRAPS[k]; if (S0.len) { const bg = S0.objs[0].obj; bg.add(gBuckle); cKeep.forEach((K) => bg.add(K.m)); } SIDES.forEach((S, i) => { S.turn = S0.rests ? S0.rests[i] : S0.rest; S.v = 0; }); }
/* ----- once the recycled dial is unlocked, the consulting strap is the recycled bottle webbing for the rest of the visit, whatever dial is chosen later. The navy suede it replaces is never seen
   again: it falls away from wherever it is (the watch, its place on the display, or the air), and the webbing takes its place there ----- */
let upGone = false;
/* a strap that is done with drops: a copy of it, exactly as it is that moment, falls under its own weight with a slow tumble round its own middle and is gone below the page.
   push is a little throw, in screen heights a second. The fall keeps its own clock (fallHold stops it, for tests) */
const FALL = [], fBox = new THREE.Box3(), fB2 = new THREE.Box3(), fC = new THREE.Vector3(); let fallHold = false;
function strapFall(objs, push) { objs.forEach((o, i) => { if (!o.visible || !o.parent) return; o.updateWorldMatrix(true, true); fBox.makeEmpty();
    o.traverseVisible((m) => { if (m.isMesh && !(m.material.opacity === 0)) { m.geometry.computeBoundingBox(); fBox.union(fB2.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)); } }); if (fBox.isEmpty()) return; fBox.getCenter(fC);   /* it turns about the middle of what can be seen of it */
    const ud = []; o.traverse((x) => { if (x.userData.qr) { ud.push([x, x.userData]); x.userData = {}; } }); const pv = new THREE.Group(), c = o.clone(true); ud.forEach(([x, u]) => { x.userData = u; }); scene.add(pv);   /* the release levers' hit spheres point back at themselves: left out of the copy */ pv.position.copy(fC); pv.add(c); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); c.position.sub(fC); pv.userData.railFly = true; o.visible = false;
    if (reduce) { scene.remove(pv); return; }
    FALL.push({ pv, t: 0, p0: fC.clone(), v: [(i ? -0.05 : 0.05) + (push || 0) * 0.3, 0.12 + (push || 0) * 0.05, (push || 0) * 0.3], ax: new THREE.Vector3(0.35 + 0.3 * i, 0.2, 1).normalize(), w: (i ? -1 : 1) * 1.9 }); }); }
function fallTick(dt) { if (!FALL.length) return; const vh = 2 * camera.position.z * Math.tan(rad(camera.fov / 2));
  for (let i = FALL.length - 1; i >= 0; i--) { const F = FALL[i]; if (!fallHold) F.t += dt; const t = F.t;
    F.pv.position.set(F.p0.x + F.v[0] * vh * t, F.p0.y + F.v[1] * vh * t - 1.8 * vh * t * t, F.p0.z + F.v[2] * vh * t); F.pv.quaternion.setFromAxisAngle(F.ax, F.w * t * (1 + 0.6 * t));
    if (t > 2.2 || F.pv.position.y < -0.9 * vh - 40) { scene.remove(F.pv); FALL.splice(i, 1); } } }
/* the dial has just been unlocked: the webbing becomes the consulting strap, and the suede goes from the display or from the air now (from the watch, when the swap takes it off) */
function upReplace() { if (upGone) return; upGone = true; const sw = STRAPS.upcycle; dress(sw); if (sw.mats && !sw.km && cKeep.length) keepMat(sw, KEEPS.upcycle);
  if (strapNext === 'consulting') strapNext = 'upcycle';
  if (!RAIL || !RS.consulting) return; const R = RS.consulting; railVis(RS.upcycle);
  if (R.state === 'worn') return;
  const wasIn = rs.inK === 'consulting'; strapFall(R.halves.map((H) => H.o.obj), R.state === 'hang' ? 0.25 : 0); R.halves.forEach((H) => { H.tr = null; }); R.state = 'gone'; railVis(R); rl.opDirty = true;
  if (wasIn) { rs.inK = 'upcycle'; const U = RS.upcycle, T = Math.max(0, swapT);   /* the suede was on its way to the watch: the webbing goes instead */
    railFly('upcycle', 'watch', T, 0); rs.arrAt = T + 0.9; rs.toolIn = rs.arrAt - 0.28; } }
/* everything that happens once the recycled dial is won: its swatch, the webbing in for the suede, the dial; a beat later the webbing goes on the watch (whatever the dial by then, if the suede was on it) */
function upUnlocked(bt, animate) { WAYS.upcycle.dotCss = DIALS.upcycle.css(bt); WAYS.upcycle.name = 'Upcycled plastic, ' + bt.name.toLowerCase(); unlockUpcycle(animate); upReplace(); tintHold = true; pickWay('upcycle'); tintHold = false;
  setTimeout(() => { if (strapNow === 'consulting' || way === 'upcycle') pickStrap('consulting'); }, 1700); }
function setStrap(k) { if (RAIL && railSet(k)) return; if (k === strapNow && pendTint == null) { strapNext = null; return; } if (snap) { showStrap(k); return; } strapNext = k; if (swapT < 0) swapT = 0; }
const SIDES = [1, -1].map((sy) => ({ sy, turn: STRAPS.consulting.rests[sy > 0 ? 0 : 1], v: 0, wob: 0, wv: 0, c: null }));
/* quick release: every leather and sailcloth half hangs on a spring bar with a little lever that shows through a slot in the lining by the lug. Flick it and that half drops off the watch; a moment later it is clicked back on.
   Built the way the real ones are: a narrow window, 1.1 by 4.5 mm with round ends (the size a 1 x 4.5 mm strap notching punch cuts), is let through the lining over the bar's tunnel. Its cut edge is painted and burnished, standing a hair proud,
   and the leather round it is pressed a shade darker. Down in it lies a sliver of the polished 1.5 mm tube of the spring bar, slotted along its top, and out of that slot rises the release pin, a polished steel peg with a domed head.
   Pushed, the pin slides 2 mm along the window toward the middle of the strap, pulling the bar's tip in; when the half is clicked back on it springs home.
   The window is a portal: whatever lies below the lining is drawn only where the line of sight passes through the cut, and is depth-tested as if it lay on the lining, so it reads as a real hole with depth without cutting the strap mesh */
const QR = [], qrRay = new THREE.Raycaster(), qrV = new THREE.Vector2(), qrN = new THREE.Vector3(), qrP = new THREE.Vector3();
const QRS = { xc: 5.0, a: 2.25, b: 0.55, lip: 0.045, rim: 0.15, depth: 1.9, tr: 0.76, ty: -0.96, pr: 0.32, x0: 6.7, run: 1.95, at: 1.9 };   // mm, in the frame of the window: x across the strap, y out of the lining, z along the strap
{ const S = QRS, sU = { value: new THREE.Vector4(S.xc, S.a - S.b, S.b, 0.012) }, gx0 = S.x0 - S.run - S.pr - 0.04, gx1 = S.x0 + S.pr + 0.04, gU = { value: new THREE.Vector4((gx0 + gx1) / 2, (gx1 - gx0) / 2 - (S.pr + 0.025), S.pr + 0.025, 0) };
  const tU = (clip) => ({ value: new THREE.Vector4(0, S.ty, S.tr, clip ? 1 : 0) }), tClip = tU(true), tOpen = tU(false);
  /* below the lining: keep only what is seen through the window and inside its walls (and, for the pin, outside the tube), and give it the depth of the point where the sight line crosses the lining */
  const FRAG = `#include <clipping_planes_fragment>
float qrD = gl_FragCoord.z, qrAO = 1.0;
if (vSl.y < 0.0) { vec3 qd = vSl - vCam; if (vCam.y <= uS.w || qd.y >= 0.0) discard; float qt = (uS.w - vCam.y) / qd.y; vec3 qh = vCam + qt * qd;
  float qe = max(abs(qh.x - uS.x) - uS.y, 0.0); if (qe * qe + qh.z * qh.z > uS.z * uS.z) discard;
  float qf = max(abs(vSl.x - uS.x) - uS.y, 0.0); if (qf * qf + vSl.z * vSl.z > (uS.z + 0.02) * (uS.z + 0.02)) discard;
  float qy = vSl.y - uT.y; if (uT.w > 0.5 && qy * qy + vSl.z * vSl.z < uT.z * uT.z) discard;
  vec4 qc = projectionMatrix * vec4(-vViewPosition * qt, 1.0); qrD = qc.z / qc.w * 0.5 + 0.5; }
gl_FragDepth = qrD;`;
  const SHADE = `#include <metalnessmap_fragment>
#ifdef QR_TUBE
{ qrAO *= mix(0.65, 1.0, smoothstep(uT.y, uT.y + 0.9 * uT.z, vSl.y));
  float we = max(abs(vSl.x - uS.x) - uS.y, 0.0), wd = uS.z - sqrt(we * we + vSl.z * vSl.z); qrAO *= mix(0.35, 1.0, 1.0 - (1.0 - smoothstep(0.0, 0.25, wd)) * smoothstep(0.3, 0.6, -vSl.y));
  float ge = max(abs(vSl.x - uG.x) - uG.y, 0.0), g2 = ge * ge + vSl.z * vSl.z, gs = (1.0 - smoothstep(uG.z * uG.z * 0.82, uG.z * uG.z, g2)) * step(uT.y, vSl.y);
  diffuseColor.rgb *= mix(1.0, 0.03, gs); roughnessFactor = mix(roughnessFactor, 0.85, gs); qrAO *= mix(1.0, 0.12, gs); }
#endif
#ifdef QR_PIN
qrAO *= mix(0.3, 1.0, smoothstep(uT.y + uT.z, 0.04, vSl.y));
#endif`;
  const portal = (mat, def, clip) => { const U = { uOff: { value: new THREE.Vector3() }, uS: sU, uG: gU, uT: clip ? tClip : tOpen }; mat.defines = Object.assign({}, mat.defines, def); mat.userData.U = U; mat.customProgramCacheKey = () => 'qrPortal';
    mat.onBeforeCompile = (s) => { Object.assign(s.uniforms, U);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uOff; varying vec3 vSl; varying vec3 vCam;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSl = transformed + uOff; vCam = (inverse(modelViewMatrix) * vec4(0.0, 0.0, 0.0, 1.0)).xyz + uOff;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uS; uniform vec4 uG; uniform vec4 uT; varying vec3 vSl; varying vec3 vCam;\n#ifndef USE_TRANSMISSION\nuniform mat4 projectionMatrix;\n#endif').replace('#include <clipping_planes_fragment>', FRAG).replace('#include <metalnessmap_fragment>', SHADE).replace('#include <opaque_fragment>', 'outgoingLight *= qrAO;\n#include <opaque_fragment>'); }; return mat; };
  /* a stadium (the window's outline) grown by r, as [x, z] points round the loop */
  const stad = (r, n = 9) => { const h = S.a - S.b, p = []; for (let k = 0; k <= n; k++) { const t = -Math.PI / 2 + Math.PI * k / n; p.push([S.xc + h + r * Math.cos(t), r * Math.sin(t)]); } for (let k = 0; k <= n; k++) { const t = Math.PI / 2 + Math.PI * k / n; p.push([S.xc - h + r * Math.cos(t), r * Math.sin(t)]); } return p; };
  /* rings of [grow, y, shade, alpha] stitched into a closed band; with a floor fan if asked */
  const band = (rings, floor) => { const pos = [], col = [], idx = [], L = stad(0).length; rings.forEach(([r, y, c, a]) => stad(r).forEach(([x, z]) => { pos.push(x, y, z); col.push(c, c, c, a); }));
    for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < L; k++) { const a = j * L + k, b = j * L + (k + 1) % L, c = a + L, d = b + L; idx.push(a, c, b, b, c, d); }
    if (floor) { const o = pos.length / 3, [r, y, c] = rings[rings.length - 1]; pos.push(S.xc, y, 0); col.push(c, c, c, 1); stad(r).forEach(([x, z]) => { pos.push(x, y, z); col.push(c, c, c, 1); }); for (let k = 0; k < L; k++) idx.push(o, o + 1 + k, o + 1 + (k + 1) % L); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const gWell = band([[S.b, S.lip, 1, 1], [S.b, -0.04, 0.6, 1], [S.b, -0.18, 0.26, 1], [S.b, -0.5, 0.08, 1], [S.b, -S.depth, 0.025, 1]], true);   // the cut walls: painted edge, then the leather's core, then dark
  const gRim = band([[S.b, S.lip, 1, 1], [S.b + 0.045, S.lip * 0.88, 1, 1], [S.b + 0.095, S.lip * 0.5, 1, 1], [S.b + S.rim, 0, 1, 1]]);   // the burnished lip, rounded over
  const gHalo = band([[S.b + S.rim - 0.02, 0, 1, 0.42], [S.b + S.rim + 0.18, 0, 1, 0.2], [S.b + S.rim + 0.5, 0, 1, 0]]);   // the lining pressed and darkened round the cut
  const gTube = new THREE.CylinderGeometry(S.tr, S.tr, 2 * S.a + 0.6, 28, 1, true).rotateZ(Math.PI / 2).translate(S.xc, S.ty, 0);
  const gPin = new THREE.LatheGeometry([[0.001, -0.95], [S.pr, -0.95], [S.pr, 0.2], [S.pr - 0.005, 0.27], [S.pr - 0.03, 0.33], [S.pr - 0.08, 0.38], [S.pr - 0.16, 0.412], [S.pr - 0.26, 0.428], [0, 0.432]].map((p) => new THREE.Vector2(p[0], p[1])), 24);
  const gHit = new THREE.SphereGeometry(3.4, 8, 6), mHit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const mTube = portal(M('strap', { color: 0xeceef0, metalness: 1, roughness: 0.24, envMapIntensity: 2.2 }), { QR_TUBE: "" }, false);
  Object.keys(STRAPS).forEach((k) => { const st = STRAPS[k]; if (!st.len) return;
    const calf = st.back === 0xffffff, ec = calf ? new THREE.Color(0x2e1d12) : new THREE.Color(st.back).multiplyScalar(0.36), D = THREE.DoubleSide;   /* edge paint: dark brown on the tan calf lining, near black on the grey ones */
    const mWell = portal(M('strap', { color: ec, vertexColors: true, metalness: 0, roughness: 0.75, envMapIntensity: 0.35, side: D }), {}, false), mRim = M('strap', { color: ec, metalness: 0, roughness: calf ? 0.45 : 0.85, envMapIntensity: calf ? 0.5 : 0.2, side: D, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const mHalo = M('strap', { color: ec, vertexColors: true, transparent: true, depthWrite: false, metalness: 0, roughness: calf ? 0.6 : 0.85, envMapIntensity: 0.4, side: D, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6 });
    st.objs.forEach((o, i) => { const piv = new THREE.Group(); o.obj.add(piv);
      const mPin = portal(M('strap', { color: 0xe8eaec, metalness: 1, roughness: 0.08, envMapIntensity: 1.4 }), { QR_PIN: '' }, true), U = mPin.userData.U;
      const mk = (g, m, ro) => { const x = new THREE.Mesh(g, m); x.renderOrder = ro; x.castShadow = false; x.receiveShadow = true; piv.add(x); return x; };
      mk(gWell, mWell, 5); mk(gTube, mTube, 6); mk(gRim, mRim, 0); mk(gHalo, mHalo, 1); const pin = mk(gPin, mPin, 7), hit = new THREE.Mesh(gHit, mHit); pin.position.x = U.uOff.value.x = S.x0; hit.position.set(S.xc, 0, 0); piv.add(hit);
      const q = { k, i, o, piv, knob: pin, pin, U, hit, t: -1, p: new THREE.Vector3(), v: new THREE.Vector3() }; hit.userData.qr = q; QR.push(q); const up = o.update, hi = o.sy > 0 ? 0 : 1;
      /* sit the window on the lining exactly as the strap mesh lays it: between its first rows, each pushed off the centre line by half the strap's thickness there */
      o.update = (c, lift) => { up(c, lift); const j = Math.floor(S.at), f = S.at - j, h1 = cTh(hi, j) / 2, h2 = cTh(hi, j + 1) / 2;
        let ay = c[j + 1][0] - c[j - 1][0], az = c[j + 1][1] - c[j - 1][1], l = Math.hypot(ay, az) || 1; const n1y = -az / l, n1z = ay / l; ay = c[j + 2][0] - c[j][0]; az = c[j + 2][1] - c[j][1]; l = Math.hypot(ay, az) || 1; const n2y = -az / l, n2z = ay / l;   /* the normals of rows j and j + 1, worked out as ribbonGeo does */
        const ly = lerp(c[j][0] - n1y * h1, c[j + 1][0] - n2y * h2, f), lz = lerp(c[j][1] - n1z * h1, c[j + 1][1] - n2z * h2, f), my = -lerp(n1y, n2y, f), mz = -lerp(n1z, n2z, f);
        piv.position.set(0, o.sy * ly, lz); piv.rotation.x = Math.atan2(mz, o.sy * my); }; }); }); }
function qrPick(e) { if (intro.on || focus || swapT >= 0 || !STRAPS[strapNow].len) return false; const r = canvas.getBoundingClientRect(); qrV.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2); qrRay.setFromCamera(qrV, camera); root.updateMatrixWorld(true);
  const hits = qrRay.intersectObjects(QR.filter((q) => q.k === strapNow && q.t < 0).map((q) => q.hit), false); for (const h of hits) { const q = h.object.userData.qr; q.piv.getWorldPosition(qrP); qrN.set(0, 1, 0).transformDirection(q.piv.matrixWorld); if (qrN.dot(qrP.sub(camera.position)) < 0) { q.t = 0; q.p.set(0, 0, 0); q.v.set((q.i ? -1 : 1) * 5, q.o.sy * HEAD[0] * 22, HEAD[1] * 22); ping({ f: 2600, q: 3, dur: 0.03, vol: 0.16, sharp: 5 }); ping({ when: 0.09, f: 900, q: 1.6, dur: 0.06, vol: 0.12, sharp: 3 }); buzz(12, true); return true; } } return false; }
function qrTick(dt) { for (const q of QR) { if (q.t < 0) continue; q.t += dt; const g = q.o.obj, on = q.k === strapNow; let s = sSmooth(q.t / 0.1);
    if (q.t > 0.1 && q.t < 2.0) { q.v.addScaledVector(gv, 760 * dt); q.p.addScaledVector(q.v, dt);
      /* the loose half cannot pass through the watch: wherever it meets the case it is pushed out the nearest way (over the back, over the glass or off the flank), loses most of that speed and slides on */
      const c = SIDES[q.i].c; if (c) for (let pass = 0; pass < 2; pass++) for (let j = 0; j < c.length; j += 2) { const y = q.o.sy * c[j][0] + q.p.y, z = c[j][1] + q.p.z, hw = 9, r = Math.hypot(Math.max(0, Math.abs(q.p.x) - hw), y), R = 20.6, zb = ZBACK - 1.2, zt = ZTOP + 1.2; if (r >= R || z <= zb || z >= zt) continue;
        const pr = R - r, pb = z - zb, pt = zt - z; if (pb <= pr && pb <= pt) { q.p.z -= pb; if (q.v.z > 0) q.v.z *= -0.35; q.v.x *= 0.96; q.v.y *= 0.96; } else if (pt <= pr) { q.p.z += pt; if (q.v.z < 0) q.v.z *= -0.35; q.v.x *= 0.96; q.v.y *= 0.96; } else { const s = Math.sign(y) || q.o.sy; q.p.y += s * pr; if (q.v.y * s < 0) q.v.y *= -0.35; } } }
    else if (q.t >= 2.0 && q.t < 3.1) { if (on) g.visible = false; }
    else if (q.t >= 3.1 && q.t < 3.6) { if (on) g.visible = true; const e = 1 - sSmooth((q.t - 3.1) / 0.5); q.p.set(0, q.o.sy * HEAD[0] * 18 * e, HEAD[1] * 18 * e); s = 1 - sSmooth((q.t - 3.53) / 0.07); }   /* the pin springs home as the bar snaps into the lug */
    else if (q.t >= 3.6) { q.t = -1; q.p.set(0, 0, 0); s = 0; if (on) { g.visible = true; ping({ f: 3000, q: 3, dur: 0.03, vol: 0.14, sharp: 5 }); } }
    g.position.copy(q.p); q.pin.position.x = q.U.uOff.value.x = QRS.x0 - QRS.run * s; } }
function strapPhysics(dt, lift, extra) { braceTick(dt); fallTick(dt);
  if (RAIL && railBare()) { qrTick(dt); return; }   // between straps the watch wears nothing: the rail moves them
  const st = STRAPS[strapNow], n = 3, h = dt / n, cal = !!st.len, box = cal && ubk.on;
  if (st.links) { const o = st.objs[0], was = BCL.cl;   /* the bracelet shuts once both end links are on their bars, and opens before they come off */
    if (!RAIL || snap) BCL.clTo = 1; else if (swapT < 0 || (rs.inK === 'engineering' && rs.arr >= 0 && swapT >= rs.arr + 0.4)) BCL.clTo = 1;
    BCL.cl = BCL.hold != null ? BCL.hold : snap || !RAIL ? BCL.clTo : BCL.cl + clamp(BCL.clTo - BCL.cl, -dt / 0.75, dt / 1.15);
    o.onW = true; o.update(brClose(BCL.cl, lift, BCL.c), lift); o.fl = BCL.fl; if (was < 0.985 && BCL.cl >= 0.985 && !snap && RAIL) ping({ f: 4300, q: 5, dur: 0.015, vol: 0.07, sharp: 6, ring: 6200, ringVol: 0.16, ringDur: 0.03 }); qrTick(dt); return; }   /* the bracelet is shut round the wrist: it keeps its shape, and drops away from the case as the bars are drawn */
  SIDES.forEach((S, i) => { const up = st.under && natoP < 0.999 && S.sy > 0, fl = up ? -1 : 1, gu = fl * S.sy * gv.y, gz = fl * gv.z, mag = Math.min(1, Math.hypot(gu, gz)); let dg = Math.atan2(gz, gu) - TH0; dg = ((dg + Math.PI) % TAU + TAU) % TAU - Math.PI; dg = clamp(dg, rad(-170), rad(up ? 130 : 36));
    const target = lerp(cal ? st.rests[i] : st.rest, dg, (up ? 1 : st.droop) * mag) + extra;
    /* while the webbing is being fed in, its tail is held up above the watch; let go, it falls. Buckled in the box, the free curve just waits at rest */
    if (box && ubk.u < CALF.uc) { S.turn = target; S.v = 0; S.wob = 0; S.wv = 0; }
    else for (let q = 0; q < n; q++) { const a = st.k * (target - S.turn) - st.c * S.v; S.v += a * h; S.turn += S.v * h; const wa = 120 * (-S.v * 0.03 - S.wob) - 9 * S.wv; S.wv += wa * h; S.wob = clamp(S.wob + S.wv * h, -0.45, 0.45); }
    S.c = box ? cPt[i] : strapCenter(S.turn, S.wob, lift, st.dz || 0, st.dy || 0, cal ? CALF.n[i] : st.sn ? st.sn[i] : SN, cal ? CALF.L[i] / CALF.n[i] : SSTEP); });
  if (box) cIntro(SIDES);
  SIDES.forEach((S, i) => st.objs[i].update(S.c, lift)); qrTick(dt);
  if (cal) { st.mats[1].color.copy(st.mat.color); st.ml.roughness = st.nap ? 0.95 : 0.52; if (st.nap) st.mats.forEach((m) => napSheen(m.sheenColor, st.mat.color)); if (strapNow === 'consulting' || strapNow === 'upcycle') st.ml.color.copy(st.mat.color).multiplyScalar(0.6); else st.ml.color.setHex(st.base).multiplyScalar(0.8); keepTick(st); cBuckle(dt, SIDES[0].c, box, !snap); }
}
/* the spring bar tool: a knurled handle, a slim shaft and a 0.8 mm pin that goes into the drilled lug */
const gTool = new THREE.Group(); gTool.visible = false; root.add(gTool);
{ const ms = new THREE.MeshStandardMaterial({ color: STEEL, metalness: 1, roughness: 0.16 }), mk = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.85, roughness: 0.42, bumpMap: frost, bumpScale: 1.2 });
  const seg = (r0, r1, x0, x1, m) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, x1 - x0, 28).rotateZ(-Math.PI / 2), m); c.position.x = (x0 + x1) / 2; c.castShadow = true; gTool.add(c); };
  seg(0.38, 0.38, 0, 4, ms); seg(0.38, 1.3, 4, 7, ms); seg(1.3, 1.3, 7, 30, ms); seg(1.3, 2.9, 30, 33, mk); seg(2.9, 2.9, 33, 88, mk); for (let i = 0; i < 6; i++) seg(3.05, 3.05, 37 + i * 8, 38.2 + i * 8, ms); seg(2.9, 2.2, 88, 90, ms); }
const TOOL0 = new THREE.Vector3(13.5, LH[0], LH[1]), TOOLA = new THREE.Vector3(60, 8, 34);
function toolPose(T) { let a = 0, push = 0; if (T < 0.28) { const x = 1 - T / 0.28; a = x * x * x; } else if (T < 0.46) push = Math.sin(Math.PI * clamp((T - 0.28) / 0.16, 0, 1)); else { const x = clamp((T - 0.46) / 0.3, 0, 1); a = x * x; }
  gTool.visible = T < 0.76; gTool.position.copy(TOOL0).addScaledVector(TOOLA, a); gTool.position.x -= push * 1.1; }
/* keepers, made the way real ones are: a strip of the strap's own material wrapped round once, its two ends skived thin and lapped under the strap, glued, and sewn through
   with a short row in the strap's own thread. The cut edges are painted like the strap's own (sealed and painted on the sailcloth, sealed on the webbing).
   One texture runs round the loop: u from the joint, once round (0 to 1), v across the keeper's face; the cut edges read a band of edge paint below the face.
   KV gives that texture's rows: the face, where the edge band starts, the edge band, and the whole height */
function KV() { return [118, 122, 36, 160]; }
function keepUV(g, hw, b0, b1, t, wd) { const [FH, E0, EH, KH] = KV(), X = hw + t / 2, Y0 = b0 - t / 2, Y1 = b1 + t / 2, rc = 1.15, ax = X - rc, a0 = Y0 + rc, a1 = Y1 - rc, H = a1 - a0, q = rc * Math.PI / 2, xj = 2.2, SA = ax - xj, P = 4 * ax + 2 * H + 4 * q;
  /* distance round the loop's midline, from the joint (on the underside, a little off centre) going toward +x */
  const sOf = (x, y) => { if (Math.abs(x) <= ax) return y < (Y0 + Y1) / 2 ? (x - xj + P) % P : SA + 2 * q + H + ax - x;
    if (y >= a0 && y <= a1) return x > 0 ? SA + q + y - a0 : SA + 3 * q + H + 2 * ax + a1 - y;
    const a = Math.atan2(y - (y < a0 ? a0 : a1), x - (x > 0 ? ax : -ax));
    return x > 0 ? (y < a0 ? SA + rc * (a + Math.PI / 2) : SA + q + H + rc * a) : (y > a1 ? SA + 2 * q + H + 2 * ax + rc * (a - Math.PI / 2) : SA + 3 * q + 2 * H + 2 * ax + rc * (a + Math.PI)); };
  const dOf = (x, y) => { if (Math.abs(x) <= ax) return y < (Y0 + Y1) / 2 ? Y0 - y : y - Y1; if (y >= a0 && y <= a1) return Math.abs(x) - X; return Math.hypot(x - Math.sign(x) * ax, y - (y < a0 ? a0 : a1)) - rc; };
  const p = g.attributes.position, uv = g.attributes.uv, lid = g.groups[0].count, s = [0, 0, 0];
  for (let i = 0; i < p.count; i += 3) { for (let k = 0; k < 3; k++) s[k] = sOf(p.getX(i + k), p.getY(i + k)); const wrap = Math.max(s[0], s[1], s[2]) - Math.min(s[0], s[1], s[2]) > P / 2;   /* a triangle across the joint: unwrap it */
    for (let k = 0; k < 3; k++) { const j = i + k; uv.setXY(j, (wrap && s[k] < P / 2 ? s[k] + P : s[k]) / P, j < lid ? (E0 + (clamp(dOf(p.getX(j), p.getY(j)) / 1.5, -0.5, 0.5) + 0.5) * EH) / KH : clamp((p.getZ(j) + 0.25) / wd, 0, 1) * (FH - 1) / KH); } }
  g.userData.keep = { P }; return g; }
/* what each strap's keepers are cut from: the same recipe as the strap's own bake, at the same scale. edge is the edge paint, as the strap's own edges show it */
const KEEPS = { consulting: { kind: 'suede', thread: '#e4e4e4', shade: 0.9, proud: 0.9, edge: [182, 182, 182], eRo: 0.82 },
  banking: { kind: 'leather', thread: '#d2c19c', shade: 1, proud: 1, base: [112, 62, 33], hi: [158, 99, 56], edge: [67, 36, 18], eRo: 0.5 },
  quant: { kind: 'sail', thread: '#b4b7bc', shade: 1, proud: 1, base: [102, 106, 112], edge: [60, 62, 67], eRo: 0.55 },
  upcycle: { kind: 'pet', thread: '#dfe4e8', shade: 1, proud: 1, edge: [182, 182, 182], eRo: 0.45 } };
/* one stitch, drawn the way sew draws the strap's: holes, a round thread standing proud, its twist */
function kStitch(gC, gF, gR, a, b, o) { const w = 0.4 * SPX, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, inn = 0.13 * SPX, x0 = a[0] + ux * inn, y0 = a[1] + uy * inn, x1 = b[0] - ux * inn, y1 = b[1] - uy * inn;
  const line = (g, style, lw, of = 0) => { g.strokeStyle = style; g.lineWidth = lw; g.beginPath(); g.moveTo(x0 - uy * of, y0 + ux * of); g.lineTo(x1 - uy * of, y1 + ux * of); g.stroke(); };
  [a, b].forEach((p) => { [[gF, 'rgba(0,0,0,.4)'], [gC, 'rgba(0,0,0,' + 0.3 * o.shade + ')']].forEach(([g, c]) => { g.fillStyle = c; g.beginPath(); g.arc(p[0], p[1], 0.19 * SPX, 0, TAU); g.fill(); }); });
  line(gF, 'rgba(0,0,0,.1)', w * 2.4); line(gC, 'rgba(0,0,0,' + 0.12 * o.shade + ')', w * 2.4);   /* the thread pulls the face down round it, as on the strap */
  [[48, 1], [86, 0.62], [114, 0.26]].forEach(([q, k]) => { const v = Math.round(128 + q * o.proud); line(gF, 'rgb(' + v + ',' + v + ',' + v + ')', w * k); });
  line(gC, o.thread, w); line(gC, 'rgba(40,28,14,' + 0.1 * o.shade + ')', w); line(gC, 'rgba(0,0,0,.16)', w * 0.3, w * 0.36); line(gC, 'rgba(255,255,255,.12)', w * 0.25, -w * 0.2);
  const n = Math.max(2, Math.round(l / (0.34 * SPX))), tx = (ux * Math.cos(1) - uy * Math.sin(1)) * w * 0.5, ty = (ux * Math.sin(1) + uy * Math.cos(1)) * w * 0.5; gC.strokeStyle = 'rgba(0,0,0,.13)'; gC.lineWidth = 1;
  for (let k = 1; k < n; k++) { const cx = lerp(x0, x1, k / n), cy = lerp(y0, y1, k / n); gC.beginPath(); gC.moveTo(cx - tx, cy - ty); gC.lineTo(cx + tx, cy + ty); gC.stroke(); }
  line(gR, '#d4d4d4', w); }
/* bake one keeper strip, P mm round: the face in the strap's own material, the edge paint wrapping over its rounded edges, the lapped joint and its row of stitches */
function keepMaps(o, P) { const [FH, E0, EH, H] = KV(), W = Math.ceil(P * SPX), n = W * H, h = new Float32Array(n), mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cC = mk(), gC = cC.getContext('2d'), iC = gC.createImageData(W, H), cR = mk(), gR = cR.getContext('2d'), iR = gR.createImageData(W, H), cF = mk(), gF = cF.getContext('2d', { willReadFrequently: true }), C = iC.data, R = iR.data, E = o.edge, K = o.kind;
  const QW = (W >> 2) + 2, QH = (FH >> 2) + 2, A1 = new Float32Array(QW * QH), A2 = new Float32Array(QW * QH), AX = new Float32Array(QW * QH), AY = new Float32Array(QW * QH), ca = Math.cos(0.5), sa = Math.sin(0.5), T = K === 'leather' ? grainTile(9, 23) : null;
  for (let qy = 0; qy < QH; qy++) for (let qx = 0; qx < QW; qx++) { const x = qx * 4, y = qy * 4, k = qy * QW + qx;   /* the slow terms on a quarter grid, as the strap bakes do */
    if (K === 'suede') { const wx = 46 * (sNoise(x / 120 + 5, y / 120) - 0.5), wy = 46 * (sNoise(x / 120 + 50, y / 120 + 20) - 0.5), u = (x + wx) * ca + (y + wy) * sa, v = (y + wy) * ca - (x + wx) * sa;
      A1[k] = 0.62 * sSmooth((sFbm(u / 250 + 3, v / 62 + 7, 2) - 0.36) / 0.28) + 0.26 * sSmooth((sFbm(u / 120 + 30, v / 30 + 11, 2) - 0.38) / 0.28) + 0.12 * sSmooth((sNoise(v / 240 + 9, u / 70 + 2) - 0.4) / 0.25); A2[k] = sFbm(x / 170 + 60, y / 170 + 3, 2); }
    else if (T) { A1[k] = sFbm(x / 64, y / 64, 2); A2[k] = sFbm(x / 190 + 40, y / 190, 2); AX[k] = 6 * (sNoise(x / 26, y / 26) - 0.5); AY[k] = 6 * (sNoise(x / 26 + 31, y / 26 + 7) - 0.5); }
    else A1[k] = K === 'sail' ? sFbm(x / 90, y / 90, 2) : sFbm(x / 110, y / 110, 2); }
  const bl = (A, x, y) => { const k = (y >> 2) * QW + (x >> 2), fx = (x & 3) / 4, fy = (y & 3) / 4; return lerp(lerp(A[k], A[k + 1], fx), lerp(A[k + QW], A[k + QW + 1], fx), fy); };
  const fold = W - 6 * SPX, PS = K === 'sail' ? W / 72 : W / 60;
  for (let y = 0; y < FH; y++) { const vf = y / (FH - 1), eb = 1 - sSmooth((Math.min(vf, 1 - vf) - 0.035) / 0.035);   /* the edge paint wraps over the rounded edge onto the face */
    for (let x = 0; x < W; x++) { const i = y * W + x, mic = sLat[(x * 3 + y * 1021) & 65535] - 0.5; let c0, c1, c2, hv, rv;
      if (K === 'suede') { const br = bl(A1, x, y), tn = bl(A2, x, y), u = x * ca + y * sa, v = y * ca - x * sa, lie = br + 0.7 * mic > 0.5, fib = (lie ? sNoise(u / 1.25 + 71, v / 4.4 + 29) : sNoise(u / 4.4 + 13, v / 1.25 + 4)) - 0.5, cl = (lie ? sNoise(u / 3.1 + 5, v / 11 + 40) : sNoise(u / 11 + 21, v / 3.1 + 90)) - 0.5, sk = sNoise(u / 90 + 8, v / 5.5 + 60) - 0.5;
        const L = 1 + 0.15 * (br - 0.5) + 0.1 * (tn - 0.5) + 0.27 * fib + 0.27 * 0.65 * cl + 0.045 * sk + 0.27 * 0.55 * mic; c0 = c1 = c2 = 204 * L; hv = 0.016 * (fib + 0.7 * cl + 0.4 * mic) + 0.006 * (br - 0.5); rv = 0.98 + 0.04 * mic; }
      else if (T) { const n1 = bl(A1, x, y), n2 = bl(A2, x, y), ti = ((x + bl(AX, x, y)) & 255) + (((y + bl(AY, x, y)) & 255) << 8), val = (1 - sSmooth(T.e[ti] / 0.3)) * sSmooth(sNoise(x / 11 + 3, y / 11 + 8) * 2.6 - 0.75), dome = 1 - Math.min(1, T.f[ti] * T.f[ti] * 3), pore = T.f[ti] < 0.17 && T.v[ti] > 0.45 ? 0.16 : 0;
        const wr = clamp(0.9 * (0.3 + 1.6 * (n2 - 0.5) + 0.8 * (n1 - 0.5)) * (1 - 0.55 * val), 0, 1), L = 1 + 0.2 * (n1 - 0.5) + 0.14 * (n2 - 0.5) - 0.04 * val - 0.3 * pore + 0.04 * mic;
        c0 = lerp(o.base[0], o.hi[0], wr) * L; c1 = lerp(o.base[1], o.hi[1], wr) * L; c2 = lerp(o.base[2], o.hi[2], wr) * L; hv = -0.02 * val + 0.01 * dome - 0.035 * pore + 0.004 * mic; rv = 0.62 + 0.12 * val - 0.2 * wr + 0.06 * mic + 0.06 * (n1 - 0.5); }
      else { const cx = x / PS, cy = y / PS, ix = cx | 0, iy = cy | 0, sx = Math.sin(Math.PI * (cx - ix)), sy = Math.sin(Math.PI * (cy - iy)), n1 = bl(A1, x, y), cv = sLat[(ix * 71 + iy * 1237) & 65535];
        if (K === 'sail') { const over = (ix + iy) & 1, top = over ? sx * (0.5 + 0.5 * sy) : sy * (0.5 + 0.5 * sx), tv = over ? sLat[(ix * 131 + 7) & 65535] : sLat[(iy * 197 + 30011) & 65535], L = (0.7 + 0.36 * top) * (1 + 0.22 * (tv - 0.5) + 0.1 * (cv - 0.5) + 0.14 * (n1 - 0.5));
          c0 = o.base[0] * L; c1 = o.base[1] * L; c2 = o.base[2] * L; hv = 0.04 * top; rv = 0.9 - 0.2 * top; }
        else { const band = (ix / 10) | 0, over = ((((band & 1 ? ix : -ix) + iy) % 4 + 4) % 4) < 2, top = over ? sx * (0.45 + 0.55 * sy) : sy * (0.45 + 0.55 * sx), tv = over ? sLat[(ix * 131 + 7) & 65535] : sLat[(iy * 197 + 30011) & 65535], fl = sLat[(ix * 53 + iy * 911 + 77) & 65535], rib = ix % 10 === 0 ? 0.9 : 1;
          c0 = c1 = c2 = clamp(214 * (0.62 + 0.4 * top) * (over ? 1.04 : 0.88) * rib * (1 + 0.3 * (tv - 0.5) + 0.12 * (cv - 0.5) + 0.12 * (n1 - 0.5)) * (fl > 0.988 ? 1.5 : fl < 0.01 ? 0.7 : 1), 0, 255); hv = 0.05 * top * rib; rv = 0.86 - 0.22 * top; } }
      if (x > fold) hv += 0.1 * sSmooth((x - fold) / (2 * SPX)) * (K === 'sail' || K === 'pet' ? Math.sqrt(sSmooth((W - x) / (0.3 * SPX))) : 1);   /* the outer end lies over the inner one: skived to a thin step on leather, a soft turned-under fold on cloth */
      sPut(C, R, i, lerp(c0, E[0], eb), lerp(c1, E[1], eb), lerp(c2, E[2], eb), clamp(lerp(rv, o.eRo, eb), 0.2, 1)); h[i] = hv * (1 - eb); } }
  for (let y = FH; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, nn = sNoise(x / 9, y / 4) - 0.5, l = 1 + 0.06 * nn + 0.04 * (sLat[(x * 7 + y * 613) & 65535] - 0.5); sPut(C, R, i, E[0] * l, E[1] * l, E[2] * l, clamp(o.eRo + 0.08 * nn, 0.2, 1)); h[i] = 0.003 * nn; }   /* the edge paint: sanded flat, a little uneven */
  gC.putImageData(iC, 0, 0); gR.putImageData(iR, 0, 0); gF.fillStyle = '#808080'; gF.fillRect(0, 0, W, H); [gC, gF, gR].forEach((g) => { g.lineCap = 'round'; });
  const cloth = K === 'sail' || K === 'pet', ec = 'rgb(' + E.join(',') + ')';
  if (cloth) { const gr = gC.createLinearGradient(W - 0.3 * SPX, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.22)'); gC.fillStyle = gr; gC.fillRect(W - 0.3 * SPX, 0, 0.3 * SPX, FH); }
  else { gC.fillStyle = ec; gC.fillRect(W - 0.11 * SPX, 0, 0.11 * SPX, FH); gR.fillStyle = '#' + Math.round(o.eRo * 255).toString(16).padStart(2, '0').repeat(3); gR.fillRect(W - 0.11 * SPX, 0, 0.11 * SPX, FH); }   /* the cut end of the outer lap, painted */
  { const gs = gC.createLinearGradient(0, 0, 0.35 * SPX, 0); gs.addColorStop(0, 'rgba(0,0,0,.16)'); gs.addColorStop(1, 'rgba(0,0,0,0)'); gC.fillStyle = gs; gC.fillRect(0, 0, 0.35 * SPX, FH); }   /* the lower lap, in the step's shadow */
  { const r = prng(83), xs = W - (cloth ? 2.6 : 3.0) * SPX, ys = [0.19, 0.5, 0.81].map((f) => f * (FH - 1)), pts = ys.map((y, k) => [xs + (k & 1 ? 0.1 : -0.1) * SPX + (r() - 0.5) * 0.08 * SPX, y + (r() - 0.5) * 0.08 * SPX]);   /* sewn through both laps: two stitches across the keeper */
    for (let k = 0; k < pts.length - 1; k++) kStitch(gC, gF, gR, pts[k], pts[k + 1], o); }
  const f = gF.getImageData(0, 0, W, H).data; for (let i = 0; i < n; i++) h[i] += (f[i * 4] - 128) * 0.0016;
  const cN = mk(), gN = cN.getContext('2d'), iN = gN.createImageData(W, H), d = iN.data;   /* the normal map wraps round the loop, so the step at the joint is kept */
  for (let y = 0; y < H; y++) { const ya = Math.max(0, y - 1), yb = Math.min(H - 1, y + 1); for (let x = 0; x < W; x++) { const xa = (x + W - 1) % W, xb = (x + 1) % W, dx = (h[y * W + xb] - h[y * W + xa]) * SPX * 0.5, dy = (h[yb * W + x] - h[ya * W + x]) * SPX * 0.5, l = 127.5 / Math.hypot(dx, dy, 1), j = (y * W + x) * 4; d[j] = 127.5 - dx * l; d[j + 1] = 127.5 - dy * l; d[j + 2] = 127.5 + l; d[j + 3] = 255; } }
  gN.putImageData(iN, 0, 0);
  const Tx = (c, data) => { const t = new THREE.CanvasTexture(c); t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  return { map: Tx(cC), normalMap: Tx(cN, true), roughnessMap: Tx(cR, true) }; }
/* a strap's keeper material: its own bake, and the same cloth response as the strap's face */
function keepMat(st, o) { const t = keepMaps(o, Math.max(...cKeep.map((K) => K.m.geometry.userData.keep.P))), L = LAY.strap;
    st.km = M('strap', Object.assign({ color: 0xffffff, map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalness: 0, roughness: 1, envMapIntensity: 0.6 }, st.sheen ? { sheen: st.sheen, sheenRoughness: st.sheenR || 0.5, sheenColor: new THREE.Color(st.sheenC ?? 0xffffff) } : {}), !!st.sheen);
    if (st.nap) st.km.sheenColorMap = t.map; if (L.o < 0.999) { st.km.opacity = L.o; st.km.transparent = true; st.km.depthWrite = L.o > 0.5; } }
/* every frame on a stitched strap: its keepers wear its own material and take its colour, and the folded end round the buckle bar is the strap itself */
function keepTick(st) { const o = KEEPS[strapNow]; if (!o || !cKeep.length) return;
  if (!keepTick.fold) { const ml = STRAPS.consulting.ml; keepTick.fold = gBuckle.children.filter((m) => m.material === ml); keepTick.fold.forEach((m) => { const p = m.geometry.attributes.position, uv = m.geometry.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + m.position.x + 9.85) / 19.7, (0.25 + 2.2 * Math.abs(2 * uv.getX(i) - 1)) / 19.7); uv.needsUpdate = true; }); }
  keepTick.fold.forEach((m) => { if (m.material !== st.mats[0]) m.material = st.mats[0]; });
  if (strapNow !== 'consulting') keepTick.away = true; if (!st.km) { if (!snap && !keepTick.away) return; keepMat(st, o); }   /* the strap the page opens on waits for idle time; one picked later is baked as it is fitted */
  st.km.color.copy(st.mat.color); if (st.nap) napSheen(st.km.sheenColor, st.mat.color); cKeep.forEach((K) => { if (K.m.material !== st.km) K.m.material = st.km; }); }
/* and in idle time once the box is open, starting with the one on the watch: small enough not to wait for the visitor to sit still, as the straps do */
{ const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 2000 }) : (f) => setTimeout(f, 250), next = () => { if (intro.on || jump) { setTimeout(next, 700); return; } const k = [strapNow].concat(Object.keys(KEEPS)).find((q) => KEEPS[q] && STRAPS[q].mats && !STRAPS[q].km); if (k && cKeep.length) { keepMat(STRAPS[k], KEEPS[k]); idle(next); } }; setTimeout(() => idle(next), 1400); }

/* ---------- the strap display: the straps that are not on the watch wait beside it on a workshop pegboard, newest job on the left, oldest on the right: a dark powder coated
   steel sheet with a grid of round holes, and one single prong hook per strap set in a hole. Every strap hangs as a shop hangs it: a two piece strap by its buckle, the long half slipped
   through the buckle half's keepers so the pair stays together; the NATO by its buckle, full length; the bracelet, clasp open, folded once over a small printed cradle. A strap is only
   ever in one place: on the watch, in the air, or on its hook. Everything here is in mm, in the display's own frame (x along the board, y up, z toward the visitor, the hooks' prongs
   at y = 0); the group is scaled to the page. RAIL, at the top of the straps section, switches it all off ---------- */
const RJ = (() => { const def = ['consulting', 'engineering', 'quant', 'banking', 'writing'], o = Array.isArray(CT.jobOrder) ? CT.jobOrder.filter((k, i, a) => def.includes(k) && a.indexOf(k) === i) : [];
  def.forEach((k) => { if (!o.includes(k)) o.push(k); });
  const yrs = { consulting: '2023 to now', engineering: '[years]', quant: '[years]', banking: '[years]', writing: '2019' }; if (CT.jobs) def.forEach((k) => { const y = CT.jobs[k] && CT.jobs[k].years; if (typeof y === 'string' && y.trim()) yrs[k] = y.trim(); });
  return { order: o, years: yrs }; })();
/* the board: an industrial pegboard, a dark powder coated steel sheet with round holes on a square grid, stood a little off the wall on four screws. top and drop are how far it runs above
   and below the row of holes' hooks (every strap hangs at full length, so the longest, the NATO, sets the drop); z is its back, t its thickness, hy how far the hooks' holes sit above
   the prongs. PAIR: where a hung buckle's strap tip lies under the prong, how far the long half's tip stops short of the buckle bar, and how far it slides to come out of the keepers */
const RB = { top: 13, drop: 171, z: -8.4, t: 1.6, hy: 5 }, PAIR = { tip: -7.5, gap: 3, D: 30 }, BRY = 2.5;   // BRY: the height of the cradle's saddle edge
const mBoard = new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.45, roughness: 0.62, envMapIntensity: 0.55 });
/* the printed cradle: matte, with the fine ridges a printer's layers leave */
const mCradle = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0, roughness: 0.82, envMapIntensity: 0.35, bumpScale: 0.6, bumpMap: (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'); for (let y = 0; y < 64; y++) { const v = Math.round(128 + 100 * Math.sin(y / 8 * TAU)); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(0, y, 4, 1); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })() });
const mSteelR = new THREE.MeshStandardMaterial({ color: 0xcfd1d4, metalness: 1, roughness: 0.3, envMapIntensity: 1.15 }), RFURN = [mSteelR, mBoard, mCradle];
const railG = new THREE.Group(); railG.visible = false; if (RAIL) scene.add(railG);
const rF = new THREE.Group(); railG.add(rF);   // rF: the furniture, rebuilt only when the block on the page changes size
const rl = { op: -1, opDirty: true, t: 0, inCh: false, jt: -1, desk: false, gx: 0, drop: 0, s: 0.3, ppm: 2, vis: 0, el: null, btns: [], key: '', rodL: 100, force: false, slots: [], cw: 0, ch: 0, top: 10, mobBg: '' };
const R_LATCH = 1.1, N_IN = 2.4, N_OUT = 2.3, N_LATCH = 1.75;   /* when the next strap is fetched; how long the NATO takes to come in and to go back; when the next strap is fetched after a NATO */
const rs = { dep: 0, inK: null, arr: -1, arrAt: 0, click: false, latch: R_LATCH, nOut: false, nIn: false, toolIn: -1 };   // the swap in progress: 1 once the old strap has left, 2 if it goes straight back on; the strap coming in; when it reached the watch
const rsReset = () => { rs.dep = 0; rs.inK = null; rs.arr = -1; rs.click = false; rs.latch = R_LATCH; rs.nOut = false; rs.nIn = false; rs.toolIn = -1; };
const RS = {}, RSV = [];   // per strap: its slot, its halves and where it is ('worn', 'hang', 'out' going back, 'in' coming to the watch)
const bHold = new THREE.Group(); bHold.visible = false; gStrap.add(bHold);   // the one real buckle waits here while no calf strap is on the watch
/* a single prong peg hook, bent from steel wire: out of its hole, down the face of the board, forward as the prong, its tip turned up */
const gHookWire = (() => { const zf = RB.z + RB.t, P = [[RB.hy, RB.z - 1.2], [RB.hy, zf + 1.0], [RB.hy - 1.6, zf + 2.2], [1.3, zf + 2.3], [0, zf + 3.7], [0, 4.5], [0.4, 6.8], [1.9, 8]].map((q) => new THREE.Vector3(0, q[0], q[1]));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P, false, 'centripetal'), 48, 1.1, 10, false); })();
/* the bracelet's cradle, printed: a plate screwed to the board, two cheeks standing out from it, and between them a thin wedge whose top edge the clasp's middle hinge rests on. The blades
   lie down its two faces and the bracelet hangs straight on either side. ya is the height of that edge */
function rCradle(g, ya) { const zf = RB.z + RB.t, put = (geo, x, y, z) => { const m = new THREE.Mesh(geo, mCradle); m.position.set(x, y, z); g.add(m); return m; }, uvy = (geo, k) => { const u = geo.attributes.uv, q = geo.attributes.position; for (let i = 0; i < u.count; i++) u.setXY(i, q.getX(i) / 9, q.getY(i) / k); return geo; };
  put(uvy(new RoundedBoxGeometry(25, 19, 2.4, 2, 0.8), 0.42), 0, ya - 5, zf + 1.2);
  [-1, 1].forEach((sx) => put(uvy(new RoundedBoxGeometry(2.2, 14, 4.4 - zf, 2, 0.7), 0.42), sx * 9.8, ya - 4.5, (zf + 4.4) / 2));
  const w = new THREE.Shape(); w.moveTo(0, -0.55); w.lineTo(1.25, -10.5); w.lineTo(-1.25, -10.5); w.closePath();
  const wg = new THREE.ExtrudeGeometry(w, { depth: 18.6, bevelEnabled: false }); wg.translate(0, 0, -9.3); wg.rotateY(Math.PI / 2); uvy(wg, 0.42); put(wg, 0, ya, 0);
  [[-6.5, -11], [6.5, -11]].forEach(([x, y]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.8, 14).rotateX(Math.PI / 2), mSteelR); m.position.set(x, ya + y, zf + 2.6); g.add(m); }); }   // two screw heads
/* the furniture: the pegboard (the sheet with its holes, four screws) (slab, lands between the channels, rim, lining, and a pair of bushings at each end of every channel) */
function rFurn(len, xs) { const t0 = performance.now(); rF.children.slice().forEach((m) => { rF.remove(m); m.geometry.dispose(); });
  const put = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); rF.add(o); return o; };
  { const p0 = xs.length > 1 ? xs[1] - xs[0] : 50, px = p0 / Math.max(1, Math.round(p0 / 25.4)), x0 = -len / 2, x1 = len / 2, y1 = RB.top, y0 = -RB.drop, cr = 3.5, sh = new THREE.Shape();   /* the holes' pitch divides the straps' pitch, so every hook sits in a real hole */
    sh.moveTo(x0 + cr, y0); sh.lineTo(x1 - cr, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + cr); sh.lineTo(x1, y1 - cr); sh.quadraticCurveTo(x1, y1, x1 - cr, y1); sh.lineTo(x0 + cr, y1); sh.quadraticCurveTo(x0, y1, x0, y1 - cr); sh.lineTo(x0, y0 + cr); sh.quadraticCurveTo(x0, y0, x0 + cr, y0);
    for (let x = xs[0] - px * Math.floor((xs[0] - x0 - 7) / px); x < x1 - 6.5; x += px) for (let y = RB.hy; y > y0 + 7; y -= px) { const h = new THREE.Path(); h.absarc(x, y, 2.3, 0, TAU, true); sh.holes.push(h); }
    put(new THREE.ExtrudeGeometry(sh, { depth: RB.t - 0.4, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1, curveSegments: 10 }), mBoard, 0, 0, RB.z + 0.2);
    [-1, 1].forEach((sx) => [y1 - 6, y0 + 6].forEach((y) => put(new THREE.CylinderGeometry(2.1, 2.1, 0.9, 16).rotateX(Math.PI / 2), mSteelR, sx * (len / 2 - 6), y, RB.z + RB.t + 0.4)));
    rl.furnMs = performance.now() - t0; return; }
}
/* a chain is a list of [y, z] points in a half's own frame: its start point, then the angle and length of each segment. Two chains are blended by angle, so a strap
   bends from one shape into the other without stretching. The angles are unwrapped along the chain, so a curl stays a curl */
const rWrap = (x) => x - TAU * Math.round(x / TAU);
function chainMix(A, B, t, out) { const n = A.length; out[0][0] = lerp(A[0][0], B[0][0], t); out[0][1] = lerp(A[0][1], B[0][1], t); let pa = 0, pb = 0;
  for (let j = 1; j < n; j++) { const ya = A[j][0] - A[j - 1][0], za = A[j][1] - A[j - 1][1], yb = B[j][0] - B[j - 1][0], zb = B[j][1] - B[j - 1][1], ra = Math.atan2(za, ya), rb2 = Math.atan2(zb, yb);
    let a, b; if (j === 1) { a = ra; b = rb2 + TAU * Math.round((ra - rb2) / TAU); } else { a = pa + rWrap(ra - pa); b = pb + rWrap(rb2 - pb); } pa = a; pb = b;
    const l = lerp(Math.hypot(ya, za), Math.hypot(yb, zb), t), m = lerp(a, b, t); out[j][0] = out[j - 1][0] + l * Math.cos(m); out[j][1] = out[j - 1][1] + l * Math.sin(m); } return out; }
const chainBuf = (n) => { const b = []; for (let i = 0; i < n; i++) b.push([0, 0]); return b; }, chainCopy = (c, out) => { for (let i = 0; i < c.length; i++) { out[i][0] = c[i][0]; out[i][1] = c[i][1]; } return out; };
/* the frame a half hangs in on the stand: down its chain is down the page, its outer face toward the visitor */
const rBasis = (sy, f, yaw) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-sy * f, 0, 0), new THREE.Vector3(0, 0, sy * f), new THREE.Vector3(0, 1, 0))));
/* how each kind waits. On the stand calf and cloth fall straight from the spring bar; the hole half, worn into a curve, curls back a little at the tail */
/* on the board a two piece strap hangs from one hook by its buckle, as a shop hangs them: the prong through the empty buckle frame, the buckle half hanging from it, lug end down, tang loose.
   The long half is not buckled: its tail is slipped up through the buckle half's two keepers from below and stops short of the buckle bar, so the two lie face up one on the other and the
   long half's lug end hangs free below. The keepers take only the tail (the lug end is too wide for them), which is why it goes in tail first. zo is how far the long half lies in front of the
   buckle half's middle, by mm from its lug */
const pairZ = (s) => { const s0 = CALF.L[1] - PAIR.gap - CALF.L[0]; return 1.2 + (3.0 - 1.2) * sSmooth(s / s0) - 0.6 * sSmooth((s - s0) / 24); };
function hangLen(i) { const n = CALF.n[i], st = CALF.L[i] / n, c = [[LH[0] - 0.6, LH[1] + 0.2]]; let p = c[0];
  for (let j = 0; j < n; j++) { const dz = i ? pairZ((j + 1) * st) - pairZ(j * st) : 0, th = Math.PI / 2 + Math.asin(clamp(dz / st, -0.9, 0.9)); p = [p[0] + st * Math.cos(th), p[1] + st * Math.sin(th)]; c.push(p); } return c; }
/* where each half's spring bar hangs, from the prong */
const hangAt = (i) => i ? new THREE.Vector3(0, PAIR.tip - PAIR.gap - CALF.L[1] - 0.2, pairZ(0) - 0.6) : new THREE.Vector3(0, PAIR.tip - CALF.L[0] - 0.2, -0.6);
/* a strap in the air is not rigid: it bows along its length, most toward its free end, swelling and easing as it flies, with a slow ripple running through it */
const rFxA = [], rFxL = [];
function chainFlex(c, f, w, ph) { const n = c.length - 1; if (Math.abs(f) + Math.abs(w) < 1e-4) return;
  for (let j = 0; j < n; j++) { rFxA[j] = Math.atan2(c[j + 1][1] - c[j][1], c[j + 1][0] - c[j][0]); rFxL[j] = Math.hypot(c[j + 1][0] - c[j][0], c[j + 1][1] - c[j][1]); }
  for (let j = 0; j < n; j++) { const u = (j + 0.5) / n, a = rFxA[j] + f * Math.pow(u, 1.5) + w * u * Math.sin(TAU * u - ph); c[j + 1][0] = c[j][0] + rFxL[j] * Math.cos(a); c[j + 1][1] = c[j][1] + rFxL[j] * Math.sin(a); } }
/* the bracelet on the board: clasp open, folded once over the printed saddle at the hinge between its blades, each half hanging straight down from there, no curl. The six side (blade 1, the
   cover, its rows) hangs in front, cover face out; the twelve side behind, against the board. In the half's own frame y is toward the visitor and z up; the hinge is at the origin */
function brHangPose() { const S = BRC.S, m = BRC.m, L = BRSH.L, g = 2.8, c = chainBuf(S + 1);
  c[m + 1][0] = g; c[m + 1][1] = -Math.sqrt(L[m] * L[m] - g * g); for (let j = m + 1; j < S; j++) { c[j + 1][0] = g; c[j + 1][1] = c[j][1] - L[j]; }
  c[m - 1][0] = -g; c[m - 1][1] = -Math.sqrt(L[m - 1] * L[m - 1] - g * g); for (let j = m - 2; j >= 0; j--) { c[j][0] = -g; c[j][1] = c[j + 1][1] - L[j]; }
  return brPose(c, 0); }
/* the worn shape a strap must arrive in: what the physics will hold it at the moment it is clicked in, lifted off the lugs */
function wornTurn(st, i, sy) { const gu = sy * gv.y, gz = gv.z, mag = Math.min(1, Math.hypot(gu, gz)); let dg = Math.atan2(gz, gu) - TH0; dg = rWrap(dg); dg = clamp(dg, rad(-170), rad(36)); return lerp(st.len ? st.rests[i] : st.rest, dg, st.droop * mag) - 0.9; }
const wornChain = (st, i, lift) => strapCenter(wornTurn(st, i, i ? -1 : 1), 0, lift, st.dz || 0, st.dy || 0, st.len ? CALF.n[i] : SN, st.len ? CALF.L[i] / CALF.n[i] : SSTEP);
/* the point each half is carried by in the air: its spring bar, or for the bracelet the clasp's middle hinge */
function anchorOf(H, c, lift, out) { if (H.kind === 'len') return out.set(0, H.sy * (LH[0] + HEAD[0] * lift), LH[1] + HEAD[1] * lift); if (H.kind === 'brace') return out.set(0, c[BRC.m][0], c[BRC.m][1]); return out.set(0, H.sy * c[0][0], c[0][1]); }
/* shape a half: the strap itself, plus whatever rides on it (the buckle and keepers follow the buckle half) */
const rV = new THREE.Vector3();
function shapeHalf(R, H, c, lift, rel) {
  H.o.update(c, lift);
  if (H.kind === 'len' && H.i === 0 && R.buck && R.buck.visible) { const n = CALF.n[0], tip = c[n], ta = Math.atan2(tip[1] - c[n - 1][1], tip[0] - c[n - 1][0]); R.buck.position.set(0, tip[0], tip[1]); R.buck.rotation.x = ta + rel;
    R.keeps.forEach((K, j) => { const o = along(c, cKeep[j].s); K.position.set(0, o.y - Math.sin(o.ang) * cKeep[j].b0, o.z + Math.cos(o.ang) * cKeep[j].b0); K.rotation.x = o.ang; K.scale.z = R.kf ? lerp(0.6, 1, R.kf[j]) : 0.6; }); if (R.tangO) R.tangO.rotation.x = R.tang || 0; }
  if (H.kind === 'len') H.o.obj.children[1].visible = false; }   /* off the watch a spring bar's pivots are drawn in */
/* ----- the NATO is one piece of webbing, always. Off the watch it is drawn as a ribbon whose every row follows one path: out of its place (folded over the spring bar in its block, or
   lying in its channel), through the air, down past twelve, under the 12 o'clock bar, flat under the case, under the 6 o'clock bar and out. Sliding along that path is how it is taken
   and how it goes back: q is how far along it is, 0 in its place, 1 threaded. A click the other way just turns q round ----- */
const NT = { tw: 0, q: 1, q0: 1, t0: 0, to: 1, bars: true, c12: null, c6: null, n: 0, s: null, L: 0, disp: null, P: [], X: [], G: [], rP: [], rX: [], rG: [], pu: [] };
const NRUN = 16, NBR = 30;   /* the straight run the webbing is fed along above twelve, in mm; the points along its flight through the air */
const nW = new THREE.Vector3(), nV = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], nM = new THREE.Matrix4(), nQ3 = new THREE.Matrix3();
/* the flat webbing's cross-section, as ribbonGeo draws it */
const NHALF = [[0, 1], [0.93, 1], [0.975, 0.9], [1, 0.55]], NBE = -0.55, NTOP = NHALF.slice(1).reverse().map((p) => [-p[0], p[1]]).concat(NHALF), NBOT = [[1, NBE], [0.975, -0.94], [0.93, -1], [-0.93, -1], [-0.975, -0.94], [-1, NBE]], NEB = (x) => { const a = Math.abs(x); return a <= 0.93 ? -1 : a <= 0.975 ? lerp(-1, -0.94, (a - 0.93) / 0.045) : lerp(-0.94, NBE, (a - 0.975) / 0.025); };
/* lay the ribbon through rows given anywhere in space: P the centre of each row, X the way across, g the scale. Row order and vertex order are ribbonGeo's, so the two hand over without a jump */
function ribbon3(P, X, g, w, th, geo) { const n = P.length, a = geo.attributes.position.array, T = nV[0], N = nV[1], Xo = nV[2]; let k = 0; const rows = NT.rows || (NT.rows = P.map(() => ({ p: new THREE.Vector3(), x: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, h: 0 })));
  for (let i = 0; i < n; i++) { T.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]); if (T.lengthSq() < 1e-12) T.set(0, 1, 0); T.normalize(); N.crossVectors(X[i], T); if (N.lengthSq() < 1e-12) N.set(0, 0, 1); N.normalize(); Xo.crossVectors(T, N).normalize(); const r = rows[i]; r.p.copy(P[i]); r.x.copy(Xo); r.n.copy(N); r.w = w / 2 * g[i]; r.h = th / 2 * g[i]; }
  const pt = (r, x, e) => { a[k++] = r.p.x + r.x.x * x * r.w + r.n.x * e * r.h; a[k++] = r.p.y + r.x.y * x * r.w + r.n.y * e * r.h; a[k++] = r.p.z + r.x.z * x * r.w + r.n.z * e * r.h; };
  const grid = (prof) => { for (let i = 0; i < n; i++) for (let j = 0; j < prof.length; j++) pt(rows[i], prof[j][0], prof[j][1]); };
  grid(NTOP); grid(NBOT); grid([[-1, NBE], [-1, 0.55]]); grid([[1, 0.55], [1, NBE]]); [rows[0], rows[n - 1]].forEach((r) => NTOP.forEach((p) => { pt(r, p[0], p[1]); pt(r, p[0], NEB(p[0])); }));
  geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); }
/* the NATO's own frame on its hook or in its channel: u runs from the end that goes in last (the buckle end, at the hook or the back of the channel) to the end that goes in first */
function natoDisp(u, out) { const L = NT.L;
  return out.set(0, PAIR.tip - u, 0.5 + 0.5 * Math.sin(Math.PI * clamp(u / L, 0, 1))); }   /* hung from its hook by the buckle, full length, a hair of belly in it */
/* which way the webbing leaves its place when it is drawn out: down off the front of the block, or forward out of the channel */
const natoOut = (out) => out.set(0, 0.25, 0.97).normalize();   // off its hook: out toward the visitor, a little up
function natoInit(st) { const W0 = st.loop(0), n = W0.length, s = [0]; for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(W0[i][0] - W0[i - 1][0], W0[i][1] - W0[i - 1][1]));
  Object.assign(NT, { n, s, L: s[n - 1] }); st.natoG = new THREE.Group(); st.natoG.add(st.natoMesh); gStrap.add(st.natoG);
  const mk = (m) => { const a = []; for (let i = 0; i < m; i++) a.push(new THREE.Vector3()); return a; }; NT.rP = mk(n); NT.rX = mk(n); NT.rG = new Array(n).fill(1); NT.disp = mk(n);
  for (let i = 0; i < n; i++) natoDisp(NT.L - s[i], NT.disp[i]); const m = 2 * n + NBR + 8; NT.P = mk(m); NT.X = mk(m); NT.G = new Array(m).fill(1); NT.pu = new Array(m).fill(0); }
/* what the physics would hold each side at: the side at twelve held up out of the way while the webbing is fed in, or both falling as they hang */
function natoTurn(sy, up) { const st = STRAPS.writing, fl = up ? -1 : 1, gu = fl * sy * gv.y, gz = fl * gv.z, mag = Math.min(1, Math.hypot(gu, gz)); let dg = Math.atan2(gz, gu) - TH0; dg = rWrap(dg); dg = clamp(dg, rad(-170), rad(up ? 130 : 36)); return lerp(st.rest, dg, (up ? 1 : st.droop) * mag); }
const nC12 = chainBuf(STRAPS.writing.sn[0] + 1), nC6 = chainBuf(STRAPS.writing.sn[1] + 1);
/* while it is fed in, the side at twelve is held up and turned toward the display it is coming from (on a desktop, toward the gutter it comes up), so the webbing runs in one easy curve from there to the lug */
function natoAim(piv) { const tgt = nV[0].setFromMatrixPosition(piv.matrixWorld), lug = nV[1].set(0, LH[0], LH[1]); if (rl.desk) tgt.set(rl.gx, tgt.y - rl.drop, tgt.z);   /* on a desktop it is turned toward the gutter it comes up, not at the display under the text */ nM.copy(gStrap.matrixWorld).invert(); tgt.applyMatrix4(nM); const up = natoTurn(1, true), aim = clamp(rWrap(Math.atan2(tgt.z - lug.z, tgt.y - lug.y) - TH0), rad(-10), rad(150)); return up + rWrap(aim - up) * (rl.desk ? 1 : 0.74); }
/* where the NATO is, by the swap's clock: eased from where it was when the last click came, to its place or to the watch */
function natoQ(T) { const span = Math.abs(NT.to - NT.q0); if (span < 1e-4) return NT.to; const u = clamp((T - NT.t0) / ((NT.to ? N_IN : N_OUT) * span), 0, 1); if (u >= 1) return NT.to; return lerp(NT.q0, NT.to, u * u * u * (u * (u * 6 - 15) + 10)); }
/* build the whole path in the scene's frame and slide the webbing to q along it. Each point carries the way across and the scale, so the webbing grows from the display's size to the watch's as it flies */
function natoLay(R, q, T, sy0) { const st = R.st, n = NT.n, L = NT.L, s = NT.s, P = NT.P, X = NT.X, G = NT.G, pu = NT.pu, piv = R.slot.piv; let m = 0;
  piv.updateWorldMatrix(true, false); gStrap.updateWorldMatrix(true, false); const gd = rl.s, gw = nV[3].setFromMatrixColumn(gStrap.matrixWorld, 0).length(), xd = nV[4].set(1, 0, 0).transformDirection(piv.matrixWorld), xw = nV[5].set(1, 0, 0).transformDirection(gStrap.matrixWorld);
  /* first it is lifted off its hook, whole, up off the prong and out toward the visitor; only then does its free end lead it away */
  const off = sSmooth(q / 0.07), lv = nV[0].set(0, 5 * off, 26 * off).transformDirection(piv.matrixWorld).multiplyScalar(Math.hypot(5, 26) * off * gd);
  for (let i = n - 1; i >= 0; i--) { P[m].copy(NT.disp[i]).applyMatrix4(piv.matrixWorld).add(lv); X[m].copy(xd); G[m] = gd; pu[m] = L - s[i]; m++; }
  /* on the watch: the side at twelve rises out of the way as it goes back, and is held up while it comes in; the side at six hangs */
  const lift = sy0, wUp = R.state === 'out' && NT.c12 ? sSmooth((T - NT.t0) / 0.45) : 1, up12 = strapCenter(natoAim(piv), 0, lift, st.dz, st.dy, st.sn[0]), dn6 = strapCenter(natoTurn(-1, false), 0, lift, st.dz, st.dy, st.sn[1]);
  if (R.state === 'out' && NT.c12) { chainMix(NT.c12, up12, wUp, nC12); chainMix(NT.c6, dn6, wUp, nC6); } else { chainCopy(up12, nC12); chainCopy(dn6, nC6); }
  st.cs = { 1: nC12, [-1]: nC6 }; const W = st.loop(lift), mw = m + NBR, d0y = W[n - 1][0] - W[n - 2][0], d0z = W[n - 1][1] - W[n - 2][1], dl = Math.hypot(d0y, d0z) || 1;
  /* the run in above twelve, then the loop from the tip at twelve to the tip at six */
  for (let k = 0; k < 6; k++) { const f = (6 - k) / 6 * NRUN; P[mw + k].set(0, W[n - 1][0] + d0y / dl * f, W[n - 1][1] + d0z / dl * f); }
  for (let i = n - 1; i >= 0; i--) P[mw + 6 + (n - 1 - i)].set(0, W[i][0], W[i][1]);
  for (let k = 0; k < n + 6; k++) { P[mw + k].applyMatrix4(gStrap.matrixWorld); X[mw + k].copy(xw); G[mw + k] = gw; }
  /* through the air: from where it leaves its place to the start of the run in, sagging a little and bowed toward the visitor, clear of the case */
  const B0 = P[m - 1], B3 = P[mw], t0 = natoOut(nV[0]).transformDirection(piv.matrixWorld), t3 = nV[1].subVectors(P[mw + 1], P[mw]).normalize(), dist = B0.distanceTo(B3), k0 = 0.3 * dist, k3 = 0.34 * dist;
  let bl = 0, prev = nV[2].copy(B0);
  /* on a desktop it keeps below the text: off its place, along at the display's level to the gutter, up the gutter, and in over twelve */
  const NC = NT.cv || (NT.cv = new THREE.CatmullRomCurve3([0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3()), false, 'centripetal')); if (rl.desk) { const q = NC.points, gx = Math.min(rl.gx, B0.x), lo = lerp(B0.y, B3.y, 0.12);   /* never below where its end leaves the hook */
    q[0].copy(B0); q[1].copy(B0).addScaledVector(t0, 0.16 * dist); q[2].set(gx + 0.05 * dist, lo, B0.z + 0.12 * dist); q[3].set(gx - 0.03 * dist, lerp(lo, B3.y, 0.55), B3.z + 0.06 * dist);   /* out of the board toward the eye first, then along in one S */ q[4].copy(B3).addScaledVector(t3, -0.18 * dist); q[5].copy(B3); }
  for (let k = 1; k <= NBR; k++) { const u = k / (NBR + 1), a = (1 - u) * (1 - u) * (1 - u), b = 3 * (1 - u) * (1 - u) * u, c = 3 * (1 - u) * u * u, d = u * u * u, bow = Math.sin(Math.PI * u), V = P[m + k - 1];
    if (rl.desk) NC.getPoint(u, V); else V.set(a * B0.x + b * (B0.x + t0.x * k0) + c * (B3.x - t3.x * k3) + d * B3.x, a * B0.y + b * (B0.y + t0.y * k0) + c * (B3.y - t3.y * k3) + d * B3.y - 0.085 * dist * bow, a * B0.z + b * (B0.z + t0.z * k0) + c * (B3.z - t3.z * k3) + d * B3.z + 0.14 * dist * bow);
    const e = sSmooth(u); G[m + k - 1] = lerp(gd, gw, e);
    if (!reduce) { const rp = nW.subVectors(B3, B0).cross(X[m + k - 1]).normalize(), wv = 0.035 * dist * bow * Math.sin(TAU * 1.6 * u - T * 8.5); V.addScaledVector(rp, wv); }   /* soft webbing does not fly flat: a slow ripple runs along it, driven by the swap's clock */ bl += V.distanceTo(prev) / G[m + k - 1]; prev = V; }
  bl += B3.distanceTo(prev) / gw; for (let k = 0; k < NBR; k++) pu[m + k] = 0;
  /* the webbing's way across is carried along the flight without turning about its own length; whatever turn is still owed where it meets the watch is then spread evenly over the whole
     flight, so it never flips or kinks in the middle */
  /* the webbing's way across in the air: it keeps its face turned to the visitor, as a strap carried by its end does, so it never twirls about its own length; near its two ends it eases
     to the way it lies on the hook and on the watch. The face's side is the one it shows at both ends, so nothing flips */
  { const Tk = nW, Nc = nV[2], Xe = nV[0], cam = camera.position, tA = nV[1].subVectors(P[m], B0).normalize(), sg = Math.sign(Xe.crossVectors(xd, tA).dot(Nc.subVectors(cam, B0))) || 1, pN = NT.pN || (NT.pN = new THREE.Vector3()), Tq = NT.Tq || (NT.Tq = new THREE.Vector3());
    pN.crossVectors(xd, tA).normalize();
    for (let k = 0; k < NBR; k++) { Tk.subVectors(k < NBR - 1 ? P[m + k + 1] : B3, k ? P[m + k - 1] : B0).normalize(); Nc.subVectors(cam, P[m + k]).normalize().multiplyScalar(sg); Nc.addScaledVector(Tk, -Tk.dot(Nc));
      const w = clamp(Nc.length() / 0.6, 0, 1); Nc.normalize().multiplyScalar(w).addScaledVector(pN, 1 - w); Nc.addScaledVector(Tk, -Tk.dot(Nc)).normalize(); pN.copy(Nc);   /* where it runs toward the eye the face is held as it was */
      X[m + k].crossVectors(Tk, Nc).normalize(); }
    for (let pass = 0; pass < 3; pass++) for (let k = 0; k < NBR; k++) { const a = k ? X[m + k - 1] : xd, b = k < NBR - 1 ? X[m + k + 1] : xw; Tq.copy(a).add(b).addScaledVector(X[m + k], 2); Tk.subVectors(k < NBR - 1 ? P[m + k + 1] : B3, k ? P[m + k - 1] : B0).normalize(); X[m + k].copy(Tq.addScaledVector(Tk, -Tk.dot(Tq)).normalize()); }   /* smoothed along its length, so it never kinks */
    for (let k = 0; k < NBR; k++) { const u = (k + 1) / (NBR + 1), w0 = 1 - sSmooth(u / 0.16), w1 = sSmooth((u - 0.84) / 0.16); Tk.subVectors(k < NBR - 1 ? P[m + k + 1] : B3, k ? P[m + k - 1] : B0).normalize(); if (w0 > 0) X[m + k].lerp(xd, w0); if (w1 > 0) X[m + k].lerp(xw, w1); X[m + k].addScaledVector(Tk, -Tk.dot(X[m + k])).normalize(); }
    NT.endDot = X[m + NBR - 2].dot(xw); }
  /* the length of each stretch, in mm of webbing */
  { let acc = L, pv = P[m - 1]; for (let k = 0; k < NBR; k++) { acc += P[m + k].distanceTo(pv) / G[m + k]; pu[m + k] = acc; pv = P[m + k]; } acc = L + bl; for (let k = 0; k < 6; k++) pu[mw + k] = acc + NRUN * k / 6; acc += NRUN; for (let i = n - 1; i >= 0; i--) pu[mw + 6 + (n - 1 - i)] = acc + L - s[i]; }
  const tot = mw + 6 + n, Pt = pu[tot - 1], p0 = q * (Pt - L); let j = 1;
  for (let i = n - 1; i >= 0; i--) { const u = p0 + L - s[i]; while (j < tot - 1 && pu[j] < u) j++; const f = pu[j] > pu[j - 1] ? clamp((u - pu[j - 1]) / (pu[j] - pu[j - 1]), 0, 1) : 0;
    NT.rP[i].lerpVectors(P[j - 1], P[j], f); NT.rX[i].lerpVectors(X[j - 1], X[j], f).normalize(); NT.rG[i] = lerp(G[j - 1], G[j], f); }
  ribbon3(NT.rP, NT.rX, NT.rG, st.w[0], st.th[0], st.geo); natoHard(st, true);
  { let tw = 0; const R = NT.rows; for (let i = 1; i < n; i++) tw = Math.max(tw, Math.acos(clamp(R[i].x.dot(R[i - 1].x), -1, 1))); NT.tw = tw; } }   /* a test aid: the most the way across turns between one row and the next */
/* the NATO in its place: its ribbon is laid once in the slot's own frame and swings with it */
function natoHome(R) { const st = R.st, n = NT.n; R.slot.piv.add(st.natoG); st.natoG.position.set(0, 0, 0); st.natoG.quaternion.identity(); st.natoG.scale.set(1, 1, 1);
  for (let i = 0; i < n; i++) { NT.rP[i].copy(NT.disp[i]); NT.rX[i].set(1, 0, 0); NT.rG[i] = 1; } ribbon3(NT.rP, NT.rX, NT.rG, st.w[0], st.th[0], st.geo); natoHard(st, true); NT.q = 0; NT.bars = false; natoBarsSet(0); }
/* its spring bars are fitted to the watch by the tool before it is threaded, and taken out after it has gone */
function natoBarsSet(lift) { const st = STRAPS.writing; st.objs.forEach((o) => { o.obj.visible = NT.bars; if (o.obj.parent !== gStrap) gStrap.add(o.obj); o.obj.position.set(0, 0, 0); o.obj.quaternion.identity(); o.obj.scale.set(1, 1, 1);
  const sy = o.sy, b = o.obj.children[0], t = o.obj.children[1]; b.position.set(0, sy * (LH[0] + HEAD[0] * lift), LH[1] + HEAD[1] * lift); t.position.copy(b.position); t.visible = true; }); }
function natoGo(dir, T) { const R = RS.writing; if (!R) return;
  if (R.state === 'worn') { NT.c12 = SIDES[0].c.map((p) => p.slice()); NT.c6 = SIDES[1].c.map((p) => p.slice()); NT.q = 1; }
  else if (dir === 'in' && R.state === 'hang' && !reduce) R.slot.hkV -= 0.5;   // drawing it off the block sets the block swinging
  if (R.state === 'hang' || R.state === 'worn') { scene.attach(R.st.natoG); R.st.natoG.position.set(0, 0, 0); R.st.natoG.quaternion.identity(); R.st.natoG.scale.set(1, 1, 1); }
  if (dir === 'in') NT.c12 = null; NT.q0 = NT.q; NT.t0 = T; NT.to = dir === 'in' ? 1 : 0; R.state = dir === 'in' ? 'in' : 'out'; railSwapMats(R, true); railVis(R); }
/* every frame of a NATO on its way: lay it along the path; at the end, hand it to the watch or leave it in its place */
function natoTick(T, sy0) { const R = RS.writing; if (!R || (R.state !== 'in' && R.state !== 'out')) return;
  const q = NT.q = natoQ(T); natoLay(R, q, T, sy0); natoBarsSet(sy0);
  if (q !== NT.to) return;
  if (R.state === 'in') { if (rs.inK === 'writing' && rs.arr < 0) { natoArrive(); rs.arr = T; rs.nIn = true; natoCheck(sy0); } return; }
  railHang('writing'); if (!reduce) R.slot.phV += 0.16; ping({ f: 2400, q: 3, dur: 0.03, vol: 0.03, sharp: 3 }); }
/* a test aid: how far, in mm, the webbing the watch takes over lies from where the path left it (the watch's own shape at the hand over, before the physics moves it) */
function natoCheck(lift) { const st = STRAPS.writing, v = nV[0]; st.cs = { 1: strapCenter(SIDES[0].turn, 0, lift, st.dz, st.dy, st.sn[0]), [-1]: strapCenter(SIDES[1].turn, 0, lift, st.dz, st.dy, st.sn[1]) }; const W = st.loop(lift); gStrap.updateWorldMatrix(true, false); let g = 0; W.forEach((p, i) => { v.set(0, p[0], p[1]).applyMatrix4(gStrap.matrixWorld); g = Math.max(g, v.distanceTo(NT.rP[i])); }); NT.gap = g / nV[1].setFromMatrixColumn(gStrap.matrixWorld, 0).length(); }
/* threaded: the watch takes it over exactly as it is, the side at twelve still held up, and the physics lets it fall */
function natoArrive() { const R = RS.writing, a = natoAim(R.slot.piv); railPutOn('writing'); strapNow = 'writing'; SIDES.forEach((S, i) => { S.turn = i ? natoTurn(S.sy, false) : a; S.v = 0; S.wob = 0; S.wv = 0; }); if (RS.upcycle) railVis(RS.upcycle); }
/* set every strap up: its slot, its halves, a buckle and keepers of its own for when it is off the watch */
function railInit() { const home = railG;
  RJ.order.forEach((job, j) => { const h = new THREE.Group(), hook = new THREE.Group(), piv = new THREE.Group(); home.add(h); h.add(hook); h.add(piv); const st0 = STRAPS[job], kind = st0.links ? 'brace' : st0.under ? 'nato' : 'len';
    const S = { job, j, h, hook, piv, kind, drape: kind !== 'len', ph: 0, phV: 0, hk: 0, hkV: 0, w0: [3.45, 3.12, 3.82, 3.3, 3.62][j % 5], p0: [0.4, 2.3, 4.4, 1.3, 5.3][j % 5], e0: [0.19, 0.27, 0.15, 0.23, 0.31][j % 5] };
    if (kind === 'brace') rCradle(hook, BRY); else hook.add(new THREE.Mesh(gHookWire, mSteelR));
    S.amp = rad(kind === 'brace' ? 0.25 : kind === 'nato' ? 1.0 : 1.4); rl.slots.push(S); });
  Object.keys(STRAPS).forEach((k) => { const st = STRAPS[k], slot = rl.slots[RJ.order.indexOf(k === 'upcycle' ? 'consulting' : k)], yaw = rad([-3, 2.5, -1.5, 3, -2][slot.j % 5]);
    const R = RS[k] = { k, st, slot, state: 'hang', halves: [], aux: null, buck: null, keeps: [], mlR: null };
    if (st.under) natoInit(st);
    else if (st.links) { const pose = brHangPose(), hang = brPts(pose, chainBuf(BRC.S + 1)), a = new THREE.Vector3(0, hang[BRC.m][0], hang[BRC.m][1]), Q = rBasis(1, 1, 0);
      R.halves.push({ o: st.objs[0], sy: 1, i: 0, tr: null, kind: 'brace', pose, hang, a, Q, A: new THREE.Vector3(0, BRY, 0), P0: brCopy(pose), PtW: brCopy(pose), Pt: pose, Pb: brCopy(pose), tgtB: chainBuf(BRC.S + 1), buf: chainBuf(BRC.S + 1), c0: chainBuf(BRC.S + 1) }); }
    else st.objs.forEach((o, i) => { const sy = i ? -1 : 1, H = { o, sy, i, tr: null };
      Object.assign(H, { kind: 'len', hang: hangLen(i), a: new THREE.Vector3(0, sy * LH[0], LH[1]), A: hangAt(i), Q: rBasis(sy, -1, yaw) });   /* both halves hang lug end down and face out, so their frames are turned over */
      H.buf = chainBuf(H.hang.length); H.c0 = chainBuf(H.hang.length); R.halves.push(H); });
    if (st.len) { R.mlR = st.ml.clone(); R.buck = gBuckle.clone(true); R.tangO = R.buck.children[gBuckle.children.indexOf(gTang)]; R.tangO.rotation.x = 0; R.buck.traverse((m) => { if (m.isMesh && m.material === st.ml) m.material = R.mlR; }); st.objs[0].obj.add(R.buck); R.keeps = cKeep.map((K) => { const m = K.m.clone(); m.material = R.mlR; st.objs[0].obj.add(m); return m; }); }
    if (k === strapNow) { R.state = 'worn'; if (R.buck) { R.buck.visible = false; R.keeps.forEach((m) => { m.visible = false; }); } return; }
    railHang(k); });
  Object.keys(RS).forEach((k) => RSV.push(RS[k])); RSV.forEach((R) => { R.halves.forEach((H) => { H.o.obj.userData.railFly = true; }); if (R.st.natoG) R.st.natoG.userData.railFly = true; });   // a strap in the air is a child of the scene; the phone window draws it too
 }
/* where a half sits in its place, in its slot's frame */
const rM = new THREE.Matrix4(), rM2 = new THREE.Matrix4(), rQ2 = new THREE.Quaternion(), rQ = new THREE.Quaternion(), rA = new THREE.Vector3(), rB = new THREE.Vector3(), rC = new THREE.Vector3();
function hangLocal(H, obj) { obj.quaternion.copy(H.Q); obj.scale.set(1, 1, 1); obj.position.copy(H.a).applyQuaternion(H.Q).negate().add(H.A); }
function railHang(k) { const R = RS[k], P = R.slot.piv; if (R.st.len) { R.kf = [1, 1]; R.tang = 0.35; }
  if (R.st.len && gBuckle.parent === R.st.objs[0].obj) { bHold.add(gBuckle); cKeep.forEach((K) => bHold.add(K.m)); }
  if (R.buck) { R.buck.visible = true; R.keeps.forEach((m) => { m.visible = true; }); }
  if (R.st.under) natoHome(R);
  R.halves.forEach((H) => { H.tr = null; P.add(H.o.obj); hangLocal(H, H.o.obj); if (H.kind === 'brace') { H.o.onW = false; H.o.fl = H.pose.fl; brCopy(H.pose, H.Pb); } shapeHalf(R, H, H.hang, 0, 0); });   // off the watch a bracelet's spring bars sit flush in its end links
  if (R.st.len) { const a = R.halves[0].o.obj, b = R.halves[1].o.obj; a.updateMatrix(); b.updateMatrix(); (R.rel || (R.rel = new THREE.Matrix4())).copy(a.matrix).invert().multiply(b.matrix); }   /* how the long half lies on the buckle half, for when the pair is carried as one */
  if (R.swap) railSwapMats(R, true); R.state = 'hang'; rl.opDirty = true; railVis(R); }
/* put a strap straight on the watch: back into the watch's own frame, where the strap physics takes it from here */
function railPutOn(k) { const R = RS[k];
  R.halves.forEach((H) => { H.tr = null; gStrap.add(H.o.obj); H.o.obj.position.set(0, 0, 0); H.o.obj.quaternion.identity(); H.o.obj.scale.set(1, 1, 1); H.o.obj.visible = true; if (H.kind === 'brace') { H.o.onW = true; H.o.fl = BCL.fl; } });
  if (R.st.under) { const g = R.st.natoG; gStrap.add(g); g.position.set(0, 0, 0); g.quaternion.identity(); g.scale.set(1, 1, 1); g.visible = true; NT.q = 1; NT.bars = true; natoBarsSet(0); }
  if (R.buck) { R.buck.visible = false; R.keeps.forEach((m) => { m.visible = false; }); const bg = R.st.objs[0].obj; bg.add(gBuckle); cKeep.forEach((K) => bg.add(K.m)); ubk.rel = 0; ubk.relV = 0; }
  if (R.swap) { railSwapMats(R, false); railFade(R.own, LAY.strap.o); } R.state = 'worn'; }
/* the webbing for the upcycled dial shares the consulting place: it shows once it has replaced the suede, and the suede never again */
function railVis(R) { const vis = R.k === 'upcycle' ? upGone : R.state !== 'gone'; R.halves.forEach((H) => { H.o.obj.visible = vis; }); if (R.st.natoG) R.st.natoG.visible = true; }
const railOff = (k) => !!RS[k] && RS[k].state !== 'worn';
const railBare = () => rs.dep === 1 && rs.arr < 0;
/* snap a strap onto the watch at once (the snapshots, and anything that asks for a strap with no time to show it) */
function railShow(k) { const old = strapNow; dress(STRAPS[k]); if (STRAPS[k].links) BCL.cl = BCL.clTo = 1; if (k === old && RS[k].state === 'worn') { tintNow(); return; }
  if (RS[old] && RS[old].state === 'worn') { if (old === 'consulting' && upGone) { RS[old].state = 'gone'; railVis(RS[old]); if (gBuckle.parent === RS[old].st.objs[0].obj) { bHold.add(gBuckle); cKeep.forEach((K) => bHold.add(K.m)); } } else railHang(old); } RS[k].halves.forEach((H) => { H.tr = null; }); railPutOn(k); strapNow = k; tintNow();
  RS.upcycle && railVis(RS.upcycle); const S0 = STRAPS[k]; SIDES.forEach((S, i) => { S.turn = S0.rests ? S0.rests[i] : S0.rest; S.v = 0; S.wob = 0; S.wv = 0; }); }
/* a click while the tool is busy: queue it, or turn back the strap already on its way */
function railSet(k) { if (snap && !rl.force) return false; rl.force = false;
  if (swapT < 0) { if (k === strapNow && pendTint == null) { strapNext = null; return true; } strapNext = k; swapT = 0; rsReset(); return true; }
  if (rs.inK) { strapNext = k === rs.inK ? null : k; return true; }
  if (rs.dep === 1) { strapNext = k; return true; }
  strapNext = k === strapNow && pendTint == null ? null : k; return true; }
/* start a flight from wherever the strap is now (on the watch, in its place, or already in the air) */
function railFly(k, to, T, lift0) { const R = RS[k], toRail = to === 'rail';
  if (R.state === 'worn' && R.st.len && gBuckle.parent === R.st.objs[0].obj) { bHold.add(gBuckle); cKeep.forEach((K) => bHold.add(K.m)); if (R.buck) { R.buck.visible = true; R.keeps.forEach((m) => { m.visible = true; }); } }
  const from = R.state; R.state = toRail ? 'out' : 'in'; railSwapMats(R, true);
  R.halves.forEach((H, h) => { const obj = H.o.obj, old = H.tr; obj.updateWorldMatrix(true, false); scene.attach(obj); obj.visible = true;
    const tr = H.tr = { t0: T + (h ? 0.06 : 0), D: toRail ? 0.8 : 0.84, to, A0: new THREE.Vector3(), q0: obj.quaternion.clone(), s0: obj.scale.x, l0: 0, rel0: 0, done: false, vx: 0, pair: H.kind === 'len' && (toRail || from === 'hang'), from };
    if (H.kind === 'brace') { H.o.onW = false; if (from === 'worn') brSeatP(lift0, H.P0); else brCopy(old ? H.Pb : H.pose, H.P0); brPts(H.P0, H.c0); tr.l0 = from === 'worn' ? lift0 : old ? old.l : 0; }
    else if (from === 'worn') { chainCopy(SIDES[H.i].c, H.c0); tr.l0 = lift0; tr.rel0 = H.kind === 'len' && !H.i ? ubk.rel : 0; }
    else if (old) { chainCopy(H.buf, H.c0); tr.l0 = old.l; tr.rel0 = old.rel || 0; }
    else { chainCopy(H.hang, H.c0); tr.l0 = 0; }
    anchorOf(H, H.c0, tr.l0, tr.A0); obj.localToWorld(tr.A0); });
  if (!toRail) { const S = R.slot; if (!reduce) S.hkV += (S.drape ? 0.18 : 0.75) * -1; }   // lifting it off leaves the block swinging
  railVis(R); if (RS.upcycle) railVis(RS.upcycle); }
/* the suede, replaced, comes off the watch and falls; the one real buckle and its keepers go back to waiting */
function railDrop(k) { const R = RS[k], o = R.st.objs[0].obj; strapFall(R.halves.map((H) => H.o.obj), 0); if (gBuckle.parent === o) { bHold.add(gBuckle); cKeep.forEach((K) => bHold.add(K.m)); } R.halves.forEach((H) => { H.tr = null; }); R.state = 'gone'; railVis(R); }
/* the swap's own clock. A strap the tool unpins leaves at 0.7 and the next is fetched at 1.1, fitted by the tool when it gets there. The NATO is never unpinned:
   it is drawn out from under its bars at once, and the tool takes the bars when it has gone; coming in, the tool fits its bars first and it is threaded after */
function railStep(was, T, sy0) { const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, nNow = !!STRAPS[strapNow].under;
  if (!rs.dep && nNow && strapNext && strapNext !== strapNow && T >= 0.02) { natoGo('out', T); rs.dep = 1; rs.nOut = true; rs.latch = N_LATCH; }
  if (!rs.dep && STRAPS[strapNow].links && strapNext && strapNext !== strapNow && BCL.cl > 0.001) { BCL.clTo = 0; if (!swapHold) swapT = Math.min(swapT, 0.01); return 0; }   /* a shut bracelet is opened first; the swap's clock waits for it */
  if (was < 0.34 && T >= 0.34 && !rs.nOut && !nNow) snd.strap(0);
  if (!rs.dep && T >= 0.7) { if (strapNext && strapNext !== strapNow) { if (strapNow === 'consulting' && upGone) railDrop('consulting'); else railFly(strapNow, 'rail', 0.7, sy0 + 12); rs.dep = 1; } else { if (strapNext === strapNow) tintNow(); strapNext = null; rs.dep = 2; } }
  if (rs.dep === 2) { if (was < 0.98 && T >= 0.98) snd.strap(1); if (!nNow) toolPose(T); if (T >= 1.2) railDone(); return nNow ? 0 : T < 0.38 ? 0 : T < 0.7 ? sm((T - 0.38) / 0.32) : sm(1 - (T - 0.7) / 0.34); }
  if (rs.dep === 1) {
    if (!rs.inK && T >= rs.latch) { rs.inK = strapNext || strapNow; strapNext = null; dress(STRAPS[rs.inK]);
      if (STRAPS[rs.inK].under) { natoGo('in', T); rs.toolIn = T; rs.arrAt = T + 9; } else { railFly(rs.inK, 'watch', rs.latch, 0); rs.arrAt = rs.latch + 0.06 + 0.84; rs.toolIn = rs.arrAt - 0.28; } }
    /* the tool: out with the old strap's bars (at once, or after the NATO has gone), in with the new one's */
    const tOut = rs.nOut ? T - 1.0 : T, tIn = rs.inK && rs.toolIn >= 0 ? T - rs.toolIn : -1; if (tIn >= 0 && tIn < 0.76) toolPose(tIn); else if (tOut >= 0 && tOut < 0.76) toolPose(tOut); else gTool.visible = false;
    if (rs.nOut && NT.bars && RS.writing.state === 'out' && T >= 1.37) { NT.bars = false; natoBarsSet(sy0); snd.strap(0); }   /* flags, not crossings, so a held clock still lands on the right side of each */
    if (rs.inK === 'writing' && !NT.bars && T >= rs.toolIn + 0.37) { NT.bars = true; natoBarsSet(sy0); snd.strap(1); }
    if (rs.arr >= 0) { if (rs.nIn) { if (T >= rs.arr + 0.2) railDone(); return 0; } if (!rs.click && T >= rs.arr + 0.3) { rs.click = true; snd.strap(1); } if (T >= rs.arr + 0.52) { railDone(); return 0; } return sm(1 - (T - rs.arr) / 0.35); }
    return 1; }
  if (!nNow) toolPose(T); return nNow ? 0 : T < 0.38 ? 0 : sm((T - 0.38) / 0.32); }
function railDone() { swapT = strapNext ? 0 : -1; gTool.visible = false; rsReset(); }
/* the carrying point's path. On a phone: over the top in one arc, a touch toward the visitor, clear of the case. On a desktop the display stands under the text, which has no backing,
   so a strap leaves it level or a little lower, runs out to the gutter left of the text (rl.gx, about 57vw) and only there turns up to the watch; going back it comes down the gutter and in */
const rP1 = new THREE.Vector3(), rP2 = new THREE.Vector3();
function flyPath(A, B, e, back, out) { const d = A.distanceTo(B);
  if (!rl.desk) { rC.addVectors(A, B).multiplyScalar(0.5); rC.y += 0.16 * d; rC.z += 0.24 * d; return out.copy(A).multiplyScalar((1 - e) * (1 - e)).addScaledVector(rC, 2 * (1 - e) * e).addScaledVector(B, e * e); }
  const D = back ? B : A, Wt = back ? A : B, low = D.y - rl.drop, gx = Math.min(rl.gx, D.x);
  if (back) { rP1.set(gx, Wt.y, Wt.z + 0.02 * d); rP2.set(gx, low, D.z + 0.02 * d); } else { rP1.set(gx, low, D.z + 0.02 * d); rP2.set(gx, Wt.y, Wt.z + 0.02 * d); }
  const a = (1 - e) * (1 - e) * (1 - e), b = 3 * (1 - e) * (1 - e) * e, c = 3 * (1 - e) * e * e, f = e * e * e;
  return out.copy(A).multiplyScalar(a).addScaledVector(rP1, b).addScaledVector(rP2, c).addScaledVector(B, f); }
/* each frame of a flight: the carrying point along its path, the turn by the shortest way, the size by ratio (so it reads as distance), the shape blended a little behind */
const rT = { A: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1 };
function flyTarget(R, H, sy0) { const st = R.st;
  if (H.tr.to === 'rail') { const P = R.slot.piv; rT.q.copy(P.getWorldQuaternion(rQ)).multiply(H.Q); rT.s = rl.s; rT.A.copy(H.A); P.localToWorld(rT.A); H.tgt = H.hang; H.tl = 0; if (H.kind === 'brace') H.Pt = H.pose; return; }
  const lift = sy0 + 12; rT.q.copy(root.quaternion); rT.s = root.scale.x; H.tl = lift;
  if (H.kind === 'brace') { H.Pt = brSeatP(lift, H.PtW); H.tgt = brPts(H.Pt, H.tgtB); } else H.tgt = wornChain(st, H.i, lift); anchorOf(H, H.tgt, lift, rT.A); rT.A.multiplyScalar(rT.s).applyQuaternion(rT.q).add(root.position); }
function railFlights(T, sy0) { let any = false;
  for (let ri = 0; ri < RSV.length; ri++) { const R = RSV[ri]; if ((R.state !== 'out' && R.state !== 'in') || R.st.under) continue; let all = true;
    R.halves.forEach((H) => { const tr = H.tr; if (!tr) return; any = true; flyTarget(R, H, sy0); const u = clamp((T - tr.t0) / tr.D, 0, 1), e = u * u * u * (u * (u * 6 - 15) + 10), toR = tr.to === 'rail', er = toR ? sSmooth(u / 0.8) : sSmooth((u - 0.15) / 0.8), obj = H.o.obj;   /* it only turns once it is clear of the board */
      /* a pair leaves its hook as one: the buckle is lifted off the prong, the long half slides down out of the keepers, and only then do the two part, each to its own lug. Going back
         they come together below the hook, the tail runs up into the keepers, and the buckle is set on the prong. pw is how much the two still move as one, pq how far the tail is out */
      const pw = tr.pair ? (toR ? sSmooth((u - 0.5) / 0.28) : 1 - sSmooth((u - 0.2) / 0.3)) : 0, pq = toR ? 1 - sSmooth((u - 0.62) / 0.38) : sSmooth(u / 0.42), ec = tr.pair ? (toR ? sSmooth(u / 0.52) : sSmooth((u - 0.3) / 0.62)) : sSmooth((u - 0.06) / 0.78);
      flyPath(tr.A0, rT.A, e, toR, rA); tr.vx = rT.A.x - tr.A0.x;
      if (tr.pair) { const hop = Math.sin(Math.PI * clamp(toR ? (u - 0.72) / 0.28 : u / 0.3, 0, 1)) * rl.s; rA.y += 5 * hop; }
      /* everything leaves the board by coming straight out of it toward the visitor, unhooked, and only then travels; going back it comes in from the front and is hung last. Never behind the board */
      if (tr.from === 'hang' || toR) rA.z += 90 * rl.s * (toR ? sSmooth((u - 0.04) / 0.46) * (1 - sSmooth((u - 0.84) / 0.16)) : sSmooth(u / 0.15) * (1 - sSmooth((u - 0.5) / 0.48)));
      obj.quaternion.slerpQuaternions(tr.q0, rT.q, er); const es = tr.to === 'rail' ? sSmooth(u * 1.3) : sSmooth((u - 0.22) / 0.78), s = tr.s0 * Math.pow(rT.s / tr.s0, es); obj.scale.setScalar(s);   // it shrinks as it leaves, and grows as it comes, so size reads as distance
      if (H.kind === 'brace') { brMix(H.P0, H.Pt, ec, tr.to !== 'rail', H.Pb); brPts(H.Pb, H.buf); H.o.fl = H.Pb.fl; } else { chainMix(H.c0, H.tgt, ec, H.buf); if (H.kind === 'len' && !reduce) { const b = Math.sin(Math.PI * u) * (1 - pw); chainFlex(H.buf, -0.55 * b * (H.i ? 1.15 : 1), 0.22 * b, 7 * u); } if (tr.pair && !H.i) { R.kf = [1 - sSmooth(pq * 2.4 - 1.2), 1 - sSmooth(pq * 2.4 - 0.2)]; R.tang = 0.35 * (toR ? e : 1 - e); } }   /* the clasp snaps shut; a strap bows as it flies */ tr.l = lerp(tr.l0, H.tl, e); tr.rel = tr.rel0 * (1 - e); shapeHalf(R, H, H.buf, tr.l, tr.rel);
      anchorOf(H, H.buf, tr.l, rB).multiplyScalar(s).applyQuaternion(obj.quaternion); obj.position.copy(rA).sub(rB);
      if (tr.pair && H.i && pw > 0 && R.rel) { const o0 = R.halves[0].o.obj; o0.updateMatrix(); rM.copy(o0.matrix).multiply(rM2.makeTranslation(0, 0, -pq * PAIR.D)).multiply(R.rel).decompose(rA, rQ2, rB); obj.position.lerp(rA, pw); obj.quaternion.slerp(rQ2, pw); obj.scale.lerp(rB, pw); }
      tr.done = u >= 1; if (!tr.done) all = false; });
    if (!all) continue;
    if (R.state === 'out') { const S = R.slot, vx = R.halves[0].tr ? R.halves[0].tr.vx : 1; railHang(R.k); if (!reduce) S.phV += (S.drape ? 0.12 : 0.42) * Math.sign(vx || 1); ping({ f: 3900, q: 6, dur: 0.02, vol: 0.035, sharp: 5, ring: 5600, ringVol: 0.12, ringDur: 0.05 }); }
    else if (R.state === 'in' && rs.inK === R.k && rs.arr < 0) { railArrive(R.k); rs.arr = swapT; } }
  return any; }
/* the new strap has reached the lugs: hand it to the watch exactly as it is, the physics holding the same curve */
function railArrive(k) { const R = RS[k], st = R.st; if (st.links) { BCL.cl = 0; BCL.clTo = 0; BCL.fl = 0; } railPutOn(k); strapNow = k; if (k === 'consulting' && pendTint != null) tintNow(); SIDES.forEach((S, i) => { S.turn = wornTurn(st, i, S.sy); S.v = 0; S.wob = 0; S.wv = 0; }); if (RS.upcycle) railVis(RS.upcycle); }
/* the page tells the display where to be: the empty block under the heading, with one button per strap. Each strap's job and years are set under it; the one on the watch is marked */
function railDom() { const p = panels.find((q) => q.dataset.ch === '1'); if (!p) return; p.classList.add('railed');
  const box = document.createElement('div'); box.className = 'rail3d'; box.id = 's-rail'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Straps on their board, newest first. Choose one to wear it');
  RJ.order.forEach((k) => { const b = document.createElement('button'), j = CT.jobs && CT.jobs[k], chip = (j && j.chip) || { consulting: 'Consulting', engineering: 'Engineering', quant: 'Quant', banking: 'Banking', writing: 'Journalism' }[k];
    b.dataset.strap = k; b.dataset.rail = k; b.innerHTML = '<span class="rj"></span><span class="ry"></span>'; b.children[0].textContent = chip; b.children[1].textContent = RJ.years[k]; b.setAttribute('aria-label', chip + ', ' + RJ.years[k] + ', ' + STRAPS[k].name.toLowerCase());
    b.addEventListener('pointerenter', (e) => railNudge(k, e.movementX || 1, 1)); b.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') railNudge(k, e.movementX, 0.25); }); b.addEventListener('pointerdown', () => railNudge(k, 1, 1.4)); box.appendChild(b); rl.btns.push(b); });
  box.addEventListener('keydown', (e) => { const i = rl.btns.indexOf(document.activeElement); if (i < 0) return; let n = -1; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = Math.min(rl.btns.length - 1, i + 1); if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = Math.max(0, i - 1); if (e.key === 'Home') n = 0; if (e.key === 'End') n = rl.btns.length - 1; if (n >= 0) { e.preventDefault(); e.stopPropagation(); rl.btns[n].focus(); } });
  const ch = p.querySelector('.chips'); ch.parentNode.insertBefore(box, ch.nextSibling); rl.el = box;
}
function railNudge(k, dx, g) { if (reduce || !rl.vis) return; const S = rl.slots[RJ.order.indexOf(k)]; if (!S) return; S.phV += clamp(dx * 0.02, -0.09, 0.09) * g * (S.drape ? 0.4 : 1); }
/* where the display is on the page and how big, in the scene: from the block's box, at the plane of the watch. Its size only changes when the block does */
function railLayout(visW, visH, slide) { const el = rl.el, r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(), w = r.width, h = r.height;
  if (Math.abs(w - rl.cw) > 0.5 || Math.abs(h - rl.ch) > 0.5) { rl.cw = w; rl.ch = h; const n = rl.btns.length, pitch = w / n, b0 = rl.btns[0], lab = b0 ? b0.children[0].offsetHeight + b0.children[1].offsetHeight + 18 : 46;
    { rl.ppm = Math.max(0.3, Math.min((h - lab - 6) / (RB.top + RB.drop + 2), pitch * 0.62 / 19.7)); rl.top = (RB.top + 1) * rl.ppm + 2; rl.rodL = W > 800 ? 0.93 * w / rl.ppm : w / rl.ppm + 10; rFurn(rl.rodL, rl.btns.map((b) => (b.offsetLeft + b.offsetWidth / 2 - w / 2) / rl.ppm)); }   /* on a desktop the board is drawn at about 93% of the column; on a phone it runs edge to edge */
    rl.slots.forEach((S, i) => { const b = rl.btns[i]; S.h.position.x = (b.offsetLeft + b.offsetWidth / 2 - w / 2) / rl.ppm; }); }
  const wpp = visH / H, px = r.left - sr.left + w / 2, py = r.top - sr.top + rl.top + slide; rl.s = rl.ppm * wpp;
  railG.position.set((px / W - 0.5) * visW, (0.5 - py / H) * visH, 0); railG.scale.setScalar(rl.s); }
/* phones: the sheet is opaque, except for a window where the display is */
function railSheet(mob) { const p = rl.el.parentNode; let v = ''; if (mob) { const a = rl.el.offsetTop - p.scrollTop, b = a + rl.el.offsetHeight; v = Math.round(a) + 'px,' + Math.round(b) + 'px'; } if (v === rl.mobBg) return; rl.mobBg = v;
  if (!mob) { p.style.removeProperty('--rh0'); p.style.removeProperty('--rh1'); return; } const ab = v.split(','); p.style.setProperty('--rh0', ab[0]); p.style.setProperty('--rh1', ab[1]); }
/* every frame, while the strap chapter is anywhere near (or a strap is in the air): place the display, swing what hangs, fly what flies */
let railDressAt = 0;
function railTick(dt, pe, je, sy0, mob, visW, visH) { if (!rl.el) return;
  const o = jump ? (jump.i === 1 ? clamp(je * 3 - 2, 0, 1) : clamp(1 - je * 3, 0, 1) * (rl.vis > 0.004 ? 1 : 0)) : clamp(1 - Math.abs(pe - 1) * 2.4, 0, 1), vis = intro.on ? 0 : o, busy = swapT >= 0 && rs.dep === 1;
  if (vis <= 0.3 && !intro.on && !jump && railDressAt >= 0 && performance.now() > railDressAt) { const R = RSV.find((q) => q.st.maps && !q.st.dressed); if (R) { dress(R.st); railDressAt = performance.now() + 700; } else railDressAt = -1; }   /* straps are dressed ahead of time, one every 0.7 s away from the display, so it never shows bare leather */
  rl.vis = vis; if (vis < 0.004 && !busy) { if (railG.visible) railG.visible = false; return; }
  railG.visible = vis > 0.004; const dir = jump ? (jump.i === 1 ? 1 : -1) : (pe < 1 ? 1 : -1), slide = (1 - sSmooth(vis)) * 30 * dir;   // it fades in with the page, drifting up a little, and leaves the same way
  railSheet(mob); railLayout(visW, visH, slide); rl.desk = !mob; rl.gx = 0.02 * visW; rl.drop = 0.04 * visH;   // the gutter at 56vw, just left of the text column
  const op = sSmooth(vis), tr = op < 0.999; RFURN.forEach((m) => { m.opacity = op; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } });
  if (Math.abs(op - rl.op) > 1e-4 || rl.opDirty) { rl.op = op; rl.opDirty = false; railFade(rl.rsh || (rl.rsh = [...RSH.values()]), op); for (let ri = 0; ri < RSV.length; ri++) if (RSV[ri].state === 'hang' || RSV[ri].state === 'out') railFade(RSV[ri].own, op); }
  rl.t += dt; const t = rl.t;
  /* scrolling into the chapter disturbs what hangs: each strap is set swinging about a fifth wider than its usual sway, each a little differently, and settles in two or three seconds */
  if (vis > 0.5 && !rl.inCh) { rl.inCh = true; rl.jt = reduce ? -1 : t; } else if (vis < 0.08) rl.inCh = false;
  for (let si = 0; si < rl.slots.length; si++) { const S = rl.slots[si]; let loaded = false; for (let ri = 0; ri < RSV.length; ri++) if (RSV[ri].slot === S && RSV[ri].state === 'hang') loaded = true;
    const tj = rl.jt >= 0 ? t - rl.jt : 99, jig = tj < 7 ? 1.5 * S.amp * (0.85 + 0.3 * Math.abs(Math.sin(S.p0 * 3))) * (si & 1 ? -1 : 1) * Math.exp(-tj / 1.3) * Math.sin(S.w0 * 1.1 * tj + 0.25 * si) : 0,   /* scrolled into: a swing about twice the usual, dying away over three or four seconds */
      idle = reduce ? 0 : S.amp * (loaded ? 1 : 0.35) * (0.62 + 0.38 * Math.sin(t * S.e0 * S.w0 + S.p0 * 1.7)) * Math.sin(S.w0 * t + S.p0) + jig, w = S.w0, wh = 4.6, n = 3, h = dt / n;
    for (let q = 0; q < n; q++) { S.phV += (-w * w * S.ph - 2 * 0.11 * w * S.phV) * h; S.ph += S.phV * h; S.hkV += (-wh * wh * S.hk - 2 * 0.09 * wh * S.hkV) * h; S.hk += S.hkV * h; }
    /* whatever hangs from a prong swings on it as one pendulum (the hook itself is fixed in the board) */
    S.piv.rotation.z = idle + S.ph + 0.5 * S.hk; }
  railG.updateMatrixWorld(true);
  for (let ri = 0; ri < RSV.length; ri++) { const R = RSV[ri], st = R.st; if (st.len && R.state !== 'worn') { st.mats[1].color.copy(st.mat.color); if (st.nap) st.mats.forEach((m) => napSheen(m.sheenColor, st.mat.color)); if (R.k === 'consulting' || R.k === 'upcycle') R.mlR.color.copy(st.mat.color).multiplyScalar(0.6); else R.mlR.color.setHex(st.base).multiplyScalar(0.8); R.mlR.roughness = st.nap ? 0.95 : 0.52; } }
  if (RS.upcycle && RS.upcycle.state === 'hang' && RS.upcycle.halves[0].o.obj.visible !== upGone) railVis(RS.upcycle);
  if (pendTint != null && railOff('consulting')) { const sc = STRAPS.consulting, tc = tintC.setHex(pendTint), k = 1 - Math.exp(-dt * 5); sc.mat.color.lerp(tc, k); sc.matEnd.color.lerp(tc, k); if (Math.abs(sc.mat.color.r - tc.r) + Math.abs(sc.mat.color.g - tc.g) + Math.abs(sc.mat.color.b - tc.b) < 0.004) tintNow(); }
  if (vis > 0.3 && railDressAt >= 0 && performance.now() > railDressAt) { let st = null; for (let ri = 0; ri < RSV.length; ri++) { const R = RSV[ri]; if (R.state === 'hang' && (!R.halves[0] || R.halves[0].o.obj.visible) && R.st.maps && !R.st.dressed) st = R; } if (st) { dress(st.st); railDressAt = performance.now() + 120; } else if (RSV.every((R) => !R.st.maps || R.st.dressed)) railDressAt = -1; }   // anything still undressed when the display first shows is dressed here, one per beat
  railFlights(swapT, sy0); natoTick(swapT, sy0); }
const tintC = new THREE.Color();
/* phones: the watch's own strap can reach down behind the sheet's window. The window is drawn once more on its own, with nothing in it but the display and what is flying to or from it */
const rKeep = [];
function railOverlay(mob) { if (!mob || !rl.el || rl.vis < 0.004 || !railG.visible) return; const r = rl.el.getBoundingClientRect(), sr = stage.getBoundingClientRect(), y = r.top - sr.top, bot = Math.min(H, y + r.height + 16), top = Math.max(0, y - 22);   /* over the sheet's fades into and out of the window too, so the watch never shows through them */
  if (bot - top < 2) return; rKeep.length = 0;
  for (let c = 0; c < scene.children.length; c++) { const o = scene.children[c]; if (!o.visible || o === railG || o === glow || o.isLight || o === key.target || o.userData.railFly) continue; o.visible = false; rKeep.push(o); }
  const au = renderer.autoClear, su = renderer.shadowMap.autoUpdate; renderer.autoClear = false; renderer.shadowMap.autoUpdate = false; renderer.setScissorTest(true); renderer.setScissor(0, H - bot, W, bot - top); renderer.clear(true, true, false); renderer.render(scene, camera);
  renderer.setScissorTest(false); renderer.autoClear = au; renderer.shadowMap.autoUpdate = su; rKeep.forEach((o) => { o.visible = true; }); }
/* fading the display: a strap in its place fades with its own materials. The few it shares with the strap on the watch (spring bars, buckle steel, the quick release levers) are swapped for copies while it is off the watch */
const RSH = new Map(), railMat = (m) => { if (!RSH.has(m)) { const c = m.clone(); c.userData = Object.assign({}, m.userData, { bo: m.opacity, bt: m.transparent }); RSH.set(m, c); } return RSH.get(m); };
function railMats() { const shared = new Set([mBar]); gBuckle.traverse((o) => { if (o.isMesh && o.material !== STRAPS.consulting.ml) shared.add(o.material); }); QR.forEach((q) => q.piv.traverse((o) => { if (o.isMesh && o.material.opacity > 0) shared.add(o.material); }));
  Object.values(RS).forEach((R) => { const own = new Set(); R.swap = []; const objs = R.halves.map((H) => H.o.obj).concat(R.st.natoG ? [R.st.natoG, R.st.objs[0].obj, R.st.objs[1].obj] : []);
    objs.forEach((g) => g.traverse((o) => { if (!o.isMesh || o === gBuckle || cKeep.some((K) => K.m === o)) return; let p = o.parent; while (p) { if (p === gBuckle) return; p = p.parent; }
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((x, j) => { if (x.opacity === 0) return; if (shared.has(x)) R.swap.push([o, j, x, railMat(x)]); else own.add(x); }); }));
    R.own = [...own]; R.own.forEach((x) => { if (x.userData.bo == null) { x.userData.bo = x.opacity; x.userData.bt = x.transparent; } }); }); }
function railSwapMats(R, rail) { if (!R.swap) return; R.swap.forEach(([o, j, a, b]) => { if (Array.isArray(o.material)) o.material[j] = rail ? b : a; else o.material = rail ? b : a; }); }
function railFade(ms, op) { const tr0 = op < 0.999; ms.forEach((x) => { x.opacity = x.userData.bo * op; const tr = x.userData.bt || tr0; if (x.transparent !== tr) { x.transparent = tr; x.needsUpdate = true; } }); }
if (RAIL) { railInit(); railMats(); Object.values(RS).forEach((R) => { if (R.state !== 'worn') railSwapMats(R, true); }); }

/* ---------- hotspot anchors ---------- */
const anchors = {};
function anchor(k, parent, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); anchors[k] = o; }
anchor('sec', gDial, SX, 0, ZD + 0.4); anchor('moon', gDial, 0, MC, ZD + 0.2); anchor('date', gDial, DX, 0, ZD + 0.2);
if (typeof CB_PINS !== 'undefined') { Object.entries(CB_PINS).forEach(([k, v]) => { anchor('i-' + k, v.g, v.p[0], v.p[1], v.p[2]); anchor('z-' + k, v.g, v.p[0], v.p[1], v.p[2]); }); anchors['z-soccer'].removeFromParent(); anchor('z-soccer', gBr, MR[0], MR[1], BTOP); anchors['z-cooking'].position.set(lerp(PBAL[0], SBC[0], 0.42), lerp(PBAL[1], SBC[1], 0.42), ZCT); anchors['z-snow'].position.set(lerp(SBC[0], PBAL[0], 0.3), lerp(SBC[1], PBAL[1], 0.3), ZLOW); }   // the camera goes to the middle of the rotor, which stays put
if (typeof CB_PINS !== 'undefined') void 0;   // under the hood: four parts that are not quite standard
else { anchor('i-soccer', mov, PBAL[0] - CKU[1] * RBS * 0.9, PBAL[1] + CKU[0] * RBS * 0.9, BTOP); anchor('i-cooking', gBr, PBAL[0], PBAL[1], ZCT + 0.6); anchor('i-snow', gBr, PE[0], PE[1], BTOP + 0.8); anchor('i-music', gBr, PB[0], PB[1], BTOP + 0.8); }

const FOCUS = { date: [DX, 0], moon: [0, MC], sec: [SX, 0] }, FSC = { date: 16.5, moon: 6.2, sec: 4.6 };


/* ---------- time and mechanism ---------- */
const mesh = (a, NA, pa, pb, NB) => { const al = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]); return al + Math.PI - (Math.PI - NA * (al - a)) / NB; };
const tzOff = -new Date().getTimezoneOffset() * 60;
const today = new Date().getDate();
let dateRot = (today - 1) * DSTEP, moonRot = 0, moonTarget = 0, secNow = 0, secDisp = 0, secSteps = 0, nextBeat = 0, tickGain = 0.35;
const BPS = 5;   // 18,000 beats an hour: the unhurried beat of a vintage movement. Repetitive clicks speed up our sense of time, so slower is calmer
const H1010 = (10 + 10 / 60) / 12 * TAU;
function mechanism(setW) {
  const t = Date.now() / 1000 + tzOff, b = t * BPS, fb = b - Math.floor(b), step = Math.min(1, fb * 5);
  const tt = ((Math.floor(b) + step) / BPS) % 43200; secNow = tt % 60;
  const aH = tt / 43200 * TAU, hr = aH + (((H1010 - aH + Math.PI) % TAU + TAU) % TAU - Math.PI) * setW;   // rolls the short way round to 10:10
  if (focus === 'sec') secDisp += (secSteps * TAU / DATA.sec.items.length - secDisp) * (snap ? 1 : 0.3); else secDisp = secNow / 60 * TAU;
  hSec.rotation.z = -secDisp; hHour.rotation.z = -hr; hMin.rotation.z = -hr * 12; dialTick(t, hr);
  // each tick is booked on the audio clock a little ahead, for the instant the balance passes the middle of its swing, so frame hiccups never smear the rhythm
  if (actx && actx.state === 'running' && !muted && !document.hidden && !focus && !intro.on && !needle && zoomK !== 'cooking' && zoomK !== 'snow' && zoomK !== 'soccer') { if (nextBeat <= b) nextBeat = Math.floor(b) + 1; while (nextBeat / BPS - t < 0.12) { snd.tick(nextBeat % 2, nextBeat / BPS - t, tickGain); nextBeat++; } } else nextBeat = 0;
  const pull = Math.sin(Math.PI * setW); gCrown.position.x = 19.7 + 1.3 * pull; gCrown.rotation.x = hr * 12 * (pull > 0.001 ? 1 : 0);
  const aC = tt / 3600 * TAU; gCenter.rotation.z = aC;
  gBarrel.rotation.z = mesh(aC, 12, PC, PB, 72);
  const aT = mesh(aC, 64, PC, PT, 8); gThird.rotation.z = aT;
  const aF = mesh(aT, 60, PT, PF, 8); gFourth.rotation.z = aF;
  gEsc.rotation.z = mesh(aF, 84, PF, PE, 7);
  const sgn = Math.floor(b) % 2 ? 1 : -1; gPal.rotation.z = lerp(-sgn, sgn, step) * rad(6.5);
  const ba = 4.3 * Math.sin(TAU * BPS / 2 * t);   // through the middle exactly on each beat
  gBal.rotation.z = ba; hair.rotation.z = ba * 0.5; hair.scale.setScalar(1 - ba * 0.022);
  dateDisc.rotation.z = uRing.rotation.z = dateRot; uHour.rotation.z = -hr; uCannon.rotation.z = -hr * 12; uMinute.rotation.z = hr * 4 + 0.09; uDay.rotation.z = hr / 2 + 2.2; uMoonDrive.rotation.z = hr * 2; uMoon.rotation.z = moonRot; moonRot += (moonTarget - moonRot) * (snap ? 1 : 0.09); moonDisc.rotation.z = moonRot;
}
const gv = new THREE.Vector3(), qi = new THREE.Quaternion(), gravW = new THREE.Vector3(0, -1, 0);   // gravW: which way is down, in the scene
let wound = 0, rotPrev = rotA;   // only one way of the rotor winds; the other way the clutch pinion slips
function rotorPhysics(dt) {
  gv.copy(gravW).applyQuaternion(qi.copy(root.quaternion).invert());
  const lx = -gv.x, ly = gv.y, mag = Math.hypot(lx, ly), phi = Math.atan2(ly, lx);
  const n = 4, h = dt / n; for (let i = 0; i < n; i++) { rotV += (-55 * mag * Math.sin(rotA - phi) - (zoomK === 'soccer' ? 9 : 1.6) * rotV) * h; rotA += rotV * h; }
  const dA = rotA - rotPrev; rotPrev = rotA; if (dA > 0) wound += dA;
  gRot.rotation.z = rotA; aPin.rotation.z = rotA; aR1.rotation.z = mesh(rotA, NROT, MR, PWA, NA1);
  const aP = -wound * NROT / NA1; aR1p.rotation.z = aP;
  const aB = mesh(aP, NAP, PWA, PWB, NB1); aR2.rotation.z = aB;
  const aRt = mesh(aB, NDRV, PWB, PB, NRAT); gRat.rotation.z = aRt;
  const aI = mesh(aRt, NRAT, PB, PINT, NINT); gInt.rotation.z = aI; gCrw.rotation.z = mesh(aI, NINT, PINT, PCW, NCRW);
  const cq = (((Math.PI - aRt) * NRAT / TAU) % 1 + 1) % 1; gClick.rotation.z = 0.065 * (cq > 0.5 ? (cq - 0.5) * 2 : cq < 0.2 ? 1 : 0);   // the click rides up each tooth and drops behind it
}

/* ---------- sound: synthesised watch noises. Nothing plays until the visitor has touched the page. ---------- */
let actx = null, muted = false, master = null, vol = 0.5;
function audioOn() { if (muted) return; if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = vol * 0.7; master.connect(actx.destination); } catch (e) {} } else if (actx.state === 'suspended') actx.resume(); }
function ping(o) { if (!actx || muted || actx.state !== 'running') return; try { const t = actx.currentTime + (o.when || 0), len = Math.max(64, Math.floor(actx.sampleRate * (o.dur || 0.02))), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, o.sharp || 5);
  const n = actx.createBufferSource(); n.buffer = buf; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q || 3; const g = actx.createGain(); g.gain.value = o.vol; n.connect(f).connect(g).connect(master); n.start(t);
  if (o.ring) { const os = actx.createOscillator(), og = actx.createGain(); os.type = 'triangle'; os.frequency.value = o.ring; og.gain.setValueAtTime(o.vol * (o.ringVol || 0.2), t); og.gain.exponentialRampToValueAtTime(0.0001, t + (o.ringDur || 0.03)); os.connect(og).connect(master); os.start(t); os.stop(t + (o.ringDur || 0.03) + 0.01); }
  if (o.thump) { const os = actx.createOscillator(), og = actx.createGain(); os.frequency.setValueAtTime(o.thump, t); os.frequency.exponentialRampToValueAtTime(o.thump * 0.45, t + 0.05); og.gain.setValueAtTime(o.vol * 0.8, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); os.connect(og).connect(master); os.start(t); os.stop(t + 0.08); } } catch (e) {} }
/* graphite on paper: a dry, broadband scratch, gritty with the tooth of the paper, loudest where the stroke moves fastest, silent where the lead lifts */
function pencil(strokes) { if (!actx || muted || actx.state !== 'running') return; try {
  const sr = actx.sampleRate, end = Math.max(...strokes.map((s) => s.t + s.d)) + 0.05, n = Math.ceil(end * sr), buf = actx.createBuffer(1, n, sr), d = buf.getChannelData(0); let grit = 0.5;
  for (const s of strokes) { const i0 = Math.floor(s.t * sr), i1 = Math.min(n, Math.floor((s.t + s.d) * sr));
    for (let i = i0; i < i1; i++) { const u = (i - i0) / (i1 - i0), speed = Math.pow(Math.sin(Math.PI * u), 0.6) * (1 + 0.35 * Math.sin(u * TAU * s.w));
      grit += (Math.random() - grit) * 0.02; const tooth = 0;
      d[i] += ((Math.random() * 2 - 1) * (0.5 + grit) + tooth) * speed * s.v; } }
  const src = actx.createBufferSource(); src.buffer = buf; const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380; hp.Q.value = 0.5;
  const pk = actx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1200; pk.Q.value = 0.7; pk.gain.value = 2; const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2100; lp.Q.value = 0.3;   // muted: soft lead over the old word, no shriek
  const g = actx.createGain(); g.gain.value = 0.05; src.connect(hp).connect(pk).connect(lp).connect(g).connect(master); src.start(); } catch (e) {} }
const snd = {
  // lever escapement at 18,000: unlock, impulse, drop inside 12 ms. Lower and softer than a stopwatch, and every other beat a shade lower (tick, tock)
  tick: (odd, when = 0, g = 1) => { const p = odd ? 0.9 : 1; ping({ when, f: 3100 * p, q: 2.6, dur: 0.008, vol: 0.006 * g, sharp: 5 }); ping({ when: when + 0.006, f: 3900 * p, q: 3, dur: 0.012, vol: 0.013 * g, sharp: 5, ring: 5400 * p, ringVol: 0.2, ringDur: 0.008 }); ping({ when: when + 0.012, f: 2600 * p, q: 2.4, dur: 0.012, vol: 0.009 * g, sharp: 5 }); },
  // instantaneous date: jumper lets go, disc lands 12 ms later
  date: () => { ping({ f: 3400, q: 2.4, dur: 0.014, vol: 0.05, sharp: 6 }); ping({ when: 0.012, f: 2400, q: 2, dur: 0.04, vol: 0.085, sharp: 5, ring: 3100, ringVol: 0.08, ringDur: 0.02 }); },
  // moon disc: two lighter clicks 40 ms apart
  moon: () => { ping({ f: 3200, q: 2.2, dur: 0.04, vol: 0.12, sharp: 4 }); ping({ when: 0.04, f: 4200, q: 2.6, dur: 0.04, vol: 0.09, sharp: 4 }); },
  // seconds hand stepped: one very short, bright click
  sec: () => ping({ f: 6800, q: 3, dur: 0.008, vol: 0.07, sharp: 8, ring: 7600, ringVol: 0.2, ringDur: 0.006 }),
  // the box: a magnetic catch lets go, then the lid settles on its stays
  lid: () => { ping({ f: 2300, q: 2.5, dur: 0.018, vol: 0.07, sharp: 6 }); ping({ when: 0.9, f: 420, q: 1.2, dur: 0.09, vol: 0.09, sharp: 3, thump: 95 }); },
  // the box shaken with a watch inside: soft knocks on the table, and a muffled clink of steel against the cushion
  rattle: (n) => { const k = n > 1 ? 9 : 6, g = n > 1 ? 1.25 : 1; for (let i = 0; i < k; i++) { const d = 1 - i / k, t = i * 0.075 + Math.random() * 0.02; ping({ when: t, f: 600 + Math.random() * 400, q: 1.3, dur: 0.05, vol: 0.07 * g * d, sharp: 3, thump: 95 + Math.random() * 30 }); if (i % 2 === 0) ping({ when: t + 0.018, f: 4400 + Math.random() * 1400, q: 5, dur: 0.012, vol: 0.022 * g * d, sharp: 6, ring: 5800, ringVol: 0.15, ringDur: 0.02 }); } },
  // a pin buckle let go: the tang lifts out of its hole, the frame knocks the leather
  buckle: () => { ping({ f: 5200, q: 6, dur: 0.012, vol: 0.05, sharp: 6, ring: 7400, ringVol: 0.2, ringDur: 0.03 }); ping({ when: 0.07, f: 2100, q: 2, dur: 0.03, vol: 0.05, sharp: 4, thump: 160 }); },
  // oil and noodles tossed in a hot pan
  sizzle: (g) => { for (let i = 0; i < 3; i++) ping({ when: i * 0.03, f: 5200 + Math.random() * 2600, q: 0.7, dur: 0.07, vol: 0.022 * g, sharp: 1.2 }); },
  // a pen strikes a word out, then writes another over it
  // a pencil: one quick stroke through the word, then c, a, p, s in four little runs
  scribble: () => pencil([{ t: 0, d: 0.28, v: 1, w: 1 }, { t: 0.4, d: 0.11, v: 0.55, w: 1.5 }, { t: 0.53, d: 0.09, v: 0.5, w: 2 }, { t: 0.63, d: 0.05, v: 0.45, w: 1 }, { t: 0.71, d: 0.08, v: 0.5, w: 1 }, { t: 0.8, d: 0.08, v: 0.45, w: 2 }, { t: 0.9, d: 0.11, v: 0.5, w: 2 }]),
  strap: (seat) => seat ? ping({ f: 1900, q: 3, dur: 0.02, vol: 0.1, thump: 150 }) : ping({ f: 3000, q: 4, dur: 0.012, vol: 0.11, ring: 4600, ringVol: 0.18, ringDur: 0.02 })
};
addEventListener('pointerdown', audioOn, { passive: true });
const sndBtn = $('snd'), volEl = $('vol'); let lastVol = 50;
const setVol = () => { vol = volEl.value / 100; muted = vol < 0.005; if (master) master.gain.value = vol * 0.7; sndBtn.dataset.lv = muted ? 0 : vol < 0.5 ? 1 : 2; sndBtn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); sndBtn.setAttribute('aria-pressed', !muted); if (!muted) audioOn(); };
sndBtn.onclick = () => { if (muted) volEl.value = lastVol || 50; else { lastVol = +volEl.value; volEl.value = 0; } setVol(); };
volEl.oninput = setVol;


/* ---------- choreography ---------- */
const NAMES = ['Start', 'Experience', 'Side projects', 'Projects', 'Articles / blogs', 'Film', 'Background and interests', 'Contact'], N = NAMES.length, CD = 2, CB = 6;
/* chapters 3 to 5 are the complications, visited in this order as you scroll: the camera goes in to each one and stops there */
const STOP = ['moon', 'sec', 'date'], S0 = 3, stopCh = (k) => S0 + STOP.indexOf(k);
/* the three works can change places for one visit: whichever one a visitor jumps to from outside comes first, and the other two follow in their
   usual order, so scrolling on from it still passes through all three before the caseback. Back at the dial, the usual order returns */
const WORK0 = ['moon', 'sec', 'date'], WNAME = { moon: 'Projects', sec: 'Articles', date: 'Film' }, RNAME = { moon: 'Projects', sec: 'Articles / blogs', date: 'Film' }, seenW = new Set();
// z: [crystal, hands, dial, movement, back]   o: ORDER   sy: how far the straps have come off
const KD = { rx: -10, ry: 0, rz: 0, sc: 1.08, sy: 16, f: [0, 0, 6], z: [22, 11, 11, 0, 0], o: [0, 1, 1, 1, 1, 1, 1, 1, 0] };
const K = [
  { rx: -16, ry: 24, rz: 0, sc: 0.92, sy: 0, f: [0, 0, -2], z: [0, 0, 0, 0, 0], o: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { rx: -34, ry: -36, rz: 8, sc: 0.84, sy: 0, f: [0, 0, -6], z: [0, 0, 0, 0, 0], o: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  KD, KD, KD, KD,
  { rx: 14, ry: 180, rz: 0, sc: 1.1, sy: 16, f: [0, 0, -2], z: [0, 0, 0, 0, 0], o: [1, 1, 1, 1, 1, 1, 1, 1, 0] },
  { rx: -16, ry: 384, rz: 0, sc: 0.92, sy: 0, f: [0, 0, -2], z: [0, 0, 0, 0, 0], o: [1, 1, 1, 1, 1, 1, 1, 1, 1] }];
const BG = NAMES.map(() => [13, 17, 23]);   // the room stays the same; only the watch moves
const track = $('track'), rail = $('rail'), panels = [...document.querySelectorAll('.panel')], hots = [...document.querySelectorAll('.hot')], scrim = $('scrim');
/* once a dot or handle has been tried, it turns from pink to brass for the rest of the visit */
['pointerdown', 'click'].forEach((ev) => document.addEventListener(ev, (e) => { const h = e.target.closest && e.target.closest('.hot'); if (h) h.classList.add('done'); }, true));
/* SNAP: each chapter is a stop the browser itself settles on (CSS scroll snap, one stop per flick, wheel notch or key), so nothing ever holds the page back.
   false brings back free scrolling with the old detents. The stops sit one pitch apart; the pitch is set once from the screen height and only
   changes when the width does (or a desktop window's height), so a phone's toolbar sliding in and out never moves them */
const SNAP = true; let PITCH = 0, pitchW = 0;
const marks = SNAP ? NAMES.map((n, k) => { const m = document.createElement('div'); m.className = 'snapm'; m.setAttribute('aria-hidden', 'true'); track.appendChild(m); return m; }) : [];
function pitchSet() { const w = innerWidth, h = innerHeight; if (PITCH && w === pitchW && (w <= 800 || Math.abs(h * 1.05 - PITCH) < 2)) return;
  const was = PITCH ? scrollY / PITCH : 0; pitchW = w; PITCH = Math.max(320, Math.round(h * 1.05));
  if (SNAP) { track.style.height = 'calc(' + PITCH * (N - 1) + 'px + 100vh)'; marks.forEach((m, k) => { m.style.top = k * PITCH + 'px'; }); } else track.style.height = (1 + (N - 1) * 1.05) * 100 + 'vh';
  if (was) window.scrollTo({ top: Math.round(was) * PITCH, behavior: 'instant' }); }
pitchSet(); addEventListener('resize', pitchSet); window.__N = N - 1;
if (SNAP) document.documentElement.classList.add('snap');
/* a mouse wheel or trackpad under SNAP: the browser alone would snap a single wheel notch straight back to where it was, so each gesture moves
   exactly one chapter, in its direction, the moment it starts. A gesture is a run of wheel events with no pause longer than 180 ms; a trackpad's
   gliding tail belongs to the flick that started it, but a fresh, harder flick during that tail counts as new. Panels that scroll on their own
   (the sheet on a phone) keep the wheel until they reach their end */
const WG = { t: 0, t0: 0, sign: 0, abs: 0, acc: 0, done: false, to: -1, at: 0 };
function wheelStep(dir) { const now = performance.now(), base = now - WG.at < 900 && WG.to >= 0 ? WG.to : Math.round(scrollY / PITCH), k = clamp(base + dir, 0, N - 1);
  WG.at = now; if (k === base) return; WG.to = k; window.scrollTo({ top: k * PITCH, behavior: reduce ? 'instant' : 'smooth' }); }
if (SNAP) addEventListener('wheel', (e) => {
  if (intro.on || jump || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1); if (!d) return;
  const sc = e.target.closest && e.target.closest('.panel, #focus'); if (sc && sc.scrollHeight > sc.clientHeight + 2 && (d > 0 ? sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1 : sc.scrollTop > 0)) return;
  e.preventDefault(); const now = e.timeStamp, sign = Math.sign(d), a = Math.abs(d), gap = now - WG.t;
  if (gap > 180 || sign !== WG.sign || (a > WG.abs * 1.6 && a > 12 && now - WG.at > 280) || (now - WG.t0 > 1800 && a >= 4)) { WG.t0 = now; WG.acc = 0; WG.done = false; }
  WG.t = now; WG.sign = sign; WG.abs = a; WG.acc += d;
  if (!WG.done && Math.abs(WG.acc) >= 24) { WG.done = true; wheelStep(sign); } }, { passive: false });
const total = () => SNAP ? PITCH * (N - 1) : track.offsetHeight - innerHeight;
/* the catch: someone skimming without touching anything gets a short pause the first time they reach each chapter, so they land on it once.
   Anyone who has used something on the page scrolls freely */
const caught = new Array(N).fill(false); caught[0] = true; let brakeUntil = 0, brakeAt = 0, brakeY = 0, sPrev = 0, wheelLast = 0; const BRW = 0.13, DWELL = 650, braking = () => { if (SNAP) return false; const now = performance.now(); if (now < brakeUntil) return true; if (brakeAt && now - wheelLast < 160 && now - brakeAt < 2600) { brakeUntil = now + 60; return true; } return false; };   /* a detent holds for DWELL ms, and for as long as a flick's momentum is still arriving */
addEventListener('wheel', (e) => { wheelLast = performance.now(); if (braking()) e.preventDefault(); }, { passive: false });
addEventListener('wheel', (e) => { if (braking()) e.preventDefault(); }, { passive: false });
/* anyone who has used something on the page (a chip, a dot, a dial, the watch itself) is looking, not skimming: from then on the scroll is free */
let engaged = false; const engage = () => { if (!intro.on) engaged = true; };
document.addEventListener('click', (e) => { if (e.target.closest('button, a, input, [role=button]')) engage(); }, true); canvas.addEventListener('pointerdown', engage);
addEventListener('touchmove', (e) => { if (braking()) e.preventDefault(); }, { passive: false });
addEventListener('keydown', (e) => { if (braking() && ['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) e.preventDefault(); });
let lockOff = false;
function brakeCheck() { let s = clamp(scrollY / total(), 0, 1) * (N - 1);
  if (!SNAP && !fixDone && !lockOff && !jump && !intro.on && s > 1.1) { window.scrollTo({ top: total() * 1.1 / (N - 1), behavior: 'instant' }); s = 1.1; }   // nobody scrolls past the strap chapter until the pen has made its correction
  if (braking()) { if (Math.abs(scrollY - brakeY) > 2) scrollTo({ top: brakeY, behavior: 'instant' }); sPrev = s; return; }
  if (!SNAP && !jump && !intro.on && s > sPrev) for (let k = Math.floor(sPrev + BRW) + 1; k <= Math.floor(s + BRW) && k < N; k++) if (k > 0) { caught[k] = true; brakeY = total() * k / (N - 1); brakeAt = performance.now(); brakeUntil = brakeAt + DWELL; ping({ f: 3200, q: 4, dur: 0.025, vol: 0.05, sharp: 5 }); scrollTo({ top: brakeY, behavior: 'instant' }); break; }   // a short pause, then they are free to go on
  sPrev = clamp(scrollY / total(), 0, 1) * (N - 1); }
const CHOLD = 0.12, settle = (s) => { const i = Math.floor(s), f = s - i; return i + clamp((f - CHOLD) / (1 - 2 * CHOLD), 0, 1); };   // each chapter holds still for a stretch of scroll before the next moves in
const stopKey = (c) => c > S0 - 0.5 && c < S0 + 2.5 ? STOP[clamp(Math.round(c) - S0, 0, 2)] : null;
const ease = (t) => { t = clamp((t - 0.1) / 0.8, 0, 1); return t * t * (3 - 2 * t); };
const snap = location.hash.startsWith('#snap');
const reduce = snap || matchMedia('(prefers-reduced-motion:reduce)').matches;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
function poseAt(c) { const i = Math.min(N - 2, Math.floor(c)), t = ease(c - i), a = K[i], b = K[i + 1]; return { rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), rz: lerp(a.rz, b.rz, t), sc: lerp(a.sc, b.sc, t), sy: lerp(a.sy, b.sy, t), f: mix(a.f, b.f, t), z: mix(a.z, b.z, t), o: mix(a.o, b.o, t), bg: mix(BG[i], BG[i + 1], t), pe: i + t }; }
/* a jump is its own move: straight from wherever the watch is to the chosen chapter, never through the ones between.
   That includes the zoom: a jump that crosses the three complications does not dive into them on the way past */
let cur = 0, jump = null, lastPose = poseAt(0), zNow = { fe: 0, c: [0, MC], s: 6.2, r: 3.1, k: null };
function zsnap(c) { focusPath(c); return { fe: focusAmount(c), c: FZ.c.slice(), s: FZ.s, r: FZ.r, k: stopKey(c) }; }
function jumpTo(i, then) { caught[i] = true; sPrev = i; if (i > 1) lockOff = true;   // a jump is not a skim: the catch leaves it alone
  const top = total() * i / (N - 1);
  if (reduce) { window.scrollTo(0, top); cur = i; if (then) then(); return; }
  const to = Object.assign({}, K[i], { bg: BG[i] }); to.ry = to.ry + 360 * Math.round((lastPose.ry - to.ry) / 360);
  jump = { from: lastPose, to, i, c0: cur, t: 0, then, far: Math.abs(i - cur), zA: { fe: zNow.fe, c: zNow.c.slice(), s: zNow.s, r: zNow.r, k: zNow.k }, zB: zsnap(i) };
  window.scrollTo({ top, behavior: 'instant' }); cur = i;
}
/* the strap display's test pages (window.STRAPSKIP): no unboxing, and the page opens on the Strap chapter. Without the flag nothing here changes */
const SKIP = !!window.STRAPSKIP;
if (SKIP) { caught[1] = true; sPrev = 1; cur = 1; window.scrollTo(0, total() / (N - 1)); }
NAMES.forEach((n, i) => { const b = document.createElement('button'); b.textContent = n; b.setAttribute('aria-label', 'Go to ' + n); if (i >= S0 && i < S0 + 3) b.className = 'sub'; b.onclick = () => (i >= S0 && i < S0 + 3 ? goWork(STOP[i - S0]) : jumpTo(i)); rail.appendChild(b); });
const inWork = () => { const c = jump ? jump.i : Math.round(cur); return c >= S0 && c < S0 + 3; };
function workOrder(list) { STOP.splice(0, 3, ...list); [...rail.children].slice(S0, S0 + 3).forEach((b, j) => { b.textContent = RNAME[STOP[j]]; b.setAttribute('aria-label', 'Go to ' + RNAME[STOP[j]]); }); stopsPaint(); }
/* every way into the three works (the chips, the journey bar, the dial dots and rows, the links on the spec sheet) comes through here */
function goWork(k) { audioOn(); if (!inWork() && STOP[0] !== k) workOrder([k, ...WORK0.filter((x) => x !== k)]); jumpTo(stopCh(k)); }
const JUMPS = { career: [1], resume: [N - 1], contact: [N - 1], top: [0] };
$('home').addEventListener('click', () => jumpTo(0));
document.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); const w = { projects: 'moon', writing: 'sec', film: 'date' }[b.dataset.jump]; if (w) { goWork(w); return; } const j = JUMPS[b.dataset.jump]; jumpTo(j[0], j[1]); }));

/* ---------- complication focus mode ---------- */
/* focus follows the scroll: whichever complication chapter you are on is open. Next and Back browse inside it; scrolling moves on */
let focus = null, idx = { date: 0, moon: 0, sec: 0 }, wDate = 0, wMoon = 0, slide = null;
const fEl = $('focus'), nextOf = (k) => { const j = STOP.indexOf(k); return j < 2 ? WNAME[STOP[j + 1]].toLowerCase() : 'the caseback'; };
const wCount = (k) => DATA[k].items.length;   // the same number the Back and Next counter shows
/* the switch between the three works, under each one: in this visit's order, with how many are in each and a mark on the ones already seen */
function stopsPaint() { const box = document.querySelector('#focus .stops'); if (!box) return; STOP.forEach((k) => { const b = box.querySelector('[data-stop="' + k + '"]'); if (!b) return; box.appendChild(b); b.classList.toggle('cur', k === focus); b.classList.toggle('seen', seenW.has(k) && k !== focus); }); }
document.querySelectorAll('.rows.work .wn').forEach((e) => { e.textContent = wCount(e.dataset.n); }); { const wm = $('w-moon'); if (wm && DATA.moon.items.length) wm.textContent = DATA.moon.items.map((x) => x.t).filter(Boolean).join(', ') + '.'; }
document.querySelectorAll('#focus .stops [data-stop]').forEach((b) => { const k = b.dataset.stop; b.innerHTML = WNAME[k] + ' <i>' + wCount(k) + '</i>'; b.setAttribute('aria-label', WNAME[k] + ', ' + wCount(k)); });
function paint() {
  const D = DATA[focus], n = D.items.length, it = D.items[idx[focus]];
  $('f-kicker').textContent = D.kicker; $('f-title').textContent = it.t; $('f-body').textContent = it.d;
  const l = $('f-link'); l.style.display = it.link && it.url ? 'inline-block' : 'none'; if (it.url) { l.textContent = it.link; l.href = it.url; l.target = '_blank'; l.rel = 'noopener'; }   // no button until there is somewhere to go
  $('f-note').textContent = D.note || ''; $('f-count').textContent = (idx[focus] + 1) + ' of ' + n; $('f-hint').textContent = D.hint + ' Keep scrolling for ' + nextOf(focus) + '.';
  stopsPaint();
}
function stepFocus(dir) {
  if (!focus || slide) return; const n = DATA[focus].items.length; idx[focus] = (idx[focus] + dir + n) % n;
  if (focus === 'date') { photoB.material.map = photos[idx.date]; photoB.visible = true; slide = { t: 0, dir }; snd.date(); }
  if (focus === 'moon') { moonTarget += -dir * TAU / NPROJ; snd.moon(); }
  if (focus === 'sec') { secSteps += dir; snd.sec(); }
  paint();
}
function enterStop(k) {
  focus = k; seenW.add(k); document.body.classList.add('focused');
  if (k === 'date') { loadPhotos(); photoA.material.map = photos[idx.date]; }
  if (k === 'sec') { idx.sec = 0; secSteps = 0; secDisp = secDisp % TAU - TAU; snd.sec(); }   // sweeps round to twelve and stops
  paint();
}
function leaveStop() { if (!focus) return; focus = null; document.body.classList.remove('focused'); }
function openFocus(k) { goWork(k); }
function closeFocus() {}
$('f-prev').onclick = () => { audioOn(); stepFocus(-1); }; $('f-next').onclick = () => { audioOn(); stepFocus(1); };
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openFocus(b.dataset.open)));
document.querySelectorAll('[data-stop]').forEach((b) => b.addEventListener('click', () => openFocus(b.dataset.stop)));
addEventListener('keydown', (e) => { if (!focus || (e.target && e.target.tagName === 'INPUT')) return; if (e.key === 'ArrowRight') { e.preventDefault(); stepFocus(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); stepFocus(-1); } });
/* where the camera looks and how close, between and at the three stops */
const RADS = { date: 2.2, moon: AR + 0.5, sec: SR + 0.45 }, FZ = { c: [0, MC], s: FSC.moon, r: RADS.moon };
function focusPath(cv) { const u = clamp(cv - S0, 0, 2), i0 = Math.min(1, Math.floor(u)), t = ease(u - i0), A = STOP[i0], B = STOP[i0 + 1], dip = 1 - 0.38 * Math.sin(Math.PI * t);   // pulls back a little while it travels across the dial
  FZ.c = [lerp(FOCUS[A][0], FOCUS[B][0], t), lerp(FOCUS[A][1], FOCUS[B][1], t)]; FZ.s = lerp(FSC[A], FSC[B], t) * dip; FZ.r = lerp(RADS[A], RADS[B], t); }
const zin = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const focusAmount = (cv) => cv < S0 ? zin((cv - CD - 0.15) / 0.6) : cv <= S0 + 2 ? 1 : 1 - zin((cv - S0 - 2 - 0.05) / 0.5);


/* ---------- drag: free spin on the first screen, a nudge elsewhere ---------- */
let heroYaw = 0, heroPitch = 0, hy = 0, hp = 0, tx = 0, ty = 0, dragX = 0, dragY = 0, down = null;
const wv = new THREE.Vector3(); let touchHold = false;
function onWatch(e) { const r = canvas.getBoundingClientRect(), px = (v) => { v.project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (0.5 - v.y * 0.5) * r.height]; }; root.getWorldPosition(wv); const z = wv.z, x0 = wv.x, y0 = wv.y, c = px(wv), ed = px(wv.set(x0 + 21 * root.scale.x, y0, z)); return Math.hypot(e.clientX - c[0], e.clientY - c[1]) < Math.abs(ed[0] - c[0]); }
canvas.addEventListener('pointerdown', (e) => { touchHold = false; if (focus || intro.on) return; if (propsGrab(e)) { touchHold = true; return; } if (qrPick(e)) return; const hero = cur < 1.3 || cur > N - 1.2, own = e.pointerType !== 'mouse' && (hero || Math.round(cur) === CB) && onWatch(e);   /* a finger on the watch does not hold the page: the canvas is touch-action pan-y, so a swipe up or down still scrolls and a sideways drag comes here to turn the watch (and may then tilt it too) */
  down = { x: e.clientX, y: e.clientY, yaw: heroYaw, pitch: heroPitch, tx, ty, hero, mouse: e.pointerType === 'mouse' || own }; });
canvas.addEventListener('touchstart', (e) => { if (touchHold && e.cancelable) e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { if (touchHold && e.cancelable) e.preventDefault(); }, { passive: false });
addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if (down.hero) { heroYaw = down.yaw + dx * 0.5; if (down.mouse) heroPitch = clamp(down.pitch + dy * 0.4, -80, 80); } else { tx = clamp(down.tx + dx * 0.35, -70, 70); if (down.mouse) ty = clamp(down.ty + dy * 0.2, -25, 25); } });
['pointerup', 'pointercancel'].forEach((ev) => addEventListener(ev, () => { down = null; touchHold = false; }));


/* ---------- strap and dial selectors ---------- */
/* each job: [title, the paragraph, the link's words, the link, the place]. content.js overrides any of it */
const ROLES = {
  consulting: ['Economic consulting', 'Antitrust, pricing and market strategy for Fortune 100 clients across AI, consumer tech, adtech and energy. I turn messy data into the evidence a case or a launch decision rests on.', 'My Analysis Group profile', 'https://www.analysisgroup.com/careers/why-analysis-group/our-people/nikhil/', 'Analysis Group, San Francisco'],
  engineering: ['Software engineering', '[ONE LINE ON WHAT YOU BUILT]', '', '', '[EMPLOYER, CITY]'],
  quant: ['Quant research', '[ONE LINE ON WHAT YOU MODELED]', '', '', '[EMPLOYER, CITY]'],
  banking: ['Investment banking', '[ONE LINE ON THE DEALS OR COVERAGE]', '', '', '[EMPLOYER, CITY]'],
  writing: ['Watch journalism', 'My own blog and a Wrist Review byline, plus a lot of ghostwriting.', 'Read them on Wrist Review', 'https://wristreview.com/?s=NIKHIL+KURMALA', 'Wrist Review']
};
if (CT.jobs) Object.keys(ROLES).forEach((k) => { const j = CT.jobs[k]; if (!j) return; ROLES[k] = [j.title || ROLES[k][0], j.text || ROLES[k][1], j.linkText || '', j.link || '', typeof j.place === 'string' ? j.place.trim() : ROLES[k][4]]; const b = document.querySelector('[data-strap="' + k + '"]'); if (b && j.chip) b.textContent = j.chip; });
if (RAIL) railDom();
const chips = [...document.querySelectorAll('[data-strap]')];
function pickStrap(k) { const sk = k === 'consulting' && upGone ? 'upcycle' : k; setStrap(sk); chips.forEach((c) => c.setAttribute('aria-pressed', c.dataset.strap === k));
  const fill = () => { const R = ROLES[k], sl = $('s-link'); $('s-title').textContent = R[0]; $('s-name').textContent = 'on ' + STRAPS[sk].name.toLowerCase(); $('s-place').textContent = R[4] || ''; $('s-years').textContent = RJ.years[k] || ''; $('s-body').textContent = R[1];
    sl.hidden = !R[3]; if (R[3]) { sl.textContent = R[2] || R[3]; sl.href = R[3]; } };
  if (!rl.cardK || rl.cardK === k + sk) { rl.cardK = k + sk; fill(); return; } rl.cardK = k + sk; plateSwap(fill); }   // the plate changes on the click, not when the strap lands
/* the plate's change: the old lines lift a hair and fade together, then the new ones rise into place one after another (title, material, place and years, paragraph, link).
   A later click takes over from wherever the lines are. Reduced motion: a short crossfade and nothing moves. PL.hold (tests) freezes the new lines at that many ms in */
const PL = { gen: 0, hold: null }, PLD = [0, 40, 80, 120, 160];
const plateLines = () => ['s-title', 's-name', 's-meta', 's-body', 's-link'].map($);
function plateSwap(fill) { const g = ++PL.gen, ls = plateLines(), rm = reduce; if (snap) { fill(); return; }
  const out = ls.map((el) => { const cs = getComputedStyle(el), o = +cs.opacity, tf = cs.transform === 'none' ? 'none' : cs.transform; el.getAnimations().forEach((a) => a.cancel());
    return el.animate([{ opacity: o, transform: tf }, { opacity: 0, transform: rm ? 'none' : 'translateY(-4px)' }], { duration: rm ? 60 : 140, easing: 'ease-in', fill: 'forwards' }); });
  out[0].finished.then(() => { if (g !== PL.gen) return; fill();
    ls.forEach((el, i) => { el.getAnimations().forEach((a) => a.cancel()); const a = el.animate([{ opacity: 0, transform: rm ? 'none' : 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: rm ? 60 : 320, delay: rm ? 0 : PLD[i], easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }); if (PL.hold != null) { a.pause(); a.currentTime = PL.hold; } }); }).catch(() => {}); }
chips.forEach((c) => c.addEventListener('click', () => pickStrap(c.dataset.strap))); pickStrap('consulting');
/* the pen: a beat after the strap copy comes into view, "straps" gets struck out and "caps" written over it */
const fixEl = $('fix'); let fixT = 0, fixDone = !fixEl; if (fixEl && reduce) { fixEl.classList.add('on'); fixDone = true; }
function fixTick(dt) { if (fixDone) return; const p = panels.find((q) => q.dataset.ch === '1'); if (p && p.classList.contains('live')) { fixT += dt; if (fixT > (SNAP ? 0.6 : 1.4)) { fixDone = true; fixEl.classList.add('on'); snd.scribble(); } } else fixT = 0; }
const dots = [...document.querySelectorAll('[data-way]')]; let wayFlash = false;   /* on phones the dial's name is not in the top row: it shows for a moment under the swatches when a dial is picked */
function pickWay(k) { setWay(k); dots.forEach((c) => c.setAttribute('aria-pressed', c.dataset.way === k)); document.querySelectorAll('.wayname').forEach((e) => { e.textContent = WAYS[k].name; if (wayFlash) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } }); }
dots.forEach((c) => { c.style.background = 'radial-gradient(circle at 35% 30%,' + WAYS[c.dataset.way].dot[0] + ',' + WAYS[c.dataset.way].dot[1] + ')'; c.addEventListener('click', () => { pickWay(c.dataset.way); const p = WAYS[c.dataset.way].pair; if (p) pickStrap(p); }); }); pickWay('silver'); wayFlash = true;

/* under the hood: four parts of the movement are not quite standard. No labels on the watch: the parts give themselves away, and a tap tells the rest */
/* each entry: [the part, the title, a line about it, a heading for the list, the list, photos]. Add to the lists and photo arrays freely */
const INTS = {
  soccer: ['Rotor, engraved Liverpool and Volo Soccer', 'Football', 'Pickup football on Fridays, pickup volleyball on Thursdays. A Liverpool fan since I was eight, with the old Warrior kit to prove it.', 'On the pitch', ['[Your league or team]', '[A favorite Liverpool memory]'], []],
  cooking: ['The jewel on the balance cock, lit', 'Cooking and baking', 'Always experimenting with something new, on the stove, in the oven and in the ice cream maker. Tonight: tofu stir fry noodles. Take the pan by the handle and give it a shake.', 'Lately', ['[Something you cooked]', '[Something you baked]', '[An ice cream flavor]'], []],
  snow: ['Escapement cock, waxed', 'Snowboarding', 'An escapement lets the energy out one controlled turn at a time. On a board, that is the whole idea.', 'Where I have ridden', ['[Mountain 1]', '[Mountain 2]', '[Mountain 3]'], []],
  music: ['Ratchet wheel, on the decks', 'Music', 'Electronic, mostly, and festivals like Outside Lands.', 'Top five artists this year', ['[Artist 1]', '[Artist 2]', '[Artist 3]', '[Artist 4]', '[Artist 5]'], [], true] };
if (CT.interests) Object.keys(INTS).forEach((k) => { const c = CT.interests[k], r = INTS[k]; if (!c) return; if (c.title) r[1] = c.title; if (c.text) r[2] = c.text; if (c.listTitle) r[3] = c.listTitle; if (Array.isArray(c.list)) r[4] = c.list; if (Array.isArray(c.photos)) r[5] = c.photos.map((p) => typeof p === 'string' ? { src: 'photos/' + p, alt: '' } : { src: 'photos/' + p.file, alt: p.alt || '' }); });
{ const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])), q = (s) => document.querySelector(s), ext = (u, t) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + '</a>';
  if (CT.name) { const parts = String(CT.name).trim().split(/\s+/), first = parts[0], last = parts.slice(1).join(' '), h1 = q('h1.name'); if (h1) { h1.setAttribute('aria-label', CT.name); h1.querySelector('.first').textContent = first; h1.querySelector('.last').innerHTML = [...last.toUpperCase()].map((ch) => '<i>' + esc(ch) + '</i>').join(''); } document.title = CT.name; }
  if (Array.isArray(CT.signedOnTheBack)) document.querySelectorAll('.rows.sign > div').forEach((d, i) => { const s = CT.signedOnTheBack[i]; if (!s) return; d.querySelector('b').textContent = s.title || ''; d.querySelector('span').textContent = s.text || ''; });
  const F = CT.fullSet, C = CT.contact || {}, rows = [...document.querySelectorAll('dl.spec > div')].reduce((o, d) => { o[d.querySelector('dt').textContent.trim()] = d.querySelector('dd'); return o; }, {});
  if (F) { if (rows.Name && (CT.name || F.role)) rows.Name.innerHTML = esc(CT.name || 'Nikhil Kurmala') + '<span class="opt">. ' + esc(F.role || '') + (F.employer ? ', ' + (F.employerLink ? ext(F.employerLink, F.employer) : esc(F.employer)) : '') + (F.city ? ', ' + esc(F.city) : '') + '.</span>';
    if (rows['Included in box'] && F.includedInBox) rows['Included in box'].textContent = F.includedInBox; if (rows.Origin && F.origin) rows.Origin.textContent = F.origin; if (rows['Import duties'] && F.importDuties) rows['Import duties'].textContent = F.importDuties; }
  if (rows.Price && (C.email || C.linkedin)) rows.Price.innerHTML = 'On inquiry. ' + (C.email ? '<a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a>' : '') + (C.email && C.linkedin ? ' or ' : '') + (C.linkedin ? ext(C.linkedin, 'LinkedIn') : '');
  if (rows['Box and papers'] && (C.resume || (F && F.papers))) { const o = rows['Box and papers'].querySelector('.opt'); rows['Box and papers'].innerHTML = (F && F.papers ? esc(F.papers) + ' ' : '') + (C.resume ? ext(C.resume, 'Resume (PDF)') + '.' : 'Resume on request.') + (o ? o.outerHTML : ''); } if (rows['Box and papers'] && C.resume) { document.querySelectorAll('#top a').forEach((a) => { if (a.textContent.trim() === 'Resume') { a.href = C.resume; a.target = '_blank'; a.rel = 'noopener'; a.removeAttribute('data-jump'); } }); } }
const ZSIGN = -1, ARMSWING = 0.3;
/* snow for the board: flakes streaming past as if it were on its way down */
const SNOWN = 170, snowP = new Float32Array(SNOWN * 3), snowS = Array.from({ length: SNOWN }, () => [Math.random(), Math.random() * 2 - 1, Math.random(), 0.6 + Math.random() * 0.8]);
const snow = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(snowP, 3)); const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), size: 5, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: false })); p.frustumCulled = false; p.visible = false; gBr.add(p); return p; })();
let snowA = 0;
/* on the stove, while you are in close: a pan of soy glazed tofu stir fry noodles. Take the handle and toss it. Too hard, and dinner ends up in the movement */
const PAN = { z: ZHOB + 0.92, r: 1.8, off: new THREE.Vector2(), vel: new THREE.Vector2(), tgt: null, food: new THREE.Vector2(), fv: new THREE.Vector2(), hop: 0, hv: 0, a: 0, cool: 0, bits: [], items: [], t: 0 }, gPan = new THREE.Group(), gPanIn = new THREE.Group(), gFood = new THREE.Group(), gSpill = new THREE.Group();
{ gPan.visible = false; gBr.add(gPan); gPan.add(gPanIn); gPanIn.add(gFood); gBr.add(gSpill); gPan.position.set(PBAL[0], PBAL[1], 0); const r = prng(321), z = PAN.z, R = PAN.r;
  const mk = (geo, mat, par) => { const me = new THREE.Mesh(geo, mat); me.castShadow = true; par.add(me); return me; }, P = (o) => M('bridges', o);
  const mp = P({ color: 0x25262b, metalness: 0.9, roughness: 0.34 }), mi = P({ color: 0x121214, metalness: 0.5, roughness: 0.5 }), ms = P({ color: 0xd9dce0, metalness: 1, roughness: 0.2 }), mh = P({ color: 0x4a2c16, metalness: 0, roughness: 0.5, clearcoat: 0.5 });
  /* a proper skillet: a thick closed body with a rolled rim, a dark seasoned inside, a steel neck riveted on and a wooden grip */
  mk(lathe([[0.001, z - 0.12], [R * 0.8, z - 0.12], [R + 0.05, z + 0.5], [R + 0.13, z + 0.56], [R + 0.13, z + 0.62], [R + 0.02, z + 0.62]], 56), mp, gPanIn);
  mk(lathe([[R + 0.02, z + 0.62], [R * 0.82, z + 0.02], [0.001, z]], 56), mi, gPanIn);
  mk(lathe([[0.001, z + 0.035], [R * 0.74, z + 0.035], [R * 0.8, z + 0.06]], 40), P({ color: 0x3a1c08, metalness: 0, roughness: 0.12, clearcoat: 1 }), gPanIn);   // a film of soy and oil
  const ha = Math.atan2(CKU[1], CKU[0]) - 1.25, hd = [Math.cos(ha), Math.sin(ha)]; PAN.hd = hd;
  { const at = (geo, mat, d, dz, tilt) => { const h = mk(geo, mat, gPanIn); h.position.set(hd[0] * (R + d), hd[1] * (R + d), z + dz); h.rotation.z = ha; h.rotation.order = 'ZYX'; h.rotation.y = -tilt; return h; };
    at(new THREE.BoxGeometry(1.1, 0.3, 0.09), ms, 0.5, 0.62, 0.2); at(new THREE.CapsuleGeometry(0.17, 1.9, 6, 14).rotateZ(Math.PI / 2), mh, 2.05, 0.86, 0.12); at(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 14).rotateZ(Math.PI / 2), ms, 3.2, 0.99, 0.12); }
  const mn = P({ color: 0xb9803c, metalness: 0, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }), mt = P({ color: 0xd2a05c, metalness: 0, roughness: 0.5, clearcoat: 0.4 }), mtb = P({ color: 0x8c5524, metalness: 0, roughness: 0.4, clearcoat: 0.6 }), mg = P({ color: 0x3f8a2c, metalness: 0, roughness: 0.4, clearcoat: 0.5 }), mr = P({ color: 0xb8301f, metalness: 0, roughness: 0.4, clearcoat: 0.5 });
  const item = (me, wgt) => { PAN.items.push({ me, b: me.position.clone(), r0: me.rotation.z, w: wgt, ph: r() * TAU, lag: 0.55 + r() * 0.9 }); };
  for (let i = 0; i < 16; i++) { const pts = [], a0 = r() * TAU, rr = 0.2 + r() * 0.75; for (let k = 0; k < 7; k++) { const a = a0 + k * (0.6 + r() * 0.7), q = rr * (0.45 + 0.55 * r()) * R * 0.78; pts.push(new THREE.Vector3(Math.cos(a) * q, Math.sin(a) * q, 0.12 + r() * 0.26)); } const me = mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.06, 7), mn, gFood); me.position.z = z; item(me, 0.7); }
  for (let i = 0; i < 8; i++) { const a = r() * TAU, q = r() * R * 0.6, t = mk(new RoundedBoxGeometry(0.36, 0.36, 0.3, 2, 0.05), i % 2 ? mt : mtb, gFood); t.position.set(Math.cos(a) * q, Math.sin(a) * q, z + 0.36 + r() * 0.1); t.rotation.set(r() * 0.5, r() * 0.5, r() * 3); item(t, 1.2); }
  for (let i = 0; i < 14; i++) { const a = r() * TAU, q = r() * R * 0.68, t = mk(new THREE.CapsuleGeometry(0.045, 0.34, 3, 6).rotateZ(Math.PI / 2), i % 3 ? mg : mr, gFood); t.position.set(Math.cos(a) * q, Math.sin(a) * q, z + 0.38 + r() * 0.14); t.rotation.z = r() * 3; item(t, 1); }
  for (let i = 0; i < 18; i++) { const k = i % 4, me = mk(k === 0 ? new RoundedBoxGeometry(0.36, 0.36, 0.3, 2, 0.05) : k === 1 ? new THREE.TorusGeometry(0.2, 0.055, 5, 10, 4.2) : new THREE.CapsuleGeometry(0.045, 0.34, 3, 6), k === 0 ? mt : k === 1 ? mn : k === 2 ? mg : mr, gSpill); me.visible = false; PAN.bits.push({ me, on: false, v: new THREE.Vector3(), w: 0 }); }
  anchor('i-pan', gPanIn, hd[0] * (R + 2.2), hd[1] * (R + 2.2), z + 0.95); anchor('pan-o', gBr, PBAL[0], PBAL[1], z); anchor('pan-x', gBr, PBAL[0] + 1, PBAL[1], z); anchor('pan-y', gBr, PBAL[0], PBAL[1] + 1, z); }
{ const hd = $('pan'), scr = (k) => { const rc = canvas.getBoundingClientRect(), p = anchors[k].getWorldPosition(new THREE.Vector3()).project(camera); return [rc.left + (p.x * 0.5 + 0.5) * rc.width, rc.top + (0.5 - p.y * 0.5) * rc.height]; }; let d0 = null;
  hd.addEventListener('pointerdown', (e) => { e.preventDefault(); hd.setPointerCapture(e.pointerId); audioOn(); d0 = { x: e.clientX, y: e.clientY, ox: PAN.off.x, oy: PAN.off.y }; PAN.tgt = PAN.off.clone(); hd.classList.add('grab'); });
  hd.addEventListener('pointermove', (e) => { if (!d0) return; const O = scr('pan-o'), X = scr('pan-x'), Y = scr('pan-y'), ax = X[0] - O[0], ay = X[1] - O[1], bx = Y[0] - O[0], by = Y[1] - O[1], det = ax * by - ay * bx || 1, dx = e.clientX - d0.x, dy = e.clientY - d0.y;
    PAN.tgt.set(d0.ox + (dx * by - dy * bx) / det, d0.oy + (ax * dy - ay * dx) / det); if (PAN.tgt.length() > 2.1) PAN.tgt.setLength(2.1); });
  const end = () => { d0 = null; PAN.tgt = null; hd.classList.remove('grab'); }; hd.addEventListener('pointerup', end); hd.addEventListener('pointercancel', end); }
const pv = new THREE.Vector2();
/* steam and spitting oil: soft puffs that rise off the food, more of them the harder the pan is worked, and orange sparks when it is tossed */
const STN = 70, stP = new Float32Array(STN * 3), stC = new Float32Array(STN * 3), stS = Array.from({ length: STN }, () => ({ life: 0, max: 1, v: [0, 0, 0], hot: false })); let stI = 0, fry = null, clang = 0;
const steam = (() => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(stP, 3)); geo.setAttribute('color', new THREE.BufferAttribute(stC, 3)); const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: snow.material.map, size: 26, sizeAttenuation: false, transparent: true, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false })); p.frustumCulled = false; p.visible = false; gBr.add(p); return p; })();
function puff(hot, sp) { const q = stS[stI], i = stI; stI = (stI + 1) % STN; const a = Math.random() * TAU, r = Math.random() * PAN.r * 0.6; stP[i * 3] = PBAL[0] + PAN.off.x + Math.cos(a) * r; stP[i * 3 + 1] = PBAL[1] + PAN.off.y + Math.sin(a) * r; stP[i * 3 + 2] = PAN.z + 0.4; q.hot = hot; q.max = q.life = hot ? 0.35 + Math.random() * 0.3 : 0.9 + Math.random() * 0.8;
  q.v = hot ? [Math.cos(a) * (3 + Math.random() * 5), Math.sin(a) * (3 + Math.random() * 5), 4 + Math.random() * 6] : [(Math.random() - 0.5) * 0.8 + PAN.vel.x * 0.05, (Math.random() - 0.5) * 0.8 + PAN.vel.y * 0.05, 1.2 + Math.random() * 1.4 + sp * 0.05]; }
function fryLoop(on, level) { if (on && !fry && actx && actx.state === 'running' && !muted) try { const sr = actx.sampleRate, n = sr * 3, b = actx.createBuffer(1, n, sr), d = b.getChannelData(0); let e = 0; for (let i = 0; i < n; i++) { if (Math.random() < 0.0016) e = 0.5 + Math.random(); e *= 0.9992; d[i] = (Math.random() * 2 - 1) * (0.1 + e * 0.5); }
    const s = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.6; s.buffer = b; s.loop = true; g.gain.value = 0.0001; s.connect(bp).connect(g).connect(master); s.start(); fry = { s, g, bp }; } catch (e) {}
  if (fry) { if (!on || muted) { try { fry.g.gain.setTargetAtTime(0.0001, actx.currentTime, 0.08); fry.s.stop(actx.currentTime + 0.4); } catch (e) {} fry = null; } else { fry.g.gain.setTargetAtTime(0.05 + 0.16 * level, actx.currentTime, 0.06); fry.bp.frequency.setTargetAtTime(4600 + 2600 * level, actx.currentTime, 0.08); } } }
/* ---- penalty shootout. Zoom on the rotor and a small pitch rises out of the open half of its well, opposite the gold weight, and turns with it.
   The lane is a curve round the big ball, with a low gilt lip on each edge: pull back from the ball, let go, and bank the shot round to the goal at the other end */
const PIT = { ri: 3.36, ro: 4.74, a0: rad(104), a1: rad(256), z: ZR + 0.42, rb: 0.17, a: 0, flip: false, p: new THREE.Vector2(), v: new THREE.Vector2(), bz: 0, vz: 0, mode: 'ready', t: 0, shots: 0, goals: 0, kr: 0, kt: 0, res: '', aim: null, hop: 0, nb: 0, nv: 0, nc: false, nt: -1, nA: 0, nh: [0, 0.2] };
const gPit = new THREE.Group(); gRot.add(gPit); gPit.visible = false; const kickEl = $('kick');   // the ball's dot steps aside while the ball is in play, so the shot and the net can be seen
const pitBall = new THREE.Mesh(new THREE.SphereGeometry(PIT.rb, 18, 12), new THREE.MeshStandardMaterial({ roughness: 0.35 })), gGoal = new THREE.Group(), gKeep = new THREE.Group(), gShoot = new THREE.Group(), pitAim = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: 0xff9a1f }));
{ const { ri, ro, a0, a1, z } = PIT, rm = (ri + ro) / 2, S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), px = (x) => (x / ro + 1) / 2 * S, py = (y) => (1 - (y / ro + 1) / 2) * S, k = S / 2 / ro;
  g.fillStyle = '#1f7a3f'; g.fillRect(0, 0, S, S); for (let i = 0; i < 16; i++) { const b0 = a0 + (a1 - a0) * i / 16, b1 = a0 + (a1 - a0) * (i + 1) / 16; g.fillStyle = i % 2 ? '#248a47' : '#1c7039'; g.beginPath(); g.moveTo(S / 2, S / 2); g.arc(S / 2, S / 2, S, -b1, -b0); g.closePath(); g.fill(); }
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.035 * k; [ri + 0.1, ro - 0.1].forEach((r) => { g.beginPath(); g.arc(S / 2, S / 2, r * k, -a1 + 0.02, -a0 - 0.02); g.stroke(); });
  [a0 + 0.035, a1 - 0.035, (a0 + a1) / 2, a0 + 0.2, a1 - 0.2].forEach((a, i) => { const r0 = i < 3 ? ri + 0.1 : rm - 0.5, r1 = i < 3 ? ro - 0.1 : rm + 0.5; g.beginPath(); g.moveTo(px(r0 * Math.cos(a)), py(r0 * Math.sin(a))); g.lineTo(px(r1 * Math.cos(a)), py(r1 * Math.sin(a))); g.stroke(); });
  g.beginPath(); g.arc(px(rm * Math.cos((a0 + a1) / 2)), py(rm * Math.sin((a0 + a1) / 2)), 0.3 * k, 0, TAU); g.stroke();
  const tt = new THREE.CanvasTexture(cv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
  const turf = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 80, 1, a0, a1 - a0), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.92, metalness: 0 })); turf.position.z = z; turf.receiveShadow = true; gPit.add(turf);
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c765, metalness: 1, roughness: 0.2, side: THREE.DoubleSide }), wall = (r, zb, zt) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, zt - zb, 80, 1, true, a0 + Math.PI / 2, a1 - a0).rotateX(Math.PI / 2), gold); c.position.z = (zb + zt) / 2; gPit.add(c); };
  wall(ro, ZR - 0.36, z + 0.13); wall(ri, ZR - 0.1, z + 0.13); wall(ro + 0.05, ZR - 0.36, z + 0.13); wall(ri - 0.05, ZR - 0.1, z + 0.13);
  [ro + 0.025, ri - 0.025].forEach((r) => { const t = new THREE.Mesh(new THREE.RingGeometry(r - 0.03, r + 0.03, 80, 1, a0, a1 - a0), gold); t.position.z = z + 0.13; gPit.add(t); });
  [a0, a1].forEach((a) => { const e = new THREE.Mesh(new THREE.BoxGeometry(ro - ri + 0.1, 0.05, z + 0.13 - (ZR - 0.36)), gold); e.position.set(rm * Math.cos(a), rm * Math.sin(a), (z + 0.13 + ZR - 0.36) / 2); e.rotation.z = a; gPit.add(e); });
  /* the match ball */
  { const c2 = document.createElement('canvas'); c2.width = 128; c2.height = 64; const q = c2.getContext('2d'); q.fillStyle = '#f6f6f2'; q.fillRect(0, 0, 128, 64); q.fillStyle = '#16171a'; [[16, 14], [58, 8], [100, 16], [36, 36], [80, 38], [120, 44], [12, 54], [60, 60]].forEach((p) => { q.beginPath(); q.arc(p[0], p[1], 8, 0, TAU); q.fill(); }); const bt = new THREE.CanvasTexture(c2); bt.colorSpace = THREE.SRGBColorSpace; pitBall.material.map = bt; }
  pitBall.castShadow = true; gPit.add(pitBall); pitAim.visible = false; gPit.add(pitAim);
  /* goal: white posts and bar, a net behind. Its own x runs across the lane, its y points back up the pitch toward the taker */
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35, metalness: 0.1 }), GW = 0.96, GH = 0.74, GD = 0.36, post = (x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, GH, 10).rotateX(Math.PI / 2), white); p.position.set(x, 0, GH / 2); gGoal.add(p); };
  post(-GW / 2); post(GW / 2); { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, GW + 0.07, 10).rotateZ(Math.PI / 2), white); bar.position.set(0, 0, GH); gGoal.add(bar); }
  /* the net is one cloth in four panels (back, roof and two sides), each pegged along its edges to the frame and the turf. It is drawn as dark grey cord over a smoky veil, so it shows against the turf,
     and is fine enough to bulge where the ball goes in */
  { const pos = [], idx = [], ln = [], pin = [], pid = [], o3 = new THREE.Object3D();
    const pl = (w, hh, sx, sy, k, fn) => { const g = new THREE.PlaneGeometry(w, hh, sx, sy); o3.position.set(0, 0, 0); o3.rotation.set(0, 0, 0); fn(o3); o3.updateMatrix(); g.applyMatrix4(o3.matrix); const b = pos.length / 3, P3 = g.attributes.position, U = g.attributes.uv;
      for (let i = 0; i < P3.count; i++) { pos.push(P3.getX(i), P3.getY(i), P3.getZ(i)); pin.push(Math.sin(Math.PI * U.getX(i)) * Math.sin(Math.PI * U.getY(i))); pid.push(k); } g.index.array.forEach((q) => idx.push(b + q));
      for (let r = 0; r <= sy; r++) for (let c = 0; c <= sx; c++) { const q = b + r * (sx + 1) + c; if (c < sx) ln.push(q, q + 1); if (r < sy) ln.push(q, q + sx + 1); } g.dispose(); };
    pl(GW, GH, 14, 11, 0, (n) => { n.rotation.x = Math.PI / 2; n.position.set(0, -GD, GH / 2); }); pl(GW, GD, 14, 5, 1, (n) => { n.position.set(0, -GD / 2, GH); });
    pl(GD, GH, 5, 11, 2, (n) => { n.rotation.x = Math.PI / 2; n.rotation.y = Math.PI / 2; n.position.set(-GW / 2, -GD / 2, GH / 2); }); pl(GD, GH, 5, 11, 2, (n) => { n.rotation.x = Math.PI / 2; n.rotation.y = Math.PI / 2; n.position.set(GW / 2, -GD / 2, GH / 2); });
    const pa = new THREE.Float32BufferAttribute(pos, 3); pa.setUsage(THREE.DynamicDrawUsage);
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', pa); vg.setIndex(idx); const veil = new THREE.Mesh(vg, new THREE.MeshBasicMaterial({ color: 0x23262b, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })); veil.frustumCulled = false; gGoal.add(veil);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', pa); cg.setIndex(ln); const cord = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x3d4148, transparent: true, opacity: 0.9, depthWrite: false })); cord.frustumCulled = false; gGoal.add(cord);
    PIT.netN = { cord, pa, base: new Float32Array(pos), pin: new Float32Array(pin), id: new Uint8Array(pid), dirty: false }; }
  PIT.GW = GW; PIT.GH = GH; PIT.GD = GD; gPit.add(gGoal);
  /* two figures: a keeper in yellow, a taker in red */
  const man = (grp, kit) => { const skin = new THREE.MeshStandardMaterial({ color: 0xe6bf98, roughness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.6 }), shirt = new THREE.MeshStandardMaterial({ color: kit, roughness: 0.55 }), cyl = (r, hh, mt, x, zz) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh, 10).rotateX(Math.PI / 2), mt); c.position.set(x, 0, zz); c.castShadow = true; grp.add(c); };
    cyl(0.035, 0.26, dark, -0.05, 0.13); cyl(0.035, 0.26, dark, 0.05, 0.13); cyl(0.095, 0.26, shirt, 0, 0.39); cyl(0.028, 0.2, shirt, -0.125, 0.4); cyl(0.028, 0.2, shirt, 0.125, 0.4); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.078, 12, 10), skin); hd.position.set(0, 0, 0.6); hd.castShadow = true; grp.add(hd); };
  man(gKeep, 0xf2c230); gKeep.scale.setScalar(1.25); gGoal.add(gKeep); man(gShoot, 0xc4203a); gShoot.scale.setScalar(1.25); gPit.add(gShoot);
  anchor('i-kick', gPit, 0, 0, z + PIT.rb); }
function pitSet() { const P = PIT, rm = (P.ri + P.ro) / 2, s = P.flip ? -1 : 1, ag = P.flip ? P.a1 - 0.2 : P.a0 + 0.2, as = P.flip ? P.a0 + 0.3 : P.a1 - 0.3; P.ag = ag; P.as = as; P.s = s;
  gGoal.position.set(rm * Math.cos(ag), rm * Math.sin(ag), P.z); gGoal.rotation.z = ag; gGoal.scale.y = s; gShoot.position.set(rm * Math.cos(as + s * 0.085), rm * Math.sin(as + s * 0.085), P.z); pitReset(); }
function pitReset() { const P = PIT, rm = (P.ri + P.ro) / 2; P.p.set(rm * Math.cos(P.as), rm * Math.sin(P.as)); P.v.set(0, 0); P.bz = 0; P.vz = 0; P.mode = 'ready'; P.res = ''; pitAim.visible = false; P.nb = P.nv = 0; P.nc = false; P.nt = -1; if (P.netN) P.netN.dirty = true; pitScore(); }
function pitScore(msg) { const el = $('int-score'); if (!el) return; const P = PIT; el.textContent = msg || (P.shots >= 5 ? P.goals + ' of 5. ' + (P.goals >= 4 ? 'Sign him up.' : P.goals >= 2 ? 'Not bad.' : 'Keep practising.') + ' Pull the ball back to go again.' : 'Penalties: pull back from the ball, aim, let go. Bank it round the big ball. ' + P.goals + ' scored, ' + (5 - P.shots) + ' to take.'); }
function crowd(up) { if (!actx || muted || actx.state !== 'running') return; try { const sr = actx.sampleRate, dur = up ? 1.7 : 1.15, n = (sr * dur) | 0, b = actx.createBuffer(1, n, sr), d = b.getChannelData(0); let lp = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * 0.2; d[i] = lp * 2.4; }
    const s = actx.createBufferSource(), f1 = actx.createBiquadFilter(), f2 = actx.createBiquadFilter(), g = actx.createGain(), t = actx.currentTime + 0.02; s.buffer = b; f1.type = f2.type = 'bandpass'; f1.Q.value = 1.1; f2.Q.value = 2.2;
    if (up) { f1.frequency.setValueAtTime(650, t); f1.frequency.exponentialRampToValueAtTime(1500, t + 0.35); f2.frequency.setValueAtTime(1700, t); f2.frequency.exponentialRampToValueAtTime(3000, t + 0.4); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.16); g.gain.setValueAtTime(0.5, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    else { f1.frequency.setValueAtTime(640, t); f1.frequency.exponentialRampToValueAtTime(250, t + 0.75); f2.frequency.setValueAtTime(1150, t); f2.frequency.exponentialRampToValueAtTime(480, t + 0.75); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.34, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    s.connect(f1).connect(g); s.connect(f2).connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05); } catch (e) {} }
function pitEnd(res) { const P = PIT; if (P.res) return; P.res = res; P.t = 0; P.shots++; if (res === 'goal') { P.goals++; P.hop = 1; ping({ f: 5200, q: 0.5, dur: 0.24, vol: 0.22, sharp: 2 }); crowd(true); buzz([18, 40, 30], true); pitScore('GOAL!'); } else { crowd(false); pitScore(res === 'save' ? 'Saved.' : res === 'out' ? 'Over the boards.' : res === 'post' ? 'Off the post.' : 'Not enough on it.'); } }
/* the ball in the net. Past the line the net takes it like a soft spring: it gives, holds the ball, and lets it drop and roll back a touch. The side netting keeps it in,
   and nothing lets it back out over the line. Where and how hard it went in is kept for the cloth */
function pitNet(h) { const P = PIT, ca = Math.cos(P.ag), sa = Math.sin(P.ag), rm = (P.ri + P.ro) / 2, dx = P.p.x - rm * ca, dy = P.p.y - rm * sa, bx = sa * P.s, by = -ca * P.s, lx = dx * ca + dy * sa, dep = dx * bx + dy * by, vin = P.v.x * bx + P.v.y * by, pen = dep - (P.GD - P.rb);
  P.v.multiplyScalar(Math.exp(-2.6 * h));
  if (pen > 0) { const a = -150 * pen - 6 * vin; P.v.x += bx * a * h; P.v.y += by * a * h; if (P.nt < 0) { P.nt = 0; P.nA = 0.08 * clamp(vin / 3, 0.35, 1.2); } P.nb = pen; P.nv = vin; P.nh[0] = lx; P.nh[1] = P.rb + P.bz; }
  P.nc = pen > 0;
  const vl = P.v.x * ca + P.v.y * sa, side = P.GW / 2 - P.rb - 0.03; if (Math.abs(lx) > side && lx * vl > 0) { P.v.x -= ca * vl * 1.5; P.v.y -= sa * vl * 1.5; }
  if (dep < P.rb + 0.05 && vin < 0) { P.v.x -= bx * vin; P.v.y -= by * vin; } }
/* the cloth: a bulge round the spot the ball went in, deepest there and held at the posts, the bar and the pegs, and a ripple that runs out over all four panels and dies away.
   Once the ball has come off the back, the netting springs back past its rest and settles */
function netTick(dt) { const P = PIT, N = P.netN; if (!N) return;
  if (P.nt < 0) { if (N.dirty) { N.pa.array.set(N.base); N.pa.needsUpdate = true; N.dirty = false; N.cord.material.opacity = 0.72; } return; }
  P.nt += dt; if (!P.nc || P.mode !== 'fly') { const w = 24, z = 0.2, n = 4, h = dt / n; for (let i = 0; i < n; i++) { P.nv += (-w * w * P.nb - 2 * z * w * P.nv) * h; P.nb += P.nv * h; } }
  const pos = N.pa.array, b0 = N.base, hx = P.nh[0], hz = P.nh[1], t = P.nt, ph = Math.sin(Math.PI * clamp(hx / P.GW + 0.5, 0, 1)) * Math.sin(Math.PI * clamp(hz / P.GH, 0, 1)), A = P.nb / Math.max(0.3, ph), rip = P.nA * Math.exp(-t / 0.42) * (1 - Math.exp(-t * 30)), k = TAU / 0.3, om = TAU * 3.2;
  for (let i = 0, n = b0.length / 3; i < n; i++) { const x = b0[i * 3], y = b0[i * 3 + 1], z = b0[i * 3 + 2], f = N.pin[i], r = Math.hypot(x - hx, y + P.GD, z - hz), wv = f * rip * Math.sin(k * r - om * t) * Math.exp(-r * 1.6);
    if (N.id[i] === 0) pos[i * 3 + 1] = y - f * A * Math.exp(-((x - hx) * (x - hx) + (z - hz) * (z - hz)) / 0.05) - wv; else if (N.id[i] === 1) pos[i * 3 + 2] = z + 0.7 * wv; else pos[i * 3] = x + Math.sign(x) * 0.7 * wv; }
  N.pa.needsUpdate = true; N.dirty = true; N.cord.material.opacity = 0.9 + 0.1 * Math.min(1, Math.abs(P.nb) * 6 + rip * 8); }
function pitTick(dt) { const P = PIT, want = zoomK === 'soccer' ? 1 : 0, was = P.a; P.a += (want - P.a) * Math.min(1, dt * 4); gPit.visible = P.a > 0.02; if (!gPit.visible) { if (was > 0.02) { P.shots = P.goals = 0; } return; }
  gPit.position.z = (sSmooth(P.a) - 1) * 0.95;
  if (was <= 0.02 || P.ag === undefined) { /* the taker stands on whichever end is to the right on screen */ gPit.updateWorldMatrix(true, false); const rm = (P.ri + P.ro) / 2, sx = (a) => new THREE.Vector3(rm * Math.cos(a), rm * Math.sin(a), P.z).applyMatrix4(gPit.matrixWorld).project(camera).x; P.flip = sx(P.a0) > sx(P.a1); P.shots = P.goals = 0; pitSet(); }
  const rm = (P.ri + P.ro) / 2, lane = (P.ro - P.ri) / 2 - P.rb; P.kt += dt;
  /* the keeper patrols his line, and steps toward a shot once it is close */
  { let tgt = Math.sin(P.kt * 1.7) * (P.GW / 2 - 0.16); if (P.mode === 'fly' && !P.res) { const r = P.p.length(), th = Math.atan2(P.p.y, P.p.x), da = Math.abs(((th < 0 ? th + TAU : th) - P.ag)); if (da < 0.22) tgt = clamp(r - rm, -P.GW / 2 + 0.1, P.GW / 2 - 0.1); } P.kr += clamp(tgt - P.kr, -0.55 * dt, 0.55 * dt); gKeep.position.set(P.kr, 0.03, 0); gKeep.rotation.y = P.res === 'goal' ? Math.min(1.3, P.t * 5) * (P.kr > 0 ? 1 : -1) : 0; }
  if (P.mode === 'fly') { const n = 5, hh = dt / n; for (let i = 0; i < n && P.mode === 'fly'; i++) { P.p.addScaledVector(P.v, hh); P.v.multiplyScalar(Math.exp(-0.6 * hh)); if (P.bz > 0 || P.vz > 0) { P.vz -= 30 * hh; P.bz = Math.max(0, P.bz + P.vz * hh); }
      let r = P.p.length(), th = Math.atan2(P.p.y, P.p.x); if (th < 0) th += TAU; const ux = P.p.x / r, uy = P.p.y / r, vr = P.v.x * ux + P.v.y * uy, vt = -P.v.x * uy + P.v.y * ux;
      if (P.out) { if (r > P.ro + 1.2 || P.bz <= 0) { P.mode = 'dead'; } continue; }
      if (r < P.ri + P.rb && vr < 0) { P.v.x -= 1.85 * vr * ux; P.v.y -= 1.85 * vr * uy; P.p.setLength(P.ri + P.rb); ping({ f: 1100, q: 3, dur: 0.03, vol: 0.1, sharp: 5 }); }
      else if (r > P.ro - P.rb && vr > 0) { if (vr > 13) { P.out = true; P.vz = 5.5; P.bz = 0.02; ping({ f: 1500, q: 5, dur: 0.05, vol: 0.14, sharp: 4 }); pitEnd('out'); } else { P.v.x -= 1.85 * vr * ux; P.v.y -= 1.85 * vr * uy; P.p.setLength(P.ro - P.rb); ping({ f: 1300, q: 4, dur: 0.03, vol: 0.1, sharp: 5 }); } }
      /* the taker's end is boarded; the goal end is the goal line */
      const back = P.s > 0 ? th > P.a1 - 0.05 : th < P.a0 + 0.05; if (back && vt * P.s > 0) { P.v.x += 1.4 * vt * uy; P.v.y -= 1.4 * vt * ux; }
      const over = P.s > 0 ? th < P.ag : th > P.ag; if (over && !P.res) { const rr = r - rm; if (Math.abs(rr - P.kr) < 0.19) { P.v.multiplyScalar(-0.45); P.p.set(r * Math.cos(P.ag + P.s * 0.03), r * Math.sin(P.ag + P.s * 0.03)); ping({ f: 220, q: 1, dur: 0.07, vol: 0.25, sharp: 3, thump: 80 }); pitEnd('save'); }
        else if (Math.abs(rr) < P.GW / 2 - P.rb * 0.6) { pitEnd('goal'); const sp = P.v.length() || 1, ns = Math.min(sp * 0.55, 4.5); P.v.multiplyScalar(ns / sp); if (P.bz <= 0) { P.vz = Math.min(3.2, ns * 0.8); P.bz = 0.001; } }
        else if (Math.abs(rr) < P.GW / 2 + P.rb) { P.v.multiplyScalar(-0.6); P.p.set(r * Math.cos(P.ag + P.s * 0.03), r * Math.sin(P.ag + P.s * 0.03)); ping({ f: 1250, q: 16, dur: 0.5, vol: 0.3, sharp: 3 }); ping({ f: 2610, q: 14, dur: 0.35, vol: 0.14, sharp: 3 }); pitEnd('post'); }
        else { P.v.x += 1.4 * vt * uy; P.v.y -= 1.4 * vt * ux; P.v.multiplyScalar(0.8); P.p.set(r * Math.cos(P.ag + P.s * 0.02), r * Math.sin(P.ag + P.s * 0.02)); ping({ f: 700, q: 2, dur: 0.04, vol: 0.14, sharp: 4 }); } }
      if (P.res === 'goal') pitNet(hh);
      if (P.v.length() < 0.45 && P.bz <= 0) { if (!P.res) pitEnd('short'); P.mode = 'dead'; } } }
  if (P.res) { P.t += dt; if (P.t > (P.res === 'goal' ? 1.9 : 1.4) && P.mode !== 'ready') { P.out = false; if (P.shots >= 5) { pitReset(); pitScore(); P.over = true; } else pitReset(); } }
  P.hop = Math.max(0, P.hop - dt * 1.1); netTick(dt); if (kickEl && kickEl.classList.contains('busy') !== (P.mode !== 'ready')) kickEl.classList.toggle('busy', P.mode !== 'ready'); gShoot.position.z = P.z + 0.22 * Math.abs(Math.sin(P.hop * 9.4)) * P.hop;
  pitBall.position.set(P.p.x, P.p.y, P.z + P.rb + P.bz); if (P.mode === 'fly') { pitBall.rotation.x += P.v.y * dt / P.rb; pitBall.rotation.y -= P.v.x * dt / P.rb; } anchors['i-kick'].position.set(P.p.x, P.p.y, P.z + P.rb);
  if (P.aim) { const L = 0.5 + 1.9 * P.aim.pw; pitAim.visible = true; pitAim.scale.x = L; pitAim.position.set(P.p.x + P.aim.dx * (L / 2 + 0.2), P.p.y + P.aim.dy * (L / 2 + 0.2), P.z + 0.03); pitAim.rotation.z = Math.atan2(P.aim.dy, P.aim.dx); } else pitAim.visible = false; }
{ const hd = $('kick'); if (hd) { const P = PIT, sc = (x, y) => { const rc = canvas.getBoundingClientRect(), v = new THREE.Vector3(x, y, P.z + P.rb).applyMatrix4(gPit.matrixWorld).project(camera); return [rc.left + (v.x * 0.5 + 0.5) * rc.width, rc.top + (0.5 - v.y * 0.5) * rc.height]; }; let d0 = null;
    const aimAt = (e) => { gPit.updateWorldMatrix(true, false); const O = sc(P.p.x, P.p.y), X = sc(P.p.x + 1, P.p.y), Y = sc(P.p.x, P.p.y + 1), ax = X[0] - O[0], ay = X[1] - O[1], bx = Y[0] - O[0], by = Y[1] - O[1], det = ax * by - ay * bx || 1, dx = e.clientX - O[0], dy = e.clientY - O[1], lx = (dx * by - dy * bx) / det, ly = (ax * dy - ay * dx) / det, l = Math.hypot(lx, ly); return l < 0.12 ? null : { dx: -lx / l, dy: -ly / l, pw: clamp((l - 0.12) / 2.4, 0, 1) }; };
    hd.addEventListener('pointerdown', (e) => { e.preventDefault(); if (P.mode !== 'ready') return; if (P.shots >= 5) { P.shots = P.goals = 0; pitScore(); } hd.setPointerCapture(e.pointerId); audioOn(); d0 = true; P.aim = null; hd.classList.add('grab'); });
    hd.addEventListener('pointermove', (e) => { if (d0) P.aim = aimAt(e); });
    const end = (e) => { if (!d0) return; d0 = null; hd.classList.remove('grab'); const A = P.aim; P.aim = null; if (!A || A.pw < 0.06 || e.type === 'pointercancel') return; const sp = 6 + 15 * A.pw; P.v.set(A.dx * sp, A.dy * sp); P.mode = 'fly'; P.out = false; P.res = ''; P.hop = 0.5; ping({ f: 170, q: 1, dur: 0.09, vol: 0.32, sharp: 3, thump: 90 }); buzz(10, true); pullSeen(); };
    hd.addEventListener('pointerup', end); hd.addEventListener('pointercancel', end); } }
window.__pit = PIT;
/* one way back out of any close-up: from a piece of work to the dial, from a caseback part to the caseback */
{ const zb = $('zback'); if (zb) zb.addEventListener('click', () => { audioOn(); if (zoomK) zoomOut(); else if (focus) jumpTo(CD); }); }
/* a first time hint on the pitch: a ghost fingertip settles on the ball, draws back along a dotted line, and lets go, and a small chevron flicks off toward goal.
   It plays only in the shootout, never while the ball is held or in flight, and once a shot has been taken it is gone for this visit and the next.
   With reduced motion it is one still drawing: the fingertip drawn back, the line, and the chevron */
const pull = { el: null, seen: false, lw: 0, lh: 0, v: new THREE.Vector3() };
try { pull.seen = localStorage.getItem('nk-pull') === '1'; } catch (e) {}
{ const el = document.createElement('div'); el.id = 'pull'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<div class="pa"><i class="pb"></i><i class="pg"></i><i class="pt"></i></div><span class="pl">Pull back to shoot</span>'; if (reduce) el.classList.add('still'); const k = $('kick'); if (k && k.parentNode) k.parentNode.insertBefore(el, k); pull.el = el; }
function pullSeen() { if (pull.seen) return; pull.seen = true; pull.el.classList.remove('on'); kickEl.classList.remove('hinting'); try { localStorage.setItem('nk-pull', '1'); } catch (e) {} }
function pullTick(W, H) { const P = PIT, el = pull.el, k = $('kick'), show = !pull.seen && zoomK === 'soccer' && P.a > 0.97 && P.mode === 'ready' && !P.aim && !!k && k.classList.contains('on') && !k.classList.contains('grab');
  if (el.classList.contains('on') !== show) { el.classList.toggle('on', show); if (k) k.classList.toggle('hinting', show); } if (!show) return;   /* while the hint plays, the ball's dot pulses small so the two do not compete */
  const sc = (x, y) => { pull.v.set(x, y, P.z + P.rb).applyMatrix4(gPit.matrixWorld).project(camera); return [(pull.v.x * 0.5 + 0.5) * W, (0.5 - pull.v.y * 0.5) * H]; };
  const th = Math.atan2(P.p.y, P.p.x), ux = -P.s * Math.sin(th), uy = P.s * Math.cos(th), O = sc(P.p.x, P.p.y), B = sc(P.p.x + ux, P.p.y + uy), R = sc(P.p.x + Math.cos(th), P.p.y + Math.sin(th));   // back along the lane, away from goal; and straight out from the big ball
  const bx = B[0] - O[0], by = B[1] - O[1], bl = Math.hypot(bx, by) || 1, L = clamp(bl * 1.3, 46, 92), rx = R[0] - O[0], ry = R[1] - O[1], rl = Math.hypot(rx, ry) || 1, nx = rx / rl, ny = ry / rl;
  el.firstChild.style.transform = 'translate(' + O[0].toFixed(1) + 'px,' + O[1].toFixed(1) + 'px) rotate(' + Math.atan2(by, bx).toFixed(4) + 'rad)'; el.style.setProperty('--L', L.toFixed(1) + 'px');
  const lab = el.lastChild; if (!pull.lw) { pull.lw = lab.offsetWidth; pull.lh = lab.offsetHeight; }
  const d = 16 + Math.abs(nx) * pull.lw / 2 + Math.abs(ny) * pull.lh / 2; lab.style.transform = 'translate(' + clamp(O[0] + nx * d - pull.lw / 2, 8, W - pull.lw - 8).toFixed(1) + 'px,' + clamp(O[1] + ny * d - pull.lh / 2, 8, H - pull.lh - 8).toFixed(1) + 'px)'; }
/* the sound of a board going downhill: a low cold wind that wanders, and the hiss of an edge biting and letting go, turn after turn */
let slope = null;
function snowLoop(on) { if (on && !slope && actx && actx.state === 'running' && !muted) try { const sr = actx.sampleRate, n = sr * 4, b = actx.createBuffer(1, n, sr), d = b.getChannelData(0); let lp = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * 0.12; d[i] = 0.55 * w + 1.6 * lp; }
    const s = actx.createBufferSource(), out = actx.createGain(), wind = actx.createBiquadFilter(), wg = actx.createGain(), edge = actx.createBiquadFilter(), hp = actx.createBiquadFilter(), eg = actx.createGain(), l1 = actx.createOscillator(), l1g = actx.createGain(), l2 = actx.createOscillator(), l2g = actx.createGain(), l3 = actx.createOscillator(), l3g = actx.createGain();
    s.buffer = b; s.loop = true; out.gain.value = 0.0001; wind.type = 'bandpass'; wind.frequency.value = 520; wind.Q.value = 0.7; wg.gain.value = 0.5; edge.type = 'bandpass'; edge.frequency.value = 4200; edge.Q.value = 0.8; hp.type = 'highpass'; hp.frequency.value = 2400; eg.gain.value = 0.16;
    l1.frequency.value = 0.11; l1g.gain.value = 210; l1.connect(l1g).connect(wind.frequency); l2.frequency.value = 0.42; l2g.gain.value = 0.15; l2.connect(l2g).connect(eg.gain); l3.frequency.value = 0.42; l3g.gain.value = 1300; l3.connect(l3g).connect(edge.frequency);
    s.connect(wind).connect(wg).connect(out); s.connect(hp).connect(edge).connect(eg).connect(out); out.connect(master); s.start(); l1.start(); l2.start(); l3.start(); out.gain.setTargetAtTime(0.2, actx.currentTime, 0.5); slope = { s, out, l: [l1, l2, l3] }; } catch (e) {}
  if (slope && (!on || muted)) { const z = slope; slope = null; try { z.out.gain.setTargetAtTime(0.0001, actx.currentTime, 0.25); z.s.stop(actx.currentTime + 1.2); z.l.forEach((o) => o.stop(actx.currentTime + 1.2)); } catch (e) {} } }
function panTick(dt) { pitTick(dt); snowLoop(zoomK === 'snow'); const want = zoomK === 'cooking' ? 1 : 0; PAN.a += (want - PAN.a) * Math.min(1, dt * 5); gPan.visible = PAN.a > 0.01; gSpill.visible = steam.visible = gPan.visible; if (!gPan.visible) { fryLoop(false, 0); stS.forEach((q) => { q.life = 0; }); stC.fill(0); steam.geometry.attributes.color.needsUpdate = true; if (PAN.bits[0] && PAN.a <= 0.01) PAN.bits.forEach((b) => { b.on = false; b.me.visible = false; }); PAN.off.set(0, 0); PAN.vel.set(0, 0); return; }
  const n = 4, h = dt / n; let sp = 0, acc = 0; PAN.t += dt;
  for (let s = 0; s < n; s++) { pv.copy(PAN.tgt || pv.set(0, 0)); const k = PAN.tgt ? 420 : 120, c = PAN.tgt ? 24 : 9, ax = k * (pv.x - PAN.off.x) - c * PAN.vel.x, ay = k * (pv.y - PAN.off.y) - c * PAN.vel.y; PAN.vel.x += ax * h; PAN.vel.y += ay * h; PAN.off.addScaledVector(PAN.vel, h); acc = Math.max(acc, Math.hypot(ax, ay));
    /* the food is loose in the pan: it lags, slides up the wall, and comes back late */
    PAN.fv.x += (70 * (PAN.off.x - PAN.food.x) - 5.5 * PAN.fv.x) * h; PAN.fv.y += (70 * (PAN.off.y - PAN.food.y) - 5.5 * PAN.fv.y) * h; PAN.food.addScaledVector(PAN.fv, h);
    PAN.hv += (acc * 0.012 * (PAN.hop < 0.02 ? 1 : 0) - 60 * PAN.hop - 0) * h - PAN.hv * 6 * h; PAN.hop = Math.max(0, PAN.hop + PAN.hv * h); sp = Math.max(sp, PAN.vel.length()); }
  const e = PAN.a * PAN.a * (3 - 2 * PAN.a); gPan.scale.setScalar(Math.max(e, 0.001)); gPanIn.position.set(PAN.off.x, PAN.off.y, 0.25 * Math.min(1, sp / 14)); gPanIn.rotation.set(clamp(PAN.vel.y * 0.022, -0.4, 0.4), clamp(-PAN.vel.x * 0.022, -0.4, 0.4), 0);
  const sx = clamp(PAN.food.x - PAN.off.x, -0.8, 0.8), sy = clamp(PAN.food.y - PAN.off.y, -0.8, 0.8), sl = Math.hypot(sx, sy), live = Math.min(1, sp / 6) + 0.12;
  PAN.items.forEach((it, i) => { const q = it.lag * it.w, wob = live * 0.05, px = it.b.x - sx * q + Math.sin(PAN.t * (5 + it.lag * 4) + it.ph) * wob, py = it.b.y - sy * q + Math.cos(PAN.t * (4.3 + it.lag * 5) + it.ph) * wob, d = Math.hypot(px, py), lim = PAN.r * 0.74, f = d > lim ? lim / d : 1;
    it.me.position.set(px * f, py * f, it.b.z + (d > lim ? (d - lim) * 0.7 : 0) + PAN.hop * it.w * (0.6 + 0.4 * Math.sin(it.ph * 3)) + sl * 0.12 * it.lag); it.me.rotation.z = it.r0 + (sx * Math.cos(it.ph) + sy * Math.sin(it.ph)) * 1.6 * it.lag + Math.sin(PAN.t * 3 + it.ph) * 0.06 * live; });
  const lvl = clamp(sp / 16, 0, 1); fryLoop(want === 1, lvl); PAN.flare = lvl;
  /* a toss: the food hisses louder, the pan knocks on the grate, steam bursts and the oil spits */
  clang -= dt; if (sp > 9 && clang <= 0) { clang = 0.32; ping({ f: 1900 + Math.random() * 500, q: 6, dur: 0.02, vol: 0.05 + 0.06 * lvl, sharp: 5, ring: 2600 + Math.random() * 300, ringVol: 0.4, ringDur: 0.12, thump: 130 }); snd.sizzle(1); buzz(8); for (let i = 0; i < 6; i++) puff(false, sp); for (let i = 0; i < 5; i++) puff(true, sp); }
  if (Math.random() < dt * (3 + 26 * lvl)) puff(false, sp);
  for (let i = 0; i < STN; i++) { const q = stS[i]; if (q.life <= 0) { stC[i * 3] = stC[i * 3 + 1] = stC[i * 3 + 2] = 0; continue; } q.life -= dt; const u = Math.max(0, q.life / q.max), f = q.hot ? u : Math.sin(Math.PI * Math.min(1, (1 - u) * 1.6 + 0.08)) * u * 0.5; if (q.hot) q.v[2] -= 30 * dt; stP[i * 3] += q.v[0] * dt; stP[i * 3 + 1] += q.v[1] * dt; stP[i * 3 + 2] += q.v[2] * dt; stC[i * 3] = f * (q.hot ? 1 : 0.5); stC[i * 3 + 1] = f * (q.hot ? 0.55 : 0.5); stC[i * 3 + 2] = f * (q.hot ? 0.12 : 0.52); }
  steam.geometry.attributes.position.needsUpdate = true; steam.geometry.attributes.color.needsUpdate = true;
  /* too hard: something leaves the pan */
  if (sp > 15 && PAN.tgt) { const b = PAN.bits.find((q) => !q.on); if (b && Math.random() < dt * 12) { b.on = true; b.me.visible = true; b.me.position.set(PBAL[0] + PAN.off.x, PBAL[1] + PAN.off.y, PAN.z + 0.7); const a = Math.atan2(PAN.vel.y, PAN.vel.x) + (Math.random() - 0.5) * 1.6, q = 3 + Math.random() * 5; b.v.set(Math.cos(a) * q, Math.sin(a) * q, 7 + Math.random() * 6); b.w = (Math.random() - 0.5) * 20; b.land = false; b.kicks = 0; ping({ f: 1500 + Math.random() * 600, q: 2, dur: 0.02, vol: 0.03, sharp: 4 }); buzz(6); } }
  { const bz = gBal.rotation.z; PAN.balW = dt > 0 ? (bz - (PAN.bz0 ?? bz)) / dt : 0; PAN.bz0 = bz; }
  PAN.bits.forEach((b) => { if (!b.on || b.land) return; b.v.z -= 45 * dt; b.me.position.addScaledVector(b.v, dt); b.me.rotation.x += b.w * dt; b.me.rotation.z += b.w * 0.7 * dt; const qx = b.me.position.x - PBAL[0], qy = b.me.position.y - PBAL[1], d = Math.hypot(qx, qy), al = qx * CKU[0] + qy * CKU[1], pe = Math.abs(qx * CKU[1] - qy * CKU[0]), onCock = al > -1.6 && pe < 1.75 && d < 6.4, onWheel = !onCock && d > 0.9 && d < RBAL + 0.35, fl = d < 2.6 && onCock ? ZHOB + 0.06 : onCock ? ZCK + 0.1 : onWheel ? 3.6 : BTOP + 0.06;
    /* table football: a bit that comes down on the swinging balance is batted away by the rim or a spoke, up and off across the movement, to land somewhere else */
    if (b.v.z < 0 && onWheel && b.me.position.z <= fl && (b.kicks || 0) < 3) { const sg = (PAN.balW || 0) === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(PAN.balW), vt = sg * (6 + Math.random() * 7), vo = 1.5 + Math.random() * 3.5; b.kicks = (b.kicks || 0) + 1; b.me.position.z = fl; b.v.set((-qy / d) * vt + (qx / d) * vo, (qx / d) * vt + (qy / d) * vo, 7 + Math.random() * 6); b.w = (Math.random() - 0.5) * 34; ping({ f: 2300 + Math.random() * 900, q: 9, dur: 0.07, vol: 0.07, sharp: 4 }); buzz(5); return; }
    if (b.v.z < 0 && b.me.position.z <= fl) { b.me.position.z = fl; b.land = true; b.me.rotation.x = 0; ping({ f: 500 + Math.random() * 200, q: 1.2, dur: 0.03, vol: 0.02, sharp: 3 }); } });
}
const gDrift = new THREE.Group(); gDrift.visible = false; gBr.add(gDrift);
{ const ms = M('bridges', { color: 0xf6f9ff, roughness: 0.92, metalness: 0, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xdfeaff) }), r = prng(77), at = (u, n) => [SBC[0] + SBU[0] * u - SBU[1] * n, SBC[1] + SBU[1] * u + SBU[0] * n], h = SBL / 2;
  const lump = (u, n, z, sx, sy, sz) => { const g = new THREE.SphereGeometry(1, 14, 10); g.scale(sx, sy, sz); const p = at(u, n), me = new THREE.Mesh(g, ms); me.position.set(p[0], p[1], z); me.rotation.z = Math.atan2(SBU[1], SBU[0]) + (r() - 0.5) * 0.6; me.receiveShadow = true; gDrift.add(me); };
  /* powder caught on the board: along the edges, against the bindings, on the nose */
  for (let i = 0; i < 16; i++) { const u = (r() * 2 - 1) * h * 0.9, n = (r() > 0.5 ? 1 : -1) * SBW * (0.55 + r() * 0.4); lump(u, n, ZLOW + 0.01, 0.16 + r() * 0.2, 0.08 + r() * 0.08, 0.04 + r() * 0.03); }
  for (let i = 0; i < 5; i++) lump(h * (0.72 + r() * 0.2), (r() - 0.5) * SBW, ZLOW + 0.01, 0.2 + r() * 0.14, 0.14 + r() * 0.08, 0.05); }
function snowTick(t, dt) { snowA += ((zoomK === 'snow' ? 1 : 0) - snowA) * Math.min(1, dt * 3); snow.visible = gDrift.visible = snowA > 0.01; if (!snow.visible) return; gDrift.scale.set(1, 1, Math.min(1, snowA * 1.15)); gDrift.children.forEach((c, i) => { c.scale.setScalar(clamp(snowA * 1.6 - (i % 7) * 0.08, 0.001, 1)); }); snow.material.opacity = 0.6 * snowA; const nx = -SBU[1], ny = SBU[0];
  for (let i = 0; i < SNOWN; i++) { const q = snowS[i], u = ((q[0] + t * 0.11 * q[3]) % 1) * 9 - 4.5, n = q[1] * 2.6 + 0.25 * Math.sin(t * 1.3 + i), z = ZLOW + 0.2 + q[2] * 1.5 - 0.25 * ((q[0] + t * 0.11 * q[3]) % 1);
    snowP[i * 3] = SBC[0] + SBU[0] * u + nx * n; snowP[i * 3 + 1] = SBC[1] + SBU[1] * u + ny * n; snowP[i * 3 + 2] = z; } snow.geometry.attributes.position.needsUpdate = true; }
const intPins = [...document.querySelectorAll('.hot[data-int]')], cbPanel = document.querySelector('.panel[data-ch="6"]'); let selInt = null, zoomK = null;
/* tapping a dot goes in close on that part and opens its notes */
function footFix(on) { const t = $('int-t'); t.style.paddingTop = on ? '1.45em' : ''; if (!on) return; t.innerHTML = '<span class="sr">Football</span><span aria-hidden="true" class="fix" id="fixf"><span class="was">Soccer</span><svg class="strike" viewBox="0 0 100 20" preserveAspectRatio="none"><path pathLength="1" vector-effect="non-scaling-stroke" d="M1 12.5C18 11 36 14 54 11S84 8.5 99 9.5"/></svg><span class="now">Football</span></span>'; const f = $('fixf'); if (reduce || footFix.done) { f.classList.add('on'); return; } setTimeout(() => { f.classList.add('on'); if (!footFix.done) { footFix.done = true; snd.scribble(); } }, 900); }
function pickInt(k) { document.body.classList.add('dotted'); selInt = zoomK = k; const r = INTS[k]; cbPanel.classList.add('zoomed'); document.body.classList.add('zoomed'); $('int-d').hidden = false; $('int-k').textContent = r[0]; $('int-t').textContent = r[1]; footFix(k === 'soccer'); $('int-b').textContent = r[2]; $('int-l').textContent = r[3];
  const ol = $('int-list'); ol.className = r[6] ? 'num' : ''; ol.replaceChildren(...r[4].map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
  $('int-ph').replaceChildren(...r[5].map((p) => { const im = document.createElement('img'); im.src = p.src; im.alt = p.alt || ''; im.loading = 'lazy'; return im; }));
  intPins.forEach((p) => p.classList.toggle('sel', p.dataset.int === k)); $('int-deck').hidden = k !== 'music'; document.body.classList.toggle('deck', k === 'music'); document.body.classList.toggle('cook', k === 'cooking'); document.body.classList.toggle('pitch', k === 'soccer'); $('int-score').hidden = k !== 'soccer'; setNeedle(false); }
/* the deck: the arm waits off the record. Drop the needle and it plays; lift it, or leave, and it stops */
let needle = false, armOff = 0, crackle = null, armDrag = null;
/* the tonearm is yours to move: take the headshell, swing it over the record and let go, and the needle drops. Lift it away and the music stops */
const armAt = (o, t) => { const a = ARMSWING * t, dx = TAS[0] - TAP[0], dy = TAS[1] - TAP[1]; o.position.set(TAP[0] + dx * Math.cos(a) - dy * Math.sin(a), TAP[1] + dx * Math.sin(a) + dy * Math.cos(a), TAZ + 0.25); };
anchor('i-arm', gBr, 0, 0, 0); anchor('arm-a', gBr, 0, 0, 0); anchor('arm-b', gBr, 0, 0, 0); armAt(anchors['arm-a'], 0); armAt(anchors['arm-b'], 1); armAt(anchors['i-arm'], 0);
{ const hd = $('arm'), scr = (k) => { const r = canvas.getBoundingClientRect(), p = anchors[k].getWorldPosition(new THREE.Vector3()).project(camera); return [r.left + (p.x * 0.5 + 0.5) * r.width, r.top + (0.5 - p.y * 0.5) * r.height]; };
  hd.addEventListener('pointerdown', (e) => { e.preventDefault(); hd.setPointerCapture(e.pointerId); armDrag = { x: e.clientX, y: e.clientY, moved: false, was: needle }; if (needle) setNeedle(false); hd.classList.add('grab'); });
  hd.addEventListener('pointermove', (e) => { if (!armDrag) return; if (Math.hypot(e.clientX - armDrag.x, e.clientY - armDrag.y) > 5) armDrag.moved = true; const A = scr('arm-a'), B = scr('arm-b'), ux = B[0] - A[0], uy = B[1] - A[1]; armDrag.t = clamp(((e.clientX - A[0]) * ux + (e.clientY - A[1]) * uy) / (ux * ux + uy * uy), -0.25, 1.1); });
  const end = () => { if (!armDrag) return; const d = armDrag; armDrag = null; hd.classList.remove('grab'); if (d.moved ? d.t < 0.45 : !d.was) { setNeedle(true); buzz(12, true); } else setNeedle(false); };
  hd.addEventListener('pointerup', end); hd.addEventListener('pointercancel', end); } const TONE0 = gTone.rotation.z, NOW = '[Your last played song]';
function setNeedle(on) { needle = on && selInt === 'music'; $('int-needle').textContent = needle ? 'Lift the needle' : 'Drop the needle'; $('int-now').textContent = needle ? 'Now playing: ' + NOW : 'Take the tonearm and drop the needle on the record.';
  if (needle) { audioOn(); ping({ f: 180, q: 1, dur: 0.05, vol: 0.09, sharp: 3, thump: 70 }); if (actx && !muted && !crackle) try { const sr = actx.sampleRate, n = sr * 2, b = actx.createBuffer(1, n, sr), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.5 : 0);
      const s = actx.createBufferSource(), g = actx.createGain(), lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; s.buffer = b; s.loop = true; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.5, actx.currentTime + 0.4); s.connect(lp).connect(g).connect(master); s.start(); crackle = { s, g }; } catch (e) {} }
  else if (crackle) { try { crackle.g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.25); crackle.s.stop(actx.currentTime + 0.3); } catch (e) {} crackle = null; } }
function zoomOut() { if (!selInt) return; setNeedle(false); document.body.classList.remove('deck', 'cook', 'pitch'); selInt = zoomK = null; cbPanel.classList.remove('zoomed'); document.body.classList.remove('zoomed'); $('int-d').hidden = true; intPins.forEach((p) => p.classList.remove('sel')); }
intPins.forEach((p) => p.addEventListener('click', () => pickInt(p.dataset.int))); $('int-back').addEventListener('click', zoomOut); $('int-needle').addEventListener('click', () => setNeedle(!needle)); addEventListener('keydown', (e) => { if (e.key === 'Escape') zoomOut(); });
const ZOOMS = { soccer: 2.8, cooking: 2.7, snow: 4.2, music: 3.8 }, ZTILT = { soccer: [50, -20, -12], cooking: [48, 14, 160], snow: [50, 24, 15], music: [32, -10, 0] }, zTilt = [0, 0, 0], zoomP = new THREE.Vector3(), zw = new THREE.Vector3(), zl = new THREE.Vector3(); let cz = 0, zsNow = 1, zoomInit = false;
function zoomApply(dt, sc, cx, cy, act) {
  if (zoomK && act !== CB) zoomOut();
  const k = snap ? 1 : 1 - Math.exp(-dt * 4.5); cz += ((zoomK ? 1 : 0) - cz) * k; { const tt = zoomK ? ZTILT[zoomK] : [0, 0, 0], kk = snap ? 1 : 1 - Math.exp(-dt * 2.6); for (let i = 0; i < 3; i++) zTilt[i] += (tt[i] - zTilt[i]) * kk; } if (!zoomK && cz < 0.002) { cz = 0; zoomInit = false; return; }
  root.updateMatrixWorld(true);
  if (zoomK) { anchors['z-' + zoomK].getWorldPosition(zl); root.worldToLocal(zl); if (!zoomInit) { zoomInit = true; zoomP.copy(zl); zsNow = ZOOMS[zoomK]; } else { zoomP.lerp(zl, k); zsNow += (ZOOMS[zoomK] - zsNow) * k; } }
  const e = cz * cz * (3 - 2 * cz); root.scale.setScalar(sc * lerp(1, zsNow, e)); root.updateMatrixWorld(true);
  zw.copy(zoomP).applyMatrix4(root.matrixWorld); root.position.x += (cx - zw.x) * e; root.position.y += (cy - zw.y) * e; root.position.z -= zw.z * e; }   // the part comes to the middle of the view, at the depth the view is set for


/* ---------- unboxing: a plain box on an empty page. Its lid opens as a pair of butterfly doors, a sprung platform pops the watch up,
   the watch flies to its place, and the empty box drifts back and drops beside a recycling bin at the back of the scene ---------- */
const intro = { on: document.body.classList.contains('intro'), open: false, t: 0, hold: null, tries: 0, need: Math.random() < 0.5 ? 2 : 3, lastTry: -1e9, shake: null, idleT: 0, nextTw: 2.4 };
let upDone = false;   // every visit starts fresh: the recycled dial only appears once the box goes in the bin
const gBox = new THREE.Group(); scene.add(gBox);
const BW = 104, BH = 56, BL = 18, BWT = 4;   // footprint, base height, lid height, wall (mm, the watch's own scale)
const boxGrain = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) { g.fillStyle = 'rgba(' + (Math.random() > 0.5 ? '255,255,255' : '0,0,0') + ',' + Math.random() * 0.22 + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t; })();
/* plain grained leatherette in a midnight blue, a shade lighter than the page so the box still reads at the back of the room. A soft sheen on the grain
   lifts the faces turned away from the light, and a thin satin lacquer gives the edges a highlight */
const BOXC = 0x26304a, mBoxOut = new THREE.MeshPhysicalMaterial({ color: BOXC, roughness: 0.5, metalness: 0, bumpMap: boxGrain, bumpScale: 0.6, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.35, sheenColor: new THREE.Color(0x7d8fb8), sheenRoughness: 0.55, envMapIntensity: 1.4 });
const mBoxIn = new THREE.MeshStandardMaterial({ color: 0x12151b, roughness: 1, metalness: 0, bumpMap: boxGrain, bumpScale: 0.3 });
/* the pillow's cloth is a short napped microfibre. One tile of it, 20 mm square: every fibre is laid as a little ramp that rises from root to tip along the local nap,
   and the nap swirls slowly, so patches of it are brushed different ways. The relief becomes a normal map; the colour is lighter on the fibre tips and darker between them */
const pilTex = (() => { const S = 512, r = prng(909), h = new Float32Array(S * S), tn = new Float32Array(S * S), hb = new Float32Array(S * S), k = TAU / S;
  const ang = (x, y) => 0.6 + 0.75 * Math.sin(k * x + 1.8 * Math.sin(2 * k * y + 1)) + 0.5 * Math.sin(3 * k * y + 2 + 1.4 * Math.sin(2 * k * x));
  for (let n = 0; n < 16000; n++) { const x0 = r() * S, y0 = r() * S, a = ang(x0, y0) + (r() - 0.5) * 1.15, ca = Math.cos(a), sa = Math.sin(a), len = 7 + r() * 17, amp = 0.3 + 0.7 * r(), tint = r();
    for (let q = 0; q <= len; q++) { const w = amp * (0.3 + 0.7 * q / len) * Math.min(1, (len - q + 0.6) / 2.5), px = x0 + ca * q, py = y0 + sa * q;
      for (let dd = -1; dd <= 1; dd++) { const X = ((Math.round(px - sa * dd * 0.95) % S) + S) % S, Y = ((Math.round(py + ca * dd * 0.95) % S) + S) % S, o = Y * S + X, val = dd ? w * 0.6 : w; if (val > h[o]) { h[o] = val; tn[o] = tint; } } } }
  for (let y = 0; y < S; y++) { const yu = ((y + S - 1) % S) * S, yd = ((y + 1) % S) * S, y0 = y * S; for (let x = 0; x < S; x++) { const xl = (x + S - 1) % S, xr = (x + 1) % S; hb[y0 + x] = 0.4 * h[y0 + x] + 0.15 * (h[y0 + xl] + h[y0 + xr] + h[yu + x] + h[yd + x]); } }
  const dc = new Uint8Array(S * S * 4), dn = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) { const yu = ((y + S - 1) % S) * S, yd = ((y + 1) % S) * S, y0 = y * S; for (let x = 0; x < S; x++) { const o = y0 + x, j = o * 4, xl = (x + S - 1) % S, xr = (x + 1) % S;
      const gx = (hb[y0 + xr] - hb[y0 + xl]) * 2.4, gy = (hb[yd + x] - hb[yu + x]) * 2.4, il = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      dn[j] = 128 - 127 * gx * il; dn[j + 1] = 128 - 127 * gy * il; dn[j + 2] = 128 + 127 * il; dn[j + 3] = 255;
      const v = clamp(0.84 + 0.16 * hb[o] + (tn[o] - 0.5) * 0.05 , 0, 1); dc[j] = 255 * v; dc[j + 1] = 251 * v; dc[j + 2] = 243 * v; dc[j + 3] = 255; } }
  const mk = (d, srgb) => { const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  return { tc: mk(dc, true), tn: mk(dn, false) }; })();
const mPillow = new THREE.MeshPhysicalMaterial({ color: 0xdcd4c4, map: pilTex.tc, normalMap: pilTex.tn, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.94, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xfff6ea), vertexColors: true, envMapIntensity: 0.85 });
const mThread = new THREE.MeshPhysicalMaterial({ color: 0xc4b596, roughness: 0.8, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xfff4e0) });
const mSatin = new THREE.MeshPhysicalMaterial({ color: 0xe8e0cf, roughness: 0.45, sheen: 0.6, sheenRoughness: 0.3, sheenColor: new THREE.Color(0xfff6e4) });
const bxm = (geo, mat, parent, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m; };
{ const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r), hh = BH - BWT, yw = -BH + BWT + hh / 2, ins = BW - 2 * BWT - 0.1;
  bxm(rb(BW, BWT, BW, 1.4), mBoxOut, gBox, 0, -BH + BWT / 2, 0);
  bxm(rb(BW, hh, BWT, 1.2), mBoxOut, gBox, 0, yw, BW / 2 - BWT / 2); bxm(rb(BW, hh, BWT, 1.2), mBoxOut, gBox, 0, yw, -BW / 2 + BWT / 2);
  bxm(rb(BWT, hh, BW - 2 * BWT + 0.4, 1.2), mBoxOut, gBox, BW / 2 - BWT / 2, yw, 0); bxm(rb(BWT, hh, BW - 2 * BWT + 0.4, 1.2), mBoxOut, gBox, -BW / 2 + BWT / 2, yw, 0);
  const pl = (w, h, x, y, z, rx, ry) => { const m = bxm(new THREE.PlaneGeometry(w, h), mBoxIn, gBox, x, y, z); m.rotation.set(rx, ry, 0); };
  pl(ins, ins, 0, -BH + BWT + 0.05, 0, -Math.PI / 2, 0); pl(ins, hh, 0, yw, ins / 2, 0, Math.PI); pl(ins, hh, 0, yw, -ins / 2, 0, 0); pl(ins, hh, ins / 2, yw, 0, 0, -Math.PI / 2); pl(ins, hh, -ins / 2, yw, 0, 0, Math.PI / 2); }
/* the cushion sits on a sprung platform, so it can pop the watch up out of the box. It is a soft stuffed pillow on a wedge plan: a round bolster at the back, a slim nose at the front,
   the watch on its top and the strap buckled underneath. It can rock back on its bolster and turn on the plate, and the watch rides with it */
const gPlat = new THREE.Group(); gBox.add(gPlat); const gYaw = new THREE.Group(), gPil = new THREE.Group(); gPlat.add(gYaw); gYaw.add(gPil);
const PIL0 = [-8.8, 4.75], PNU = 288, PNX = 120, PLX = 34, PA1 = 3.6577, PA2 = 2.6255, PL1 = 18 * PA1, PPER = 72 + PL1 + 8.5 * PA2;
/* a point on the pillow's outline and its outward normal, by distance round it: top, back bolster, lower face, nose. This is the firm core the strap is laid round */
function pilAt(u) { u = ((u % PPER) + PPER) % PPER; if (u < 36) return [u - 18, 0, 0, 1]; u -= 36; if (u < PL1) { const a = Math.PI / 2 - u / 18; return [18 + 18 * Math.cos(a), -18 + 18 * Math.sin(a), Math.cos(a), Math.sin(a)]; }
  u -= PL1; if (u < 36) return [9.12 - 0.8698 * u, -33.66 + 0.4934 * u, -0.4934, -0.8698]; u -= 36; const a = Math.PI / 2 - PA1 - u / 8.5; return [-18 + 8.5 * Math.cos(a), -8.5 + 8.5 * Math.sin(a), Math.cos(a), Math.sin(a)]; }
function pilU(y, z) { const dx = y - 18, dz = z + 18, py = dx * PAXY + dz * PAXZ, cr = dx * PAXZ - dz * PAXY, k = -PCB * Math.abs(cr) + PCA * py;
  if (k < 0) { let t = Math.PI / 2 - Math.atan2(dz, dx); t = ((t % TAU) + TAU) % TAU; return 36 + 18 * clamp(t, 0, PA1); }
  if (k > PCA * 37.2324) { let t = Math.PI / 2 - Math.atan2(z + 8.5, y + 18); t = ((t % TAU) + TAU) % TAU; return 72 + PL1 + 8.5 * clamp(t - PA1, 0, PA2); }
  return cr > 0 ? clamp(y + 18, 0, 36) : 36 + PL1 + clamp((y - 9.12) * -0.8698 + (z + 33.66) * 0.4934, 0, 36); }
/* the mesh: PNU bins round the loop (one extra column closes the texture), PNX rows along the axis, close together at the two seamed ends.
   Every vertex is the core outline pushed out along its normal by a height h (mm), then drawn toward the end seam by the row's taper */
const PNC = PNU + 1, PNR = PNX + 1, PNV = PNU * PNR, PBIG = 99, PEND = 18, PXM = 29.5, PXD = 27, PEDGE = 9.7, PTILE = PPER / 8, PSTP = 2.3;
const pilGeo = new THREE.BufferGeometry(), pilPos = new Float32Array(PNC * PNR * 3), pilNor = new Float32Array(PNC * PNR * 3), pilCol = new Float32Array(PNC * PNR * 3);
const plB = new Float32Array(PNU * 4), plSm = [new Float32Array(PNU * 2), new Float32Array(PNU * 2)], plSw = new Float32Array(PNU), plSf = new Float32Array(PNU), plPc = new Float32Array(PNU);
const plX = new Float32Array(PNR), plT = new Float32Array(PNR), plLip = new Float32Array(PNR), plGrv = new Float32Array(PNR);
const plP = new Float32Array(PNV), plHc = new Float32Array(PNV).fill(PBIG), plHs = new Float32Array(PNV).fill(PBIG), plGs = new Float32Array(PNV), plGc = new Float32Array(PNV), plMo = new Float32Array(PNV);
/* each end is pinched flat into a seam that runs from in front of the nose to behind the bolster, a little low, and not quite the same at the two ends */
const PSEAM = [{ F: [-28.3, -9.4], R: [37.6, -22.6], bow: -0.7 }, { F: [-28.6, -11.3], R: [38.2, -20.6], bow: 0.9 }];
PSEAM.forEach((s) => { const dy = s.R[0] - s.F[0], dz = s.R[1] - s.F[1], l = Math.hypot(dy, dz); s.len = l; s.d = [dy / l, dz / l]; s.n = [-dz / l, dy / l]; });
function pilSeam(e, f) { const s = PSEAM[e]; return [lerp(s.F[0], s.R[0], f), lerp(s.F[1], s.R[1], f) + s.bow * Math.sin(Math.PI * f) + 0.3 * Math.sin(3 * Math.PI * f + 2 * e)]; }
const pilCorner = (f) => Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(2 * f - 1), 10)));
/* the underside of the watch as the pillow meets it (x along the pillow, y toward twelve, heights from the top plane of the core): the back, the bowl of the case, four lugs and the crown */
const pilCase = (r) => r < 15.6 ? -2 : r < 16.05 ? lerp(-2, -0.6, (r - 15.6) / 0.45) : r < 16.5 ? -0.45 : r < 19.5 ? 0.6 + 2.1 * Math.pow((r - 16.5) / 3, 1.25) : PBIG;
const PBR = 0.05, pilCaseT = new Float32Array(260); for (let k = 0; k < 260; k++) { const r = k * 0.1; let m = PBIG; for (let q = Math.max(0, r - 6); q <= r + 6; q += 0.04) { const z = pilCase(q) + PBR * (q - r) * (q - r); if (z < m) m = z; } pilCaseT[k] = m; }
function pilHead(x, y) { const ax = Math.abs(x), ay = Math.abs(y); let z = PBIG;
  if (ax > 9.7 && ax < 13.3 && ay > 13.5 && ay < 22.7) { const zl = ay < 16.5 ? lerp(1.4, 0.8, (ay - 13.5) / 3) : ay < 18.8 ? lerp(0.8, -0.3, (ay - 16.5) / 2.3) : ay < 21.1 ? lerp(-0.3, -1.3, (ay - 18.8) / 2.3) : ay < 21.9 ? -1.4 : lerp(-1.4, -0.9, (ay - 21.9) / 0.8); if (zl < z) z = zl; }
  if (x > 19.2 && x < 23.7 && ay < 3.65) { const zk = 4.1 - Math.sqrt(3.65 * 3.65 - y * y); if (zk < z) z = zk; }
  return z; }
{ const r = prng(4242), uF = 72 + PL1 + 8.5 * (1.5 * Math.PI - PA1), uR = 36 + 9 * Math.PI, LT = PPER - uF + uR, LB = uF - uR, du = PPER / PNU, Pu = new Float32Array(PNU), tmp = new Float32Array(PNU);
  const blur = (a, rad, n) => { for (let q = 0; q < n; q++) { for (let i = 0; i < PNU; i++) { let s = 0; for (let k = -rad; k <= rad; k++) s += a[(i + k + PNU) % PNU]; tmp[i] = s / (2 * rad + 1); } a.set(tmp); } };
  for (let i = 0; i < PNU; i++) { const u = i * du, B = pilAt(u); plB.set(B, i * 4); const top = u >= uF || u < uR, f = top ? ((u - uF + PPER) % PPER) / LT : 1 - (u - uR) / LB; plSf[i] = f; plSw[i] = (top ? 1 : -1) * pilCorner(f);
    for (let e = 0; e < 2; e++) { const p = pilSeam(e, f); plSm[e][i * 2] = p[0]; plSm[e][i * 2 + 1] = p[1]; }
    /* how far the stuffing pushes the cloth out past the core: most in the middle of the flat faces, least underneath */
    Pu[i] = u < 36 ? 2.3 + 0.7 * Math.sin(Math.PI * u / 36) : u < 36 + PL1 ? 2.0 : u < 72 + PL1 ? 1.5 + 0.8 * Math.sin(Math.PI * (u - 36 - PL1) / 36) : 1.7; }
  blur(Pu, 8, 2);
  for (let j = 0; j < PNR; j++) { const x = j <= PEND ? -PLX + (PLX - PXM) * j / PEND : j >= PNX - PEND ? PXM + (PLX - PXM) * (j - PNX + PEND) / PEND : -PXM + 2 * PXM * (j - PEND) / (PNX - 2 * PEND), ax = Math.abs(x), d = PLX - ax, s = clamp((ax - 13) / (PLX - 1.6 - 13), 0, 1);
    plX[j] = x; plT[j] = Math.pow(1 - Math.pow(s, x < 0 ? 2.4 : 2.7), 0.56);
    plLip[j] = (d < 0.45 ? 0.5 * Math.sqrt(Math.max(0, 1 - (1 - d / 0.45) * (1 - d / 0.45))) : 0.5) * (1 - sSmooth((d - 1.6) / 3)); plGrv[j] = 0.26 * Math.exp(-(d - 1.15) * (d - 1.15) / 0.09);
    const cx = (1 - 0.45 * sSmooth((ax - 17) / 13)) * (1 + 0.07 * x / PLX);
    for (let i = 0; i < PNU; i++) { const w = TAU * i / PNU, v = j * PNU + i;
      plP[v] = Pu[i] * cx + (0.3 * Math.sin(2 * w + 0.21 * x + 1) + 0.22 * Math.sin(3 * w - 0.33 * x + 4) + 0.14 * Math.sin(5 * w + 0.5 * x + 2.2)) * (1 - 0.6 * sSmooth((ax - 20) / 10));
      plMo[v] = 1 + 0.035 * Math.sin(2 * w + 0.4 * x + 3 + 1.5 * Math.sin(3 * w - 0.2 * x)) + 0.025 * Math.sin(7 * w - 0.9 * x + 1) + 0.02 * Math.sin(4 * w + 1.3 * x + 5); } }
  for (let i = 0; i < PNU; i++) { let m = -9; for (let j = 0; j < PNR; j++) if (Math.abs(plX[j]) <= 10.8) m = Math.max(m, plP[j * PNU + i]); plPc[i] = m; }
  /* the gathers the strap pulls into the cloth: creases that start at its edges and run out along the pillow, fanning and fading, with the cloth puffed up between them */
  for (let sd = -1; sd <= 1; sd += 2) for (let big = 0; big < 2; big++) { let u = r() * 3; while (u < PPER - 1) { const a = big ? 0.9 + 0.8 * r() : 0.4 + 0.9 * r(), L = big ? 9 + r() * 7 : 4 + r() * 7, s0 = big ? 1.1 + 0.8 * r() : 0.34 + 0.36 * r(), sl = (r() - 0.5) * (big ? 0.35 : 0.6), ph = r() * TAU, wb = 0.3 + 0.5 * r();
      for (let j = 0; j < PNR; j++) { const dx = sd * plX[j] - PEDGE; if (dx < -0.6 || dx > L) continue; const env = sSmooth((dx + 0.6) / 2.2) * Math.pow(1 - dx * dx / (L * L), 1.6), uc = u + sl * dx + wb * Math.sin(dx * 0.55 + ph), sg = s0 * (1 + 0.09 * dx), n = Math.ceil(3 * sg / du), i0 = Math.round(uc / du);
        for (let q = -n; q <= n; q++) { const dd = (i0 + q) * du - uc; plGs[j * PNU + ((i0 + q) % PNU + PNU) % PNU] -= a * env * Math.exp(-dd * dd / (2 * sg * sg)); } }
      u += big ? 5 + r() * 10 : 1.2 + r() * r() * 5; } }
  for (let j = 0; j < PNR; j++) { const o = j * PNU, row = plGs.subarray(o, o + PNU), sm = Pu; sm.set(row); blur(sm, 6, 2); const dx = Math.abs(plX[j]) - PEDGE, e2 = sSmooth(dx / 4) * (1 - sSmooth((dx - 4) / 10));
    for (let i = 0; i < PNU; i++) { const w = TAU * i / PNU; row[i] += -0.75 * sm[i] + e2 * (0.3 * Math.sin(13 * w + 0.35 * plX[j] + 1) + 0.22 * Math.sin(21 * w - 0.5 * plX[j] + 4)); } }
  /* under and round the head: how low the watch holds the cloth (the cloth bridges any sharp step), a soft raised rim just outside it, and folds fanning out from under it */
  const rays = []; for (let q = 0; q < 30; q++) rays.push([r() * TAU, 0.25 + 0.5 * r(), 3 + r() * 6.5, 0.4 + 0.35 * r()]);
  for (let i = 0; i < PNU; i++) { const nz = plB[i * 4 + 3]; if (nz < 0.35) continue; const u = i * du, yu = u < PPER / 2 ? u - 18 : u - PPER - 18, y = plB[i * 4], bz = plB[i * 4 + 1];
    for (let j = 0; j < PNR; j++) { const x = plX[j], ax = Math.abs(x); if (ax > PXD) continue; const v = j * PNU + i, t = plT[j]; let zm = PBIG, dm = 9;
      const r0 = Math.hypot(x, y), kq = Math.min(258, r0 * 10), k0 = Math.floor(kq); zm = lerp(pilCaseT[k0], pilCaseT[k0 + 1], kq - k0); if (r0 < 23.5) dm = Math.max(0, r0 - 19.5); const hsm = (z) => ((z - 0.3 - plSm[x < 0 ? 0 : 1][i * 2 + 1] * (1 - t)) / t - bz) / nz; if (zm < PBIG) plHs[v] = hsm(zm);
      if ((ax > 4 && ax < 19 && Math.abs(y) > 8) || (x > 13.5 && Math.abs(y) < 9.5)) for (let a = -7; a <= 7; a++) for (let b = -7; b <= 7; b++) { const dx = a * 0.7, dy = b * 0.7, z = pilHead(x + dx, y + dy); if (z < PBIG) { const d2 = dx * dx + dy * dy, zz = z + PBR * d2; if (zz < zm) zm = zz; if (d2 < dm * dm) dm = Math.sqrt(d2); } }
      if (zm < PBIG) plHc[v] = hsm(zm);
      const rr = Math.hypot(x, yu), dO = rr - 19.6, fade = (1 - sSmooth((ax - 19.5) / 6.5)) * sSmooth((nz - 0.35) / 0.3); if (dO <= 0 || ax < 10.4 || pilHead(x, y) < PBIG) continue;
      let g = 0.45 * sSmooth(dO / 1.5) * (1 - sSmooth((dO - 1.5) / 4)); const th = Math.atan2(yu, x);
      for (let q = 0; q < rays.length; q++) { const R = rays[q]; if (dO >= R[2]) continue; let da = th - R[0]; da -= TAU * Math.round(da / TAU); const dd = da * rr, sg = R[3] * (1 + 0.08 * dO); if (Math.abs(dd) > 3 * sg) continue; g -= R[1] * sSmooth(dO / 0.9) * Math.pow(1 - dO / R[2], 1.4) * Math.exp(-dd * dd / (2 * sg * sg)); }
      plGc[v] = g * fade; } } }
/* the pillow is soft and it remembers. Round the loop, each bin carries the height of the cloth under the strap (plx) on a light spring: the strap is a ceiling it cannot pass, so it is pressed
   into a waist, and what is pressed in swells out either side. Let go, it bounces most of the way back at once, wobbles, then creeps the rest as the memory of the squeeze (smF quick, smS slow) fades.
   The seat under the head (plHd: 1 pressed home, 0 gone) does the same: plHs is the broad seat of the case, which springs and remembers; plHc is every part of the head, a hard ceiling that simply rises with the watch */
const plx = new Float32Array(PNU), plv = new Float32Array(PNU), smF = new Float32Array(PNU), smS = new Float32Array(PNU), sCr = new Float32Array(PNU), sCl = new Float32Array(PNU).fill(PBIG), sWr = new Float32Array(PNU), sWd = new Float32Array(PNU).fill(9.85), sCb = new Float32Array(PNU), sBu = new Float32Array(PNU), sAs = new Float32Array(PNU), sTmp = new Float32Array(PNU);
let plHd = 1, plHv = 0, plSepN = 0, hmF = 0.42, hmS = 0.13, pilKey = -99, pilDirty = true;
const pilSep = (u) => cLift(u) + 2 * smo((u - CALF.uc - 0.05) / 0.5) + 44 * smo((u - 2.3) / 0.55);
/* where the strap and the buckle are now, as a ceiling over each bin: the height of their underside above the core */
function pilCeil() { sCr.fill(PBIG);
  if (ubk.on) { const kb = PNU / PPER, zt = CALF.zt0 - ubk.lift;
    for (let i = 0; i < 2; i++) { const sy = i ? -1 : 1, pts = cPt[i], st = CALF.L[i] / CALF.n[i]; for (let j = 2; j < pts.length; j++) { const y = sy * pts[j][0], z = pts[j][1] - zt, s = j * st, c = pilSD(y, z) - cTh(i, s) / 2 - 0.12; if (c > 7) continue; const b = Math.round(pilU(y, z) * kb), hw = cW(i, s) / 2;
        for (let q = -1; q <= 1; q++) { const bb = ((b + q) % PNU + PNU) % PNU; if (c < sCr[bb]) { sCr[bb] = c; sWr[bb] = hw; } } } }
    if (!ubk.free) { const t = cPt[0][CALF.n[0]], y = t[0], z = t[1] - zt, c = pilSD(y, z) - 1.9; if (c < 7) { const b0 = Math.round(pilU(y, z) * kb); for (let q = -4; q <= 20; q++) { const b = ((b0 + q) % PNU + PNU) % PNU, cc = c + (q > 5 ? 0.25 : 0); if (cc < sCr[b]) { sCr[b] = cc; sWr[b] = 10.3; } } } } }
  for (let b = 0; b < PNU; b++) { let m = sCr[b], wd = m < PBIG ? sWr[b] : -1; for (let k = 1; k <= 14; k++) { const pen = 0.03 * k * k; if (pen >= m) break; const b1 = (b + k) % PNU, b2 = (b - k + PNU) % PNU; if (sCr[b1] + pen < m) { m = sCr[b1] + pen; wd = sWr[b1]; } if (sCr[b2] + pen < m) { m = sCr[b2] + pen; wd = sWr[b2]; } }
    sCl[b] = m; if (wd > 0) sWd[b] += (wd - sWd[b]) * 0.5; } }
function pilStep(dt, sep, now) { let ch = 0; const n = now ? 1 : Math.max(1, Math.ceil(dt / 0.012)), h = dt / n, eF1 = 1 - Math.exp(-h / 0.3), eS1 = 1 - Math.exp(-h / 0.8), eF0 = Math.exp(-h / 1.1), eS0 = Math.exp(-h / 6);
  for (let b = 0; b < PNU; b++) { const free = plPc[b], cl = sCl[b], x0 = plx[b]; let x = x0, v = plv[b], mF = smF[b], mS = smS[b];
    if (now) { const c = Math.max(0, free - cl); mF = 0.48 * c; mS = 0.15 * c; x = Math.min(cl, free); v = 0; }
    else for (let q = 0; q < n; q++) { v += (230 * (free - mF - mS - x) - 9.5 * v) * h; x += v * h; let hit = false; if (x > cl) { x = cl; if (v > 0) v = 0; hit = true; }
      const c = Math.max(0, free - x); if (hit) { mF += (0.48 * c - mF) * eF1; mS += (0.15 * c - mS) * eS1; } else { mF *= eF0; mS *= eS0; } }
    plx[b] = x; plv[b] = v; smF[b] = mF; smS[b] = mS; ch += Math.abs(x - x0); sCb[b] = free - x; }
  for (let q = 0; q < 2; q++) { for (let b = 0; b < PNU; b++) { let s = 0; for (let k = -6; k <= 6; k++) s += sCb[(b + k + PNU) % PNU]; sTmp[b] = s / 13; } sCb.set(sTmp); }
  for (let b = 0; b < PNU; b++) { const c = Math.max(0, sCb[b]); sBu[b] = 0.42 * c; sAs[b] = Math.min(1.05, 0.1 + c / 3.6); }
  { const fl = clamp(1 - sep / 6.5, 0, 1), h0 = plHd; if (now) { plHd = fl; plHv = 0; hmF = 0.42 * fl; hmS = 0.13 * fl; }
    else for (let q = 0; q < n; q++) { plHv += (170 * (hmF + hmS - plHd) - 8.5 * plHv) * h; plHd += plHv * h; let hit = false; if (plHd < fl) { plHd = fl; if (plHv < 0) plHv = 0; hit = true; }
      if (hit) { hmF += (0.42 * plHd - hmF) * eF1; hmS += (0.13 * plHd - hmS) * eS1; } else { hmF *= eF0; hmS *= eS0; } }
    ch += Math.abs(plHd - h0) + (sep < 8 || plSepN < 8 ? Math.abs(sep - plSepN) : 0); plSepN = sep; }
  return ch > 2e-4; }
/* smooth normals straight from the grid: cheaper than the general routine, and the wrap round the loop needs no seam */
function pilNormals(j0, j1) { for (let j = j0; j <= j1; j++) { const ja = (j > 0 ? j - 1 : j) * PNC * 3, jb = (j < PNX ? j + 1 : j) * PNC * 3, jo = j * PNC * 3;
    for (let i = 0; i < PNU; i++) { const o = jo + i * 3, ip = jo + ((i + 1) % PNU) * 3, im = jo + ((i + PNU - 1) % PNU) * 3, a = ja + i * 3, b = jb + i * 3;
      const ax = pilPos[ip] - pilPos[im], ay = pilPos[ip + 1] - pilPos[im + 1], az = pilPos[ip + 2] - pilPos[im + 2], bx = pilPos[b] - pilPos[a], by = pilPos[b + 1] - pilPos[a + 1], bz = pilPos[b + 2] - pilPos[a + 2];
      const nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax, il = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1); pilNor[o] = nx * il; pilNor[o + 1] = ny * il; pilNor[o + 2] = nz * il; }
    const e = jo + PNU * 3; pilNor[e] = pilNor[jo]; pilNor[e + 1] = pilNor[jo + 1]; pilNor[e + 2] = pilNor[jo + 2]; } }
function pilDeform(all) { let jA = 0, jB = PNX; if (!all) { while (Math.abs(plX[jA]) > PXD) jA++; while (Math.abs(plX[jB]) > PXD) jB--; } const hk = clamp(plHd, -0.1, 1), hc0 = clamp(plHd, 0, 1.1), sp = plSepN;
  for (let j = jA; j <= jB; j++) { const x = plX[j], ax = Math.abs(x), t = plT[j], en = x < 0 ? 0 : 1, sm = plSm[en], fn = PSEAM[en].n, sl = PSEAM[en].len, lip = plLip[j], grv = plGrv[j], dyn = ax <= PXD; let v = j * PNU, o = j * PNC * 3;
    for (let i = 0; i < PNU; i++, v++, o += 3) { let h = plP[v], sh = plMo[v];
      if (dyn) { const e = ax - sWd[i], dc = plx[i] - plPc[i], w = e <= 0.2 ? 1 : e >= 5.2 ? 0 : 1 - sSmooth((e - 0.2) / 5), gs = plGs[v] * sAs[i];
        h += w * dc + gs + hc0 * plGc[v]; if (e > 0 && e < 15) h += sBu[i] * sSmooth(e / 4) * (1 - sSmooth((e - 4) / 11));
        if (e < 0.2 && h > plx[i]) h = plx[i];
        const hc = plHc[v]; if (hc < 50) { const d = h - plHs[v]; if (d > 0) h -= hk * d; if (h > hc + sp) h = hc + sp; }
        sh *= (1 - 0.2 * w * clamp(-dc / 5, 0, 1)) * clamp(1 + (gs < 0 ? 0.5 : 0.08) * gs, 0.66, 1.06); }
      const i4 = i * 4; let Y = plB[i4] + plB[i4 + 2] * h, Z = plB[i4 + 1] + plB[i4 + 3] * h;
      if (t < 1) { const sy = sm[i * 2], sz = sm[i * 2 + 1]; Y = sy + t * (Y - sy); Z = sz + t * (Z - sz); }
      if (lip > 0) { const th = plSw[i] * (lip - grv * (0.7 + 0.3 * Math.cos(TAU * plSf[i] * sl / PSTP))); Y += fn[0] * th; Z += fn[1] * th; }
      pilPos[o] = x; pilPos[o + 1] = Z; pilPos[o + 2] = -Y; pilCol[o] = sh; pilCol[o + 1] = sh; pilCol[o + 2] = sh * (0.93 + 0.07 * sh); }
    const s = j * PNC * 3; for (let k = 0; k < 3; k++) { pilPos[o + k] = pilPos[s + k]; pilCol[o + k] = pilCol[s + k]; } }
  pilNormals(all ? 0 : Math.max(0, jA - 1), all ? PNX : Math.min(PNX, jB + 1));
  pilGeo.attributes.position.needsUpdate = true; pilGeo.attributes.normal.needsUpdate = true; pilGeo.attributes.color.needsUpdate = true; }
/* each frame of the unboxing: live, the springs take one step; held at a time (for stills), the whole history up to that time is replayed first so the pillow is where it would have been */
function pilShape(dt, hold, u, sep) { let ch = false; const cal = strapNow === 'consulting';
  if (hold) { if (u !== pilKey) { pilKey = u; const on0 = ubk.on, u0 = ubk.u, l0 = ubk.lift, hN = 1 / 60;
      ubk.u = Math.min(u, 0); ubk.lift = 0; ubk.on = cal; if (cal) cIntro(SIDES); pilCeil(); pilStep(0, 0, true);
      for (let k = 1, n = Math.ceil(Math.max(0, u) / hN); k <= n; k++) { const uk = u * k / n; ubk.u = uk; ubk.lift = pilSep(uk); ubk.on = cal && uk < 3.3; if (ubk.on) cIntro(SIDES); pilCeil(); pilStep(u / n, ubk.lift, false); }
      ubk.on = on0; ubk.u = u0; ubk.lift = l0; if (on0) cIntro(SIDES); ch = true; } }
  else { pilKey = -99; pilCeil(); ch = pilStep(Math.min(dt, 0.05), sep, u <= 0); }
  if (ch || pilDirty) { pilDeform(pilDirty); pilDirty = false; } }
{ const uv = new Float32Array(PNC * PNR * 2), idx = [];
  for (let j = 0; j < PNX; j++) for (let i = 0; i < PNU; i++) { const a = j * PNC + i, b = a + 1, c = a + PNC, d = b + PNC; idx.push(a, c, b, b, c, d); }
  pilGeo.setAttribute('position', new THREE.BufferAttribute(pilPos, 3)); pilGeo.setAttribute('normal', new THREE.BufferAttribute(pilNor, 3)); pilGeo.setAttribute('color', new THREE.BufferAttribute(pilCol, 3)); pilGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); pilGeo.setIndex(idx);
  pilCeil(); pilStep(0, 0, true); pilDeform(true); pilDirty = true;
  /* the cloth is laid on by its own length, so the nap is not stretched where the pillow closes toward its seams */
  let cum = 0; for (let j = 0; j < PNR; j++) { if (j) { let s = 0; for (let i = 0; i < PNU; i += 8) { const a = (j * PNC + i) * 3, b = a - PNC * 3; s += Math.hypot(pilPos[a] - pilPos[b], pilPos[a + 1] - pilPos[b + 1], pilPos[a + 2] - pilPos[b + 2]); } cum += s / (PNU / 8); } for (let i = 0; i < PNC; i++) { uv[(j * PNC + i) * 2] = cum / PTILE; uv[(j * PNC + i) * 2 + 1] = 8 * i / PNU; } }
  const pil = bxm(pilGeo, mPillow, gPil, 0, 0, 0); pil.castShadow = true; pil.frustumCulled = false;
  /* a row of running stitches closes each end, a little way in from the edge, on both faces */
  { const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1), vy = new THREE.Vector3(0, 1, 0), vd = new THREE.Vector3(), list = [];
    for (let e = 0; e < 2; e++) { const S = PSEAM[e], n = Math.floor((S.len - 5) / PSTP); for (let sd = -1; sd <= 1; sd += 2) for (let k = 0; k <= n; k++) { const f = (2.5 + (S.len - 5 - n * PSTP) / 2 + k * PSTP) / S.len, p = pilSeam(e, f), p2 = pilSeam(e, f + 0.01), off = sd * pilCorner(f) * 0.33; list.push([(e ? 1 : -1) * (PLX - 1.15), p[1] + S.n[1] * off, -(p[0] + S.n[0] * off), p2[1] - p[1], -(p2[0] - p[0])]); } }
    const th = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 1.15, 3, 8), mThread, list.length); list.forEach((L, k) => { p4.set(L[0], L[1], L[2]); q4.setFromUnitVectors(vy, vd.set(0, L[3], L[4]).normalize()); th.setMatrixAt(k, m4.compose(p4, q4, s4)); }); th.frustumCulled = false; gPil.add(th); }
  bxm(new RoundedBoxGeometry(BW - 2 * BWT - 1, 2, BW - 2 * BWT - 1, 2, 0.8), mBoxIn, gPlat, 0, -51, 0); bxm(new THREE.CylinderGeometry(41, 41, 0.8, 64), mBoxIn, gYaw, 0, -49.6, 0); }
/* rocking back on the bolster: the pillow turns about the bolster's centre and rolls back a little on its heel, which lifts the nose and shows the buckle under it */
function pilPlace(rock) { const c = Math.cos(rock), sn = Math.sin(rock); gPil.rotation.x = -rock; gPil.position.set(0, PIL0[0] - 18 - (-18 * c - 18 * sn), PIL0[1] - 18 - (18 * sn - 18 * c) - 22.5 * rock); }
pilPlace(0);
/* the lid is two leaves, each on a piano hinge along its outer edge, like the doors of a fine watch box: they rise together on soft stays, the left a breath ahead, and stop just past upright */
const doorAxis = new THREE.Vector3(0, 0, 1), DOOR = rad(106), mHinge = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 1, roughness: 0.28 });
const lidHalves = [];
const doors = [-1, 1].map((sd) => { const piv = new THREE.Group(); piv.position.set(sd * BW / 2, 0, 0); gBox.add(piv);
  const half = new THREE.Mesh(new RoundedBoxGeometry(BW / 2 + 0.1, BL, BW + 0.6, 3, 1.6), mBoxOut); half.position.set(-sd * (BW / 4 - 0.25), BL / 2, 0); half.castShadow = half.receiveShadow = true; piv.add(half); lidHalves.push(half);
  const sat = new THREE.Mesh(new THREE.PlaneGeometry(BW / 2 - BWT - 0.2, BW - 2 * BWT), mSatin); sat.rotation.x = Math.PI / 2; sat.position.set(-sd * (BW / 4 + BWT / 2 - 0.1), -0.06, 0); piv.add(sat);
  [-0.3, 0, 0.3].forEach((f, j) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, j === 1 ? 20 : 12, 16).rotateX(Math.PI / 2), mHinge); b.position.set(sd * (BW / 2 + 0.55), 0.2, f * BW); gBox.add(b); });
  return { piv, sd }; });
/* a fine gilt piping round the top of the base, just under the lid's edge: it outlines the box when it is small at the back of the room */
{ const h = BW / 2 + 0.35, rc = 1.9, pts = [], C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  C.forEach((c, i) => { for (let k = 0; k <= 5; k++) { const a = (i + k / 5) * Math.PI / 2; pts.push(new THREE.Vector3(c[0] * (h - rc) + rc * Math.cos(a), 0, c[1] * (h - rc) + rc * Math.sin(a))); } const n = C[(i + 1) % 4], a1 = (i + 1) * Math.PI / 2, p0 = [c[0] * (h - rc) + rc * Math.cos(a1), c[1] * (h - rc) + rc * Math.sin(a1)], p1 = [n[0] * (h - rc) + rc * Math.cos(a1), n[1] * (h - rc) + rc * Math.sin(a1)]; for (let k = 1; k < 12; k++) pts.push(new THREE.Vector3(lerp(p0[0], p1[0], k / 12), 0, lerp(p0[1], p1[1], k / 12))); });
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 240, 0.65, 8, true), mHinge); pipe.position.y = -1.05; gBox.add(pipe); }
const soft = (t, k = 4.6) => t <= 0 ? 0 : 1 - Math.exp(-k * t) * (1 + k * t);
const qTw = new THREE.Quaternion(), vTw = new THREE.Vector3(1, 0, 0);
const setDoors = (dl, dr, tw = 0) => { doors[0].piv.quaternion.setFromAxisAngle(doorAxis, DOOR * dl).multiply(qTw.setFromAxisAngle(vTw, tw)); doors[1].piv.quaternion.setFromAxisAngle(doorAxis, -DOOR * dr).multiply(qTw.setFromAxisAngle(vTw, -tw * 0.7)); };
const spring = (t, w = 11, z = 6) => t <= 0 ? 0 : 1 - Math.exp(-z * t) * Math.cos(w * t);
const smo = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
const backOut = (x) => { x = clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

/* the recycling bin, made like the watch: brushed steel with a polished rolled rim, a thin green enamel band, an etched recycling mark and a rubber foot */
const gBin = new THREE.Group(); scene.add(gBin); gBin.visible = false;
const BINR = 84, BINR0 = 74, BINH = 150, binR = (y) => BINR0 + (BINR - BINR0) * y / BINH;
function recycleMark(g, cx, cy, R, col) { g.save(); g.translate(cx, cy); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * TAU / 3); const w = R * 0.2, y = R * 0.5, x0 = -R * 0.56, x1 = R * 0.24;
    g.lineWidth = w; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.beginPath(); g.moveTo(x1 - w * 0.1, y - w * 1.15); g.lineTo(x1 + w * 1.35, y); g.lineTo(x1 - w * 0.1, y + w * 1.15); g.closePath(); g.fill(); g.restore(); }
  g.restore(); }
{ const steel = new THREE.MeshPhysicalMaterial(Object.assign({}, brushP, { side: THREE.FrontSide, roughness: 0.56, envMapIntensity: 1.15 })); steel.normalScale.set(0.3, 0.3);
  const body = new THREE.Mesh(uvMap(new THREE.CylinderGeometry(BINR, BINR0, BINH, 96, 1, true), (u, v) => [v * BINH, u * TAU * BINR]), steel); body.position.y = BINH / 2; gBin.add(body);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(BINR - 1.2, BINR0 - 1.2, BINH - 1, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.8, roughness: 0.55, side: THREE.BackSide })); inner.position.y = BINH / 2 + 0.5; gBin.add(inner);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(BINR0 - 1.2, 48), new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.5, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 5; gBin.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BINR + 0.6, 2.4, 20, 128), new THREE.MeshStandardMaterial({ color: STEEL, metalness: 1, roughness: 0.1 })); rim.rotation.x = Math.PI / 2; rim.position.y = BINH; gBin.add(rim);
  const foot = new THREE.Mesh(new THREE.TorusGeometry(BINR0 + 0.4, 2.6, 12, 96), new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0, roughness: 0.85 })); foot.rotation.x = Math.PI / 2; foot.position.y = 2.6; gBin.add(foot);
  const mBand = new THREE.MeshPhysicalMaterial({ color: 0x2c7a52, metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(binR(136) + 0.2, binR(128) + 0.2, 8, 96, 1, true), mBand); band.position.y = 132; gBin.add(band);
  const mark = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); recycleMark(g, 256, 262, 190, '#fff'); const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t; })();
  const decal = new THREE.Mesh(new THREE.CylinderGeometry(binR(111) + 0.15, binR(75) + 0.15, 36, 32, 1, true, -0.26, 0.52), new THREE.MeshStandardMaterial({ map: mark, color: 0x1d2125, metalness: 0.4, roughness: 0.8, transparent: true, alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2 })); decal.position.y = 93; gBin.add(decal);
  gBin.userData.rim = mBand; }
/* soft contact shadows, so both sit on the floor rather than float in front of it */
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const blob = (w) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; scene.add(m); return m; };
const binShadow = blob(1), boxShadow = blob(1);
/* the box is small at the back, so it gets a generous invisible handle for picking up */
const boxHandle = new THREE.Mesh(new THREE.SphereGeometry(BW * 0.95, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); boxHandle.position.y = -BH / 2; gBox.add(boxHandle);

/* where things live at the back of the first screen. The box comes to rest on the floor behind the lower strap, so you only find it
   by turning the watch; the bin stands at the far left, behind the menu */
const RP = { home: new THREE.Vector2(), bin: new THREE.Vector3(), mouth: new THREE.Vector3(), binQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rad(-10), 0, 'YXZ')), bs: 0.1, hh: 50, hw: 50, z: -120, yF: 0, R: 1, a: 1, b: 1 };
function restPoses(visW, visH, mob) { const z = RP.z, f = (camera.position.z - z) / camera.position.z, hw = visW / 2 * f, hh = visH / 2 * f; RP.hw = hw; RP.hh = hh;
  const bw = mob ? 0.115 * 2 * hw : 0.05 * 2 * hh, bs = bw / BW, yF = mob ? 0.07 * hh : -0.94 * hh; RP.bs = bs; RP.yF = yF;
  RP.a = 0.5 * BW * (Math.cos(rad(32)) + Math.sin(rad(32))) * bs; RP.b = 0.5 * (BH + BL) * bs; RP.R = BINR * bs;
  RP.home.set(mob ? 0.66 * hw : -0.14 * hw, yF + RP.b); RP.bin.set((mob ? -0.66 : -0.6) * hw, yF, z - 4); RP.mouth.copy(RP.bin).y += BINH * bs; }
/* the box is a 2D rigid body in that back plane: a centre, a velocity, a spin about the line of sight. Its corners decide where it touches */
const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rad(-32)), qZr = new THREE.Quaternion(), vZ = new THREE.Vector3(0, 0, 1), cOff = new THREE.Vector3();
function boxPose(cx, cy, th, s, z, outP, outQ) { qZr.setFromAxisAngle(vZ, th); outQ.copy(qZr).multiply(qYaw); cOff.set(0, -19 * s, 0).applyQuaternion(outQ); outP.set(cx - cOff.x, cy - cOff.y, z - cOff.z); }
const hTh = (th) => Math.abs(RP.a * Math.sin(th)) + Math.abs(RP.b * Math.cos(th)), wTh = (th) => Math.abs(RP.a * Math.cos(th)) + Math.abs(RP.b * Math.sin(th));
const boxS = { mode: intro.on ? 'intro' : 'rest', t: 0, hold: null, C: new THREE.Vector2(), v: new THREE.Vector2(), th: 0, w: 0, s: 1, fx: null, rth: 0, tgt: new THREE.Vector2(), smp: [], from: null, wob: 0, sndAt: 0, land: 9, z: -120 };
let binIn = intro.on ? 0 : 1;
const qBox = new THREE.Quaternion(), qIn = new THREE.Quaternion(), qHero = new THREE.Quaternion(), qDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), qT = new THREE.Quaternion();
const pIn = new THREE.Vector3(), pUp = new THREE.Vector3(), pHero = new THREE.Vector3(), eBox = new THREE.Euler(), vUp = new THREE.Vector3(), vT = new THREE.Vector3();
const vX1 = new THREE.Vector3(1, 0, 0), vY1 = new THREE.Vector3(0, 1, 0), qPl = new THREE.Quaternion(), qYw = new THREE.Quaternion(), pBox = new THREE.Vector3(), vF = new THREE.Vector3();
/* the unboxing, by seconds from the lid: 0 the lids spring open, 0.5 the platform pops, 0.85 to 1.7 it lifts the pillow clear of the walls while the pillow rocks back, turns its crown side
   to you and the view pushes in. TU starts the unbuckling (see the strap): tail out of the keepers, round the end bar, tang out, then the head lifts and draws the strap out of the buckle;
   the halves let go and spring to their own curve and the pillow fills out again; the view stays close for that (it pulls back from TU + 1.55), then the platform sinks,
   and from TU + 2.2 the watch travels to its place while the empty box closes and drifts off */
const TU = 1.95, STAGE = { rock: 25, yaw: 36, zoom: 2.6, fx: 0, fy: 26, fz: 4, hov: 58 };
function introPose(dt, visW, visH, mob, scHero, cx, cy) {
  if (intro.open && intro.hold === null) intro.t += dt; const T = intro.hold !== null ? intro.hold : intro.open ? intro.t : 0, idle = intro.open ? 0 : performance.now() / 1000;
  const sb0 = Math.min(visW * 0.5, visH * 0.46) / (BW * 1.25); let bx0 = 0, by0 = visH * (mob ? 0.06 : 0.02);
  eBox.set(rad(46 + Math.sin(idle * 0.7) * 1.2), rad(lerp(-20, -6, smo(T / 1.1)) + Math.sin(idle * 0.45) * 3), 0, 'YXZ'); qBox.setFromEuler(eBox);   // tipped toward you, turned a little and breathing while it waits; it squares up as the lids open so the two halves match
  /* a go at the lid: the box rocks, hops and skitters, and the lids jump against the catch. Before anyone tries, it twitches now and then, as if something inside moved */
  let sx = 0, sy = 0, lid = 0;
  if (!intro.open && document.body.classList.contains('ready')) { intro.idleT += dt; if (!intro.shake && intro.tries === 0 && intro.idleT > intro.nextTw) { intro.shake = { t: 0, d: 0.45, a: 0.035, lid: 0.015 }; intro.nextTw = intro.idleT + 3.2 + Math.random() * 1.6; } }
  if (intro.shake) { const S = intro.shake; S.t += dt; const u = S.t / S.d; if (u >= 1 || intro.open) intro.shake = null; else { const env = Math.min(1, S.t / 0.04) * (1 - u) * (1 - u), w = S.t * TAU;
    qT.setFromAxisAngle(vZ, S.a * Math.sin(w * 8.5) * env); qBox.premultiply(qT); sx = S.a * 0.3 * Math.sin(w * 11) * env; sy = S.a * 0.6 * Math.abs(Math.sin(w * 4.25)) * env; lid = S.lid * Math.abs(Math.sin(w * 6.5)) * env; } }
  bx0 += sx * BW * sb0; by0 += sy * BW * sb0;
  const u = T - TU, stg = smo((T - 0.95) / 0.75), back = smo((u - 1.75) / 0.8), rock = rad(STAGE.rock) * stg * (1 - back), yaw = rad(STAGE.yaw) * stg * (1 - back), pz = stg * (1 - smo((u - 1.55) / 1.0)), sb = sb0 * lerp(1, STAGE.zoom, pz);
  /* the watch carries its pillow up off the platform by the strap, so the tail has room to swing underneath. As the strap runs out of the buckle the pillow sinks out of the loop,
     and once the tail is clear it drops the rest of the way back onto its plate; then the platform goes down into the box */
  const dl = soft(T), dr = soft(T - 0.1), lift = cLift(u), sink = 44 * smo((u - 2.3) / 0.55), plat = 16 * spring(T - 0.5, 13, 7) + 28 * smo((T - 0.85) / 0.6) - sink;
  const hh = STAGE.hov * stg - (STAGE.hov - 48) * smo((u - 0.95) / 1.0), ph = hh - lift - 2 * smo((u - CALF.uc - 0.05) / 0.5), sep = hh - ph + sink;
  const inBox = boxS.mode === 'intro' || boxS.mode === 'fly';
  ubk.on = inBox && strapNow === 'consulting' && u < 3.3; ubk.u = u; ubk.lift = sep;
  /* leather creaks as the tail comes out of its keepers; a bright tick as the tang leaves its hole; a softer knock when the tail runs clear of the frame */
  if (T < 0.3) intro.cue = 0;
  if (intro.open && intro.hold === null) { const c = intro.cue || 0;
    if (!(c & 1) && u >= 0.02) { intro.cue |= 1; ping({ f: 700, q: 1.5, dur: 0.16, vol: 0.035, sharp: 1.6 }); ping({ when: 0.13, f: 1100, q: 2, dur: 0.1, vol: 0.024, sharp: 2 }); }
    if (!(c & 2) && u >= 0.72) { intro.cue |= 2; snd.buckle(); buzz(8); }
    if (!(c & 4) && u > 1 && ubk.free) { intro.cue |= 4; ping({ f: 2600, q: 3, dur: 0.02, vol: 0.035, sharp: 5, ring: 3800, ringVol: 0.12, ringDur: 0.02 }); ping({ when: 0.05, f: 1500, q: 1.6, dur: 0.05, vol: 0.03, sharp: 3, thump: 130 }); buzz(5); } }
  vF.set(STAGE.fx, STAGE.fy + ph + 0.55 * lift, STAGE.fz).multiplyScalar(sb).applyQuaternion(qBox); pBox.set(bx0 - pz * vF.x, by0 - pz * vF.y, -pz * vF.z);
  pilPlace(rock); gPil.position.y += ph; gYaw.rotation.y = yaw;
  if (boxS.mode === 'intro') { gBox.visible = true; gBox.position.copy(pBox); gBox.position.z -= 260 * smo((u - 2.25) / 0.6); gBox.quaternion.copy(qBox); gBox.scale.setScalar(sb); setDoors(Math.max(dl, lid), Math.max(dr, lid * 0.85)); gPlat.position.y = plat;
    if (u >= 2.85) { boxS.mode = 'fly'; boxS.t = u - 2.85; boxS.hold = intro.hold !== null ? u - 2.85 : null; boxS.from = { p: gBox.position.clone(), q: qBox.clone(), s: sb, dl, dr, plat }; } }
  if (inBox) pilShape(dt, intro.hold !== null, u, sep);
  /* the watch sits on the pillow with its dial up, twelve toward the back, and goes wherever the pillow goes; unbuckled, it lifts off along its own dial normal */
  qPl.setFromAxisAngle(vX1, -rock); qYw.setFromAxisAngle(vY1, yaw); qIn.copy(qBox).multiply(qYw).multiply(qPl).multiply(qDown); vUp.set(0, 1, 0).applyQuaternion(qBox);
  vT.set(0, -CALF.zt0 + sep, 0).applyQuaternion(qPl).add(gPil.position).applyQuaternion(qYw); vT.y += plat; vT.multiplyScalar(sb).applyQuaternion(qBox); pIn.copy(pBox).add(vT);
  pUp.copy(pIn).addScaledVector(vUp, 26 * sb);   // clear of the pillow and the walls, it travels to its place
  const k = smo((u - 2.2) / 1.5), a = 1 - k; qHero.copy(root.quaternion); pHero.copy(root.position);
  root.position.set(a * a * pIn.x + 2 * a * k * pUp.x + k * k * pHero.x, a * a * pIn.y + 2 * a * k * pUp.y + k * k * pHero.y, a * a * pIn.z + 2 * a * k * pUp.z + k * k * pHero.z);
  root.quaternion.slerpQuaternions(qIn, qHero, smo((k - 0.06) / 0.94)); const s = lerp(sb, scHero, smo(k)); root.scale.setScalar(s);
  gravW.set(0, -1, 0).applyQuaternion(qBox).lerp(vT.set(0, -1, 0), k).normalize();   // in the box, down is the floor of the box
  if (u > 2.95) document.body.classList.remove('intro');
  if (u > 3.75 && intro.hold === null) finishIntro();
  return { s, lc: [lerp(bx0, cx, k), lerp(by0, cy, k)] };
}
function openBox() { if (!intro.on || intro.open) return; intro.open = true; intro.t = 0; audioOn(); snd.lid(); document.body.classList.add('opening'); }
/* the lid sticks: it takes two or three goes. Each go shakes the box and something inside rattles */
/* a buzz in the hand: phones that support vibration get a pattern; iPhones get the one tick Safari allows, from a hidden switch, and only inside a tap */
const hapt = (() => { try { const l = document.createElement('label'), i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); l.appendChild(i); l.style.cssText = 'position:fixed;left:-99px;top:-99px;opacity:0;pointer-events:none'; l.setAttribute('aria-hidden', 'true'); document.body.appendChild(l); return l; } catch (e) { return null; } })();
function buzz(p, tap) { try { if (navigator.vibrate) navigator.vibrate(p); else if (tap && hapt) hapt.click(); } catch (e) {} }
function tryOpen() { if (!intro.on || intro.open) return; const now = performance.now(); if (now - intro.lastTry < 380) return; intro.lastTry = now; audioOn(); intro.tries++;
  if (intro.tries >= intro.need) { buzz([18, 50, 70], true); openBox(); return; }
  const n = intro.tries; buzz(n === 1 ? [22, 40, 22, 40, 30] : [28, 35, 28, 35, 28, 35, 45], true); intro.shake = { t: 0, d: n === 1 ? 0.7 : 0.85, a: n === 1 ? 0.1 : 0.15, lid: n === 1 ? 0.05 : 0.1 }; snd.rattle(n);
 }
let introCool = 0;
function finishIntro() { intro.on = false; ubk.on = false; gravW.set(0, -1, 0); document.body.classList.remove('intro', 'opening'); if (scrollY > 1) scrollTo(0, 0); document.documentElement.style.overflow = ''; introCool = performance.now() + 1200; }   // land on the start, and let a trackpad's leftover momentum die out
function introAt(T) { intro.on = true; document.body.classList.add('intro'); boxS.mode = 'intro'; boxS.hold = null; binIn = 0; if (T < 0) { intro.open = false; intro.hold = null; document.body.classList.remove('opening'); } else { intro.open = true; intro.hold = T; document.body.classList.add('opening'); } }
if (intro.on) { document.documentElement.style.overflow = 'hidden'; scrollTo(0, 0);
  $('i-open').textContent = ''; $('i-open').setAttribute('aria-label', 'Open the box');
  $('i-open').addEventListener('click', tryOpen);
  let pdx = 0, pdy = 0; canvas.addEventListener('pointerdown', (e) => { pdx = e.clientX; pdy = e.clientY; });
  const onBox = (e) => { const r = canvas.getBoundingClientRect(), rc = onBox.r || (onBox.r = new THREE.Raycaster()), v2 = onBox.v || (onBox.v = new THREE.Vector2()); v2.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2); rc.setFromCamera(v2, camera); gBox.updateMatrixWorld(true); return rc.intersectObject(gBox, true).length > 0; };
  canvas.addEventListener('pointerup', (e) => { if (intro.on && !intro.open && Math.hypot(e.clientX - pdx, e.clientY - pdy) < 12 && onBox(e)) tryOpen(); });   // a tap on the box itself, not the end of a swipe and not the empty page
  canvas.addEventListener('pointermove', (e) => { if (!intro.on || intro.open || e.pointerType !== 'mouse') { if (canvas.style.cursor === 'pointer' && !intro.on) canvas.style.cursor = ''; return; } const now = performance.now(); if (now - (onBox.t || 0) < 90) return; onBox.t = now; canvas.style.cursor = onBox(e) ? 'pointer' : ''; });   // a tap, not the end of a swipe
  let wheelAt = 0, touchNew = true;   // one go per gesture: a trackpad flick sends dozens of wheel events
  addEventListener('wheel', (e) => { const now = performance.now(); if (intro.on || now < introCool) { e.preventDefault(); const fresh = e.timeStamp - wheelAt > 320; wheelAt = e.timeStamp; } }, { passive: false });
  addEventListener('touchstart', () => { touchNew = true; }, { passive: true });
  addEventListener('touchmove', (e) => { if (intro.on || performance.now() < introCool) { e.preventDefault(); } }, { passive: false });
  addEventListener('keydown', (e) => { if (intro.on && !intro.open && ['Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); tryOpen(); } }); }


/* ---------- the Easter egg: find the box, throw it about, get it in the bin. It unlocks a dial made of recycled plastic ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3(), vS = new THREE.Vector3(), pBx = new THREE.Vector3(), qBx = new THREE.Quaternion();
let grab = null, hoverAt = 0;
const propsLive = () => !intro.on && gBox.visible && (boxS.mode === 'rest' || boxS.mode === 'phys') && !jump;
function rayAt(e) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; const m = o.material; if (!m || Array.isArray(m)) return true; return m.visible !== false && (!m.transparent || m.opacity > 0.05); }
/* only when nothing of the watch is in front of it: the box hides behind the strap, and grabbing the strap should still turn the watch */
function boxUnder(e) { rayAt(e); const hb = ray.intersectObject(boxHandle, false)[0]; if (!hb) return null; const hw = ray.intersectObject(root, true).find((h) => shown(h.object)); return hw && hw.distance < hb.distance ? null : hb; }
function propsGrab(e) { if (!propsLive() || !boxUnder(e)) return false; dragPlane.constant = -RP.z; if (!ray.ray.intersectPlane(dragPlane, hitP)) return false;
  const B = boxS; grab = { x: e.clientX, y: e.clientY, moved: false, ox: hitP.x - B.C.x, oy: hitP.y - B.C.y }; B.tgt.copy(B.C); B.smp = [{ x: B.C.x, y: B.C.y, t: performance.now() }]; B.mode = 'drag'; B.v.set(0, 0);
  audioOn(); canvas.style.cursor = 'grabbing'; if (!boxTouched) { boxTouched = true; setTimeout(() => { if (boxS.mode === 'gone') return; $('toast').style.setProperty('--tk', 0.8); toast('Consider recycling the box.', 'big'); }, 350); } return true; }
addEventListener('pointermove', (e) => {
  if (grab) { if (Math.hypot(e.clientX - grab.x, e.clientY - grab.y) > 6) grab.moved = true; rayAt(e); if (ray.ray.intersectPlane(dragPlane, hitP)) { boxS.tgt.set(hitP.x - grab.ox, hitP.y - grab.oy); boxS.smp.push({ x: boxS.tgt.x, y: boxS.tgt.y, t: performance.now() }); if (boxS.smp.length > 10) boxS.smp.shift(); } return; }
  if (e.pointerType !== 'mouse' || !propsLive()) return; const now = performance.now(); if (now - hoverAt < 120) return; hoverAt = now;
  const sp = toScreen(gBox.position); if (Math.hypot(e.clientX - sp[0], e.clientY - sp[1]) > 90) { if (canvas.style.cursor === 'grab') canvas.style.cursor = ''; return; }
  canvas.style.cursor = boxUnder(e) ? 'grab' : ''; });
['pointerup', 'pointercancel'].forEach((ev) => addEventListener(ev, () => { if (!grab) return; const g = grab, B = boxS; grab = null; canvas.style.cursor = '';
  if (!g.moved) { B.v.set((Math.random() - 0.5) * RP.hh * 0.3, RP.hh * 1.35); B.w = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3); }   // a tap: it hops and turns over
  else { const now = performance.now(), sm = B.smp.filter((p) => now - p.t < 100); if (sm.length > 1) { const a = sm[0], b = sm[sm.length - 1], dtS = Math.max(0.016, (b.t - a.t) / 1000); B.v.set((b.x - a.x) / dtS, (b.y - a.y) / dtS); } else B.v.set(0, 0);
    const m = B.v.length(), mx = RP.hh * 14; if (m > mx) B.v.multiplyScalar(mx / m); B.w = clamp(B.wd || 0, -14, 14) - B.v.x / (RP.b * 9); }
  B.bud0 = B.bud = clamp(0.11 + 0.2 * (B.v.length() / (RP.hh * 14)), 0.11, 0.34); B.still = 0; B.mode = 'phys'; if (B.pend) beat(); B.pend = true; }));
canvas.addEventListener('touchstart', (e) => { if (grab) e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { if (grab) e.preventDefault(); }, { passive: false });
/* it sounds like what it hits: a padded box on the floor, a lighter tap at the edges, steel when it meets the bin */
/* every hard knock leaves its mark: creases pressed into the leatherette, lids that no longer sit flush. Past a point, a nudge toward the bin */
let boxDmg = 0, dmgAsked = false, dentTex = null; const dv = new THREE.Color();   // a colour, not a vector: a Color lerped toward a Vector3 turns to NaN and the box renders black
function dentBox(n) { const d = Math.min(boxS.bud || 0, Math.max(0.05, (boxS.bud0 || 0) * 0.6)); if (d < 0.01) return; boxS.bud -= d; boxDmg = Math.min(1, boxDmg + d);
  if (!dentTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 256; cv.getContext('2d').drawImage(boxGrain.image, 0, 0); dentTex = new THREE.CanvasTexture(cv); dentTex.wrapS = dentTex.wrapT = THREE.RepeatWrapping; dentTex.repeat.copy(boxGrain.repeat); mBoxOut.bumpMap = dentTex; }
  const g = dentTex.image.getContext('2d'), k = 2 + Math.round(d * 30);
  for (let i = 0; i < k; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 18 + Math.random() * 34; [[0, 0], [-256, 0], [256, 0], [0, -256], [0, 256]].forEach(([ox, oy]) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.7, 'rgba(70,70,70,0.3)'); gr.addColorStop(0.88, 'rgba(235,235,235,0.3)'); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); });
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120); g.stroke(); }
  dentTex.needsUpdate = true; mBoxOut.bumpScale = 0.6 + 7 * boxDmg; mBoxOut.roughness = 0.5 + 0.25 * boxDmg; mBoxOut.color.setHex(BOXC).lerp(dv.setRGB(0.2, 0.21, 0.25), 0.5 * boxDmg);
  /* and a corner of a lid crumples in */
  { const me = lidHalves[(Math.random() * 2) | 0], P = me.geometry.attributes.position, i0 = (Math.random() * P.count) | 0, cx = P.getX(i0), cy = P.getY(i0), cz = P.getZ(i0), R = 16 + 60 * d, dep = 2.5 + 22 * d;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), q = Math.hypot(x - cx, y - cy, z - cz); if (q < R) { const f = (1 - q / R) ** 2 * dep, l = Math.hypot(x, z) || 1; P.setXYZ(i, x - x / l * f * 0.8, y - Math.sign(y) * f * 0.35, z - z / l * f * 0.8); } } P.needsUpdate = true; me.geometry.computeVertexNormals(); }
 }
/* the page speaks up on the first beating and every second one after (1, 3, 5...), bigger each time from the third */
/* the first touch gets a gentle word; from the third throw on, every other throw that misses the bin gets a louder one */
let beats = 0, boxTouched = false; const BEAT_MSG = ['That box has taken a beating. Want to recycle it already?', 'Still going? The recycling bin is right there.', 'Please. Recycle the box.', 'RECYCLE THE BOX.', 'RECYCLE. THE. BOX.'];
function beat() { beats++; if (beats < 3 || !(beats % 2) || boxS.mode === 'gone') return; const n = (beats - 1) / 2, k = n < 2 ? 1 : Math.min(3.4, 1.3 + 0.38 * (n - 2)); setTimeout(() => { if (boxS.mode === 'gone') return; $('toast').style.setProperty('--tk', k); toast(BEAT_MSG[Math.min(n - 1, BEAT_MSG.length - 1)], 'big'); }, 250); }
function hit(kind, imp) { const now = performance.now(), n = clamp(imp / (RP.hh * 3), 0, 1); if (n < 0.04 || now - boxS.sndAt < 55) return; boxS.sndAt = now; if (boxS.mode === 'phys' && n > 0.1) dentBox(n);
  if (kind === 'bin') ping({ f: 2300 + Math.random() * 300, q: 5, dur: 0.03, vol: 0.03 + 0.1 * n, sharp: 4, ring: 3200 + Math.random() * 200, ringVol: 0.55, ringDur: 0.24, thump: 150 });
  else if (kind === 'wall') ping({ f: 760 + Math.random() * 80, q: 1.4, dur: 0.035, vol: 0.02 + 0.07 * n, sharp: 3 });
  else ping({ f: 420 + Math.random() * 90, q: 1.3, dur: 0.05, vol: 0.025 + 0.11 * n, sharp: 3, thump: 90 + Math.random() * 20 }); }
function capture() { const B = boxS; B.pend = false; B.mode = 'bin'; B.t = 0; B.from = { x: B.C.x, y: B.C.y, th: B.th }; hit('bin', RP.hh * 2.4); B.wob = 1; }
const GRAV = 6.2;   // in frame half-heights per second squared: a light box, a few metres away
function contact(B, rx, ry, nx, ny, pen, e, mu, kind, I) {
  const vn = (B.v.x - B.w * ry) * nx + (B.v.y + B.w * rx) * ny;
  if (vn < 0) { const rn = rx * ny - ry * nx, jn = -(1 + (-vn > RP.hh * 0.4 ? e : 0)) * vn / (1 + rn * rn / I);
    B.v.x += jn * nx; B.v.y += jn * ny; B.w += rn * jn / I;
    const tx = -ny, ty = nx, vt = (B.v.x - B.w * ry) * tx + (B.v.y + B.w * rx) * ty, rt = rx * ty - ry * tx, jt = clamp(-vt / (1 + rt * rt / I), -mu * jn, mu * jn);
    B.v.x += jt * tx; B.v.y += jt * ty; B.w += rt * jt / I; if (-vn > RP.hh * 0.45) hit(kind, -vn); }
  B.touch = true; B.C.x += nx * pen * 0.6; B.C.y += ny * pen * 0.6; }
/* the bin is a real object: its wall is solid, and the only way in is down through the mouth. This keeps track of whether the box last came from above the rim, and holds it outside the wall otherwise */
function binGuard(B) { const bx = RP.bin.x, R = RP.R, top = RP.mouth.y, a = RP.a, b = RP.b, dx = B.C.x - bx, out = R + a * 0.75;
  if (Math.abs(dx) >= out) { B.fromTop = B.C.y - b * 0.2 > top; B.sgn = Math.sign(dx) || 1; return false; }
  if (B.C.y > top + b * 0.2) { B.fromTop = true; return false; }
  if (Math.abs(dx) > R && B.C.y < top - b) B.fromTop = false;
  if (B.fromTop !== false) return false;
  if (B.C.y < top - b * 0.1) { B.C.x = bx + (B.sgn || 1) * out; return true; } return false; }
function physStep(B, h) {
  const yF = RP.yF, bx = RP.bin.x, R = RP.R, top = RP.mouth.y, a = RP.a, b = RP.b, I = (a * a + b * b) / 3;
  B.v.y -= RP.hh * GRAV * h; B.C.x += B.v.x * h; B.C.y += B.v.y * h; B.th += B.w * h; B.w *= Math.exp(-h * 0.25); B.v.multiplyScalar(Math.exp(-h * 0.1));   // a little air drag: it is light
  if (binGuard(B)) { if (B.v.x * B.sgn < 0) { B.v.x *= -0.4; hit('bin', Math.abs(B.v.x)); } B.wob = Math.max(B.wob, 0.5); }
  if (B.fromTop !== false && Math.abs(B.C.x - bx) < R - a * 0.25 && B.C.y < top + b * 0.2 && B.C.y > top - b * 3) { capture(); return; }   // down the mouth of the bin
  const c = Math.cos(B.th), s = Math.sin(B.th); B.touch = false;
  for (let it = 0; it < 2; it++) for (let k = 0; k < 4; k++) { const ex = k === 0 || k === 3 ? a : -a, ey = k < 2 ? b : -b, rx = ex * c - ey * s, ry = ex * s + ey * c, wx = B.C.x + rx, wy = B.C.y + ry;
    if (wy < yF) contact(B, rx, ry, 0, 1, yF - wy, 0.42, 0.5, 'floor', I);
    if (wx < -RP.hw) contact(B, rx, ry, 1, 0, -RP.hw - wx, 0.4, 0.3, 'wall', I);
    if (wx > RP.hw) contact(B, rx, ry, -1, 0, wx - RP.hw, 0.4, 0.3, 'wall', I);
    if (wy > RP.hh) contact(B, rx, ry, 0, -1, wy - RP.hh, 0.3, 0.3, 'wall', I);
    if (wy < top && wy > yF) { if (B.C.x < bx - R && wx > bx - R) { contact(B, rx, ry, -1, 0, wx - (bx - R), 0.35, 0.3, 'bin', I); B.wob = Math.max(B.wob, 0.4); } if (B.C.x > bx + R && wx < bx + R) { contact(B, rx, ry, 1, 0, bx + R - wx, 0.35, 0.3, 'bin', I); B.wob = Math.max(B.wob, 0.4); } } }
  for (const tx of [bx - R, bx + R]) { const dx = tx - B.C.x, dy = top - B.C.y, lx = dx * c + dy * s, ly = -dx * s + dy * c;   // the rim, a hard edge the box can catch on
    if (Math.abs(lx) < a && Math.abs(ly) < b) { const px = a - Math.abs(lx), py = b - Math.abs(ly); let nbx = 0, nby = 0, pen; if (px < py) { nbx = Math.sign(lx) || 1; pen = px; } else { nby = Math.sign(ly) || 1; pen = py; }
      contact(B, dx, dy, -(nbx * c - nby * s), -(nbx * s + nby * c), pen, 0.35, 0.3, 'bin', I); B.wob = Math.max(B.wob, 0.5); } }
  /* asleep once it has truly stopped: on a face it lies flat, leaning on something it stays as it is */
  B.still = B.touch && Math.abs(B.v.x) + Math.abs(B.v.y) < RP.hh * 0.05 && Math.abs(B.w) < 0.2 ? (B.still || 0) + h : 0;
  if (B.still > 0.12 && B.fromTop !== false && Math.abs(B.C.x - bx) < R + a * 0.6 && B.C.y > top - b && B.C.y < top + b * 1.8) { capture(); return; }   // come to rest on the rim: it tips in
  if (B.still > 0.25) { const tg = Math.round(B.th / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(tg - B.th) < 0.05) B.th = tg; else if (B.still < 0.8) return;
    B.rth = ((B.th % TAU) + TAU) % TAU; B.th = B.rth; B.fx = B.C.x / RP.hw; B.v.set(0, 0); B.w = 0; B.mode = 'rest'; B.land = 9; if (B.pend) { B.pend = false; beat(); } }
}
const toScreen = (p) => { vS.copy(p).project(camera); return [(vS.x * 0.5 + 0.5) * W, (-vS.y * 0.5 + 0.5) * H]; };

/* the recycled colours: flakes burst out of the bin, arc over and stream into the dial, and the page takes on the colour for a moment */
const UPAL = ['#1f4e8c', '#2d8ba6', '#ece8de', '#c8432b', '#e3a72f', '#3c8a55', '#16191f', '#7fb7d8', '#e07a3f'];
const NB = 150, burst = { on: false, t: 0, hold: null, mesh: null, v: [], w: [], done: false };
const mB = new THREE.Matrix4(), qB = new THREE.Quaternion(), eB = new THREE.Euler(), sB = new THREE.Vector3(), pB = new THREE.Vector3(), pB0 = new THREE.Vector3(), tB = new THREE.Vector3();
function sndRecycle() { if (!actx || muted || actx.state !== 'running') return; ping({ f: 260, q: 1, dur: 0.12, vol: 0.12, sharp: 2.5, thump: 70 }); ping({ when: 0.12, f: 1700, q: 0.7, dur: 0.38, vol: 0.035, sharp: 1.6 });
  [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => { try { const t = actx.currentTime + 0.3 + i * 0.075, o = actx.createOscillator(), g = actx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.connect(g).connect(master); o.start(t); o.stop(t + 0.6); } catch (e) {} }); }
function startBurst(hold) {
  if (!burst.mesh) { burst.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.62, 0.14), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0, envMapIntensity: 0.9 }), NB); burst.mesh.frustumCulled = false; scene.add(burst.mesh);
  }
  burst.bt = DIALS.upcycle.roll(window.__forceBatch);   // the batch is drawn as the flakes fly, and they are its colours
  { const b = burst.bt, pal = [...b.light, ...b.warm, ...b.base], col = new THREE.Color(); for (let i = 0; i < NB; i++) { col.set(pal[i % pal.length]); burst.mesh.setColorAt(i, col); } burst.mesh.instanceColor.needsUpdate = true; }
  for (let i = 0; i < NB; i++) { const a = Math.random() * TAU, sp = 0.25 + Math.random() * 0.6; burst.v[i] = [Math.cos(a) * sp * 0.75, 1.15 + Math.random() * 0.9, Math.sin(a) * sp * 0.6]; burst.w[i] = [Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, Math.random() * TAU]; }
  burst.on = true; burst.t = 0; burst.hold = hold ?? null; burst.done = false; burst.mesh.visible = true; sndRecycle();
  const m = toScreen(RP.mouth), w = $('wash'), bb = burst.bt; w.style.background = 'conic-gradient(from 0deg at ' + m[0] + 'px ' + m[1] + 'px,' + [bb.base[2], bb.light[0], bb.light[3], bb.warm[1], bb.warm[0], bb.warm[2], bb.light[4], bb.light[1], bb.base[2]].join(',') + ')'; w.style.setProperty('--wx', m[0] + 'px'); w.style.setProperty('--wy', m[1] + 'px');
  if (w.animate && !reduce) w.animate([{ clipPath: 'circle(0px at ' + m[0] + 'px ' + m[1] + 'px)', opacity: 0.55 }, { clipPath: 'circle(' + Math.hypot(W, H) * 1.1 + 'px at ' + m[0] + 'px ' + m[1] + 'px)', opacity: 0.4, offset: 0.55 }, { clipPath: 'circle(' + Math.hypot(W, H) * 1.1 + 'px at ' + m[0] + 'px ' + m[1] + 'px)', opacity: 0 }], { duration: 2200, easing: 'cubic-bezier(.2,.7,.3,1)' }); }
function burstUpdate(dt) { if (!burst.on) return; if (burst.hold === null) burst.t += dt; const T = burst.hold ?? burst.t, hh = RP.hh, sz = hh * 0.026, gr = -hh * 3.4, tk = 0.6;
  root.localToWorld(tB.set(0, 0, ZD + 0.5));
  for (let i = 0; i < NB; i++) { const tt = T - (i / NB) * 0.28, v = burst.v[i], w = burst.w[i]; let s = 0;
    if (tt > 0) { const tb = Math.min(tt, tk); pB.set(RP.mouth.x + v[0] * hh * tb, RP.mouth.y + v[1] * hh * 1.25 * tb + 0.5 * gr * tb * tb, RP.mouth.z + v[2] * 60 * tb); s = sz;
      if (tt > tk) { pB0.copy(pB); const u = smo((tt - tk) / 0.62); pB.lerpVectors(pB0, tB, u); pB.y += Math.sin(Math.PI * u) * hh * 0.12 * (v[2] + 0.3); s = sz * (1 - smo((tt - tk - 0.48) / 0.16)); } }
    eB.set(w[0] * tt, w[1] * tt, w[2]); qB.setFromEuler(eB); mB.compose(pB, qB, sB.set(s, s, s)); burst.mesh.setMatrixAt(i, mB); }
  burst.mesh.instanceMatrix.needsUpdate = true;
  if (T > 1.0 && !burst.done) { burst.done = true; const bt = burst.bt; upUnlocked(bt, true);   // the new dial first, a beat to take it in, then the strap
    toast(TIER[bt.tier] + ' batch: ' + bt.name + (bt.tier === 2 ? '. Only ' + bt.odds + ' in 100 boxes.' : '. New dial unlocked.'), bt.tier); if (bt.tier === 2) sndUltra(); countBox(); }
  if (T > 1.75 && burst.hold === null) { burst.on = false; burst.mesh.visible = false; } }
function toast(msg, tier) { const el = $('toast'); el.textContent = msg; el.dataset.tier = tier ?? ''; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function unlockUpcycle(animate) { const had = document.querySelector('[data-way="upcycle"]'); if (had) { had.style.background = WAYS.upcycle.dotCss; return; } const b = document.createElement('button'); b.dataset.way = 'upcycle'; b.setAttribute('aria-label', WAYS.upcycle.name + ' dial'); b.style.background = WAYS.upcycle.dotCss;
  b.addEventListener('click', () => { pickWay('upcycle'); if (WAYS.upcycle.pair) pickStrap(WAYS.upcycle.pair); }); const ref = document.querySelector('#top .ways .wayname'); ref.parentNode.insertBefore(b, ref); dots.push(b); if (animate) b.classList.add('pop');
  upDone = true; }
const TIER = ['Common', 'Rare', 'Ultra rare'];
function sndUltra() { if (!actx || muted || actx.state !== 'running') return; [1568, 2093, 2637, 3136, 4186].forEach((f, i) => { try { const t = actx.currentTime + 0.15 + i * 0.06, o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(g).connect(master); o.start(t); o.stop(t + 0.75); } catch (e) {} }); }
/* every third box, a nudge: there is a quicker way to get to know me */
let boxes = 0; try { boxes = +localStorage.getItem('nk-boxes') || 0; } catch (e) {}   // boxes this visitor has recycled, over every visit
function countBox() { boxes++; try { localStorage.setItem('nk-boxes', String(boxes)); } catch (e) {} if (boxes % 2 === 0) setTimeout(() => talkNudge(boxes), 4300); }
let shyN = 0, shy0 = null, shyS = 1, shyAt = 6;
function talkNudge(n) { const el = $('nudge'), s = $('nudge-shy'); $('nudge-t').textContent = n === 2 ? 'Two boxes in. Do you love a mystery box, or are you just shy?' : 'Box ' + n + '. Mystery box person, or just shy?';
  shyN = 0; shy0 = null; shyS = 1; shyAt = 3; s.style.transform = ''; s.style.opacity = ''; s.style.pointerEvents = ''; s.style.display = ''; $('nudge-btns').hidden = false; el.hidden = false; void el.offsetWidth; el.classList.add('on'); }
const closeNudge = () => { const el = $('nudge'); el.classList.remove('on'); setTimeout(() => { el.hidden = true; }, 320); };
/* "I'm shy" will not sit still: every click it runs somewhere else and shrinks, and after five or six it slips behind the other button */
$('nudge-shy').addEventListener('click', () => { const s = $('nudge-shy'); if (!shy0) shy0 = s.getBoundingClientRect(); shyN++; shyS *= 0.84; const c0x = shy0.left + shy0.width / 2, c0y = shy0.top + shy0.height / 2;
  if (shyN >= shyAt) { s.style.transform = s.style.transform.replace(/scale\([^)]*\)/, '') + ' scale(1.7)'; s.style.opacity = '0'; s.style.pointerEvents = 'none'; ping({ f: 900, q: 2, dur: 0.05, vol: 0.09, sharp: 5, thump: 220 }); buzz(10, true); setTimeout(() => { s.style.display = 'none'; }, 260); return; }   // third time: pop. The other button has the floor
  const w = shy0.width * shyS, h = shy0.height * shyS, m2 = 18, cx = m2 + w / 2 + Math.random() * (innerWidth - 2 * m2 - w), cy = innerHeight * 0.42 + h / 2 + Math.random() * (innerHeight * 0.5 - h - m2);
  s.style.transform = 'translate(' + (cx - c0x) + 'px,' + (cy - c0y) + 'px) scale(' + shyS + ')'; });
$('nudge-talk').addEventListener('click', () => { $('nudge-t').textContent = 'Great choice!'; $('nudge-btns').hidden = true; setTimeout(() => { closeNudge(); jumpTo(N - 1, highlightSpec); }, 1100); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('nudge').hidden) closeNudge(); });
/* the spec sheet lights up row by row, so the details are the first thing you read */
function highlightSpec() { const d = document.querySelector('.panel[data-ch="7"] .spec'); if (!d) return; d.classList.remove('hl'); void d.offsetWidth; d.classList.add('hl'); setTimeout(() => d.classList.remove('hl'), 6000); }

/* on a phone the pair stand well back: small, on the line where the text sheet begins, one at each edge, each behind a little haze so they sit in
   the room instead of on the page. The bin is smaller and hazier again, so it reads as the further of the two. Pick the box up and the haze clears */
const hazeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const haze = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: hazeTex, color: 0x0d1117, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })); m.visible = false; m.renderOrder = 2; scene.add(m); return m; };
const boxHaze = haze(), binHaze = haze(); let playA = 0, farA = snap ? 1 : 0;
function roomPoses(visW, visH, mob) { restPoses(visW, visH, mob); RP.kb = 1; if (!mob) return;
  const hw = RP.hw, hh = RP.hh, bs = 0.082 * 2 * hw / BW, kb = 0.78, py = (mobL.pt > 0 ? mobL.pt : H * 0.62) + 2, yF = (0.5 - py / H) * 2 * hh;
  RP.bs = bs; RP.yF = yF; RP.kb = kb; RP.a = 0.5 * BW * (Math.cos(rad(32)) + Math.sin(rad(32))) * bs; RP.b = 0.5 * (BH + BL) * bs; RP.R = BINR * bs * kb;
  RP.home.set(0.74 * hw, yF + RP.b); RP.bin.set(-0.76 * hw, yF, RP.z - 4); RP.mouth.copy(RP.bin).y += BINH * bs * kb; }
function propsUpdate(dt, visW, visH, mob, cv) {
  roomPoses(visW, visH, mob); const slide = 0, B = boxS;   // fixed in the room, whatever the chapter
  const binOut = B.mode === 'gone' && burst.done && !burst.on;   // once the flakes have flown, the bin has done its job: it swells a touch and shrinks away
  if (binOut) binIn = Math.max(0, binIn - dt / 0.5); else if (B.mode !== 'intro') binIn = Math.min(1, binIn + dt / 0.55);
  gBin.visible = binIn > 0.001;
  B.wob *= Math.exp(-dt * 3); const bs = RP.bs * RP.kb * backOut(binIn);
  gBin.position.copy(RP.bin); gBin.position.y -= slide; gBin.quaternion.copy(RP.binQ); qT.setFromAxisAngle(vT.set(0, 0, 1), Math.sin(performance.now() / 1000 * 26) * B.wob * 0.1); gBin.quaternion.multiply(qT); gBin.scale.setScalar(Math.max(0.0001, bs));
  let d = 0, plat = 0, z = RP.z, live = true;
  if (B.mode === 'fly') { if (B.hold === null) B.t += dt; const T = B.hold ?? B.t, F = B.from, TL = 1.25, plan = rollPlan(RP.a, RP.b, RP.home.x), was = B.ph || 0;
    /* the empty box falls, lands on its lid and tumbles: a real rigid box pivoting on whichever edge touches the floor, gravity speeding it over each corner and slowing it on the way up, losing energy at every face it lands on. Two full rolls, then it tries a third, can't get over, rocks back and settles */
    if (T < TL) { const u = T / TL, su = smo(u); boxPose(plan.x[0], RP.yF + plan.y[0], plan.r[0], RP.bs, RP.z, pBx, qBx); gBox.position.set(lerp(F.p.x, pBx.x, su), F.p.y + (pBx.y - F.p.y) * u * u + RP.hh * 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.2)), 2) * (1 - u), lerp(F.p.z, pBx.z, su)); gBox.quaternion.slerpQuaternions(F.q, qBx, su); gBox.scale.setScalar(lerp(F.s, RP.bs, su)); B.ph = 0; }
    else { const t2 = T - TL, f = Math.min(plan.n - 1, t2 * 240), i0 = Math.floor(f), i1 = Math.min(plan.n - 1, i0 + 1), q = f - i0;
      boxPose(lerp(plan.x[i0], plan.x[i1], q), RP.yF + lerp(plan.y[i0], plan.y[i1], q), lerp(plan.r[i0], plan.r[i1], q), RP.bs, RP.z, pBx, qBx); gBox.position.copy(pBx); gBox.quaternion.copy(qBx); gBox.scale.setScalar(RP.bs);
      let ph = 0; for (let k = 0; k < plan.hits.length; k++) if (t2 >= plan.hits[k][0]) ph = k + 1; B.ph = ph;
      if (B.hold === null) for (let k = was; k < ph; k++) { const hk = plan.hits[k]; hit('floor', RP.hh * clamp(0.35 + hk[1] / 14, 0.35, 1.6)); if (hk[2]) { boxS.bud0 = boxS.bud = 0.3; dentBox(1); boxS.bud = 0.14; dentBox(1); boxS.bud0 = boxS.bud = 0; } } }
    d = (F.dl + F.dr) / 2 * (1 - smo((T - 0.1) / 0.6)); plat = F.plat * (1 - smo(T / 0.5)); live = false;
    B.C.set(RP.home.x, RP.home.y); B.th = 0; B.s = RP.bs;
    if (T >= TL + plan.dur + 0.15 && B.hold === null) { B.mode = 'rest'; B.fx = null; B.rth = 0; B.land = 0; B.ph = 0; } }
  else if (B.mode === 'rest') { B.land += dt; B.th = B.rth; B.s = RP.bs; B.C.set(B.fx === null ? RP.home.x : B.fx * RP.hw, RP.yF + hTh(B.th) + RP.b * 0.7 * Math.abs(Math.sin(Math.PI * B.land / 0.2)) * Math.exp(-B.land * 10) * (B.land < 0.6 ? 1 : 0)); }
  else if (B.mode === 'drag') { const k = 1 - Math.exp(-dt * 28), px = B.C.x, pth = B.th; B.C.x += (B.tgt.x - B.C.x) * k; B.C.y += (B.tgt.y - B.C.y) * k; binGuard(B); B.C.y = Math.max(B.C.y, RP.yF + hTh(B.th));
    const vx = (B.C.x - px) / Math.max(dt, 1e-3); B.th += (clamp(-vx / (RP.hh * 5), -0.6, 0.6) - B.th) * Math.min(1, dt * 10); B.wd = (B.th - pth) / Math.max(dt, 1e-3); B.s = RP.bs * 1.06; }   // swings a little as you carry it
  else if (B.mode === 'phys') { const n = clamp(Math.ceil(dt / 0.0021), 2, 24), h = dt / n; for (let i = 0; i < n && B.mode === 'phys'; i++) physStep(B, h); B.s += (RP.bs - B.s) * Math.min(1, dt * 8); }
  else if (B.mode === 'bin') { if (B.hold === null) B.t += dt; const T = B.hold ?? B.t, u = clamp(T / 0.5, 0, 1), F = B.from, e2 = u * u;
    B.C.set(lerp(F.x, RP.bin.x, smo(u)), lerp(F.y, RP.mouth.y - BINH * RP.bs * RP.kb * 0.55, e2)); B.th = F.th + u * 1.4; z = lerp(RP.z, RP.bin.z, smo(u * 2.5));
    if (u >= 1 && B.hold === null) { B.mode = 'gone'; hit('floor', RP.hh * 1.5); startBurst(); } }
  if (B.mode !== 'intro') { gBox.visible = B.mode !== 'gone'; if (live) { boxPose(B.C.x, B.C.y - slide, B.th, B.s, z, gBox.position, gBox.quaternion); gBox.scale.setScalar(B.s); } setDoors(d + 0.07 * boxDmg, d + 0.13 * boxDmg, 0.09 * boxDmg); gPlat.position.y = plat; }
  const bwS = BINR * 2.6 * bs; binShadow.visible = gBin.visible; binShadow.position.set(gBin.position.x, RP.yF - slide + 0.05, gBin.position.z); binShadow.scale.setScalar(Math.max(0.001, bwS));
  const above = Math.max(0, B.C.y - hTh(B.th) - RP.yF); boxShadow.visible = gBox.visible && (B.mode === 'rest' || B.mode === 'drag' || B.mode === 'phys' || (B.mode === 'fly' && (B.hold ?? B.t) > 1.2));
  boxShadow.position.set(B.mode === 'fly' ? gBox.position.x : B.C.x, RP.yF - slide + 0.04, RP.z); boxShadow.scale.setScalar(BW * 1.7 * RP.bs); boxShadow.material.opacity = clamp(1 - above / (RP.b * 5), 0, 1);
  { const play = B.mode === 'drag' || B.mode === 'phys' || B.mode === 'bin' || burst.on ? 1 : 0; playA += (play - playA) * Math.min(1, dt * (play ? 9 : 2.5)); const bg = scene.background; farA += ((mob && !intro.on && B.mode !== 'fly' ? 1 : 0) - farA) * Math.min(1, dt * 1.6);   /* after the unboxing the haze settles in slowly, as the box comes to rest */
    boxHaze.visible = farA > 0.01 && gBox.visible; binHaze.visible = farA > 0.01 && gBin.visible;
    if (boxHaze.visible) { boxHaze.material.color.copy(bg); boxHaze.material.opacity = 0.36 * (1 - playA) * farA; boxHaze.position.set(B.C.x, B.C.y, RP.z + BW * RP.bs); boxHaze.scale.setScalar(BW * RP.bs * 3.4); }
    if (binHaze.visible) { binHaze.material.color.copy(bg); binHaze.material.opacity = lerp(0.46, 0.15, playA) * clamp(binIn, 0, 1) * farA; binHaze.position.set(RP.bin.x, RP.yF + BINH * bs * 0.5, RP.z + BINR * 1.3 * RP.bs); binHaze.scale.setScalar(BINH * RP.bs * RP.kb * 3.2); } }
  burstUpdate(dt);
}
function recycleAt(T) { boxS.mode = 'gone'; startBurst(T); }
/* the tumble is worked out once, as a little rigid-body simulation, then played back so it can also be scrubbed. The launch spin is chosen so the box makes exactly two rolls and only half-tries a third */
let rollMemo = null;
function rollPlan(a, b, homeX) { if (rollMemo && rollMemo.a === a && rollMemo.b === b && rollMemo.hx === homeX) return rollMemo;
  const HP = Math.PI / 2, NR = 2, g = 25 * (a + b), e1 = 0.72, e2 = 0.3, DT = 1 / 240;
  const sim = (w0, rec) => { let w = a, h = b, rolls = 0, phi = 0, om = w0, P = 0, t = 0; const out = rec ? { x: [], y: [], r: [], hits: [[0, w0, false]] } : null;
    while (t < 4) { for (let s = 0; s < 2; s++) { const dx = -w * Math.cos(phi) + h * Math.sin(phi); om += 3 * g * dx / (4 * (w * w + h * h)) * DT / 2; phi += om * DT / 2;
        if (phi >= HP) { if (rec) out.hits.push([t, Math.abs(om), rolls === 1]); P += 2 * h; const tmp = w; w = h; h = tmp; om *= e1; phi = 0; rolls++; if (rolls > NR) return rolls; }
        else if (phi < 0 && om < 0) { if (rec) out.hits.push([t, Math.abs(om) * 0.5, false]); om = -om * e2; phi = 0; if (Math.abs(om) < 0.3) { om = 0; if (rec) { out.dur = t; } return rec ? (out.rolls = rolls, out) : rolls; } } }
      t += DT; if (rec) { out.x.push(P - w * Math.cos(phi) + h * Math.sin(phi)); out.y.push(w * Math.sin(phi) + h * Math.cos(phi)); out.r.push(NR * HP - (rolls * HP + phi)); } }
    if (rec) out.dur = t; return rec ? (out.rolls = rolls, out) : rolls; };
  let lo = -1, hi = -1; for (let k = 1; k < 220; k++) { const r = sim(k * 0.2, false); if (r === NR && lo < 0) lo = k * 0.2; if (r === NR) hi = k * 0.2; if (r > NR) break; }
  const p = sim(lo < 0 ? 10 : lo + (hi - lo) * 0.75, true), sh = homeX - p.x[p.x.length - 1]; for (let k = 0; k < p.x.length; k++) p.x[k] += sh; p.n = p.x.length; p.a = a; p.b = b; p.hx = homeX; rollMemo = p; return p; }
function throwBox(vx, vy, w) { if (boxS.mode === 'gone' || boxS.mode === 'intro') return; boxS.mode = 'phys'; boxS.still = 0; boxS.v.set(vx * RP.hh, vy * RP.hh); boxS.bud0 = boxS.bud = 0.17; boxS.w = w ?? -vx * 2; if (boxS.pend) beat(); boxS.pend = true; }


/* ---------- frame ---------- */
let W = 0, H = 0, last = performance.now(); const v = new THREE.Vector3(), e = new THREE.Euler();
let prCap = 2, slowN = 0, fastN = 0;
['wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll'].forEach((ev) => addEventListener(ev, () => { window.__act = performance.now(); }, { passive: true, capture: true }));
/* keep it smooth: if frames run long, render at a slightly lower resolution; nobody sees the difference in motion, everybody feels the stutter */
function pace(raw) { if (snap || document.hidden || raw > 0.25) return; if (raw > 1 / 45) { slowN++; fastN = 0; } else { fastN++; if (fastN > 20) slowN = 0; } if (slowN > 24 && prCap > 1) { prCap = Math.max(1, prCap - 0.25); slowN = 0; W = -1; } }
let sizeH = 0, sizeAt = 0;
function size() { const w = stage.clientWidth, h = stage.clientHeight; if (w === W && h === H) return;
  if (w === W && w <= 800 && H > 0 && Math.abs(h - H) < 140) { const now = performance.now(); if (h !== sizeH) { sizeH = h; sizeAt = now; } if (now - sizeAt < 140) return; }   /* a phone's toolbar sliding away changes the height a little on every frame: wait for it to stop, then resize once */
  W = w; H = h; mobL.n = 0; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, prCap)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
let dialOff = false, first = true; const spot = $('spot');
/* phones: the text is a sheet at the bottom, as tall as its words, and the watch takes the room that is left above it. Where each chapter's sheet
   begins is read from the page (it changes with the screen, the fonts and what is open), and the watch eases between them as the chapters turn */
const mobL = { t: new Array(N).fill(-1), top: 48, pt: -1, n: 0, more: false }, moreEl = $('more'), topEl = $('top');
const sheetOf = (k) => k >= S0 && k < S0 + 3 ? fEl : panels.find((q) => +q.dataset.ch === k);
function mobMeasure() { mobL.top = topEl.offsetHeight; for (let k = 0; k < N; k++) { const p = sheetOf(k); mobL.t[k] = p ? p.offsetTop + (p.classList.contains('railed') ? 34 : 0) : H * 0.62; } }   // the strap chapter's sheet starts with a 34px fade the watch may reach into
function mobLayout(P, je) { if (mobL.n-- <= 0) { mobL.n = 3; mobMeasure();
    const lp = focus ? fEl : panels.find((q) => q.classList.contains('live')); let more = false;   /* a sheet with more than fits scrolls inside itself, and says so */
    [fEl, ...panels].forEach((p) => { if (p === lp) { const ovf = p.scrollHeight > p.clientHeight + 2, m = ovf && p.scrollHeight - p.scrollTop - p.clientHeight > 8; p.classList.toggle('ovf', ovf); p.classList.toggle('more', m); p.classList.toggle('scr', p.scrollTop > 4); more = m && p.dataset.ch !== '1'; } else { if (p.scrollTop && !(parseFloat(p.style.opacity) > 0.01)) p.scrollTop = 0; p.classList.remove('more', 'scr'); } });
    if (more !== mobL.more) { mobL.more = more; moreEl.classList.toggle('on', more); } }
  const T = mobL.t, a = jump ? clamp(Math.round(jump.c0), 0, N - 1) : Math.min(N - 2, Math.floor(P.pe)), b = jump ? jump.i : a + 1, u = jump ? je : clamp(P.pe - a, 0, 1), to = lerp(T[a], T[b], u);
  mobL.pt = mobL.pt < 0 || snap ? to : mobL.pt + (to - mobL.pt) * 0.2; }
moreEl.addEventListener('click', () => { const lp = focus ? fEl : panels.find((q) => q.classList.contains('live')); if (lp) lp.scrollBy({ top: lp.clientHeight * 0.7, behavior: reduce ? 'auto' : 'smooth' }); });
function frame(now) {
  pace((now - last) / 1000); const dt = clamp((now - last) / 1000, 0, 0.05); last = now; size();   // clamped: the first frame's timestamp can be earlier than the moment the script finished
  if (intro.on) { if (scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' }); cur = 0; sPrev = 0; }
  brakeCheck(); const target = settle(clamp(scrollY / total(), 0, 1) * (N - 1));
  if (!jump) { if (intro.on) cur = 0; else if (reduce) cur = target; else if (!SNAP) cur += (target - cur) * 0.12;
    else { const d = target - cur, cap = dt * Math.max(1 / 0.6, Math.abs(d) / 0.9); cur += clamp(d * (1 - Math.exp(-dt * 6)), -cap, cap); if (Math.abs(target - cur) < 0.0005) cur = target; } }   /* the camera follows the scroll at its own pace: never faster than a chapter in about 0.6 s, so a quick snap still reads as a flight */
  if (!jump && !intro.on && cur <= S0 - 0.9 && STOP.join() !== WORK0.join()) workOrder(WORK0);   // back at the dial or before it: the three works return to their usual order
  let P = poseAt(cur), cv = cur, je = 1;
  if (jump) { if (jump.hold != null) jump.t = jump.hold; else jump.t += dt / lerp(0.9, 1.5, clamp(jump.far / 5, 0, 1)); const x = clamp(jump.t, 0, 1); je = x * x * x * (x * (x * 6 - 15) + 10); const A = jump.from, B = jump.to;
    P = { rx: lerp(A.rx, B.rx, je), ry: lerp(A.ry, B.ry, je), rz: lerp(A.rz, B.rz, je), sc: lerp(A.sc, B.sc, je) * (1 - 0.1 * Math.sin(Math.PI * je) * clamp(jump.far / 3, 0, 1)), sy: lerp(A.sy, B.sy, je), f: mix(A.f, B.f, je), z: mix(A.z, B.z, je), o: mix(A.o, B.o, je), bg: mix(A.bg, B.bg, je), pe: jump.i };
    cv = lerp(jump.c0, jump.i, je); if (x >= 1) { const th = jump.then; jump = null; cur = Math.round(cv); if (th) th(); } }
  lastPose = P; const pe = P.pe, act = Math.round(pe);
  tickGain = 0.35 + 0.65 * clamp(1 - Math.abs(pe - CB) / 0.8, 0, 1);
  if (typeof caseFX === 'function') caseFX(now / 1000, dt, (selInt === 'music' && !needle) || (selInt === 'cooking' && !(PAN.flare > 0.55)) ? null : selInt); snowTick(now / 1000, dt); panTick(dt);
  if (armDrag && armDrag.t != null) armOff += (armDrag.t - armOff) * Math.min(1, dt * 18); else armOff += ((zoomK === 'music' && !needle ? 1 : 0) - armOff) * Math.min(1, dt * 3.5);
  gTone.rotation.z = TONE0 + ARMSWING * armOff; armAt(anchors['i-arm'], armOff);   // off the record, the arm swings out to its rest   // the flame flickers, the record turns   // a faint tick out front; you hear it properly at the back, with the movement in view
  let sk, fe, tf = 1;
  if (jump) { const A = jump.zA, B = jump.zB, both = A.k && B.k && A.k !== B.k, w = A.fe > 0.001 && B.fe > 0.001 ? je : B.fe > 0.001 ? 1 : 0;
    fe = lerp(A.fe, B.fe, je); FZ.c = [lerp(A.c[0], B.c[0], w), lerp(A.c[1], B.c[1], w)]; FZ.s = lerp(A.s, B.s, w) * (both ? 1 - 0.38 * Math.sin(Math.PI * je) : 1); FZ.r = lerp(A.r, B.r, w);
    sk = both ? (je < 0.5 ? A.k : B.k) : B.k ? B.k : je < 0.98 ? A.k : null; if (both) tf = clamp(Math.abs(je - 0.5) * 3 - 0.2, 0, 1); }
  else { sk = stopKey(cv); focusPath(cv); fe = focusAmount(cv); if (sk) tf = clamp(1 - (Math.abs(cv - Math.round(cv)) - 0.18) * 4, 0, 1); }
  if (sk !== focus) { if (sk) enterStop(sk); else leaveStop(); }
  zNow.fe = fe; zNow.c = FZ.c.slice(); zNow.s = FZ.s; zNow.r = FZ.r; zNow.k = sk;
  const setW = clamp(cv * 1.4, 0, 1); mechanism(setW * setW * (3 - 2 * setW));
  const fW = (c) => Math.max(1 - clamp((c - 1.25) * 2.4, 0, 1), clamp((c - (N - 1.42)) * 2.4, 0, 1)), heroW = 1 - clamp(cv * 2.4, 0, 1), freeW = jump ? lerp(fW(jump.c0), fW(jump.i), je) : fW(cv);   // the first and last screens both let go of the watch
  if (!down) { tx *= 0.93; ty *= 0.93; if (freeW < 0.02 && !jump) { heroYaw = ((heroYaw + 180) % 360 + 360) % 360 - 180; } }
  dragX += (tx - dragX) * 0.2; dragY += (ty - dragY) * 0.2; hy += (heroYaw - hy) * 0.18; hp += (heroPitch - hp) * 0.18;
  const s = now / 1000, sway = snap ? 0 : (act === 0 || act === N - 1) ? 1 : (act === CB || act === 1 ? 1 : 0.3) * (1 - fe) * (1 - 0.8 * cz);
  const mob = W <= 800, visH = 2 * camera.position.z * Math.tan(rad(camera.fov / 2)), visW = visH * camera.aspect;
  let mTop = 0, mH = 0; if (mob) { mobLayout(P, je); mTop = mobL.top - 10; mH = Math.max(80, mobL.pt - mTop); }   /* the clear band between the top row and the sheet, in pixels */
  const fit = mob ? Math.min(visW * 0.96, visH * mH / H * 1.25) : Math.min(visH * 0.7, visW * 0.5), unit = fit / 50;
  let sc = P.sc * unit * (mob ? 0.9 : 1);
  sc = lerp(sc, unit * FZ.s * (mob ? 0.66 : 1), fe);
  const pan = snap ? 0 : cz;   // in close, the camera never quite sits still: a slow pan round the part
  e.set(rad(lerp(P.rx, -6, fe) + dragY + hp * freeW + Math.sin(s * 0.5) * 1.5 * sway + ZSIGN * zTilt[0] + Math.sin(s * 0.31) * 2.5 * pan), rad(P.ry + dragX + hy * freeW + Math.sin(s * 0.33) * 4 * sway + zTilt[1] + Math.sin(s * 0.23 + 1) * 6 * pan), rad(P.rz + zTilt[2]), 'XYZ');
  root.quaternion.setFromEuler(e); root.scale.setScalar(sc);
  const fc = FZ.c;
  v.set(lerp(P.f[0], fc[0], fe), lerp(P.f[1], fc[1], fe), lerp(P.f[2], ZD + P.z[2] * (1 - fe), fe)).multiplyScalar(sc).applyQuaternion(root.quaternion);
  const cx = mob ? 0 : -visW * 0.2, cy = mob ? visH * (0.5 - (mTop + mH * 0.5) / H) : 0;
  root.position.set(cx - v.x, cy - v.y, -v.z); glow.position.x = cx; glow.position.y = cy;
  zoomApply(dt, sc, cx, cy, act);
  let lc = [cx, cy], scU = sc; if (intro.on) { const r = introPose(dt, visW, visH, mob, sc, cx, cy); lc = r.lc; scU = r.s; glow.position.x = lc[0]; glow.position.y = lc[1]; }
  propsUpdate(dt, visW, visH, mob, cv);
  const cl = 1 - P.o[0]; LAY.crystal.g.position.z = P.z[0] * 0.7; LAY.crystal.g.position.y = cl * 16; LAY.crystal.g.rotation.x = -cl * 0.7;   // the crystal tips up and away like a lid, and is gone early
  gHands.position.z = P.z[1] * (1 - fe); gDial.position.z = P.z[2] * (1 - fe);
  const lit = gDial.position.z > 1.5; if (lit !== dialOff) { dialOff = lit; [gDial, gHands].forEach((G) => G.traverse((m) => { if (m.isMesh && m.material && !m.material.transparent) m.castShadow = !lit; })); }   // a lifted dial should not black out the works below it
  gMov.position.z = P.z[3]; gBack.position.z = P.z[4];
  ORDER.forEach((n, k) => setOpacity(n, k ? P.o[k] : Math.pow(P.o[0], 4)));
  rotorPhysics(dt);
  let so = 0; natoP = 1;
  if (swapT >= 0 && RAIL) { const was = swapT; if (!swapHold) swapT += dt; so = railStep(was, swapT, P.sy); }
  else if (swapT >= 0) { const was = swapT; if (!swapHold) swapT += dt; const T = swapT, sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    if (was < 0.34 && T >= 0.34) snd.strap(0);
    if (was < 0.7 && T >= 0.7 && strapNext) { showStrap(strapNext); strapNext = null; }
    if (was < 0.98 && T >= 0.98) snd.strap(1);
    so = T < 0.38 ? 0 : T < 0.7 ? sm((T - 0.38) / 0.32) : sm(1 - (T - 0.7) / 0.34); toolPose(T);
    if (STRAPS[strapNow].under) { so = 0; if (T < 0.7) { natoP = 1 - sm((T - 0.04) / 0.64); gTool.visible = false; } else natoP = sm((T - 0.72) / 1.4); }   // webbing is not unpinned, it is pulled through
    if (T >= (STRAPS[strapNow].under ? 2.2 : 1.2)) { swapT = strapNext ? 0 : -1; gTool.visible = false; } }
  if (RAIL) railTick(dt, pe, je, P.sy, mob, visW, visH);
  strapPhysics(snap ? 0.05 : dt, P.sy + so * 12, -so * 0.9);
  wDate += ((focus === 'date' ? 1 : 0) - wDate) * (snap ? 1 : 0.14); wMoon += ((focus === 'moon' ? 1 : 0) - wMoon) * (snap ? 1 : 0.14);
  mCover.opacity = 1 - wMoon; moonCover.visible = wMoon < 0.99; photoA.material.opacity = photoB.material.opacity = wDate; photoA.visible = wDate > 0.01;
  if (slide) { slide.t += dt / 0.22; const x = clamp(slide.t, 0, 1), se = x * x * (3 - 2 * x); photoA.position.y = slide.dir * 2.75 * se; photoB.position.y = -slide.dir * 2.75 * (1 - se); if (x >= 1) { photoA.material.map = photoB.material.map; photoA.position.y = 0; photoB.visible = false; slide = null; } }
  const half = clamp(30 * scU, 14, 64); const sh = key.shadow.camera; sh.left = -half; sh.right = half; sh.top = half; sh.bottom = -half; sh.updateProjectionMatrix();
  key.target.position.set(lc[0], lc[1], 0); key.position.set(lc[0] - 70, lc[1] + 110, 190); key.shadow.normalBias = 0.05 * scU;
  scene.background.setRGB(P.bg[0] / 255, P.bg[1] / 255, P.bg[2] / 255, THREE.SRGBColorSpace);
  document.body.style.background = '#' + scene.background.getHexString();
  if (first) { const hid = []; [gBin, gBox, boxShadow, snow, gBuckle].forEach((o) => { if (o && !o.visible) { o.visible = true; hid.push(o); } });   // warm up: build every shader and send every texture to the card now, so nothing stalls when the bin and the box's landing first appear
    try { renderer.compile(scene, camera); scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((mt) => ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'alphaMap', 'emissiveMap'].forEach((k) => { if (mt[k] && mt[k].image) renderer.initTexture(mt[k]); })); }); } catch (e) {}
    hid.forEach((o) => { o.visible = false; }); }
  renderer.render(scene, camera); if (RAIL) railOverlay(mob);
  panels.forEach((p) => { const k = +p.dataset.ch; let o, ty2 = 0; if (jump) o = k === jump.i ? clamp(je * 3 - 2, 0, 1) : clamp(1 - je * 3, 0, 1) * (parseFloat(p.style.opacity) > 0.01 ? 1 : 0); else { o = clamp(1 - Math.abs(pe - k) * 2.4, 0, 1); ty2 = (k - pe) * 40; }
    o *= (k === CD ? 1 - fe : 1); p.style.opacity = o; p.style.transform = 'translateY(' + ty2 + 'px)'; p.classList.toggle('live', k === act && !jump && !(k === CD && focus)); p.style.visibility = o < 0.01 ? 'hidden' : 'visible'; });
  fixTick(dt);
  fEl.style.opacity = fe * tf; fEl.style.visibility = fe * tf < 0.01 ? 'hidden' : 'visible';
  [...rail.children].forEach((bt, k) => { bt.classList.toggle('cur', k === act); bt.classList.toggle('past', k < act); }); rail.style.setProperty('--p', clamp(pe / (N - 1), 0, 1).toFixed(4));
  const near = !jump && Math.abs(pe - act) < 0.15 && !focus && fe < 0.2;
  hots.forEach((h) => { const on = near && +h.dataset.ch === act; h.classList.toggle('on', on); if (on) { anchors[h.dataset.k].getWorldPosition(v).project(camera); h.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * W) + 'px,' + ((-v.y * 0.5 + 0.5) * H) + 'px)'; } });
  pullTick(W, H);
  $('hint').style.opacity = cv < 0.3 && !intro.on ? 1 : 0;
  scrim.style.opacity = fe; renderer.toneMappingExposure = 1 - 0.36 * fe;
  if (fe > 0.01) { const px = H / visH, rr = FZ.r * sc * px; spot.style.setProperty('--sx', ((cx / visW + 0.5) * W) + 'px'); spot.style.setProperty('--sy', ((0.5 - cy / visH) * H) + 'px'); spot.style.setProperty('--sr', rr + 'px'); } spot.style.opacity = fe;
  if (first) { first = false; if (window.__flapGo) window.__flapGo(); const go = () => { const e2 = typeof window.__flapEnd === 'number' ? window.__flapEnd : 1100, t2 = e2 - performance.now(); if (t2 > 0) setTimeout(go, Math.min(t2, 250)); else document.body.classList.add('ready'); }; go(); { const lp = () => { if (intro.on) setTimeout(lp, 400); else setTimeout(loadPhotos, 1500); }; setTimeout(lp, 2500); } }   // the loader stays until its sentence has had its say
  requestAnimationFrame(frame);
}
if (SKIP) { boxS.mode = 'gone'; burst.done = true; binIn = 0; }   // and no box to throw or bin to throw it in
requestAnimationFrame(frame);
window.__watch = { railTest: (k) => { rl.force = true; pickStrap(k); }, brace: () => ({ k: +BRSH.k.toFixed(4), res: +BRSH.res.toFixed(4), a: +BRSH.a.toFixed(2), b: +BRSH.b.toFixed(2), zc: +BRSH.zc.toFixed(2), sag: +BRSH.sag.toFixed(2), L: BRSH.L.map((x) => +x.toFixed(2)), ph: [BRWP.ph[BRC.m - 1], BRWP.ph[BRC.m], BRWP.ph[BRC.m + 1], BRWP.ph[BRC.m + 2]].map((x) => +(x * 180 / Math.PI).toFixed(1)), gh: +GHU.uGhP.value.x.toFixed(3), ghost: STRAPS.engineering.objs[0].parts.filter((P) => P.g).length, nan: STRAPS.engineering.objs[0].parts.some((P) => !isFinite(P.m.position.y)) }), calf: () => ({ L: CALF.L, n: CALF.n, hole: CALF.hole, keeps: cKeep.map((K) => [+K.s.toFixed(2), +K.b0.toFixed(2)]) }), nato: () => ({ q: +NT.q.toFixed(4), st: RS.writing && RS.writing.state, bars: NT.bars, par: STRAPS.writing.natoG && STRAPS.writing.natoG.parent && STRAPS.writing.natoG.parent.type }), natoGap: () => NT.gap, slotAt: (k) => { const S = rl.slots[RJ.order.indexOf(k)], v = new THREE.Vector3(); S.piv.getWorldPosition(v); v.project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight]; }, railState: () => ({ now: strapNow, next: strapNext, swapT, rs: Object.assign({}, rs), st: Object.fromEntries(Object.entries(RS).map(([k, R]) => [k, R.state])), ppm: rl.ppm, s: rl.s, vis: rl.vis, ms: [rl.bakeMs, rl.furnMs], sw: rl.slots.map((S) => [+S.piv.rotation.z.toFixed(4), +S.ph.toFixed(4)]) }), railBtn: () => rl.btns.map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.rail, r.left + r.width / 2, r.top + r.height * 0.4, r.width, r.height]; }), qr: (i) => { const q = QR.filter((x) => x.k === strapNow)[i]; q.t = 0; q.p.set(0, 0, 0); q.v.set((q.i ? -1 : 1) * 5, q.o.sy * HEAD[0] * 22, HEAD[1] * 22); }, qrAt: () => QR.filter((x) => x.k === strapNow).map((q) => { const v = new THREE.Vector3(); q.hit.getWorldPosition(v); v.project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight]; }), gem: (rx, ry, rz, s) => { const o = anchors['z-music']; gCase.add(o); o.position.set(0, -19.3, ZB + 3.5); ZTILT.music = [rx, ry, rz]; ZOOMS.music = s; pickInt('music'); }, throwBox, setHold: (x) => { if (jump) jump.hold = x; }, pose: () => [root.quaternion.x, root.quaternion.y, root.quaternion.z, root.quaternion.w, root.scale.x, root.position.x, root.position.y, SIDES[0].turn, SIDES[1].turn], zoomTune: (k, rx, ry, rz, s) => { ZTILT[k] = [rx, ry, rz]; ZOOMS[k] = s; pickInt(k); }, cur: () => ({ cur, sy: scrollY, total: total() }), plateHold: (ms) => { PL.hold = ms; }, upNow: (i) => { const bt = DIALS.upcycle.roll(i); upUnlocked(bt, false); return bt.name; }, fallAt: (t) => { fallHold = t >= 0; FALL.forEach((F) => { F.t = Math.max(0, t); }); return FALL.length; }, brCl: (v) => { BCL.hold = v; return [BCL.cl, BCL.fl, +BCL.gap.toFixed(2)]; }, sw: () => [+(rl.t - (rl.jt >= 0 ? rl.jt : rl.t)).toFixed(3)].concat(rl.slots.map((S) => +(S.piv.rotation.z * 180 / Math.PI).toFixed(3))), natoTw: () => [+(NT.tw * 180 / Math.PI).toFixed(1), +(NT.endDot || 0).toFixed(2)], sway: () => rl.slots.map((S) => [+(S.amp * 180 / Math.PI).toFixed(2), +(S.piv.rotation.z * 180 / Math.PI).toFixed(3)]), upRoll: (i) => { const bt = DIALS.upcycle.roll(i); WAYS.upcycle.dotCss = DIALS.upcycle.css(bt); WAYS.upcycle.name = 'Upcycled plastic, ' + bt.name.toLowerCase(); unlockUpcycle(false); pickWay('upcycle'); return bt.name; }, talk: (n) => talkNudge(n), introState: () => ({ on: intro.on, open: intro.open, tries: intro.tries, need: intro.need, shaking: !!intro.shake, hint: $('i-open').textContent, sy: scrollY }), dbg: () => ({ cw: canvas.width, ch: canvas.height, ccw: canvas.clientWidth, cch: canvas.clientHeight, sw: stage.clientWidth, sh: stage.clientHeight, W, H, asp: camera.aspect, pr: renderer.getPixelRatio(), cur, sy: scrollY, bin: gBin.visible, binPos: gBin.position.toArray().map((x) => +x.toFixed(1)), binS: gBin.scale.x, box: gBox.visible, boxPos: gBox.position.toArray().map((x) => +x.toFixed(1)), mode: boxS.mode, binIn, up: upDone, C: [+boxS.C.x.toFixed(2), +boxS.C.y.toFixed(2)], v: [+boxS.v.x.toFixed(2), +boxS.v.y.toFixed(2)], th: +boxS.th.toFixed(3), hw: +RP.hw.toFixed(1), hh: +RP.hh.toFixed(1), yF: +RP.yF.toFixed(1), mouth: RP.mouth.toArray().map((q) => +q.toFixed(1)) }), jumpHold: (i, x) => { jumpTo(i); if (jump) jump.hold = x; }, introAt, recycleAt, nudge: (x, y) => { tx = x; ty = y || 0; down = { x: 0, y: 0, yaw: heroYaw, pitch: heroPitch, tx: x, ty: y || 0, hero: false, mouse: true }; }, swapAt: (T) => { swapT = T; swapHold = T >= 0; }, pickStrap, pickWay, jumpTo, openFocus, stepFocus, closeFocus, spin: (y, p) => { heroYaw = y; heroPitch = p || 0; hy = y; hp = p || 0; } };
Object.assign(window.__watch, { work: () => ({ order: STOP.slice(), focus, seen: [...seenW], ch: +(scrollY / PITCH).toFixed(2), cur: +cur.toFixed(2) }), boxScr: () => toScreen(gBox.position), qr: (i) => { const q = QR.filter((x) => x.k === strapNow)[i]; q.t = 0; q.p.set(0, 0, 0); q.v.set((q.i ? -1 : 1) * 5, q.o.sy * HEAD[0] * 22, HEAD[1] * 22); }, qrAt: () => QR.filter((x) => x.k === strapNow).map((q) => { const v = new THREE.Vector3(); q.hit.getWorldPosition(v); v.project(camera); return [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight]; }), gem: (rx, ry, rz, s) => { const o = anchors['z-music']; gCase.add(o); o.position.set(0, -19.3, ZB + 3.5); ZTILT.music = [rx, ry, rz]; ZOOMS.music = s; pickInt('music'); }, throwBox, setHold: (x) => { if (jump) jump.hold = x; }, pose: () => [root.quaternion.x, root.quaternion.y, root.quaternion.z, root.quaternion.w, root.scale.x, root.position.x, root.position.y, SIDES[0].turn, SIDES[1].turn], zoomTune: (k, rx, ry, rz, s) => { ZTILT[k] = [rx, ry, rz]; ZOOMS[k] = s; pickInt(k); }, cur: () => ({ cur, sy: scrollY, total: total() }), upRoll: (i) => { const bt = DIALS.upcycle.roll(i); WAYS.upcycle.dotCss = DIALS.upcycle.css(bt); WAYS.upcycle.name = 'Upcycled plastic, ' + bt.name.toLowerCase(); unlockUpcycle(false); pickWay('upcycle'); return bt.name; }, talk: (n) => talkNudge(n), introState: () => ({ on: intro.on, open: intro.open, tries: intro.tries, need: intro.need, shaking: !!intro.shake, hint: $('i-open').textContent, sy: scrollY }), dbg: () => ({ cw: canvas.width, ch: canvas.height, ccw: canvas.clientWidth, cch: canvas.clientHeight, sw: stage.clientWidth, sh: stage.clientHeight, W, H, asp: camera.aspect, pr: renderer.getPixelRatio(), cur, sy: scrollY, bin: gBin.visible, binPos: gBin.position.toArray().map((x) => +x.toFixed(1)), binS: gBin.scale.x, box: gBox.visible, boxPos: gBox.position.toArray().map((x) => +x.toFixed(1)), mode: boxS.mode, binIn, up: upDone, C: [+boxS.C.x.toFixed(2), +boxS.C.y.toFixed(2)], v: [+boxS.v.x.toFixed(2), +boxS.v.y.toFixed(2)], th: +boxS.th.toFixed(3), hw: +RP.hw.toFixed(1), hh: +RP.hh.toFixed(1), yF: +RP.yF.toFixed(1), mouth: RP.mouth.toArray().map((q) => +q.toFixed(1)) }), jumpHold: (i, x) => { jumpTo(i); if (jump) jump.hold = x; }, introAt, recycleAt, nudge: (x, y) => { tx = x; ty = y || 0; down = { x: 0, y: 0, yaw: heroYaw, pitch: heroPitch, tx: x, ty: y || 0, hero: false, mouse: true }; }, swapAt: (T) => { swapT = T; swapHold = T >= 0; }, pickStrap, pickWay, jumpTo, openFocus, stepFocus, closeFocus, spin: (y, p) => { heroYaw = y; heroPitch = p || 0; hy = y; hp = p || 0; } });
