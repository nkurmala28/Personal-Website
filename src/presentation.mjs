// Keep authoring placeholders out of visitor-facing copy without inventing facts.
export function displayText(value, fallback = '') {
  const text = String(value ?? '').replace(/\[[^\]]*\]/g, '').replace(/^[\s.,;:]+/, '').trim();
  return text || fallback;
}

export function collectionSuggestion(order, current, opened) {
  return order.find(key => key !== current && !opened.has(key)) || null;
}
