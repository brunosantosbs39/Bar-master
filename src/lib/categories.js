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
