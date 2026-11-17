# Shared soccer leaderboard

The static GitHub Pages site needs this API deployed before the leaderboard can go live. It does not display fake/local scores when unconfigured.

Using a Cloudflare account with Workers and D1 enabled:

1. From this directory run `npx wrangler d1 create nikhil-soccer` and copy the returned ID into wrangler.jsonc.
2. Run `npx wrangler d1 execute nikhil-soccer --remote --file=schema.sql`.
3. Run `npx wrangler secret put RATE_SALT` and enter a random private string.
4. Run `npx wrangler deploy`.
5. Set `soccerLeaderboardUrl` in content.js to the returned HTTPS Worker URL, then publish content.js.

Scores are best of five. Equal scores sort by first achievement. Names are public; anonymous bearer tokens stay on the player's device and only token hashes are stored. IPs are hashed into hourly rate buckets using a private salt. No raw IP addresses are saved. Users can rename themselves; personal names are optional. Name moderation runs on both client and server and rejects common profanity, slurs, punctuation disguises, and some leetspeak. No finite filter catches all inappropriate names; additional moderation may be needed after launch.

This is a casual leaderboard. The server bounds scores, limits requests, checks round duration, and consumes round tokens once. It cannot prove that a submitted score came from honest browser physics; strong anti-cheat would need server-authoritative gameplay. Review retention/moderation needs before promotion to a large audience.
