import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Users, ListChecks, Check } from 'lucide-react';

/**
 * TransferTableDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * Props:
 *   open           – boolean
 *   onClose        – () => void
 *   order          – order object being transferred FROM
 *   onTransferred  – (destTable, mode) => void   called after success
 *
 * Modos:
 *   "full"  – Mesa inteira: move todos os itens para a mesa destino
 *   "items" – Itens específicos: o usuário escolhe quais transferir
 *
 * Destino pode ser mesa LIVRE ou OCUPADA.
 *   • Livre  → renomeia a comanda (ou cria nova) naquela mesa
 *   • Ocupada → agrupa os itens na comanda existente da mesa destino
 */
export default function TransferTableDialog({ open, onClose, order, onTransferred }) {
  const [mode, setMode] = useState('full');            // 'full' | 'items'
  const [tables, setTables] = useState([]);            // todas as mesas exceto a atual
  const [destOrders, setDestOrders] = useState({});    // table_id → order (só ocupadas)
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedIdxs, setSelectedIdxs] = useState(new Set()); // índices para modo 'items'
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setMode('full');
      setSelectedTable(null);
      setSelectedIdxs(new Set());
      fetchTables();
    }
  }, [open]);

  // Carrega mesas ativas + ordens abertas para saber quais estão ocupadas
  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      const all = await localDB.entities.Table.filter({ active: true });
      // Exclui a mesa atual e delivery
      const others = all.filter(t => t.id !== order?.table_id && t.type !== 'delivery');
      setTables(others);

      // Busca ordens abertas/em_recebimento das mesas ocupadas
      const [abertas, emFech] = await Promise.all([
        localDB.entities.Order.filter({ status: 'aberta' }),
        localDB.entities.Order.filter({ status: 'em_recebimento' }),
      ]);
      const map = {};
      [...abertas, ...emFech].forEach(o => {
        if (o.table_id) map[o.table_id] = o;
      });
      setDestOrders(map);
    } finally {
      setLoadingTables(false);
    }
  };

  const recalc = (items) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    return { subtotal, service_fee: 0, total: subtotal };
  };

  const toggleItemIdx = (idx) => {
    setSelectedIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set((order?.items || []).map((_, i) => i));
    setSelectedIdxs(all);
  };

  const selectNone = () => setSelectedIdxs(new Set());

  // ────────────────────────────────────────────────────────────────────────────
  // Executa a transferência
  // ────────────────────────────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!selectedTable || !order) return;

    const destOrder = destOrders[selectedTable.id]; // existe se mesa ocupada
    const isOccupied = !!destOrder;
    const sourceItems = order.items || [];

    if (mode === 'full') {
      await transferFull(destOrder, isOccupied, sourceItems);
    } else {
      await transferItems(destOrder, isOccupied, sourceItems);
    }
  };

  // Transferência de mesa inteira
  const transferFull = async (destOrder, isOccupied, sourceItems) => {
    setLoading(true);
    try {
      if (!isOccupied) {
        // Destino livre → mover a comanda toda para lá
        await localDB.entities.Order.update(order.id, {
          table_id: selectedTable.id,
          table_number: selectedTable.number,
          table_type: selectedTable.type,
        });
        // Mesa origem → livre
        if (order.table_id) {
          await localDB.entities.Table.update(order.table_id, { status: 'livre' });
        }
        // Mesa destino → ocupada
        await localDB.entities.Table.update(selectedTable.id, { status: 'ocupada' });
      } else {
        // Destino ocupado → fundir itens na comanda existente
        const merged = [...(destOrder.items || []), ...sourceItems];
        const totals = recalcWithFee(merged, destOrder.service_fee_enabled !== false);
        await localDB.entities.Order.update(destOrder.id, {
          items: merged,
          ...totals,
        });
        // Cancela a comanda origem (mas mantém no histórico)
        await localDB.entities.Order.update(order.id, {
          status: 'cancelada',
          closed_at: new Date().toISOString(),
          transfer_note: `Transferida para Mesa ${selectedTable.number}`,
        });
        // Mesa origem → livre
        if (order.table_id) {
          await localDB.entities.Table.update(order.table_id, { status: 'livre' });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onTransferred(selectedTable, 'full', isOccupied ? destOrder : null);
    } finally {
      setLoading(false);
    }
  };

  // Transferência de itens específicos
  const transferItems = async (destOrder, isOccupied, sourceItems) => {
    if (selectedIdxs.size === 0) return;
    setLoading(true);
    try {
      const toMove = sourceItems.filter((_, i) => selectedIdxs.has(i));
      const remaining = sourceItems.filter((_, i) => !selectedIdxs.has(i));

      if (!isOccupied) {
        // Destino livre → cria nova comanda lá com os itens escolhidos
        const feeEnabled = order.service_fee_enabled !== false;
        const newTotals = recalcWithFee(toMove, feeEnabled);
        await localDB.entities.Order.create({
          table_id: selectedTable.id,
          table_number: selectedTable.number,
          table_type: selectedTable.type,
          status: 'aberta',
          items: toMove,
          ...newTotals,
          service_fee_enabled: feeEnabled,
          opened_at: new Date().toISOString(),
        });
        await localDB.entities.Table.update(selectedTable.id, { status: 'ocupada' });
      } else {
        // Destino ocupado → adiciona os itens na comanda existente
        const merged = [...(destOrder.items || []), ...toMove];
        const destTotals = recalcWithFee(merged, destOrder.service_fee_enabled !== false);
        await localDB.entities.Order.update(destOrder.id, {
          items: merged,
          ...destTotals,
        });
      }

      // Atualiza comanda origem retirando os itens movidos
      const sourceTotals = recalcWithFee(remaining, order.service_fee_enabled !== false);
      await localDB.entities.Order.update(order.id, {
        items: remaining,
        ...sourceTotals,
      });
      // Se ficou sem itens, libera a mesa
      if (remaining.length === 0) {
        await localDB.entities.Order.update(order.id, { status: 'cancelada', closed_at: new Date().toISOString() });
        if (order.table_id) await localDB.entities.Table.update(order.table_id, { status: 'livre' });
      }

      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onTransferred(selectedTable, 'items', isOccupied ? destOrder : null);
    } finally {
      setLoading(false);
    }
  };

  const recalcWithFee = (items, feeEnabled = true) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const service_fee = feeEnabled ? subtotal * 0.1 : 0;
    return { subtotal, service_fee, total: subtotal + service_fee };
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers de UI
  // ────────────────────────────────────────────────────────────────────────────
  const tableLabel = (t) => {
    if (t.type === 'balcao') return `🍺 Balcão ${t.number}`;
    return `🪑 Mesa ${t.number}`;
  };

  const isTableOccupied = (t) => !!destOrders[t.id];

  const canConfirm = selectedTable && (mode === 'full' || selectedIdxs.size > 0);

  const sourceItems = order?.items || [];

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" /> Transferir Mesa
          </DialogTitle>
        </DialogHeader>

        {/* Modo tabs */}
        <div className="flex rounded-xl bg-secondary p-1 gap-1 shrink-0">
          <button
            onClick={() => setMode('full')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'full' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Mesa Inteira
          </button>
          <button
            onClick={() => { setMode('items'); setSelectedIdxs(new Set()); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'items' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> Itens Específicos
          </button>
        </div>

        {/* Seleção de itens (só no modo 'items') */}
        {mode === 'items' && (
          <div className="shrink-0 space-y-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground font-medium">Selecione os itens a mover:</p>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-primary hover:underline">Todos</button>
                <button onClick={selectNone} className="text-xs text-muted-foreground hover:underline">Nenhum</button>
              </div>
            </div>
            <div className="max-h-36 overflow-auto space-y-1 pr-0.5">
              {sourceItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Comanda vazia.</p>
              ) : (
                sourceItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleItemIdx(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                      selectedIdxs.has(idx)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary text-foreground hover:border-primary/30'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      selectedIdxs.has(idx) ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}>
                      {selectedIdxs.has(idx) && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.product_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity}× R$ {item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">R$ {item.total.toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
            {selectedIdxs.size > 0 && (
              <p className="text-[10px] text-primary text-right">{selectedIdxs.size} item(ns) selecionado(s)</p>
            )}
          </div>
        )}

        {/* Separador */}
        <div className="shrink-0">
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Mesa destino:</p>
        </div>

        {/* Grade de mesas */}
        <div className="flex-1 overflow-auto min-h-0">
          {loadingTables ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🚫</div>
              <p className="text-sm text-muted-foreground">Nenhuma outra mesa disponível.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {tables.map(t => {
                const occupied = isTableOccupied(t);
                const isSelected = selectedTable?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTable(t)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : occupied
                        ? 'border-amber-500/40 bg-amber-500/5 text-foreground hover:border-amber-500/70'
                        : 'border-border bg-secondary text-foreground hover:border-primary/40'
                    }`}
                  >
                    <div className="text-lg">{t.type === 'balcao' ? '🍺' : '🪑'}</div>
                    <div className="text-xs font-semibold mt-0.5 leading-tight">
                      {t.type === 'balcao' ? `Balcão ${t.number}` : `Mesa ${t.number}`}
                    </div>
                    <div className={`text-[10px] mt-0.5 font-medium ${
                      occupied ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {occupied ? '● Ocupada' : '○ Livre'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Aviso de agrupamento */}
        {selectedTable && isTableOccupied(selectedTable) && (
          <div className="shrink-0 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
            <span className="shrink-0 mt-0.5">⚡</span>
            <span>
              Mesa {selectedTable.number} está ocupada. Os itens serão <strong>agrupados</strong> na comanda existente.
              {mode === 'full' && ' A comanda atual será cancelada.'}
            </span>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-1 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleTransfer}
            disabled={!canConfirm || loading}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowRightLeft className="w-4 h-4" />
            )}
            {loading ? 'Transferindo...' : 'Transferir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
