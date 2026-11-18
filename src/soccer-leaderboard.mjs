import { validName } from './leaderboard-policy.mjs';
export function createSoccerBoard(endpoint, parent) {
  if (!endpoint || !/^https:\/\//.test(endpoint)) return {show() {}, finish() {}, newRound() {}};
  const panel = document.createElement('section'); panel.className = 'soccer-leaderboard'; panel.hidden = true;
  panel.innerHTML = '<h3>Penalty leaderboard (best of five)</h3><form><label>Your name <input name="player" maxlength="20" minlength="2" autocomplete="off" required></label><button>Save name</button></form><p class="board-status" role="status"></p><ol></ol><button type="button" class="board-submit" hidden>Submit score</button>';
  parent.after(panel);
  const status = panel.querySelector('.board-status'), input = panel.querySelector('input'), submit = panel.querySelector('.board-submit');
  let player, game, score, busy = false, starting;
  try { player = JSON.parse(localStorage.getItem('nk-soccer-player')); } catch {}
  async function api(path, body) {
    const response = await fetch(endpoint.replace(/\/$/, '') + path, {method: body ? 'POST' : 'GET', headers: {'Content-Type':'application/json', ...(player ? {'Authorization':'Bearer ' + player.token} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(10000)});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Leaderboard unavailable. Try again.'); return data;
  }
  async function refresh() {
    const rows = await api('/scores'); const ol = panel.querySelector('ol'); ol.replaceChildren(...rows.map(row => { const li = document.createElement('li'); li.textContent = row.name + ' — ' + row.score + '/5'; return li; }));
    if (!rows.length) { const li = document.createElement('li'); li.textContent = 'Be the first to score.'; ol.appendChild(li); }
  }
  async function start() {
    if (!player) { player = await api('/players', {}); try { localStorage.setItem('nk-soccer-player', JSON.stringify(player)); } catch {} }
    input.value = player.name; game = (await api('/games', {})).id; await refresh(); status.textContent = '';
  }
  panel.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); const name = input.value.normalize('NFKC').trim();
    if (!validName(name)) { status.textContent = 'Use 2–20 letters, numbers, spaces, dashes or underscores. Keep it appropriate.'; return; }
    try { await starting; await api('/name', {name}); player.name = name; try {localStorage.setItem('nk-soccer-player', JSON.stringify(player));} catch {} status.textContent = 'Name saved.'; await refresh(); } catch(error) {status.textContent = error.message;}
  });
  submit.addEventListener('click', async () => { if (busy || score == null) return; busy = true; submit.disabled = true;
    try {await starting; await api('/scores', {game, score}); submit.hidden = true; score = null; status.textContent = 'Score submitted!'; await refresh(); game = null;} catch(error) {status.textContent = error.message;} finally {busy = false; submit.disabled = false;}
  });
  return {newRound() { game = null; score = null; submit.hidden = true; if (!starting) starting = start().catch(error => {status.textContent = error.message;}).finally(() => {starting = null;}); }, show(on) {panel.hidden = !on; if (on && !game && !starting) {status.textContent = 'Loading leaderboard…'; starting = start().catch(error => {status.textContent = error.message;}).finally(() => {starting = null;});}}, finish(goals) {score = goals; submit.hidden = false; if (!game && !starting) starting = start().catch(error => {status.textContent = error.message;}).finally(() => {starting = null;});}};
}
