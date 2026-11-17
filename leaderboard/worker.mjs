import { validName, validScore } from '../src/leaderboard-policy.mjs';
const digest = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2,'0')).join('');
export default {async fetch(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':env.SITE_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
  const reply = (data, status=200) => new Response(JSON.stringify(data), {status, headers});
  if (origin !== env.SITE_ORIGIN) return reply({error:'Origin not allowed'},403);
  if (request.method === 'OPTIONS') return reply({});
  const path = new URL(request.url).pathname;
  try {
    if (path === '/scores' && request.method === 'GET') return reply((await env.DB.prepare('SELECT name, score FROM players WHERE score >= 0 ORDER BY score DESC, achieved ASC LIMIT 20').all()).results);
    if (request.method !== 'POST') return reply({error:'Not found'},404);
    if (Number(request.headers.get('Content-Length')) > 1024) return reply({error:'Request too large'},413);
    const raw = await request.text(); if (raw.length > 1024) return reply({error:'Request too large'},413);
    const body = JSON.parse(raw);
    const bucket = await digest((request.headers.get('CF-Connecting-IP') || 'unknown') + env.RATE_SALT + Math.floor(Date.now()/3600000));
    const rate = await env.DB.prepare('INSERT INTO limits(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1 RETURNING n').bind(bucket,Date.now()+7200000).first();
    if (rate.n > 80) return reply({error:'Too many requests. Try again later.'},429);
    await env.DB.prepare('DELETE FROM limits WHERE expires < ?').bind(Date.now()).run();
    if (path === '/players') {
      const id=crypto.randomUUID(), token=crypto.randomUUID()+crypto.randomUUID(), name='Player '+crypto.getRandomValues(new Uint32Array(1))[0];
      await env.DB.prepare('INSERT INTO players(id,token,name) VALUES(?,?,?)').bind(id,await digest(token),name).run(); return reply({token,name});
    }
    const token = request.headers.get('Authorization')?.replace(/^Bearer /,'');
    if (!token) return reply({error:'Missing player session'},401);
    const player = await env.DB.prepare('SELECT id FROM players WHERE token=?').bind(await digest(token)).first();
    if (!player) return reply({error:'Player session expired. Clear your saved player and retry.'},401);
    if (path === '/name') {if (!validName(body.name)) return reply({error:'Please choose an appropriate name (2–20 characters).'},400); await env.DB.prepare('UPDATE players SET name=? WHERE id=?').bind(body.name.normalize('NFKC').trim(),player.id).run(); return reply({ok:true});}
    if (path === '/games') { const id=crypto.randomUUID(); await env.DB.prepare('INSERT INTO games(id,player,started) VALUES(?,?,?)').bind(id,player.id,Date.now()).run(); return reply({id}); }
    if (path === '/scores') {
      if (!validScore(body.score) || typeof body.game !== 'string') return reply({error:'Invalid score'},400);
      // Consume the round atomically: retries cannot submit it twice.
      const round=await env.DB.prepare('DELETE FROM games WHERE id=? AND player=? AND started BETWEEN ? AND ? RETURNING id').bind(body.game,player.id,Date.now()-3600000,Date.now()-8000).first();
      if (!round) return reply({error:'Round unavailable or too short. Play a new five-shot round.'},400);
      await env.DB.prepare('UPDATE players SET score=?, achieved=? WHERE id=? AND score < ?').bind(body.score,Date.now(),player.id,body.score).run();
      await env.DB.prepare('DELETE FROM games WHERE started < ?').bind(Date.now()-3600000).run();return reply({ok:true});
    }
    return reply({error:'Not found'},404);
  } catch {return reply({error:'Leaderboard unavailable. Please retry.'},500);}
}};
