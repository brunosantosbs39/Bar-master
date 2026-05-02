# Melhorias do Cardápio Público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melhorar a exibição de descrições nos cards do cardápio e corrigir o modal de produto para suportar scroll interno em conteúdo longo.

**Architecture:** Mudanças puramente visuais em um único arquivo (`MenuPublico.jsx`). Nenhuma lógica de dados é alterada. Dois componentes são modificados: `ProductCard` (descrição com 2 linhas) e `ProductModal` (layout flex com scroll interno).

**Tech Stack:** React 18, Tailwind CSS, Framer Motion

---

## File Map

| Arquivo | Tipo | O que muda |
|---------|------|------------|
| `src/pages/MenuPublico.jsx` | Modify | `ProductCard` + `ProductModal` |

---

## Task 1: Descrição com 2 linhas no ProductCard

**Files:**
- Modify: `src/pages/MenuPublico.jsx` — componente `ProductCard` (linhas 221–263)

- [ ] **Step 1: Localizar o trecho exato no componente ProductCard**

No arquivo `src/pages/MenuPublico.jsx`, dentro de `function ProductCard`, encontrar:
```jsx
{product.description && (
  <p className="text-white/40 text-xs mt-1 line-clamp-1">{product.description}</p>
)}
```

- [ ] **Step 2: Aplicar a mudança**

Substituir por:
```jsx
{product.description && (
  <p className="text-white/50 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
)}
```

Mudanças:
- `line-clamp-1` → `line-clamp-2` — mostra até 2 linhas antes de truncar
- `text-white/40` → `text-white/50` — leve aumento de contraste
- adiciona `leading-relaxed` — espaçamento entre linhas mais confortável

- [ ] **Step 3: Verificar visualmente no browser**

Com o servidor rodando (`npm run dev`), abrir `http://localhost:5173/menu`.
Checar:
- Produtos **com** descrição longa mostram 2 linhas com `...` no final
- Produtos **com** descrição curta (< 1 linha) mostram normalmente sem truncamento
- Produtos **sem** descrição não mostram nenhum elemento extra
- Cards com 2 linhas de descrição ficam alinhados corretamente na grade de 2 colunas

- [ ] **Step 4: Commit**

```bash
git add src/pages/MenuPublico.jsx
git commit -m "feat: exibir descrição com 2 linhas nos cards do cardápio"
```

---

## Task 2: Modal com scroll interno (ProductModal)

**Files:**
- Modify: `src/pages/MenuPublico.jsx` — componente `ProductModal` (linhas 265–333)

- [ ] **Step 1: Localizar o motion.div principal do modal**

Encontrar o segundo `motion.div` dentro de `function ProductModal` (o que contém o conteúdo visível, não o overlay). Atual:
```jsx
<motion.div
  initial={{ opacity: 0, y: 60 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 60 }}
  transition={{ type: 'spring', damping: 28, stiffness: 400 }}
  className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[#111008] rounded-t-3xl z-50 overflow-hidden shadow-2xl"
>
```

- [ ] **Step 2: Remover overflow-hidden e adicionar max-h + flex**

Substituir a className do `motion.div`:
```jsx
<motion.div
  initial={{ opacity: 0, y: 60 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: 60 }}
  transition={{ type: 'spring', damping: 28, stiffness: 400 }}
  className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[#111008] rounded-t-3xl z-50 shadow-2xl max-h-[85vh] flex flex-col"
>
```

Mudanças:
- Remove `overflow-hidden` — necessário para que `overflow-y-auto` no filho funcione
- Adiciona `max-h-[85vh]` — limita altura a 85% da viewport
- Adiciona `flex flex-col` — habilita o layout flexível para separar imagem do conteúdo scrollável

- [ ] **Step 3: Adicionar flex-shrink-0 no container da imagem (variante com image_url)**

Encontrar o bloco condicional da imagem com `image_url`:
```jsx
{product.image_url ? (
  <div className="relative h-56 overflow-hidden">
```

Substituir por:
```jsx
{product.image_url ? (
  <div className="relative h-56 overflow-hidden flex-shrink-0">
```

- [ ] **Step 4: Adicionar flex-shrink-0 no container do emoji (variante sem imagem)**

Encontrar o bloco else (emoji fallback):
```jsx
) : (
  <div className="h-32 flex items-center justify-center text-6xl bg-gradient-to-br from-amber-950/50 to-transparent">
```

Substituir por:
```jsx
) : (
  <div className="h-32 flex items-center justify-center text-6xl bg-gradient-to-br from-amber-950/50 to-transparent flex-shrink-0">
```

- [ ] **Step 5: Tornar o div de conteúdo scrollável**

Encontrar:
```jsx
<div className="px-5 pb-8 pt-3">
```

Substituir por:
```jsx
<div className="px-5 pb-8 pt-3 overflow-y-auto flex-1">
```

Mudanças:
- `overflow-y-auto` — permite scroll quando conteúdo excede altura disponível
- `flex-1` — ocupa todo o espaço restante após a imagem

- [ ] **Step 6: Verificar visualmente no browser**

Abrir `http://localhost:5173/menu` e clicar em um produto.
Checar:
- Modal **com produto de descrição longa** — o conteúdo deve scrollar, imagem fica fixa no topo
- Modal **com produto sem imagem** — emoji fica fixo, conteúdo scrolla abaixo
- Modal **com produto simples** (nome curto + sem adicionais) — não mostra scrollbar desnecessária
- Modal **não ultrapassa** a borda superior da tela em nenhum caso
- Clicar fora do modal (no overlay escuro) ainda **fecha** o modal normalmente
- Animação de entrada/saída (spring slide) continua **suave**

- [ ] **Step 7: Commit**

```bash
git add src/pages/MenuPublico.jsx
git commit -m "fix: modal de produto com scroll interno e altura máxima responsiva"
```
