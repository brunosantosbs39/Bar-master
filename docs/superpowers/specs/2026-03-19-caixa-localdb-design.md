# Design Spec: BarMaster — LocalDB + Módulo de Caixa

**Data:** 2026-03-19
**Status:** Aprovado
**Projeto:** `able-smart-bar-flow` (BarMaster)

---

## 1. Objetivo

Substituir o backend Base44 (serviço em nuvem externo) por um backend local baseado em `localStorage`, eliminando qualquer dependência de conta ou internet. Simultaneamente, implementar um módulo completo de **Caixa** com abertura/fechamento de turno, sangria, reforço, conferência de saldo e histórico.

---

## 2. Escopo

### Incluído
- Motor de dados local (`localDB.js`) com CRUD completo para todas as entidades
- Migração de todas as 6 páginas existentes para hooks React Query
- `AuthContext` simplificado (login por nome de operador, sem senha)
- Página `/Caixa` com funcionalidades completas
- Backup/restore JSON em Configurações
- Seed de dados iniciais para primeira execução

### Excluído
- Sincronização com Base44 ou qualquer backend remoto
- Autenticação com senha/PIN para admin (apenas garçom mantém PIN)
- Multi-dispositivo (dados ficam no browser local)

---

## 3. Arquitetura

### Estrutura de arquivos

```
src/
├── lib/
│   ├── localDB.js              # Motor principal — lê/escreve localStorage
│   ├── localDB-seed.js         # Dados iniciais de exemplo
│   ├── backup.js               # Export/Import JSON
│   ├── AuthContext.jsx         # Versão simplificada (nome do operador)
│   ├── WaiterSessionContext.jsx # Mantido, adaptado
│   └── stockUtils.js           # Adaptado para localDB
│
├── hooks/
│   ├── useOrders.js            # React Query — comandas
│   ├── useTables.js            # React Query — mesas
│   ├── useProducts.js          # React Query — produtos/categorias
│   ├── useWaiters.js           # React Query — garçons
│   ├── useStock.js             # React Query — estoque
│   ├── useCashier.js           # React Query — caixa (NOVO)
│   └── useBackup.js            # Export/import backup
│
└── pages/
    ├── Caixa.jsx               # NOVO — módulo completo de caixa
    └── [demais páginas migradas para hooks]
```

### Fluxo de dados

```
Componente
    ↓ chama
useXxx hook (React Query)
    ↓ chama
localDB.entities.X.filter() / .create() / .update() / .delete()
    ↓ lê/escreve
localStorage (chave: bm_orders, bm_tables, etc.)
```

### localStorage keys

| Chave | Entidade |
|-------|----------|
| `bm_orders` | Comandas |
| `bm_tables` | Mesas |
| `bm_products` | Produtos |
| `bm_categories` | Categorias |
| `bm_waiters` | Garçons |
| `bm_cashiers` | Caixas/Turnos |
| `bm_stock` | Estoque |
| `bm_settings` | Configurações gerais |
| `bm_operator` | Nome do operador logado |

---

## 4. Módulo de Caixa

### Modelo de dados

```js
{
  id: "uuid",
  status: "aberto" | "fechado",
  turno: "manha" | "tarde" | "noite",
  operador: "Nome do responsável",
  saldo_inicial: 150.00,
  aberto_em: "ISO 8601",
  fechado_em: null | "ISO 8601",

  movimentacoes: [
    {
      id: "uuid",
      tipo: "sangria" | "reforco",
      valor: 50.00,
      motivo: "texto livre",
      hora: "ISO 8601",
      operador: "Nome"
    }
  ],

  // Preenchidos no fechamento
  resumo_pagamentos: {
    dinheiro: 0,
    pix: 0,
    cartao_credito: 0,
    cartao_debito: 0,
    misto: 0
  },
  total_comandas: 0,
  total_itens: 0,
  saldo_esperado: 0,   // saldo_inicial + dinheiro_recebido + reforços - sangrias
  saldo_real: 0,       // digitado pelo operador na conferência
  diferenca: 0         // saldo_real - saldo_esperado
}
```

### Telas da página /Caixa

| Estado | Tela | Ação principal |
|--------|------|----------------|
| Sem caixa aberto | Dashboard "Caixa Fechado" | Botão "Abrir Caixa" |
| Caixa aberto | Dashboard operacional | Sangria / Reforço / Fechar |
| Dialog Abrir | Form: operador, turno, saldo inicial | Confirmar abertura |
| Dialog Sangria | Form: valor + motivo | Registrar retirada |
| Dialog Reforço | Form: valor + motivo | Registrar entrada |
| Dialog Fechar | Resumo + campo saldo real + diferença | Confirmar fechamento |
| Tab Histórico | Lista de caixas fechados | Filtro por data, ver detalhes |

### Regras de negócio

1. Apenas 1 caixa pode estar aberto por vez
2. Comandas fechadas enquanto o caixa está aberto são automaticamente vinculadas ao turno ativo
3. Saldo esperado = `saldo_inicial + Σreforços - Σsangrias + total_dinheiro_comandas`
4. Diferença positiva = sobra de caixa; negativa = falta
5. Fechamento do caixa não bloqueia novas comandas (comportamento configurável em Settings)

### Resiliência — queda de browser / reload

- Na inicialização do app, `useCashier` verifica se existe caixa com `status: "aberto"` no localStorage — se sim, retoma automaticamente sem perda de estado
- Fechamento de caixa é **atômico**: snapshot do estado anterior é salvo antes de escrever. Se algo falhar durante a escrita, o estado anterior é restaurado
- Tab duplicada: localStorage é compartilhado, portanto ambas as tabs verão o mesmo caixa. Não há lock — aceitável para uso single-device
- Movimentações (sangria/reforço) são append-only no array `movimentacoes`: nunca sobrescreve, apenas adiciona

---

## 5. Migração Base44 → LocalDB

### Páginas a migrar

| Página | Entidades usadas | Hook destino |
|--------|-----------------|--------------|
| `Mesas.jsx` | Table | `useTables()` |
| `Comandas.jsx` | Order, Table | `useOrders()`, `useTables()` |
| `Cardapio.jsx` | Product, Category | `useProducts()` |
| `Estoque.jsx` | Stock, Product | `useStock()` |
| `Relatorios.jsx` | Order | `useOrders()` |
| `Configuracoes.jsx` | Waiter, Settings | `useWaiters()` |
| `GarcomApp.jsx` | Order, Product, Table | hooks correspondentes |

### O que é removido

- `@base44/sdk` e `@base44/vite-plugin` (dependências do `package.json`)
- `src/api/base44Client.js`
- `src/lib/AuthContext.jsx` complexo → versão simplificada
- Variáveis de ambiente `VITE_BASE44_APP_ID` e `VITE_BASE44_APP_BASE_URL`

---

## 6. Auth Simplificado

- Login admin = formulário com campo "Nome do operador" (sem senha)
- Nome salvo em `localStorage` como `bm_operator`
- **GarcomApp PIN:** mantido funcional. O PIN de 4 dígitos de cada garçom é armazenado no campo `pin` da entidade `Waiter` no `localDB`. A validação ocorre localmente, sem Base44. Decisão: PIN em plaintext (aceitável para sistema local sem exposição externa).
- Sem roles, sem permissões — sistema single-user local

---

## 7. Backup & Dados

Localização: `Configurações → aba "Dados"`

| Ação | Comportamento |
|------|--------------|
| Exportar JSON | Download de `bm-backup-YYYY-MM-DD.json` com todas as entidades |
| Importar JSON | **Sobrescreve tudo** — equivale a Reset + Import. Confirmação obrigatória. Arquivo inválido/corrompido é rejeitado com mensagem de erro antes de qualquer escrita. |
| Limpar Dados | Reset total com confirmação dupla ("Digite LIMPAR para confirmar") |

**Política de import:** sem merge, sem resolução de conflitos — import é sempre full replace para máxima simplicidade e previsibilidade.

---

## 8. Seed de Dados Iniciais

Na primeira execução (localStorage vazio), popular com dados suficientes para testar todos os fluxos:

- **Mesas:** 10 mesas (Mesa 1-8, Balcão, Delivery)
- **Categorias:** Cervejas, Destilados, Drinks, Petiscos, Pratos, Sobremesas
- **Produtos:** 15 itens com preços realistas (ex: Cerveja Lata R$8, Porcão de Frango R$35)
- **Garçons:** 2 garçons ("João" PIN 1234, "Maria" PIN 5678)
- **Estoque:** 50 unidades para cada produto (suficiente para testes)
- **Caixa fechado:** 1 caixa pré-fechado do dia anterior (para testar tela de Histórico)
- **Comandas:** 0 comandas ativas (estado limpo para começar)

### Limite do localStorage

localStorage suporta ~5-10MB. Para uso intenso (centenas de comandas por dia), recomenda-se:
- Export manual semanal via botão "Exportar JSON" em Configurações
- Política de retenção: comandas com mais de 90 dias são incluídas no export mas removidas do localStorage automaticamente na abertura do app (comportamento documentado na UI)

---

## 9. Como Rodar Localmente

```bash
cd C:\Users\User\Downloads\able-smart-bar-flow

# Remover dependências Base44
npm uninstall @base44/sdk @base44/vite-plugin

# Instalar dependências restantes
npm install

# Criar .env.local mínimo
echo VITE_APP_NAME=BarMaster > .env.local

# Rodar
npm run dev
# http://localhost:5173
```

---

## 10. Ordem de Implementação

| # | Etapa | Arquivos principais |
|---|-------|---------------------|
| 1 | `localDB.js` + seed | `lib/localDB.js`, `lib/localDB-seed.js` |
| 2 | `AuthContext` simplificado | `lib/AuthContext.jsx` |
| 3 | Migrar `Mesas.jsx` | `hooks/useTables.js`, `pages/Mesas.jsx` |
| 4 | Migrar `Comandas.jsx` + `GarcomApp` | `hooks/useOrders.js`, páginas |
| 5 | Migrar `Cardápio.jsx` + `Estoque.jsx` | `hooks/useProducts.js`, `hooks/useStock.js` |
| 6 | Migrar `Relatorios.jsx` + `Configuracoes.jsx` | `hooks/useWaiters.js` |
| 7 | Criar `Caixa.jsx` + `useCashier.js` | `hooks/useCashier.js`, `pages/Caixa.jsx` |
| 8 | Backup export/import | `lib/backup.js`, `hooks/useBackup.js` |
| 9 | Nav, seed, testes | `components/Layout.jsx`, `App.jsx` |
