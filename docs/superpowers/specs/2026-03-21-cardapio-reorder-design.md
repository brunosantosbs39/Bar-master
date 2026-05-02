# Spec: Reordenação de Categorias e Produtos no Cardápio

**Data:** 2026-03-21
**Status:** Aprovado

---

## Resumo

Adicionar drag & drop para reordenar categorias inteiras e produtos dentro de cada categoria na tela de administração do Cardápio. A ordem é persistida no servidor e visível apenas no painel admin (não afeta o menu público).

---

## Requisitos

- Arrastar categorias (fixas + customizadas) para reordenar sua exibição
- Arrastar produtos dentro de uma categoria para reordenar sua exibição
- Não é possível mover produto entre categorias via drag (usa formulário de edição)
- Ordem persiste no servidor entre sessões e dispositivos
- Salvamento automático ao soltar (sem botão confirmar)
- Afeta apenas a visão admin — o menu público está fora do escopo desta feature (sort_order poderá ser usado no menu público em uma história futura, mas não nesta)

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Estilo de UI | Drag & Drop com handle ⠿ | Preferência do usuário (opção B) |
| Escopo | Categorias + produtos | Ambos precisam de organização |
| Persistência | Servidor | Robusto, multi-dispositivo |
| Visibilidade | Somente admin | Menu público fora do escopo |
| Drag com filtro ativo | Drag desabilitado | Filtro ativo = exibição parcial, reordenar seria confuso |
| Falha no save | Rollback otimista + toast de erro | Consistência UX em caso de erro de rede |

---

## Camada de Dados

### Campo `sort_order` em produtos

Adicionar campo `sort_order: number` em cada produto em `server/data/products.json`.

- **Migração:** ao inicializar, produtos sem `sort_order` recebem índice baseado na posição atual no array por categoria (feito no `server/seed.js` ou em runtime no primeiro load)
- Ao reordenar: recalcula `sort_order` (0, 1, 2...) de todos os produtos da categoria afetada e salva via `PUT /api/products/:id`
- Ao carregar: produtos são ordenados por `sort_order` ASC dentro de cada categoria

```json
{
  "id": "1773959414358-21tnmi3",
  "name": "Cerveja Antarctica 600ml",
  "category": "cervejas",
  "sort_order": 0
}
```

### Chave `category_order` em settings

Adicionar chave `category_order` no objeto de settings via `useUpdateSettings`.

- Valor: array ordenado com os `value` de todas as categorias (fixas + custom)
- **Inicialização:** ocorre dentro de `Cardapio.jsx` após ambas as queries (`useSettings` e `useCustomCategories`) resolverem. Só então, se `settings.category_order` não existir, é criado com a ordem padrão. Isso evita race condition de categorias custom não carregadas.
- **Categorias custom novas:** ao criar uma categoria custom, ela é adicionada ao final de `category_order` no settings
- **Categorias custom deletadas:** ao deletar uma categoria custom, seu `value` é removido de `category_order` no settings. Adicionalmente, ao carregar `category_order`, valores que não correspondem a nenhuma categoria existente (nem builtin nem custom ativa) são filtrados silenciosamente — proteção contra stale data
- Ao reordenar: salva o novo array via `useUpdateSettings({ category_order: [...] })`

```json
{
  "category_order": ["cervejas", "destilados", "drinks", "vinhos", "nao_alcoolicos", "petiscos", "porcoes", "pratos", "sobremesas", "pratos_executivos"]
}
```

---

## Refatoração necessária: `BUILTIN_CATEGORIES`

`Cardapio.jsx` define `BUILTIN_CATEGORIES` e `CategoriesManager.jsx` define `BUILT_IN_CATEGORIES` — dois arrays independentes com shapes ligeiramente diferentes (`CategoriesManager` inclui `emoji` e `builtin: true`). Ambos devem ser substituídos por uma única fonte de verdade.

**Novo arquivo:** `src/lib/categories.js`
```js
// Shape canônico — inclui todos os campos usados por Cardapio e CategoriesManager
export const BUILTIN_CATEGORIES = [
  { value: 'cervejas', label: '🍺 Cervejas', emoji: '🍺', print_dept: 'bar', builtin: true },
  { value: 'destilados', label: '🥃 Destilados', emoji: '🥃', print_dept: 'bar', builtin: true },
  { value: 'drinks', label: '🍹 Drinks', emoji: '🍹', print_dept: 'bar', builtin: true },
  { value: 'vinhos', label: '🍷 Vinhos', emoji: '🍷', print_dept: 'bar', builtin: true },
  { value: 'nao_alcoolicos', label: '🥤 Não Alcoólicos', emoji: '🥤', print_dept: 'bar', builtin: true },
  { value: 'bebidas', label: '🧃 Bebidas', emoji: '🧃', print_dept: 'bar', builtin: true },
  { value: 'petiscos', label: '🍟 Petiscos', emoji: '🍟', print_dept: 'cozinha', builtin: true },
  { value: 'porcoes', label: '🍖 Porções', emoji: '🍖', print_dept: 'cozinha', builtin: true },
  { value: 'pratos', label: '🍽️ Pratos', emoji: '🍽️', print_dept: 'cozinha', builtin: true },
  { value: 'sobremesas', label: '🍰 Sobremesas', emoji: '🍰', print_dept: 'cozinha', builtin: true },
];
```

Tanto `Cardapio.jsx` quanto `CategoriesManager.jsx` importam de `@/lib/categories`. Os campos extras (`emoji`, `builtin`) são ignorados onde não são usados.

---

## Componentes Afetados

### `src/lib/categories.js` (novo)
Extrai `BUILTIN_CATEGORIES` de `Cardapio.jsx` para ser importado em outros lugares.

### `src/pages/Cardapio.jsx`
- Instalar e usar `@dnd-kit/core` e `@dnd-kit/sortable`
- Importa `BUILTIN_CATEGORIES` de `@/lib/categories`
- Lógica de inicialização de `category_order`: aguarda `useSettings` + `useCustomCategories` resolverem antes de inicializar
- Envolver a lista de categorias em `DndContext` + `SortableContext` com `verticalListSortingStrategy`
- Cada categoria vira um `useSortable` item com handle ⠿ no header
- Cada produto vira um `useSortable` item com handle ⠿ à esquerda
- **Drag desabilitado quando `search !== ''` ou `filterCat !== 'all'`**: exibir aviso "Limpe os filtros para reordenar"
- `onDragEnd`: detectar se moveu categoria ou produto e chamar o handler correto
- Visual: item arrastado com `opacity: 0.4`, placeholder de mesma altura no destino

### `src/hooks/useProducts.js`
Adicionar hook `useReorderProducts`. As chamadas devem ser **sequenciais** (não paralelas) porque o servidor salva em `products.json` com read-modify-write — chamadas concorrentes ao mesmo arquivo causam corrupção por last-write-wins:
```js
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

### `src/hooks/useSettings.js` (existente — sem modificações)
Já exporta `useSettings` e `useUpdateSettings` com a interface necessária. Nenhuma mudança.

---

## Tratamento de Erros no Save

Estratégia: **rollback otimista**.

1. Ao soltar o drag, atualizar a ordem na UI imediatamente (otimista)
2. Disparar as chamadas `PUT` em paralelo
3. Se qualquer chamada falhar:
   - Reverter a UI para a ordem anterior (mantida em uma variável `previousOrder`)
   - Exibir toast de erro: "Falha ao salvar ordem. Tente novamente."
4. Se todas tiverem sucesso: invalidar query (confirmar estado do servidor)

---

## Drag com Filtro Ativo

Quando `search !== ''` ou `filterCat !== 'all'`:
- Handles ⠿ ficam ocultos ou desabilitados (cursor `not-allowed`)
- Exibir mensagem contextual ao tentar arrastar: "Limpe os filtros para reordenar"
- Sem conflito com `sort_order`: o drag só atua na lista completa

---

## Fluxo de Interação

### Reordenar categoria
1. Usuário segura handle ⠿ no header da categoria (sem filtros ativos)
2. Arrasta para nova posição
3. UI atualiza otimisticamente
4. `useUpdateSettings({ category_order: [...] })` salva no servidor
5. Em caso de erro: rollback + toast

### Reordenar produto
1. Usuário segura handle ⠿ à esquerda do produto (sem filtros ativos)
2. Arrasta para nova posição dentro da mesma categoria
3. UI atualiza otimisticamente
4. `sort_order` dos produtos da categoria é recalculado (0, 1, 2...) e salvo em paralelo
5. Em caso de erro: rollback + toast

---

## Biblioteca: dnd-kit

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- `@dnd-kit/core` — DndContext, DragOverlay, sensors
- `@dnd-kit/sortable` — useSortable, SortableContext, verticalListSortingStrategy
- `@dnd-kit/utilities` — CSS.Transform helper

Escolha sobre react-beautiful-dnd: dnd-kit é mais moderno, suporta React 18+, sem dependências deprecated e suporta listas aninhadas.

---

## Fora de Escopo

- Mover produto entre categorias via drag (usa formulário de edição)
- Reordenação no menu público (possível feature futura usando o campo `sort_order` já adicionado)
- Persistência em localStorage
- Otimização de performance mobile (touch funciona nativamente no dnd-kit)
