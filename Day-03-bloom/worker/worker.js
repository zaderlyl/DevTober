// Day 03 - Bloom : le « bot » Discord, version Cloudflare Workers.
// Pas de programme qui tourne en permanence : Discord appelle ce Worker (Interactions Endpoint URL) à chaque
// commande /arroser, /plante ou /graine, et affiche ce qu'il répond.
//
//   POST /            Discord -> une commande ; la signature Ed25519 est vérifiée avant toute chose
//   GET  /?state=1    l'état de la plante en JSON (lu par la page bloom.html)

const PUBLIC_KEY = 'ab4636713fd09b3b530cc509f174d47d60d954000c8ba1051f2271f3068116ec';  // clé PUBLIQUE de l'application Discord (pas un secret)
const PER_STAGE = 1;   // arrosages nécessaires pour passer à l'étape suivante (1 pour le test)
const STAGES = [
  { emoji: '🌰', name: 'Graine' },
  { emoji: '🌱', name: 'Pousse' },
  { emoji: '🌿', name: 'Tige' },
  { emoji: '🌷', name: 'Bouton' },
  { emoji: '🌸', name: 'Fleur' },
];
const LAST = STAGES.length - 1;
const FRESH = { stage: 0, progress: 0, waterings: 0, lastAt: 0 };
const MAX_BODY = 20000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });

const hex = s => Uint8Array.from(s.match(/../g).map(h => parseInt(h, 16)));

// Les Workers acceptent l'algorithme « Ed25519 » ; l'ancien nom « NODE-ED25519 » sert de secours.
async function importKey(keyHex) {
  const raw = hex(keyHex);
  try { return await crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']); }
  catch { return await crypto.subtle.importKey('raw', raw, { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, false, ['verify']); }
}
async function validSignature(request, body, keyHex) {
  const sig = request.headers.get('X-Signature-Ed25519') || '';
  const ts = request.headers.get('X-Signature-Timestamp') || '';
  if (!/^[0-9a-f]{128}$/i.test(sig) || !ts) return false;
  try {
    const key = await importKey(keyHex);
    const data = new TextEncoder().encode(ts + body);
    const algo = key.algorithm.name;   // « Ed25519 » ou « NODE-ED25519 »
    return await crypto.subtle.verify(algo, key, hex(sig), data);
  } catch { return false; }
}

// ---- l'état de la plante, dans le stockage KV du Worker (liaison « BLOOM »)
async function load(env) {
  const saved = await env.BLOOM.get('plant', 'json');
  const s = { ...FRESH, ...(saved || {}) };
  s.stage = Math.max(0, Math.min(LAST, Number(s.stage) || 0));
  return s;
}
const save = (env, s) => env.BLOOM.put('plant', JSON.stringify(s));

const publicState = s => ({
  ok: true, stage: s.stage + 1, stages: STAGES.length, name: STAGES[s.stage].name, emoji: STAGES[s.stage].emoji,
  progress: s.progress, perStage: PER_STAGE, bloomed: s.stage === LAST, waterings: s.waterings, lastAt: s.lastAt * 1000,
});

const statusLine = s => `${STAGES[s.stage].emoji} ${STAGES[s.stage].name} · ${s.stage + 1}/${STAGES.length}  ` + '▰'.repeat(s.stage + 1) + '▱'.repeat(LAST - s.stage);
const reply = (text, priv = false) => json({ type: 4, data: { content: text, ...(priv ? { flags: 64 } : {}) } });

export default {
  async fetch(request, env) {
    const { method } = request;
    const url = new URL(request.url);

    if (method === 'GET') {
      const cors = { 'Access-Control-Allow-Origin': '*' };   // la page est sur GitHub Pages : elle doit pouvoir lire la réponse
      if (url.searchParams.has('state')) return json(publicState(await load(env)), 200, cors);
      return json({ ok: true, service: 'bloom' }, 200, cors);
    }
    if (method !== 'POST') return json({ ok: false, error: 'méthode non acceptée' }, 405);

    // POST : doit venir de Discord. On vérifie la signature avant de lire quoi que ce soit.
    const body = await request.text();
    if (body.length > MAX_BODY) return json({ ok: false, error: 'requête trop grosse' }, 413);
    if (!(await validSignature(request, body, env.PUBLIC_KEY || PUBLIC_KEY))) return json({ ok: false, error: 'signature invalide' }, 401);

    let msg;
    try { msg = JSON.parse(body); } catch { return json({ ok: false, error: 'JSON invalide' }, 400); }

    if (msg.type === 1) return json({ type: 1 });   // le test de Discord : « ping » -> « pong »
    if (msg.type !== 2) return json({ ok: false, error: 'interaction non gérée' }, 400);

    const cmd = String(msg.data?.name || '');
    const s = await load(env);

    if (cmd === 'arroser') {
      if (s.stage >= LAST) return reply("🌸 La fleur est déjà éclose ! Elle n'a plus besoin d'eau. Utilise /graine pour replanter.");
      s.waterings++; s.lastAt = Math.floor(Date.now() / 1000); s.progress++;
      if (s.progress >= PER_STAGE) { s.stage++; s.progress = 0; }
      await save(env, s);
      return reply('💧 Arrosé !\n' + statusLine(s) + (s.stage === LAST ? '\n🎉 La plante a fleuri !' : ''));
    }
    if (cmd === 'plante') return reply(statusLine(s) + `\n${s.waterings} arrosage${s.waterings > 1 ? 's' : ''} au total`);
    if (cmd === 'graine') {
      await save(env, { ...FRESH });
      return reply('🌰 Une nouvelle graine est plantée.\n' + statusLine(FRESH));
    }
    return reply('Commande inconnue.', true);
  },
};
