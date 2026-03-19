import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';

export const CASHIER_KEY = ['cashiers'];

export function useCashiers(filters = {}) {
  return useQuery({
    queryKey: [...CASHIER_KEY, filters],
    queryFn: () => localDB.entities.Cashier.filter(filters),
  });
}

export function useActiveCashier() {
  return useQuery({
    queryKey: [...CASHIER_KEY, 'active'],
    queryFn: async () => {
      const open = await localDB.entities.Cashier.filter({ status: 'aberto' });
      return open[0] || null;
    },
  });
}

export function useOpenCashier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operador, turno, saldo_inicial }) =>
      localDB.entities.Cashier.create({
        status: 'aberto',
        turno,
        operador,
        saldo_inicial: parseFloat(saldo_inicial) || 0,
        aberto_em: new Date().toISOString(),
        fechado_em: null,
        movimentacoes: [],
        linked_order_ids: [],
        resumo_pagamentos: { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, misto: 0 },
        total_comandas: 0,
        total_itens: 0,
        saldo_esperado: 0,
        saldo_real: 0,
        diferenca: 0,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CASHIER_KEY }),
  });
}

export function useAddMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cashierId, tipo, valor, motivo, operador }) => {
      const cashier = await localDB.entities.Cashier.get(cashierId);
      const movimentacao = {
        id: `${Date.now()}`,
        tipo,
        valor: parseFloat(valor),
        motivo,
        hora: new Date().toISOString(),
        operador,
      };
      return localDB.entities.Cashier.update(cashierId, {
        movimentacoes: [...(cashier.movimentacoes || []), movimentacao],
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CASHIER_KEY }),
  });
}

// NOTA: useCloseOrder (em useOrders.js) já invalida ['tables'] via React Query
// useCashier acessa localDB diretamente - isso é seguro porque invalidateQueries
// causa refetch em todos os componentes que usam useTables automaticamente.
export function useCloseCashier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cashierId, saldo_real }) => {
      const snapshot = await localDB.entities.Cashier.get(cashierId);
      try {
        const linkedIds = snapshot.linked_order_ids || [];
        const allOrders = await localDB.entities.Order.filter({ status: 'fechada' });
        const orders = allOrders.filter(o => linkedIds.includes(o.id));

        const resumo = { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, misto: 0 };
        let total_itens = 0;
        orders.forEach(o => {
          const method = o.payment_method || 'dinheiro';
          if (method in resumo) resumo[method] += (o.total || 0);
          total_itens += o.items?.reduce((s, i) => s + i.quantity, 0) || 0;
        });

        const movs = snapshot.movimentacoes || [];
        const totalReforcos = movs.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0);
        const totalSangrias = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);
        const saldo_esperado = snapshot.saldo_inicial + resumo.dinheiro + totalReforcos - totalSangrias;
        const saldoReal = parseFloat(saldo_real) || 0;

        return localDB.entities.Cashier.update(cashierId, {
          status: 'fechado',
          fechado_em: new Date().toISOString(),
          resumo_pagamentos: resumo,
          total_comandas: orders.length,
          total_itens,
          saldo_esperado: parseFloat(saldo_esperado.toFixed(2)),
          saldo_real: saldoReal,
          diferenca: parseFloat((saldoReal - saldo_esperado).toFixed(2)),
        });
      } catch (err) {
        await localDB.entities.Cashier.update(cashierId, snapshot);
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CASHIER_KEY }),
  });
}
