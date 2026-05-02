# Spec: White-Label Branding

**Data:** 2026-03-23
**Status:** Aprovado pelo usuário

---

## Objetivo

Tornar o BarMaster white-label para que possa ser personalizado por estabelecimento (nome, logo, banner) sem alterar o código-fonte. O cliente Empório Pires permanece com seus dados intactos.

---

## Requisitos

- **Nome do estabelecimento** configurável via painel
- **Logo** configurável via upload de imagem
- **Banner** configurável via upload de imagem
- Configuração feita pelo próprio dono do bar dentro do app (tela de Configurações)
- Branding aplicado em todo o app: painel de gestão, login, tela do garçom, cardápio público e QR Code
- Fallback seguro: se não configurado, usa valores padrão ("BarMaster", sem logo, banner do Empório Pires)

---

## Arquitetura

### 1. Dados (Settings)

Adicionar campos opcionais ao objeto de settings existente (nenhuma migração forçada — campos ausentes são tratados como null):

```json
{
  "bar_name": "string | null",
  "logo_url": "string | null",
  "banner_url": "string | null"
}
```

`bar_name` não existe atualmente em `server/data/settings.json` — será adicionado via Configurações. Sem conflito com campos existentes.

### 2. Hook `useBranding()`

**Arquivo:** `src/lib/useBranding.js`

Justificativa: centraliza os fallbacks em um único lugar. Sem o hook, cada componente precisaria replicar a lógica de fallback individualmente.

```js
export function useBranding() {
  const { data: settings } = useSettings();
  return {
    barName:   settings?.bar_name  || 'BarMaster',
    logoUrl:   settings?.logo_url  || null,
    bannerUrl: settings?.banner_url || '/banner-emporiopires.webp',
  };
}
```

A invalidação de cache já é tratada por `useUpdateSettings` (que chama `qc.invalidateQueries({ queryKey: SETTINGS_KEY })`). Como `useBranding` lê de `useSettings` (mesma query key), todas as telas recebem o novo valor automaticamente após salvar.

### 3. Endpoint de upload

**Dependência nova:** `multer` (middleware padrão do Express para multipart/form-data)

**Método:** `POST /api/upload`
**Auth:** Requer sessão autenticada (mesmo middleware de auth já usado nos outros endpoints do servidor)
**Body:** `multipart/form-data` com campos:
- `file` — arquivo de imagem
- `type` — `"logo"` ou `"banner"`

**Validações:**
- Tipos aceitos: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`
- Tamanho máximo: 5MB
- `type` deve ser `"logo"` ou `"banner"` — caso contrário, retorna 400

**Nome do arquivo com cache-busting:**
O arquivo é salvo com timestamp: `logo-{timestamp}.png` ou `banner-{timestamp}.webp`. Arquivos anteriores do mesmo tipo são removidos antes de salvar o novo.

**Retorno:** `{ url: "/logo-1711234567890.png" }`

### 4. Seção de branding em Configurações

**Localização:** Nova seção no topo de `src/pages/Configuracoes.jsx`
**Visibilidade:** Apenas para role `proprietario`
**Título:** "Identidade do Estabelecimento"

**Campos:**
- Input texto: Nome do estabelecimento (salva em `bar_name`)
- Upload com preview: Logo — recomendado quadrado, máx 5MB, PNG/JPG/SVG
- Upload com preview: Banner — recomendado 1200×400px, máx 5MB, JPG/WEBP

**Fluxo de salvar:**
1. Se houver arquivo de logo novo → POST `/api/upload?type=logo` → recebe `logo_url`
2. Se houver arquivo de banner novo → POST `/api/upload?type=banner` → recebe `banner_url`
3. `useUpdateSettings({ bar_name, logo_url, banner_url })`
4. Toast "Configurações salvas"

**Tratamento de erro:**
- Arquivo muito grande → toast de erro, não salva
- Tipo inválido → toast de erro, não salva
- Erro de rede → toast de erro, mantém valor anterior

---

## Componentes afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/useBranding.js` | **NOVO** — hook de branding |
| `src/pages/Configuracoes.jsx` | Nova seção "Identidade do Estabelecimento" |
| `src/components/Layout.jsx` | "BarMaster" e "Empório Pires" → `barName` |
| `src/pages/AdminLogin.jsx` | "BarMaster" → `barName` |
| `src/pages/GarcomLogin.jsx` | "BarMaster" → `barName` |
| `src/pages/GarcomApp.jsx` | "Empório Pires" → `barName` |
| `src/pages/MenuPublico.jsx` | banner hardcoded → `bannerUrl` |
| `src/pages/QRCodes.jsx` | "Empório Pires" no canvas → `barName` |
| `server/index.js` | Endpoint `/api/upload` + logs genéricos |

---

## O que NÃO muda

- `index.html` title permanece "BarMaster"
- Dados do Empório Pires em `server/data/` — intactos
- Imagens `public/banner-emporiopires.webp` e `public/qr-emporiopires.png` — mantidas como fallback
- Nenhuma funcionalidade operacional é alterada

---

## Critérios de aceitação

- [ ] Ao alterar o nome em Configurações, ele aparece em todas as telas sem recarregar a página
- [ ] Upload de logo funciona, preview aparece imediatamente, logo aparece no Layout e telas de login
- [ ] Upload de banner funciona, preview aparece imediatamente, banner aparece no MenuPublico
- [ ] QR Code usa o nome configurado ao gerar
- [ ] Segundo upload substitui o arquivo anterior (sem acúmulo em `/public/`)
- [ ] Empório Pires continua funcionando normalmente sem nenhuma alteração visual
- [ ] Se campos não forem preenchidos, app usa fallbacks sem erros
- [ ] Arquivos inválidos (tipo/tamanho) mostram erro e não salvam
