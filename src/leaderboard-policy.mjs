// Apply the same validation in the browser and on the server. Names are public.
const blocked = /fuck|shit|bitch|cunt|nigg|fagg|kike|chink|whore|porn|nazi|hitler|rape|retard|asshole|dick|pussy|cock|sex|slut/;
export function validName(value) {
  if (typeof value !== 'string') return false;
  const name = value.normalize('NFKC').trim();
  const folded = name.toLowerCase().replace(/[013457@$]/g, c => ({0:'o',1:'i',3:'e',4:'a',5:'s',7:'t','@':'a','$':'s'}[c])).replace(/[^a-z]/g, '');
  return /^[A-Za-z0-9][A-Za-z0-9 _-]{1,19}$/.test(name) && !blocked.test(folded);
}
export function validScore(score) { return Number.isInteger(score) && score >= 0 && score <= 5; }
