# Spec: Cloudflare Workers como URL Broker para Cardápio Público

**Data:** 2026-03-20
**Status:** Aprovado
**Contexto:** able-smart-bar-flow (BarMaster / Empório Pires)

---

## Problema

O cardápio público (`/menu`) é acessado via QR code por clientes fora da rede WiFi do estabelecimento. O sistema atual usa Cloudflare quick tunnel (`trycloudflare.com`) com fallback para `localtunnel`, mas apresenta três falhas críticas:

1. **URL muda a cada restart** — QR codes impressos ficam inválidos
2. **Tunnel às vezes não sobe** — instabilidade no processo `cloudflared.exe`
3. **Localtunnel exige senha** — clientes travam na tela de verificação

---

## Solução

Introduzir um **Cloudflare Worker gratuito** como camada de URL permanente. O Worker atua como "broker": possui uma URL fixa (`*.workers.dev`) que o QR code sempre aponta, e redireciona internamente para a URL atual do tunnel — que pode mudar sem impactar os clientes.

---

## Arquitetura

```
Cliente escaneia QR
        ↓
cardapio-emporiopires.SEU-NOME.workers.dev/menu   ← URL permanente
        ↓ (HTTP 302 redirect)
abc123.trycloudflare.com/menu                      ← URL atual do tunnel
        ↓
Servidor local Express (porta 3001) + Vite (porta 5173)
```

### Fluxo no startup

1. `cloudflared.exe` sobe e gera URL aleatória (ex: `abc123.trycloudflare.com`)
2. `server/tunnel.js` detecta a URL, chama `POST /register` no Worker com token secreto
3. Worker salva a nova URL no KV Storage
4. Qualquer acesso ao Worker a partir daí é redirecionado para a URL atual
5. `/api/public-url` retorna a URL permanente do Worker (não mais a URL aleatória)

---

## Componentes

### Novos arquivos

| Arquivo | Descrição |
|---|---|
| `worker/index.js` | Código do Cloudflare Worker |
| `worker/wrangler.toml` | Configuração de deploy do Worker |
| `.env` | Variáveis locais: WORKER_URL, WORKER_SECRET |
| `.env.example` | Template público das variáveis necessárias |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `server/tunnel.js` | Notifica Worker após obter URL do tunnel; retorna URL permanente |
| `server/index.js` | `/api/public-url` retorna URL do Worker quando disponível |
| `.gitignore` | Garantir que `.env` e `worker/.wrangler/` estão ignorados |
| `barmaster.bat` | Instrução de setup exibida na primeira execução se `.env` não existir |

---

## Worker: Endpoints

### `GET /menu`
- Lê `tunnel_url` do KV Storage
- Se encontrado: responde `302 Location: {tunnel_url}/menu`
- Se não encontrado: responde `503` com mensagem amigável

### `GET /`
- Lê `tunnel_url` do KV Storage
- Se encontrado: responde `302 Location: {tunnel_url}`
- Se não encontrado: responde `503`

### `POST /register`
- Valida header `Authorization: Bearer {WORKER_SECRET}`
- Body JSON: `{ "url": "https://abc123.trycloudflare.com" }`
- Salva URL no KV Storage com chave `tunnel_url`
- Responde `200 { "ok": true }`
- Sem token válido: responde `401`

### `GET /status`
- Retorna JSON com URL atual e timestamp da última atualização
- Usado para debug e health check

---

## Segurança

- `WORKER_SECRET` gerado automaticamente com `crypto.randomUUID()` na primeira execução
- Salvo em `.env` (gitignored) e como variável de ambiente no Worker via `wrangler secret put`
- Sem o token, o endpoint `/register` retorna `401` — ninguém consegue trocar a URL remotamente
- Endpoint `/status` é público (apenas leitura, sem dados sensíveis)

---

## KV Storage

- **Namespace:** `TUNNEL_URL`
- **Chave principal:** `tunnel_url` — valor: URL atual do tunnel
- **Chave auxiliar:** `tunnel_url_updated_at` — valor: timestamp ISO da última atualização
- **Free tier:** 100k leituras/dia, 1k escritas/dia — mais que suficiente
- TTL: sem expiração (URL persiste até próximo registro)

---

## Setup (executado uma única vez)

```bash
# Pré-requisito: Node.js instalado

# 1. Instalar Wrangler CLI
npm install -g wrangler

# 2. Autenticar com conta Cloudflare gratuita
wrangler login

# 3. Criar KV namespace e obter ID
wrangler kv:namespace create TUNNEL_URL

# 4. Atualizar wrangler.toml com o ID retornado

# 5. Deploy do Worker
cd worker && wrangler deploy

# 6. Configurar secret no Worker
wrangler secret put WORKER_SECRET
# (digitar o mesmo valor que está no .env local)
```

O `barmaster.bat` detecta se o setup já foi feito e exibe instruções na primeira execução.

---

## Modificações em `server/tunnel.js`

### Lógica atual (mantida)
- Tenta `cloudflared.exe` → fallback `localtunnel`
- Extrai URL do output do processo

### Lógica nova (adicionada após obter URL)
```
1. Lê WORKER_URL e WORKER_SECRET do process.env
2. Se ambos presentes: POST /register com URL atual
3. Se registro bem-sucedido: usa WORKER_URL como "public URL"
4. Se registro falha ou variáveis ausentes: usa URL do tunnel diretamente (comportamento atual)
```

Degradação graciosa: se o Worker não estiver configurado, o sistema funciona exatamente como antes.

---

## Modificações em `server/index.js`

### Endpoint `/api/public-url`
```
Ordem de prioridade:
1. WORKER_URL (se configurado no .env) → retorna URL permanente do Worker
2. URL do tunnel em memória → retorna URL aleatória atual (comportamento atual)
3. null → frontend usa fallback local
```

---

## Impacto em `useMenuUrl.js`

Sem alteração necessária. O hook já consome `/api/public-url` e usa o resultado para gerar a URL do QR code. Com o Worker configurado, `/api/public-url` passará a retornar a URL permanente automaticamente.

---

## Custo

| Recurso | Plano | Limite Free | Uso estimado |
|---|---|---|---|
| Cloudflare Workers | Free | 100k req/dia | ~500 req/dia |
| Workers KV Storage | Free | 100k leituras/dia, 1k escritas/dia | ~500 leituras, ~5 escritas/dia |
| Wrangler CLI | Free | — | — |

**Total: R$ 0,00**

---

## Critérios de Sucesso

- [ ] QR code impresso hoje funciona amanhã após restart do servidor
- [ ] Clientes acessam o cardápio sem precisar estar na mesma rede WiFi
- [ ] Nenhuma tela de senha ou verificação intermediária
- [ ] Sistema funciona normalmente se Worker não estiver configurado (degradação graciosa)
- [ ] Setup completo em menos de 15 minutos
