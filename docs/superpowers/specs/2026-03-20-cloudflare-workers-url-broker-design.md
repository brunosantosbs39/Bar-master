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
cardapio-emporiopires.SEU-NOME.workers.dev/menu   ← URL permanente (nunca muda)
        ↓ (HTTP 302 redirect)
abc123.trycloudflare.com/menu                      ← URL atual do tunnel
        ↓
Servidor local Express (porta 3001) + Vite (porta 5173)
```

**Constraint importante:** `/api/public-url` deve retornar a URL do Worker **sem trailing path** (ex: `https://cardapio-emporiopires.X.workers.dev`). O hook `useMenuUrl.js` já adiciona `/menu` ao final — retornar a URL com `/menu` já incluído causaria `/menu/menu`.

### Fluxo no startup

1. `cloudflared.exe` sobe e gera URL aleatória (ex: `abc123.trycloudflare.com`)
2. `server/tunnel.js` detecta a URL e chama `POST /register` no Worker com token secreto
   - **Retry:** até 3 tentativas com backoff de 2s entre cada uma
   - **Em caso de falha após retries:** log de aviso, sistema continua usando URL aleatória
3. Worker valida o token, valida o formato da URL e salva no KV Storage com TTL de 8 horas
4. Qualquer acesso ao Worker redireciona para a URL atual
5. `/api/public-url` retorna a URL permanente do Worker

### Fluxo no encerramento

Quando o processo `cloudflared` encerra (sinal de saída ou crash):
- `server/tunnel.js` chama `DELETE /register` no Worker para limpar a URL do KV
- Worker responde com `200` e remove a chave `tunnel_url`
- Acessos subsequentes ao Worker retornam `503` em vez de redirecionar para URL morta

---

## Componentes

### Novos arquivos

| Arquivo | Descrição |
|---|---|
| `worker/index.js` | Código do Cloudflare Worker |
| `worker/wrangler.toml` | Configuração de deploy do Worker |
| `.env` | Variáveis locais: WORKER_URL, WORKER_SECRET (gitignored) |
| `.env.example` | Template público das variáveis necessárias |
| `server/setup.js` | Script de primeiro uso: gera WORKER_SECRET, cria `.env`, exibe instruções |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `server/tunnel.js` | Notifica Worker após obter URL; retry com backoff; limpa KV ao encerrar |
| `server/index.js` | `/api/public-url` prioriza URL do Worker; carrega `.env` via dotenv |
| `.gitignore` | Garantir `.env` e `worker/.wrangler/` ignorados |

---

## Worker: Endpoints

### `GET /menu`
- Lê `tunnel_url` do KV Storage
- Se encontrado: responde `302 Location: {tunnel_url}/menu`
- Se não encontrado (servidor offline ou TTL expirado): responde `503` com HTML amigável: "O cardápio está temporariamente indisponível. Por favor, tente novamente em instantes."

### `GET /`
- Lê `tunnel_url` do KV Storage
- Se encontrado: responde `302 Location: {tunnel_url}`
- Se não encontrado: responde `503`

### `POST /register`
- Valida header `Authorization: Bearer {WORKER_SECRET}`
- Body JSON: `{ "url": "https://abc123.trycloudflare.com" }`
- **Validação da URL:** deve corresponder ao padrão `https://[a-z0-9-]+\.trycloudflare\.com` — rejeita com `400` se não corresponder
- Salva `tunnel_url` no KV com **TTL de 8 horas** (evita redirect para servidor offline após longa ausência)
- Salva `tunnel_url_updated_at` (timestamp ISO) no KV sem TTL
- Responde `200 { "ok": true, "url": "{url_registrada}" }`
- Token inválido: responde `401`
- URL inválida: responde `400 { "error": "URL inválida" }`

### `DELETE /register`
- Valida header `Authorization: Bearer {WORKER_SECRET}`
- Remove chave `tunnel_url` do KV Storage
- Responde `200 { "ok": true }`
- Token inválido: responde `401`

### `GET /status`
- **Requer autenticação:** header `Authorization: Bearer {WORKER_SECRET}`
- Retorna JSON: `{ "url": "...", "updated_at": "...", "active": true|false }`
- Token inválido: responde `401`
- Usado para debug e health check pelo operador

---

## Segurança

- `WORKER_SECRET` gerado por `server/setup.js` usando `crypto.randomUUID()` na **primeira execução de `npm start`** (quando `.env` não existe)
- `server/setup.js` escreve o secret em `.env` e exibe no console as instruções do próximo passo (configurar o Worker)
- Secret salvo em `.env` (gitignored) localmente e no Worker via `wrangler secret put WORKER_SECRET`
- `/register` e `/status` protegidos pelo mesmo token — nenhum endpoint sensível é público
- `POST /register` valida formato de URL para evitar injeção de URLs arbitrárias (apenas `trycloudflare.com` aceito)
- TTL de 8 horas no KV evita redirects para servidores offline após longa ausência

---

## KV Storage

- **Namespace:** `TUNNEL_URL`
- **Chave principal:** `tunnel_url` — valor: URL atual do tunnel, **TTL: 8 horas**
- **Chave auxiliar:** `tunnel_url_updated_at` — valor: timestamp ISO, sem TTL
- **Free tier:** 100k leituras/dia, 1k escritas/dia — mais que suficiente
- Quando TTL expira ou chave é deletada via `DELETE /register`: Worker retorna `503`

---

## `worker/wrangler.toml` — Estrutura esperada

```toml
name = "cardapio-emporiopires"
main = "index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "TUNNEL_URL"
id = "COLE_O_ID_AQUI"          # substituir após `wrangler kv:namespace create`
preview_id = "COLE_O_ID_AQUI"  # pode usar o mesmo ID para simplicidade
```

O arquivo `wrangler.toml` é **commitado com placeholder** (`COLE_O_ID_AQUI`). O desenvolvedor substitui o ID real após criar o namespace — o ID não é segredo.

---

## `server/setup.js` — Lógica de primeiro uso

Chamado por `server/index.js` na inicialização se `.env` não existir ou `WORKER_SECRET` não estiver definido:

```
1. Gerar secret: crypto.randomUUID()
2. Escrever .env com WORKER_URL="" e WORKER_SECRET="{gerado}"
3. Exibir no console:
   ====================================================
   SETUP NECESSÁRIO — Cloudflare Workers URL Broker
   ====================================================
   1. Crie uma conta gratuita em cloudflare.com
   2. Execute: npm install -g wrangler
   3. Execute: wrangler login
   4. Execute: wrangler kv:namespace create TUNNEL_URL
   5. Cole o ID retornado em worker/wrangler.toml
   6. Execute: cd worker && wrangler deploy
   7. Execute: wrangler secret put WORKER_SECRET
      (quando solicitado, cole: {secret_gerado})
   8. Edite .env e preencha WORKER_URL com a URL exibida pelo deploy
   ====================================================
   O servidor continuará funcionando sem o Worker até o setup ser concluído.
```

---

## Modificações em `server/tunnel.js`

### Lógica atual (mantida)
- Tenta `cloudflared.exe` → fallback `localtunnel`
- Extrai URL do output do processo

### Lógica nova — Registro no Worker (após obter URL)
```
1. Verificar: WORKER_URL e WORKER_SECRET definidos no process.env?
2. Se sim: POST /register com até 3 tentativas (backoff: 2s entre tentativas)
   - Sucesso: armazenar WORKER_URL como "public URL"
   - Falha após 3 tentativas: log "Worker não disponível, usando URL do tunnel diretamente"
3. Se não: pular (degradação graciosa — comportamento atual)
```

### Lógica nova — Limpeza ao encerrar (evento 'exit' do processo cloudflared)
```
1. Verificar: WORKER_URL e WORKER_SECRET definidos?
2. Se sim: DELETE /register (best-effort, sem retry — o processo está encerrando)
```

---

## Modificações em `server/index.js`

### Carregamento do `.env`
- Adicionar `require('dotenv').config()` ou equivalente no topo
- Instalar pacote `dotenv` como dependência

### Endpoint `/api/public-url`
```
Ordem de prioridade:
1. process.env.WORKER_URL (definido e não vazio) → retorna URL permanente do Worker (sem trailing slash)
2. _tunnelUrl em memória → retorna URL aleatória atual (comportamento atual)
3. null → frontend usa fallback local
```

---

## Impacto em `useMenuUrl.js`

Sem alteração necessária. O hook já consome `/api/public-url` e adiciona `/menu` ao construir a URL do QR code. O endpoint retornará a URL do Worker sem trailing path — o hook adicionará `/menu` corretamente.

---

## Degradação Graciosa

O sistema funciona em 3 modos sem nenhuma configuração especial:

| Modo | Condição | Comportamento |
|---|---|---|
| **Worker ativo** | `.env` configurado + Worker deployado | URL permanente, QR code nunca muda |
| **Tunnel direto** | `.env` ausente ou Worker falhou | URL aleatória por sessão (comportamento atual) |
| **Rede local** | Sem internet | QR code usa IP local da rede WiFi |

---

## Setup (executado uma única vez)

```bash
# Pré-requisito: Node.js instalado, conta Cloudflare criada em cloudflare.com

# 1. Instalar Wrangler CLI
npm install -g wrangler

# 2. Autenticar
wrangler login

# 3. Criar KV namespace — copiar o ID retornado
wrangler kv:namespace create TUNNEL_URL

# 4. Colar o ID em worker/wrangler.toml (campo "id" e "preview_id")

# 5. Deploy do Worker
cd worker && wrangler deploy
# Anotar a URL exibida: https://cardapio-emporiopires.SEU-NOME.workers.dev

# 6. Configurar secret no Worker
wrangler secret put WORKER_SECRET
# Digitar o valor gerado em .env (exibido no console na primeira execução de npm start)

# 7. Editar .env: preencher WORKER_URL com a URL do passo 5
```

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
- [ ] Worker retorna `503` amigável quando servidor está offline
- [ ] Sistema funciona normalmente se Worker não estiver configurado (degradação graciosa)
- [ ] Setup completo em menos de 15 minutos
- [ ] `POST /register` rejeita URLs fora do padrão `trycloudflare.com`
- [ ] `DELETE /register` limpa KV quando servidor encerra
