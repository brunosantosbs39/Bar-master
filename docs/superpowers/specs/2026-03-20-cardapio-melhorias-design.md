# Spec: Melhorias do Cardápio Público

**Data:** 2026-03-20
**Arquivo alvo:** `src/pages/MenuPublico.jsx`

---

## Objetivo

Melhorar a experiência visual do cardápio público em duas frentes:
1. Exibir descrição dos produtos com 2 linhas nos cards
2. Corrigir o modal de detalhe para suportar scroll interno (responsividade)

---

## Mudança 1 — Cards: descrição com 2 linhas

**Componente:** `ProductCard`

**Antes:**
```jsx
<p className="text-white/40 text-xs mt-1 line-clamp-1">{product.description}</p>
```

**Depois:**
```jsx
<p className="text-white/50 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
```

**Detalhes:**
- `line-clamp-1` → `line-clamp-2`: mostra até 2 linhas antes de truncar
- `text-white/40` → `text-white/50`: leve aumento de contraste
- `leading-relaxed`: espaçamento entre linhas mais confortável para leitura

---

## Mudança 2 — Modal: bottom sheet com scroll interno

**Componente:** `ProductModal`

**Problema atual:** o `motion.div` do modal não tem altura máxima nem scroll. Em produtos com descrição longa + muitos adicionais, o conteúdo ultrapassa a viewport.

**Solução:**
- No `motion.div` do modal: remover `overflow-hidden`, adicionar `max-h-[85vh] flex flex-col`
- Manter a imagem fora do scroll, com `flex-shrink-0` para não encolher
- Aplicar `overflow-y-auto flex-1` à div de conteúdo

**Variantes de imagem — ambas mantêm suas alturas atuais:**
- Com `image_url`: container `h-56 flex-shrink-0` (224px fixos)
- Sem `image_url` (emoji fallback): container `h-32 flex-shrink-0` (128px fixos)

O `flex-shrink-0` garante que a imagem não encolha quando o conteúdo for longo.

**Estrutura do modal após a mudança:**
```
<motion.div className="... max-h-[85vh] flex flex-col">
  {/* Imagem — flex-shrink-0, não scrolla */}
  <div className="flex-shrink-0"> imagem ou emoji </div>

  {/* Conteúdo — scrollável */}
  <div className="overflow-y-auto flex-1 px-5 pb-8 pt-3">
    handle bar
    nome
    preço + categoria
    descrição
    adicionais
    botão
  </div>
</motion.div>
```

---

## Fora de escopo

- Nenhuma mudança em outros componentes (`Cardapio.jsx`, `GarcomApp.jsx`, etc.)
- Nenhuma mudança na lógica de dados ou API
- Nenhuma alteração no layout da página principal

---

## Critérios de aceitação

- [ ] Cards com descrição mostram até 2 linhas antes de truncar com `...`
- [ ] Cards sem descrição continuam sem nenhum elemento extra
- [ ] Modal de produto com conteúdo longo permite scroll interno
- [ ] Imagem do produto não scrolla — fica fixada no topo do modal
- [ ] Modal não ultrapassa 85% da altura da viewport em nenhum dispositivo
- [ ] Comportamento de fechar (clique no overlay) continua funcionando
