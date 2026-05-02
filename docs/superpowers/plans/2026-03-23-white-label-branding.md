# White-Label Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o BarMaster white-label com nome, logo e banner configuráveis via painel de Configurações, aplicados em todo o app.

**Architecture:** Campos `bar_name`, `logo_url`, `banner_url` são adicionados ao settings existente. Um hook `useBranding()` centraliza os fallbacks e expõe os valores para todos os componentes. O servidor ganha um endpoint `POST /api/upload` (usando multer) que salva imagens em `public/` com timestamp para cache-busting.

**Tech Stack:** React 18, React Query (@tanstack/react-query), Express 5, multer (novo), react-hot-toast (para feedback)

**Nota sobre testes:** O projeto não possui infraestrutura de testes configurada. Cada task inclui passos de verificação manual no lugar de testes automatizados.

---

## Mapa de arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `src/lib/useBranding.js` | Hook que lê settings e retorna barName, logoUrl, bannerUrl com fallbacks |
| Modificar | `server/index.js` | Adicionar multer + endpoint POST /api/upload + corrigir log do comentário inicial |
| Modificar | `src/pages/Configuracoes.jsx` | Nova seção "Identidade do Estabelecimento" no topo |
| Modificar | `src/components/Layout.jsx` | Substituir "BarMaster" (header) e "Empório Pires" (sidebar) por barName |
| Modificar | `src/pages/AdminLogin.jsx` | Substituir "BarMaster" por barName |
| Modificar | `src/pages/GarcomLogin.jsx` | Substituir "BarMaster" por barName |
| Modificar | `src/pages/GarcomApp.jsx` | Substituir "Empório Pires" por barName |
| Modificar | `src/pages/MenuPublico.jsx` | Substituir banner hardcoded por bannerUrl |
| Modificar | `src/pages/QRCodes.jsx` | Substituir "Empório Pires" por barName no canvas e na UI |

---

## Task 1: Instalar multer e criar hook useBranding

**Files:**
- Create: `src/lib/useBranding.js`
- Run: `npm install multer` no projeto

---

- [ ] **Step 1: Instalar multer**

```bash
cd "C:\Users\User\Downloads\able-smart-bar-flow"
npm install multer
```

Saída esperada: `added 1 package` ou similar, sem erros.

- [ ] **Step 2: Criar o hook useBranding**

Criar `src/lib/useBranding.js`:

```js
import { useSettings } from '@/hooks/useSettings';

export function useBranding() {
  const { data: settings } = useSettings();
  return {
    barName:   settings?.bar_name   || 'BarMaster',
    logoUrl:   settings?.logo_url   || null,
    bannerUrl: settings?.banner_url || '/banner-emporiopires.webp',
  };
}
```

- [ ] **Step 3: Verificar que o arquivo foi criado corretamente**

Abrir `src/lib/useBranding.js` e confirmar que:
- importa de `@/hooks/useSettings`
- retorna os três campos com fallbacks

- [ ] **Step 4: Commit**

```bash
git add src/lib/useBranding.js package.json package-lock.json
git commit -m "feat: add multer dependency and useBranding hook"
```

---

## Task 2: Adicionar endpoint de upload no servidor

**Files:**
- Modify: `server/index.js` — adicionar import multer, configuração de storage, endpoint POST /api/upload, corrigir comentário inicial

---

- [ ] **Step 1: Adicionar imports de multer e fs no topo do server/index.js**

No `server/index.js`, a linha 1 atual é:
```js
// server/index.js — Empório Pires API Server
```

Linha 10 atual:
```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
```

Fazer duas edições:

**Edição 1 — corrigir comentário inicial:**

Substituir:
```
// server/index.js — Empório Pires API Server
// Roda no PC e serve todos os dispositivos na mesma rede WiFi
```
Por:
```
// server/index.js — BarMaster API Server
// Roda no PC e serve todos os dispositivos na mesma rede WiFi
```

**Edição 2 — adicionar imports:**

Substituir:
```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
```
Por:
```js
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import multer from 'multer';
```

- [ ] **Step 2: Configurar multer e adicionar endpoint de upload**

Após a linha `const DATA_DIR = join(__dirname, 'data');` (linha ~17), adicionar:

```js
const PUBLIC_DIR = join(__dirname, '../public');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });

// ── Upload de imagens (logo e banner) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'));
  },
});
```

- [ ] **Step 3: Registrar a rota POST /api/upload ANTES das rotas CRUD genéricas**

Adicionar logo antes do bloco `ENTITIES.forEach(...)` (linha ~66):

```js
// ── Upload de logo/banner ─────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  const { type } = req.body;
  if (!type || !['logo', 'banner'].includes(type)) {
    return res.status(400).json({ error: 'Parâmetro type deve ser "logo" ou "banner"' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo não enviado' });
  }

  // Remove arquivos anteriores do mesmo tipo
  try {
    const existing = readdirSync(PUBLIC_DIR).filter(f => f.startsWith(`${type}-cliente`));
    existing.forEach(f => unlinkSync(join(PUBLIC_DIR, f)));
  } catch { /* ignora se não houver */ }

  // Salva com timestamp para cache-busting
  const ext = extname(req.file.originalname) || (req.file.mimetype === 'image/webp' ? '.webp' : '.png');
  const filename = `${type}-cliente-${Date.now()}${ext}`;
  const filepath = join(PUBLIC_DIR, filename);
  writeFileSync(filepath, req.file.buffer);

  res.json({ url: `/${filename}` });
});

// Tratamento de erro do multer
app.use((err, _req, res, _next) => {
  if (err.message === 'Tipo de arquivo não permitido') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' });
  }
  res.status(500).json({ error: err.message });
});
```

- [ ] **Step 4: Verificar que o servidor inicia sem erros**

```bash
node server/index.js
```

Saída esperada: servidor rodando na porta 3001 sem erros.
Parar com Ctrl+C após confirmar.

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat: add POST /api/upload endpoint for logo and banner images"
```

---

## Task 3: Seção de branding em Configurações

**Files:**
- Modify: `src/pages/Configuracoes.jsx` — adicionar seção "Identidade do Estabelecimento" no início do return JSX

---

- [ ] **Step 1: Adicionar imports necessários no topo de Configuracoes.jsx**

Adicionar ao final dos imports existentes (após a linha com `import { useAuth } from '@/lib/AuthContext';`):

```js
import { useBranding } from '@/lib/useBranding';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import toast from 'react-hot-toast';
```

- [ ] **Step 2: Adicionar estado local de branding no componente Configuracoes**

Dentro da função `Configuracoes()`, logo após as declarações de estado existentes (após `const [importError, setImportError] = useState('');`), adicionar:

```js
const { barName, logoUrl, bannerUrl } = useBranding();
const { data: settings } = useSettings();
const updateSettings = useUpdateSettings();
const [brandName, setBrandName]       = useState('');
const [logoFile,  setLogoFile]        = useState(null);
const [logoPreview, setLogoPreview]   = useState(null);
const [bannerFile, setBannerFile]     = useState(null);
const [bannerPreview, setBannerPreview] = useState(null);
const [savingBrand, setSavingBrand]   = useState(false);

// Sincronizar campos com settings ao carregar
useEffect(() => {
  if (settings?.bar_name !== undefined) setBrandName(settings.bar_name || '');
}, [settings?.bar_name]);
```

- [ ] **Step 3: Adicionar função de salvar branding**

Após os handlers existentes (`handleReset`, `handleImport`, etc.), adicionar:

```js
const handleLogoChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setLogoFile(file);
  setLogoPreview(URL.createObjectURL(file));
};

const handleBannerChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setBannerFile(file);
  setBannerPreview(URL.createObjectURL(file));
};

const saveBranding = async () => {
  setSavingBrand(true);
  try {
    let newLogoUrl   = settings?.logo_url   || null;
    let newBannerUrl = settings?.banner_url || null;

    if (logoFile) {
      const fd = new FormData();
      fd.append('file', logoFile);
      fd.append('type', 'logo');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar logo');
      }
      const data = await res.json();
      newLogoUrl = data.url;
    }

    if (bannerFile) {
      const fd = new FormData();
      fd.append('file', bannerFile);
      fd.append('type', 'banner');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar banner');
      }
      const data = await res.json();
      newBannerUrl = data.url;
    }

    await updateSettings.mutateAsync({
      bar_name:   brandName.trim() || null,
      logo_url:   newLogoUrl,
      banner_url: newBannerUrl,
    });

    setLogoFile(null);
    setBannerFile(null);
    toast.success('Identidade atualizada!');
  } catch (err) {
    toast.error(err.message || 'Erro ao salvar');
  } finally {
    setSavingBrand(false);
  }
};
```

- [ ] **Step 4: Adicionar seção de branding no JSX**

No `return (...)`, logo após a `<div>` do cabeçalho (após o fechamento do `<div className="flex items-center gap-3 mb-6">`), adicionar a seção antes da seção de Garçons:

```jsx
{/* Identidade do Estabelecimento */}
<div className="rounded-xl border border-border bg-card overflow-hidden">
  <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
    <Beer className="w-4 h-4 text-muted-foreground" />
    <span className="font-semibold text-sm text-foreground">Identidade do Estabelecimento</span>
  </div>
  <div className="p-4 space-y-4">
    {/* Nome */}
    <div className="space-y-1.5">
      <Label htmlFor="brand-name" className="text-sm">Nome do estabelecimento</Label>
      <Input
        id="brand-name"
        value={brandName}
        onChange={e => setBrandName(e.target.value)}
        placeholder="Ex: Bar do João"
        className="max-w-sm"
      />
    </div>

    {/* Logo */}
    <div className="space-y-1.5">
      <Label className="text-sm">Logo</Label>
      <div className="flex items-center gap-3">
        {(logoPreview || logoUrl) && (
          <img
            src={logoPreview || logoUrl}
            alt="Logo"
            className="w-12 h-12 rounded-lg object-contain border border-border bg-background"
          />
        )}
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-secondary transition-colors">
            Escolher logo
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </label>
        <span className="text-xs text-muted-foreground">PNG, JPG ou SVG · máx 5MB</span>
      </div>
    </div>

    {/* Banner */}
    <div className="space-y-1.5">
      <Label className="text-sm">Banner do cardápio</Label>
      <div className="space-y-2">
        {(bannerPreview || bannerUrl) && (
          <img
            src={bannerPreview || bannerUrl}
            alt="Banner"
            className="w-full max-w-sm h-20 rounded-lg object-cover border border-border"
          />
        )}
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-secondary transition-colors">
            Escolher banner
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleBannerChange}
          />
        </label>
        <p className="text-xs text-muted-foreground">Recomendado: 1200×400px · JPG ou WEBP · máx 5MB</p>
      </div>
    </div>

    <Button
      onClick={saveBranding}
      disabled={savingBrand}
      size="sm"
      className="gap-1.5"
    >
      {savingBrand ? 'Salvando...' : 'Salvar identidade'}
    </Button>
  </div>
</div>
```

Obs: `Beer` já está importado no projeto (`lucide-react`). Confirmar se está no import de Configuracoes.jsx; se não estiver, adicionar ao import do lucide-react existente.

- [ ] **Step 5: Verificar que o app compila sem erros**

```bash
npm run dev
```

Navegar para `/Configuracoes`. A seção "Identidade do Estabelecimento" deve aparecer no topo.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Configuracoes.jsx
git commit -m "feat: add branding section to Configuracoes page"
```

---

## Task 4: Atualizar Layout.jsx

**Files:**
- Modify: `src/components/Layout.jsx`

---

- [ ] **Step 1: Importar useBranding no Layout**

No topo de `src/components/Layout.jsx`, após os imports existentes, adicionar:

```js
import { useBranding } from '@/lib/useBranding';
```

- [ ] **Step 2: Usar useBranding dentro do componente**

Dentro de `export default function Layout()`, logo após as declarações existentes (`const location`, `const { waiter }`, `const { canAccess, role, adminUser, logout }`), adicionar:

```js
const { barName } = useBranding();
```

- [ ] **Step 3: Substituir textos hardcoded**

**Substituição 1 — header (linha 59):**

Substituir:
```jsx
<span className="font-bold text-lg text-foreground tracking-tight">BarMaster</span>
```
Por:
```jsx
<span className="font-bold text-lg text-foreground tracking-tight">{barName}</span>
```

**Substituição 2 — sidebar desktop (linha 88):**

Substituir:
```jsx
<span className="font-bold text-base text-foreground tracking-tight block">Empório Pires</span>
```
Por:
```jsx
<span className="font-bold text-base text-foreground tracking-tight block">{barName}</span>
```

- [ ] **Step 4: Verificar no browser**

Com o app rodando, o nome no header e na sidebar deve refletir o valor salvo em Configurações (ou "BarMaster" como fallback).

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.jsx
git commit -m "feat: use barName from useBranding in Layout header and sidebar"
```

---

## Task 5: Atualizar telas de login e app do garçom

**Files:**
- Modify: `src/pages/AdminLogin.jsx`
- Modify: `src/pages/GarcomLogin.jsx`
- Modify: `src/pages/GarcomApp.jsx`

---

### AdminLogin.jsx

- [ ] **Step 1: Importar useBranding**

Adicionar import no topo:
```js
import { useBranding } from '@/lib/useBranding';
```

- [ ] **Step 2: Usar barName em SetupInicial e no login**

Localizar a função `SetupInicial` e a função principal de login. Em ambas, adicionar no corpo:
```js
const { barName } = useBranding();
```

**Substituição 1** (linha ~57 — tela de setup):
```jsx
<h1 className="text-2xl font-black text-foreground">Bem-vindo ao BarMaster!</h1>
```
→
```jsx
<h1 className="text-2xl font-black text-foreground">Bem-vindo ao {barName}!</h1>
```

**Substituição 2** (linha ~181 — tela de login):
```jsx
<h1 className="text-2xl font-black text-foreground">BarMaster</h1>
```
→
```jsx
<h1 className="text-2xl font-black text-foreground">{barName}</h1>
```

### GarcomLogin.jsx

- [ ] **Step 3: Importar useBranding e substituir texto**

Adicionar import:
```js
import { useBranding } from '@/lib/useBranding';
```

Adicionar dentro de `GarcomLogin()`:
```js
const { barName } = useBranding();
```

Substituir (linha ~45):
```jsx
<h1 className="text-2xl font-black text-foreground">BarMaster</h1>
```
→
```jsx
<h1 className="text-2xl font-black text-foreground">{barName}</h1>
```

### GarcomApp.jsx

- [ ] **Step 4: Importar useBranding e substituir texto**

Adicionar import:
```js
import { useBranding } from '@/lib/useBranding';
```

Adicionar dentro de `GarcomApp()` (ou do componente que renderiza o texto):
```js
const { barName } = useBranding();
```

Substituir (linha ~88):
```jsx
<p className="text-black font-black text-xl text-center">Empório Pires</p>
```
→
```jsx
<p className="text-black font-black text-xl text-center">{barName}</p>
```

- [ ] **Step 5: Verificar as três telas no browser**

- `/GarcomLogin` deve mostrar o nome configurado
- `/GarcomApp` deve mostrar o nome no QR code
- `/AdminLogin` (tela de setup e tela de login) deve mostrar o nome

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminLogin.jsx src/pages/GarcomLogin.jsx src/pages/GarcomApp.jsx
git commit -m "feat: replace hardcoded bar name in login and waiter screens"
```

---

## Task 6: Atualizar MenuPublico.jsx

**Files:**
- Modify: `src/pages/MenuPublico.jsx`

---

- [ ] **Step 1: Importar useBranding**

Adicionar import no topo:
```js
import { useBranding } from '@/lib/useBranding';
```

- [ ] **Step 2: Usar bannerUrl no componente**

Dentro do componente `MenuPublico`, adicionar:
```js
const { bannerUrl } = useBranding();
```

- [ ] **Step 3: Substituir o banner hardcoded**

Localizar (linha ~113):
```jsx
src="/banner-emporiopires.webp"
alt="Empório Pires"
```
Substituir por:
```jsx
src={bannerUrl}
alt="Banner do estabelecimento"
```

- [ ] **Step 4: Verificar no browser**

Acessar `/menu` (ou `/MenuPublico`). O banner deve aparecer normalmente. Após fazer upload de um novo banner em Configurações, ao recarregar o menu o novo banner deve aparecer.

- [ ] **Step 5: Commit**

```bash
git add src/pages/MenuPublico.jsx
git commit -m "feat: use dynamic bannerUrl from settings in MenuPublico"
```

---

## Task 7: Atualizar QRCodes.jsx

**Files:**
- Modify: `src/pages/QRCodes.jsx`

---

- [ ] **Step 1: Importar useBranding**

Adicionar import no topo:
```js
import { useBranding } from '@/lib/useBranding';
```

- [ ] **Step 2: Usar barName no componente**

Dentro do componente `QRCodes`, adicionar:
```js
const { barName } = useBranding();
```

- [ ] **Step 3: Substituir os textos hardcoded**

**Substituição 1 — canvas (linha ~26):**
```js
ctx.fillText('Empório Pires', 250, 490);
```
→
```js
ctx.fillText(barName, 250, 490);
```

**Substituição 2 — nome do arquivo para download (linha ~31):**
```js
a.download = 'qr-emporiopires.png';
```
→
```js
a.download = `qr-${barName.toLowerCase().replace(/\s+/g, '-')}.png`;
```

**Substituição 3 — texto na UI (linha ~64):**
```jsx
<p className="text-lg font-bold text-foreground">Empório Pires</p>
```
→
```jsx
<p className="text-lg font-bold text-foreground">{barName}</p>
```

Obs: A constante `MENU_URL` (linha ~5) é a URL de deployment específica do Empório Pires no Cloudflare Worker — **não alterar**, pois é configuração de infraestrutura fora do escopo do branding.

- [ ] **Step 4: Verificar no browser**

Acessar `/QRCodes`. O nome do estabelecimento deve aparecer abaixo do QR Code. Clicar em "Baixar" deve gerar um arquivo com o nome correto.

- [ ] **Step 5: Commit final**

```bash
git add src/pages/QRCodes.jsx
git commit -m "feat: use barName from settings in QRCodes canvas and UI"
```

---

## Verificação Final

- [ ] Abrir Configurações → preencher nome "Bar Teste", fazer upload de logo e banner → clicar Salvar
- [ ] Verificar que o nome "Bar Teste" aparece em: Layout (header e sidebar), AdminLogin, GarcomLogin, GarcomApp, QRCodes
- [ ] Verificar que o banner novo aparece em MenuPublico (`/menu`)
- [ ] Verificar que o Empório Pires, se os dados originais forem restaurados, continua funcionando normalmente
- [ ] Verificar que sem configuração preenchida, o app usa "BarMaster" como nome e o banner padrão
