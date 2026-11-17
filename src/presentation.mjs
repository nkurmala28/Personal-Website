// Keep authoring placeholders out of visitor-facing copy without inventing facts.
export function displayText(value, fallback = '') {
  const text = String(value ?? '').replace(/\[[^\]]*\]/g, '').replace(/^[\s.,;:]+/, '').trim();
  return text || fallback;
}

export function collectionSuggestion(order, current, opened) {
  return order.find(key => key !== current && !opened.has(key)) || null;
}

// Smoothly vary the desktop watch's position and size with the chapter.
// Mobile keeps its existing measured fit above the reading sheet.
const COMPOSITIONS = [
  {x:-0.16,scale:1.04}, // Home: the watch leads.
  {x:-0.28,scale:0.8},  // Experience: space for the hanger and role.
  {x:-0.18,scale:0.98}, // Work index.
  {x:-0.23,scale:0.9}, {x:-0.23,scale:0.9}, {x:-0.23,scale:0.9},
  {x:-0.17,scale:1.02}, // About: bring the mechanism forward.
  {x:-0.28,scale:0.78}  // Contact: the action leads.
];
export function compositionAt(chapter) {
  const value=Math.max(0,Math.min(COMPOSITIONS.length-1,chapter));
  const i=Math.min(COMPOSITIONS.length-2,Math.floor(value));
  const u=value-i, t=u*u*(3-2*u), a=COMPOSITIONS[i], b=COMPOSITIONS[i+1];
  return {x:a.x+(b.x-a.x)*t,scale:a.scale+(b.scale-a.scale)*t};
}
