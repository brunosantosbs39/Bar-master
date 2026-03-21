# Cloudflare Workers URL Broker — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um Cloudflare Worker gratuito como URL permanente para o cardápio público, eliminando QR codes inválidos após restart do servidor.

**Architecture:** Um Worker no Cloudflare armazena a URL atual do tunnel no KV Storage (TTL 8h). O servidor local registra a URL a cada startup via `POST /register` e limpa ao encerrar via `DELETE /register`. O endpoint `/api/public-url` passa a retornar a URL permanente do Worker quando configurado, com degradação graciosa caso contrário.

**Tech Stack:** Cloudflare Workers (JS), Cloudflare KV Storage, Node.js 18+ (ES modules), `dotenv` package, `fetch` nativo Node 18+

**Spec:** `docs/superpowers/specs/2026-03-20-cloudflare-workers-url-broker-design.md`

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `worker/index.js` | Criar | Worker: redirect, register, deregister, status |
| `worker/wrangler.toml` | Criar | Config de deploy do Worker |
| `.env.example` | Criar | Template das variáveis necessárias |
| `server/setup.js` | Criar | Geração do secret na 1ª execução |
| `server/tunnel.js` | Modificar | Registrar/desregistrar URL no Worker |
| `server/index.js` | Modificar | Carregar dotenv, chamar setup, priorizar Worker URL |
| `.gitignore` | Modificar | Adicionar `worker/.wrangler/` |
| `package.json` | Modificar | Adicionar dependência `dotenv` |

---

## Task 1: Instalar dotenv e atualizar .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Instalar dotenv**

```bash
cd "C:\Users\User\Downloads\able-smart-bar-flow"
npm install dotenv
```

Esperado: `dotenv` aparece em `dependencies` no `package.json`.

- [ ] **Step 2: Adicionar exceção e ignorar diretório do Worker no .gitignore**

No arquivo `.gitignore`, adicionar ao final:

```
# Cloudflare Worker
!.env.example
worker/.wrangler/
```

> **Importante:** O `.gitignore` atual tem `.env.*` na linha 3, que ignoraria `.env.example`. A linha `!.env.example` desfaz essa regra para que o template seja commitável.

- [ ] **Step 3: Verificar**

```bash
grep "worker/.wrangler" .gitignore
```

Esperado: linha encontrada.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add dotenv dependency and ignore worker/.wrangler/"
```

---

## Task 2: Criar .env.example

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Criar o arquivo**

Criar `.env.example` com o conteúdo:

```
# Cloudflare Workers URL Broker
# Preencher após executar: cd worker && wrangler deploy

# URL do Worker (ex: https://cardapio-emporiopires.SEU-NOME.workers.dev)
WORKER_URL=

# Secret gerado automaticamente na 1ª execução de npm start
# Copiar o valor gerado em .env após rodar npm start pela primeira vez
WORKER_SECRET=
```

- [ ] **Step 2: Verificar que .env.example NÃO está ignorado**

```bash
git check-ignore -v .env.example
```

Esperado: nenhuma saída (arquivo não ignorado). Se aparecer resultado, significa que a linha `!.env.example` ainda não está no `.gitignore` — voltar à Task 1 Step 2.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example template for Worker configuration"
```

---

## Task 3: Criar worker/wrangler.toml

**Files:**
- Create: `worker/wrangler.toml`

- [ ] **Step 1: Criar diretório e arquivo**

Criar `worker/wrangler.toml`:

```toml
name = "cardapio-emporiopires"
main = "index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "TUNNEL_URL"
id = "COLE_O_ID_AQUI"
preview_id = "COLE_O_ID_AQUI"
```

> **Nota:** Os valores `COLE_O_ID_AQUI` são placeholders — serão substituídos pelo operador após `wrangler kv:namespace create TUNNEL_URL`. O arquivo é commitado com os placeholders intencionalmente.

- [ ] **Step 2: Commit**

```bash
git add worker/wrangler.toml
git commit -m "chore: add wrangler.toml template for Cloudflare Worker"
```

---

## Task 4: Criar worker/index.js

**Files:**
- Create: `worker/index.js`

- [ ] **Step 1: Criar o Worker**

Criar `worker/index.js`:

```js
// worker/index.js — Cloudflare Worker: URL Broker para cardápio público
// Armazena a URL atual do tunnel e redireciona clientes para ela.
// Endpoints:
//   GET  /menu      → redirect para {tunnel}/menu (ou 503 se offline)
//   GET  /          → redirect para {tunnel}/ (ou 503 se offline)
//   POST /register  → salva nova URL do tunnel no KV (requer token)
//   DELETE /register → remove URL do KV (requer token)
//   GET  /status    → retorna URL atual e timestamp (requer token)

const TUNNEL_URL_KEY = 'tunnel_url';
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
  await env.TUNNEL_URL.put('tunnel_url_updated_at', new Date().toISOString());

  return jsonResponse({ ok: true, url: body.url });
}

async function handleDeregister(request, env) {
  if (!isAuthorized(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  await env.TUNNEL_URL.delete(TUNNEL_URL_KEY);

  return jsonResponse({ ok: true });
}

async function handleStatus(request, env) {
  if (!isAuthorized(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  const tunnelUrl = await env.TUNNEL_URL.get(TUNNEL_URL_KEY);
  const updatedAt = await env.TUNNEL_URL.get('tunnel_url_updated_at');

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
    return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }

  return Response.redirect(tunnelUrl + suffix, 302);
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
node --input-type=module < worker/index.js 2>&1 | head -5
```

Esperado: nenhum erro de sintaxe (pode haver erro de runtime sobre `env` — isso é normal fora do Worker runtime).

- [ ] **Step 3: Commit**

```bash
git add worker/index.js
git commit -m "feat: add Cloudflare Worker as URL broker for public menu"
```

---

## Task 5: Criar server/setup.js

**Files:**
- Create: `server/setup.js`

- [ ] **Step 1: Criar o arquivo**

Criar `server/setup.js`:

```js
// server/setup.js — Verificação de primeiro uso do Worker URL Broker
// Chamado na inicialização do servidor. Se .env não existir ou WORKER_SECRET
// não estiver definido, gera um secret e exibe instruções de setup.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

export function ensureWorkerConfig() {
  // Se .env existe e WORKER_SECRET já tem valor, nada a fazer
  if (existsSync(ENV_PATH)) {
    const content = readFileSync(ENV_PATH, 'utf8');
    const match = content.match(/^WORKER_SECRET=(.+)$/m);
    if (match && match[1].trim()) return;
  }

  const secret = randomUUID();
  const envContent = `# Cloudflare Workers URL Broker\nWORKER_URL=\nWORKER_SECRET=${secret}\n`;
  writeFileSync(ENV_PATH, envContent);

  console.log('\n====================================================');
  console.log('SETUP NECESSÁRIO — Cloudflare Workers URL Broker');
  console.log('====================================================');
  console.log('Secret gerado e salvo em .env\n');
  console.log('Para ativar a URL permanente do cardápio:');
  console.log('  1. Crie conta gratuita em cloudflare.com');
  console.log('  2. Execute: npm install -g wrangler');
  console.log('  3. Execute: wrangler login');
  console.log('  4. Execute: wrangler kv:namespace create TUNNEL_URL');
  console.log('  5. Cole o ID retornado em worker/wrangler.toml');
  console.log('  6. Execute: cd worker && wrangler deploy');
  console.log('  7. Execute: wrangler secret put WORKER_SECRET');
  console.log(`     Quando solicitado, cole: ${secret}`);
  console.log('  8. Edite .env: preencha WORKER_URL com a URL do deploy');
  console.log('\nO servidor funciona normalmente sem o Worker.');
  console.log('====================================================\n');
}
```

- [ ] **Step 2: Verificar sintaxe**

```bash
node --check server/setup.js
```

Esperado: nenhuma saída (sintaxe válida). Se houver erro, corrigir antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add server/setup.js
git commit -m "feat: add setup.js for first-run Worker secret generation"
```

---

## Task 6: Modificar server/tunnel.js

**Files:**
- Modify: `server/tunnel.js`

Adicionar duas funções ao final do arquivo e modificar o handler de URL encontrada para registrar no Worker, e o handler de saída para desregistrar.

- [ ] **Step 1: Adicionar funções de registro em `server/tunnel.js`**

Localizar a string exata `function downloadFile(url, dest) {` (linha ~92) e inserir o bloco abaixo **imediatamente antes** dela:

```js
// ── Cloudflare Worker URL Broker ─────────────────────────────────────────────

async function registerWithWorker(tunnelUrl) {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) return;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${workerUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${workerSecret}`,
        },
        body: JSON.stringify({ url: tunnelUrl }),
      });
      if (res.ok) {
        console.log('   🌐 Worker registrado: URL permanente ativa');
        console.log('   ' + workerUrl + '/menu');
        return;
      }
    } catch (_e) { /* tenta novamente */ }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
  }
  console.log('   Aviso: Worker nao disponivel. Usando URL do tunnel diretamente.');
}

async function deregisterFromWorker() {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) return;
  try {
    await fetch(`${workerUrl}/register`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${workerSecret}` },
    });
  } catch (_e) { /* best-effort — processo encerrando */ }
}
```

- [ ] **Step 2: Chamar `registerWithWorker` após detectar URL do cloudflared**

Localizar o bloco onde `_tunnelUrl` é definido (linha ~56) e adicionar a chamada de registro. O trecho atual:

```js
        found = true;
        _tunnelUrl = match[0];
        console.log('   Tunel ativo: ' + _tunnelUrl);
        console.log('   QR Code funciona em qualquer celular (dados moveis)');
        resolve();
```

Substituir por:

```js
        found = true;
        _tunnelUrl = match[0];
        console.log('   Tunel ativo: ' + _tunnelUrl);
        console.log('   QR Code funciona em qualquer celular (dados moveis)');
        registerWithWorker(_tunnelUrl);
        resolve();
```

- [ ] **Step 3: Registrar desregistro no evento de saída do processo cloudflared**

Localizar a linha do `proc.on('exit', ...)` (linha ~65):

```js
    proc.on('exit', () => { _tunnelUrl = null; });
```

Substituir por:

```js
    proc.on('exit', () => { _tunnelUrl = null; deregisterFromWorker(); });
```

- [ ] **Step 4: Fazer o mesmo para localtunnel — registrar URL**

Localizar em `startLocaltunnel` onde `_tunnelUrl` é definido (linha ~81):

```js
    _tunnelUrl = tunnel.url;
    console.log('   Localtunnel ativo: ' + _tunnelUrl);
    console.log('   Aviso: exige senha no 1o acesso. Acesse loca.lt/mytunnelpassword');
    tunnel.on('close', () => { _tunnelUrl = null; });
    tunnel.on('error', () => { _tunnelUrl = null; });
```

Substituir por:

```js
    _tunnelUrl = tunnel.url;
    console.log('   Localtunnel ativo: ' + _tunnelUrl);
    console.log('   Aviso: exige senha no 1o acesso. Acesse loca.lt/mytunnelpassword');
    registerWithWorker(_tunnelUrl);
    tunnel.on('close', () => { _tunnelUrl = null; deregisterFromWorker(); });
    tunnel.on('error', () => { _tunnelUrl = null; deregisterFromWorker(); });
```

- [ ] **Step 5: Verificar sintaxe**

```bash
node --input-type=module -e "import './server/tunnel.js'" 2>&1 | head -5
```

Esperado: sem erro de sintaxe.

- [ ] **Step 6: Commit**

```bash
git add server/tunnel.js
git commit -m "feat: register/deregister tunnel URL with Cloudflare Worker on start/stop"
```

---

## Task 7: Modificar server/index.js

**Files:**
- Modify: `server/index.js`

Duas mudanças: (1) carregar dotenv + chamar setup na inicialização; (2) priorizar Worker URL no endpoint `/api/public-url`.

- [ ] **Step 1: Adicionar import do dotenv e setup no topo de `server/index.js`**

Localizar o trecho exato (linhas 1–10):

```js
// server/index.js — Empório Pires API Server
// Roda no PC e serve todos os dispositivos na mesma rede WiFi

import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { startTunnel, getTunnelUrl } from './tunnel.js';
```

Substituir por:

```js
// server/index.js — Empório Pires API Server
// Roda no PC e serve todos os dispositivos na mesma rede WiFi

import 'dotenv/config';
import { ensureWorkerConfig } from './setup.js';
ensureWorkerConfig();

import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { startTunnel, getTunnelUrl } from './tunnel.js';
```

- [ ] **Step 2: Atualizar endpoint `/api/public-url`**

Localizar o trecho exato (inclui comentário e variável não utilizada que devem ser preservados):

```js
// ── URL pública do túnel (localtunnel ou cloudflare) ─────────────────────────
let publicTunnelUrl = null;

app.get('/api/public-url', (req, res) => {
  // 1. Tenta localtunnel (em memória)
  const tunnelUrl = getTunnelUrl();
  if (tunnelUrl) return res.json({ url: tunnelUrl });

  // 2. Tenta cloudflare.log (legado)
  const logFile = join(__dirname, '..', 'cloudflare.log');
  if (existsSync(logFile)) {
    try {
      const content = readFileSync(logFile, 'utf8');
      const match = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) return res.json({ url: match[0] });
    } catch { /* ignora */ }
  }

  res.json({ url: null });
});
```

Substituir por:

```js
// ── URL pública do túnel (localtunnel ou cloudflare) ─────────────────────────

app.get('/api/public-url', (req, res) => {
  // 1. Worker URL permanente (se configurado) — strip trailing slash para evitar /menu/menu
  const workerUrl = (process.env.WORKER_URL || '').replace(/\/$/, '');
  if (workerUrl) return res.json({ url: workerUrl });

  // 2. URL do tunnel em memória
  const tunnelUrl = getTunnelUrl();
  if (tunnelUrl) return res.json({ url: tunnelUrl });

  // 3. Legado: cloudflare.log
  const logFile = join(__dirname, '..', 'cloudflare.log');
  if (existsSync(logFile)) {
    try {
      const content = readFileSync(logFile, 'utf8');
      const match = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) return res.json({ url: match[0] });
    } catch { /* ignora */ }
  }

  res.json({ url: null });
});
```

> **Nota:** `let publicTunnelUrl = null;` foi removido pois nunca foi utilizado no código original.

- [ ] **Step 3: Verificar que o servidor inicia sem erros**

```bash
cd "C:\Users\User\Downloads\able-smart-bar-flow"
node server/index.js
```

Esperado no console:
- Mensagem de setup do Worker (primeira execução, `.env` criado)
- `🍺 Empório Pires Server iniciado!`
- Sem crashes

Pressionar `Ctrl+C` para encerrar após verificar.

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: load dotenv and prioritize Worker URL in /api/public-url"
```

---

## Task 8: Verificação end-to-end (sem Worker deployado)

Verificar que o sistema funciona em modo de degradação graciosa antes do setup do Worker.

- [ ] **Step 1: Iniciar o servidor completo**

```bash
npm start
```

- [ ] **Step 2: Verificar endpoint `/api/public-url`**

Em outro terminal:

```bash
curl http://localhost:3001/api/public-url
```

Esperado (sem Worker configurado): `{"url":"https://ALGO.trycloudflare.com"}` ou `{"url":null}` se sem internet.

- [ ] **Step 3: Verificar QR Code na interface**

Abrir `http://localhost:5173/QRCodes` no browser.

Esperado: página de QR codes carrega normalmente.

- [ ] **Step 4: Verificar que .env foi criado**

```bash
cat .env
```

Esperado: arquivo com `WORKER_URL=` (vazio) e `WORKER_SECRET=algum-uuid`.

- [ ] **Step 5: Encerrar e commit final**

```bash
git add -A
git status
```

Verificar que `.env` NÃO aparece nos arquivos staged (já está no .gitignore).

```bash
git commit -m "feat: complete Cloudflare Workers URL Broker implementation"
```

---

## Task 9: Setup do Worker (feito pelo operador — uma única vez)

> Esta task é executada manualmente pelo operador, não pelo agente. Registrada aqui como checklist de referência.

- [ ] Criar conta gratuita em `cloudflare.com`
- [ ] `npm install -g wrangler`
- [ ] `wrangler login` (abre browser para autenticar)
- [ ] `wrangler kv:namespace create TUNNEL_URL` — copiar o `id` retornado
- [ ] Editar `worker/wrangler.toml`: substituir `COLE_O_ID_AQUI` pelo ID real (ambas as ocorrências)
- [ ] `cd worker && wrangler deploy` — anotar a URL exibida (ex: `https://cardapio-emporiopires.SEU-NOME.workers.dev`)
- [ ] `wrangler secret put WORKER_SECRET` — colar o valor de `WORKER_SECRET` que está no `.env`
- [ ] Editar `.env`: preencher `WORKER_URL=https://cardapio-emporiopires.SEU-NOME.workers.dev`
- [ ] Reiniciar o servidor: `npm start`
- [ ] Verificar: `curl http://localhost:3001/api/public-url` → deve retornar a URL do Worker
- [ ] Verificar: abrir a URL do Worker no celular com dados móveis → cardápio deve carregar
- [ ] Imprimir novo QR code em `/QRCodes` — este nunca mais precisará ser reimpresso

---

## Critérios de Sucesso

- [ ] QR code impresso hoje funciona amanhã após restart do servidor
- [ ] Clientes acessam o cardápio sem estar na mesma rede WiFi
- [ ] Nenhuma tela de senha ou verificação intermediária
- [ ] Worker retorna `503` amigável quando servidor está offline
- [ ] Sistema funciona normalmente sem Worker configurado (degradação graciosa)
- [ ] `POST /register` rejeita URLs fora do padrão `trycloudflare.com`
- [ ] `DELETE /register` é chamado ao encerrar o servidor
