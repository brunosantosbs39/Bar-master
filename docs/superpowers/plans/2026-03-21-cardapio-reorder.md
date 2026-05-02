# Reordenação de Categorias e Produtos no Cardápio — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drag & drop para reordenar categorias e produtos no painel admin do Cardápio, com persistência no servidor.

**Architecture:** `@hello-pangea/dnd` (já instalado) gerencia o DnD. A ordem de categorias é salva em `settings.category_order`. A ordem de produtos é salva via campo `sort_order` em cada produto. Rollback otimista via `queryClient.setQueryData` em caso de erro.

**Tech Stack:** React 18, @hello-pangea/dnd ^17, @tanstack/react-query ^5, react-hot-toast, express local server.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `src/lib/categories.js` | Criar | Fonte única de `BUILTIN_CATEGORIES` (shape canônico) |
| `src/pages/Cardapio.jsx` | Modificar | DnD context, category order state, drag handlers |
| `src/components/CategoriesManager.jsx` | Modificar | Importar de lib/categories; sincronizar category_order ao criar/deletar |
| `src/hooks/useProducts.js` | Modificar | Adicionar `useReorderProducts` (saves sequenciais) |

`src/hooks/useSettings.js` — **sem modificações** (já tem `useSettings` e `useUpdateSettings`).

---

## Task 1: Extrair BUILTIN_CATEGORIES para módulo compartilhado

**Files:**
- Create: `src/lib/categories.js`
- Modify: `src/pages/Cardapio.jsx` (linhas 3, 14-25 — remover definição local, adicionar import)
- Modify: `src/components/CategoriesManager.jsx` (linhas 12-23 — remover definição local, adicionar import)

- [ ] **Passo 1: Criar src/lib/categories.js**

```js
// src/lib/categories.js
// Fonte única de BUILTIN_CATEGORIES — importar daqui em vez de definir localmente.
// Shape canônico inclui emoji e builtin:true usados pelo CategoriesManager.
export const BUILTIN_CATEGORIES = [
  { value: 'cervejas',      label: '🍺 Cervejas',        emoji: '🍺', print_dept: 'bar',     builtin: true },
  { value: 'destilados',    label: '🥃 Destilados',       emoji: '🥃', print_dept: 'bar',     builtin: true },
  { value: 'drinks',        label: '🍹 Drinks',           emoji: '🍹', print_dept: 'bar',     builtin: true },
  { value: 'vinhos',        label: '🍷 Vinhos',           emoji: '🍷', print_dept: 'bar',     builtin: true },
  { value: 'nao_alcoolicos',label: '🥤 Não Alcoólicos',  emoji: '🥤', print_dept: 'bar',     builtin: true },
  { value: 'bebidas',       label: '🧃 Bebidas',          emoji: '🧃', print_dept: 'bar',     builtin: true },
  { value: 'petiscos',      label: '🍟 Petiscos',         emoji: '🍟', print_dept: 'cozinha', builtin: true },
  { value: 'porcoes',       label: '🍖 Porções',          emoji: '🍖', print_dept: 'cozinha', builtin: true },
  { value: 'pratos',        label: '🍽️ Pratos',           emoji: '🍽️', print_dept: 'cozinha', builtin: true },
  { value: 'sobremesas',    label: '🍰 Sobremesas',       emoji: '🍰', print_dept: 'cozinha', builtin: true },
];
```

- [ ] **Passo 2: Substituir BUILTIN_CATEGORIES em Cardapio.jsx**

Remover as linhas 14–25 (o `const BUILTIN_CATEGORIES = [...]`) e substituir a importação no topo (linha 3) adicionando:

```js
import { BUILTIN_CATEGORIES } from '@/lib/categories';
```

O resto do arquivo não muda — `BUILTIN_CATEGORIES` já é usado com o mesmo nome.

- [ ] **Passo 3: Substituir BUILT_IN_CATEGORIES em CategoriesManager.jsx**

Remover as linhas 12–23 (o `const BUILT_IN_CATEGORIES = [...]`) e adicionar import no topo:

```js
import { BUILTIN_CATEGORIES } from '@/lib/categories';
```

Renomear todas as 3 ocorrências de `BUILT_IN_CATEGORIES` para `BUILTIN_CATEGORIES` no arquivo:
- Linha 41: `setForm({ ...emptyForm, order: custom.length + BUILTIN_CATEGORIES.length });`
- Linha 90: `{BUILTIN_CATEGORIES.map(c => (`

- [ ] **Passo 4: Verificar que o app ainda abre sem erros**

```bash
# No terminal do projeto (se o servidor já estiver rodando, só abrir o browser)
npm run dev
```

Abrir http://localhost:5173 → aba Cardápio → confirmar que categorias e CategoriesManager renderizam igual ao antes.

- [ ] **Passo 5: Commit**

```bash
git add src/lib/categories.js src/pages/Cardapio.jsx src/components/CategoriesManager.jsx
git commit -m "refactor: extract BUILTIN_CATEGORIES to src/lib/categories.js"
```

---

## Task 2: Adicionar useReorderProducts ao hook

**Files:**
- Modify: `src/hooks/useProducts.js`

- [ ] **Passo 1: Adicionar o hook no final de useProducts.js**

Adicionar após o export `useDeleteCategory` (linha 67), antes do final do arquivo:

```js
// Reordena produtos por sort_order — usa for sequencial (não Promise.all)
// porque o servidor salva em products.json com read-modify-write: chamadas
// concorrentes corrompem o arquivo por last-write-wins.
export function useReorderProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates) => {
      for (const { id, sort_order } of updates) {
        await localDB.entities.Product.update(id, { sort_order });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_KEY }),
  });
}
```

- [ ] **Passo 2: Verificar que o hook exporta sem erro de sintaxe**

```bash
node --input-type=module --eval "import('./src/hooks/useProducts.js')" 2>&1 || true
```

Se o projeto usa Vite e não Node direto, apenas salvar e confirmar que o browser não mostra erro de módulo.

- [ ] **Passo 3: Commit**

```bash
git add src/hooks/useProducts.js
git commit -m "feat: add useReorderProducts hook with sequential saves"
```

---

## Task 3: Lógica de category_order em Cardapio.jsx

Neste task adicionamos o estado e a lógica de ordenação de categorias, sem ainda adicionar o DnD visual. O objetivo é que `allCategories` já respeite a ordem salva em settings.

**Files:**
- Modify: `src/pages/Cardapio.jsx`

- [ ] **Passo 1: Adicionar imports necessários**

No topo de Cardapio.jsx, adicionar às importações existentes:

```js
import { useEffect, useMemo } from 'react'; // adicionar useEffect e useMemo ao import do react (useState e useRef já existem)
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useReorderProducts } from '@/hooks/useProducts';
import toast from 'react-hot-toast';
```

Nota: `useState` e `useRef` já são importados na linha 1 — apenas adicionar `useEffect` e `useMemo` ao mesmo import.

- [ ] **Passo 2: Adicionar hooks e derivar allCategories ordenado**

Dentro do componente `Cardapio()`, após as declarações de hooks existentes (após linha 47), adicionar:

```js
const { data: settings, isLoading: settingsLoading } = useSettings();
const updateSettings = useUpdateSettings();
const reorderProducts = useReorderProducts();

// Derivar allCategories respeitando category_order do settings
const allCategories = useMemo(() => {
  const customActive = customCategories
    .filter(c => c.active)
    .map(c => ({
      value: c.value,
      label: `${c.emoji || '🏷️'} ${c.label}`,
      print_dept: c.print_dept || 'bar',
    }));

  const base = [
    ...BUILTIN_CATEGORIES.map(c => ({ value: c.value, label: c.label, print_dept: c.print_dept })),
    ...customActive,
  ];

  if (!settings?.category_order) return base;

  const baseValues = base.map(c => c.value);
  // Filtrar stale values (categorias que foram deletadas)
  const validOrder = settings.category_order.filter(v => baseValues.includes(v));
  // Adicionar ao final categorias novas que ainda não estão na order salva
  const missing = baseValues.filter(v => !validOrder.includes(v));
  const finalOrder = [...validOrder, ...missing];
  return finalOrder.map(v => base.find(c => c.value === v)).filter(Boolean);
}, [settings, customCategories]);
```

- [ ] **Passo 3: Remover a definição antiga de allCategories**

Remover as linhas 49–58 do Cardapio.jsx original (o `const allCategories = [...]`), pois agora é gerado pelo `useMemo` acima.

- [ ] **Passo 4: Inicializar category_order no settings quando ainda não existir**

Adicionar após o `useMemo`, ainda dentro do componente. O `useRef` garante que a mutação dispara no máximo uma vez por montagem do componente, evitando múltiplos disparos durante o ciclo async de resolução das queries:

```js
// Guard para disparar a inicialização apenas uma vez
const categoryOrderInitialized = useRef(false);

// Inicializar category_order no settings se ainda não existir.
// Aguarda ambas as queries resolverem para não perder categorias custom.
useEffect(() => {
  if (settingsLoading || loading) return;
  if (categoryOrderInitialized.current) return;
  if (settings && !settings.category_order && allCategories.length > 0) {
    categoryOrderInitialized.current = true;
    const initialOrder = allCategories.map(c => c.value);
    updateSettings.mutate({ category_order: initialOrder });
  }
}, [settingsLoading, loading, settings, allCategories]);
```

- [ ] **Passo 5: Verificar que a aba Produtos ainda renderiza corretamente**

```bash
npm run dev
```

Abrir Cardápio → aba Produtos → confirmar que os produtos aparecem agrupados por categoria como antes. Abrir DevTools Network → verificar que um PUT para /api/settings é disparado na primeira carga (inicializando category_order).

- [ ] **Passo 6: Commit**

```bash
git add src/pages/Cardapio.jsx
git commit -m "feat: derive allCategories from settings.category_order with stale-value filtering"
```

---

## Task 4: DnD visual — arrastar categorias

Agora adicionamos o drag & drop de categorias. Produtos ainda não são arrastáveis.

**Files:**
- Modify: `src/pages/Cardapio.jsx`

- [ ] **Passo 1: Adicionar import do hello-pangea/dnd**

```js
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
```

- [ ] **Passo 2: Adicionar estado canDrag e handler onDragEnd (só categorias por ora)**

Dentro do componente, após os outros estados:

```js
// canDrag: desabilita arrasto quando filtro ou busca estão ativos
const canDrag = search === '' && filterCat === 'all';

const handleDragEnd = (result) => {
  const { destination, source, type } = result;
  if (!destination) return;
  if (destination.droppableId === source.droppableId && destination.index === source.index) return;

  if (type === 'CATEGORY') {
    // Calcular nova ordem de categorias
    const currentOrder = allCategories.map(c => c.value);
    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(source.index, 1);
    newOrder.splice(destination.index, 0, moved);

    // Rollback otimista via queryClient
    const previousSettings = queryClient.getQueryData(['settings']);
    queryClient.setQueryData(['settings'], (old) => ({ ...old, category_order: newOrder }));

    updateSettings.mutate(
      { category_order: newOrder },
      {
        onError: () => {
          queryClient.setQueryData(['settings'], previousSettings);
          toast.error('Falha ao salvar ordem das categorias. Tente novamente.');
        },
      }
    );
  }
  // PRODUCT drag — Task 5
};
```

Adicionar import do queryClient (já existe via useQueryClient no hook, mas precisamos do objeto aqui):

```js
import { useQueryClient } from '@tanstack/react-query';
// ...dentro do componente:
const queryClient = useQueryClient();
```

- [ ] **Passo 3: Envolver a lista de categorias com DragDropContext + Droppable + Draggable**

Localizar o bloco que começa com `{loading ? (` (linha ~180 do original). Substituir o `Object.entries(grouped).map(...)` pelo código abaixo.

O `grouped` existente continua sendo usado para mapear chave → itens. A diferença é que agora usamos `allCategories` como ordem canônica e filtramos por `grouped`:

```jsx
{/* Aviso quando filtro está ativo */}
{!canDrag && (search !== '' || filterCat !== 'all') && (
  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
    <span>⠿</span> Limpe os filtros para reordenar
  </p>
)}

<DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="categories" type="CATEGORY" isDropDisabled={!canDrag}>
    {(provided) => (
      <div ref={provided.innerRef} {...provided.droppableProps}>
        {allCategories.map((cat, index) => {
          const catData = grouped[cat.value];
          if (!catData) return null; // categoria sem produtos visíveis
          return (
            <Draggable
              key={cat.value}
              draggableId={cat.value}
              index={index}
              isDragDisabled={!canDrag}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  className={`mb-8 ${snapshot.isDragging ? 'opacity-70' : ''}`}
                >
                  {/* Header da categoria */}
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    {canDrag && (
                      <span
                        {...provided.dragHandleProps}
                        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none"
                        title="Arrastar para reordenar"
                      >
                        ⠿
                      </span>
                    )}
                    {catData.label} <span className="text-xs font-normal">({catData.items.length})</span>
                  </h2>

                  {/* Produtos — por ora sem drag, Task 5 vai adicionar */}
                  <div className="space-y-2">
                    <AnimatePresence>
                      {catData.items.map((p, i) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${
                            p.available ? 'border-border' : 'border-border opacity-50'
                          }`}
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 text-xl">
                              {allCategories.find(c => c.value === p.category)?.label?.split(' ')[0] || '🍽️'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground truncate">{p.name}</span>
                              {!p.available && <Badge variant="outline" className="text-xs text-muted-foreground border-border">Indisponível</Badge>}
                              {p.code && <span className="text-xs text-muted-foreground">#{p.code}</span>}
                              {p.print_dept === 'bar' && <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">🍺 Bar</span>}
                              {p.print_dept === 'cozinha' && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full">🍳 Cozinha</span>}
                              {p.print_dept === 'nenhum' && <span className="text-[10px] bg-secondary text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">🚫 Sem impressão</span>}
                            </div>
                            {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-primary text-sm whitespace-nowrap">R$ {p.price.toFixed(2)}</span>
                            <button onClick={() => toggleAvailable(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {p.available ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                            <button onClick={() => openEdit(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </Draggable>
          );
        })}
        {provided.placeholder}
      </div>
    )}
  </Droppable>
</DragDropContext>
```

Também remover o `Object.entries(grouped).map(...)` original que foi substituído.

- [ ] **Passo 4: Verificar drag de categoria no browser**

```bash
npm run dev
```

1. Abrir Cardápio → aba Produtos (sem filtros)
2. Verificar que o handle ⠿ aparece ao lado do nome da categoria
3. Arrastar uma categoria para outra posição → deve mover visualmente
4. Recarregar a página → a nova ordem deve persistir (settings.category_order foi salvo)
5. Ativar um filtro → confirmar que o handle some e a mensagem "Limpe os filtros" aparece

- [ ] **Passo 5: Commit**

```bash
git add src/pages/Cardapio.jsx
git commit -m "feat: drag & drop to reorder categories in Cardápio"
```

---

## Task 5: DnD visual — arrastar produtos

**Files:**
- Modify: `src/pages/Cardapio.jsx`

- [ ] **Passo 1: Derivar produtos ordenados por sort_order**

No bloco do `grouped` (linha ~115 do original):

```js
const grouped = allCategories.reduce((acc, cat) => {
  const catItems = filtered.filter(p => p.category === cat.value);
  // Produtos com sort_order definido vêm ordenados; sem sort_order mantêm posição original (índice).
  const items = catItems.slice().sort((a, b) => {
    const ai = a.sort_order != null ? a.sort_order : catItems.indexOf(a) + 10000;
    const bi = b.sort_order != null ? b.sort_order : catItems.indexOf(b) + 10000;
    return ai - bi;
  });
  if (items.length) acc[cat.value] = { label: cat.label, items };
  return acc;
}, {});
```

Nota: produtos sem `sort_order` (todos os existentes no primeiro uso) mantêm a ordem original do servidor. Após o primeiro drag dentro de uma categoria, todos os seus produtos recebem `sort_order` (0,1,2...) e passam a usar o campo persistido.

- [ ] **Passo 2: Remover AnimatePresence e motion.div dos produtos**

`@hello-pangea/dnd` controla o DOM diretamente durante o drag. O `AnimatePresence` + `motion.div` do framer-motion no wrapper de produtos conflita com isso. Remover antes de adicionar `Draggable`:

No trecho de produtos, substituir `<AnimatePresence>` e `motion.div` por `<>` e `div` simples. Remover o import de `AnimatePresence` do topo do arquivo **somente se não for usado em outro lugar no arquivo** (verificar antes).

Estrutura resultante (antes de adicionar Draggable, só para confirmar sem erros):
```jsx
<div className="space-y-2">
  {catData.items.map((p, i) => (
    <div
      key={p.id}
      className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${
        p.available ? 'border-border' : 'border-border opacity-50'
      }`}
    >
      {/* ... conteúdo do produto igual ao anterior ... */}
    </div>
  ))}
</div>
```

- [ ] **Passo 2: Adicionar handler de produto ao handleDragEnd**

No `handleDragEnd` já criado, preencher o bloco `// PRODUCT drag — Task 5`:

```js
if (type === 'PRODUCT') {
  const catKey = source.droppableId;
  const catItems = grouped[catKey]?.items ?? [];
  if (!catItems.length) return;

  // Reordenar array localmente
  const newItems = [...catItems];
  const [moved] = newItems.splice(source.index, 1);
  newItems.splice(destination.index, 0, moved);

  // Calcular updates de sort_order (0-based)
  const updates = newItems.map((p, i) => ({ id: p.id, sort_order: i }));

  // Rollback otimista no cache de products
  const productsQueryKey = ['products', {}];
  const previousProducts = queryClient.getQueryData(productsQueryKey);
  queryClient.setQueryData(productsQueryKey, (old) => {
    if (!Array.isArray(old)) return old;
    return old.map(p => {
      const upd = updates.find(u => u.id === p.id);
      return upd ? { ...p, sort_order: upd.sort_order } : p;
    });
  });

  reorderProducts.mutate(updates, {
    onError: () => {
      queryClient.setQueryData(productsQueryKey, previousProducts);
      toast.error('Falha ao salvar ordem dos produtos. Tente novamente.');
    },
  });
}
```

- [ ] **Passo 3: Substituir lista de produtos estática por Droppable+Draggable**

Dentro do `Draggable` de categoria (Task 4), substituir o bloco `<div className="space-y-2">` pelo seguinte:

```jsx
<Droppable droppableId={cat.value} type="PRODUCT" isDropDisabled={!canDrag}>
  {(prodProvided) => (
    <div
      ref={prodProvided.innerRef}
      {...prodProvided.droppableProps}
      className="space-y-2"
    >
      {catData.items.map((p, i) => (
        <Draggable
          key={p.id}
          draggableId={p.id}
          index={i}
          isDragDisabled={!canDrag}
        >
          {(prodDraggable, prodSnapshot) => (
            <div
              ref={prodDraggable.innerRef}
              {...prodDraggable.draggableProps}
              className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${
                p.available ? 'border-border' : 'border-border opacity-50'
              } ${prodSnapshot.isDragging ? 'shadow-lg ring-1 ring-primary/30' : ''}`}
            >
              {/* Handle de arrasto do produto */}
              {canDrag && (
                <span
                  {...prodDraggable.dragHandleProps}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none flex-shrink-0 text-base"
                  title="Arrastar para reordenar"
                >
                  ⠿
                </span>
              )}

              {/* Imagem ou emoji */}
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 text-xl">
                  {allCategories.find(c => c.value === p.category)?.label?.split(' ')[0] || '🍽️'}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{p.name}</span>
                  {!p.available && <Badge variant="outline" className="text-xs text-muted-foreground border-border">Indisponível</Badge>}
                  {p.code && <span className="text-xs text-muted-foreground">#{p.code}</span>}
                  {p.print_dept === 'bar' && <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">🍺 Bar</span>}
                  {p.print_dept === 'cozinha' && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full">🍳 Cozinha</span>}
                  {p.print_dept === 'nenhum' && <span className="text-[10px] bg-secondary text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">🚫 Sem impressão</span>}
                </div>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
              </div>

              {/* Ações */}
              <div className="flex items-center gap-3">
                <span className="font-bold text-primary text-sm whitespace-nowrap">R$ {p.price.toFixed(2)}</span>
                <button onClick={() => toggleAvailable(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {p.available ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => openEdit(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Draggable>
      ))}
      {prodProvided.placeholder}
    </div>
  )}
</Droppable>
```

O bloco `<AnimatePresence>` pode ser removido do wrapper de produtos (conflita com @hello-pangea/dnd que controla o DOM diretamente).

- [ ] **Passo 4: Verificar drag de produto no browser**

1. Abrir Cardápio → aba Produtos (sem filtros)
2. Confirmar que o handle ⠿ aparece à esquerda de cada produto
3. Arrastar um produto para outra posição dentro da mesma categoria
4. Recarregar a página → nova ordem deve persistir
5. Confirmar que não é possível arrastar produto para outra categoria

- [ ] **Passo 5: Commit**

```bash
git add src/pages/Cardapio.jsx
git commit -m "feat: drag & drop to reorder products within categories"
```

---

## Task 6: Sincronizar category_order ao criar/deletar categoria custom

**Files:**
- Modify: `src/components/CategoriesManager.jsx`

- [ ] **Passo 1: Adicionar imports necessários em CategoriesManager.jsx**

```js
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
```

- [ ] **Passo 2: Instanciar hooks de settings no componente**

Dentro de `CategoriesManager()`, após os hooks existentes:

```js
const { data: settings } = useSettings();
const updateSettings = useUpdateSettings();
```

- [ ] **Passo 3: Atualizar função save para adicionar nova categoria ao category_order**

Substituir o `save` existente (linhas 59–71) por:

```js
const save = async () => {
  const data = { ...form };
  if (!editing && !data.value) {
    data.value = generateSlug(data.label);
  }
  let result;
  if (editing) {
    result = await updateCategory.mutateAsync({ id: editing.id, data });
  } else {
    result = await createCategory.mutateAsync(data);
    // Adicionar nova categoria ao final de category_order
    if (settings?.category_order) {
      const newOrder = [...settings.category_order, data.value || result?.value];
      updateSettings.mutate({ category_order: newOrder });
    }
  }
  setShowForm(false);
  onCategoriesChange && onCategoriesChange();
};
```

- [ ] **Passo 4: Atualizar handleDelete para remover do category_order**

Substituir `handleDelete` existente (linhas 73–76) por:

```js
const handleDelete = async (id) => {
  const cat = custom.find(c => c.id === id);
  await deleteCategory.mutateAsync(id);
  // Remover categoria deletada do category_order
  if (cat && settings?.category_order) {
    const newOrder = settings.category_order.filter(v => v !== cat.value);
    updateSettings.mutate({ category_order: newOrder });
  }
  onCategoriesChange && onCategoriesChange();
};
```

- [ ] **Passo 5: Testar criar e deletar categoria**

1. Ir para Cardápio → aba Categorias
2. Criar uma nova categoria (ex: "Combos")
3. Ir para aba Produtos → nova categoria deve aparecer no final da lista
4. Reordenar a nova categoria via drag → deve persistir
5. Deletar a categoria → ela deve sumir da lista de categorias em Produtos

- [ ] **Passo 6: Commit**

```bash
git add src/components/CategoriesManager.jsx
git commit -m "feat: sync category_order in settings on category create/delete"
```

---

## Checklist Final de Verificação

Antes de considerar a feature completa, confirmar manualmente:

- [ ] Drag de categoria funciona (sem filtro ativo)
- [ ] Drag de produto funciona dentro da categoria (sem filtro ativo)
- [ ] Recarregar página → ordem persiste
- [ ] Filtro de busca ativo → handles somem, mensagem aparece
- [ ] Filtro de categoria ativo → handles somem, mensagem aparece
- [ ] Erro de rede simulado → toast de erro + rollback para ordem anterior
- [ ] Criar nova categoria → aparece no final da lista de produtos
- [ ] Deletar categoria custom → some da lista sem erro
- [ ] Menu público (`/menu/:id`) não foi afetado (abrir em outra aba e confirmar)
