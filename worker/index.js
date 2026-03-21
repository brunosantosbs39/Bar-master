// worker/index.js — Cloudflare Worker: URL Broker para cardápio público
// Armazena a URL atual do tunnel e redireciona clientes para ela.
// Endpoints:
//   GET  /menu      → redirect para {tunnel}/menu (ou 503 se offline)
//   GET  /          → redirect para {tunnel}/ (ou 503 se offline)
//   POST /register  → salva nova URL do tunnel no KV (requer token)
//   DELETE /register → remove URL do KV (requer token)
//   GET  /status    → retorna URL atual e timestamp (requer token)

const TUNNEL_URL_KEY = 'tunnel_url';
const TUNNEL_UPDATED_AT_KEY = 'tunnel_url_updated_at';
const TUNNEL_URL_TTL = 8 * 60 * 60; // 8 horas em segundos
const URL_PATTERN = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST' && path === '/register') return handleRegister(request, env);
    if (request.method === 'DELETE' && path === '/register') return handleDeregister(request, env);
    if (request.method === 'GET' && path === '/status') return handleStatus(request, env);
    if (request.method === 'GET' && path === '/menu') return handleRedirect(env, '/menu');
    if (request.method === 'GET' && path === '/') return handleRedirect(env, '');

    return new Response('Not found', { status: 404 });
  },
};

function isAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${env.WORKER_SECRET}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function handleRegister(request, env) {
  if (!isAuthorized(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'JSON inválido' }, 400); }

  if (!body.url || !URL_PATTERN.test(body.url)) {
    return jsonResponse({ error: 'URL inválida. Apenas trycloudflare.com é aceito.' }, 400);
  }

  await env.TUNNEL_URL.put(TUNNEL_URL_KEY, body.url, { expirationTtl: TUNNEL_URL_TTL });
  await env.TUNNEL_URL.put(TUNNEL_UPDATED_AT_KEY, new Date().toISOString(), { expirationTtl: TUNNEL_URL_TTL });

  return jsonResponse({ ok: true, url: body.url });
}

async function handleDeregister(request, env) {
  if (!isAuthorized(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  await env.TUNNEL_URL.delete(TUNNEL_URL_KEY);
  await env.TUNNEL_URL.delete(TUNNEL_UPDATED_AT_KEY);

  return jsonResponse({ ok: true });
}

async function handleStatus(request, env) {
  if (!isAuthorized(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  const tunnelUrl = await env.TUNNEL_URL.get(TUNNEL_URL_KEY);
  const updatedAt = await env.TUNNEL_URL.get(TUNNEL_UPDATED_AT_KEY);

  return jsonResponse({ url: tunnelUrl, updated_at: updatedAt, active: !!tunnelUrl });
}

async function handleRedirect(env, suffix) {
  const tunnelUrl = await env.TUNNEL_URL.get(TUNNEL_URL_KEY);

  if (!tunnelUrl) {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Cardápio indisponível</title>
<style>body{font-family:sans-serif;text-align:center;padding:3rem;color:#333}h2{color:#e65c00}</style>
</head>
<body>
  <h2>Cardápio temporariamente indisponível</h2>
  <p>O sistema está offline no momento.</p>
  <p>Por favor, tente novamente em instantes.</p>
</body></html>`;
    return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' } });
  }

  return Response.redirect(tunnelUrl + suffix, 302);
}
