import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Minus, Send, Receipt, Check, X, StickyNote, ArrowRightLeft, Printer, ShieldOff, Lock, CheckCircle, DoorOpen, Unlock, Clock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnimatePresence, motion } from 'framer-motion';
import ProductSelector from '@/components/ProductSelector';
import TransferTableDialog from '@/components/TransferTableDialog';
import { printAutoByDept, printCustomerBill } from '@/components/PrintTicket';
import { deductStockForOrder } from '@/lib/stockUtils';
import { linkOrderToCashier } from '@/hooks/useOrders';
import CancelAuthModal from '@/components/CancelAuthModal';
import EditAuthModal from '@/components/EditAuthModal';

// Permissões padrão — espelha Configuracoes.jsx
const DEFAULT_PERMS = {
  can_send_to_kitchen: true,
  can_close_order: true,
  can_print_bill: true,
  can_cancel_order: false,
  can_apply_discount: false,
  can_transfer_table: false,
};

// Resolve permissões mesclando com defaults
function resolvePerms(waiter) {
  return { ...DEFAULT_PERMS, ...(waiter?.permissions || {}) };
}

// Toast de acesso negado
function PermDeniedToast({ msg, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/90 text-white text-sm shadow-xl"
    >
      <ShieldOff className="w-4 h-4 shrink-0" />
      {msg}
    </motion.div>
  );
}

function SuccessToast({ msg, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600/90 text-white text-sm shadow-xl"
    >
      <CheckCircle className="w-4 h-4 shrink-0" />
      {msg}
    </motion.div>
  );
}

export default function GarcomComanda({ waiter, table, existingOrder, onBack }) {
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [showProducts, setShowProducts] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [noteItem, setNoteItem] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [sendingOrder, setSendingOrder] = useState(false);
  const [denied, setDenied] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [showCancelAuth, setShowCancelAuth] = useState(false);
  const [showReopenAuth, setShowReopenAuth] = useState(false);
  const [showLiberarAuth, setShowLiberarAuth] = useState(false);
  const [editAuth, setEditAuth] = useState(null); // { idx, delta } — item enviado aguardando auth
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(true); // toggle taxa 10%
  const queryClient = useQueryClient();

  const perms = resolvePerms(waiter);

  const deny = (msg) => setDenied(msg);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoadError(null);
    try {
      const prods = await localDB.entities.Product.filter({ available: true });
      setProducts(prods);

      if (existingOrder) {
        // Recarrega a ordem do servidor para garantir dados mais recentes
        try {
          const fresh = await localDB.entities.Order.get(existingOrder.id);
          const loaded = fresh || existingOrder;
          setOrder(loaded);
          setServiceFeeEnabled(loaded.service_fee_enabled !== false);
        } catch {
          setOrder(existingOrder);
          setServiceFeeEnabled(existingOrder.service_fee_enabled !== false);
        }
      } else {
        // Proteção: antes de criar uma nova comanda, verifica se já existe uma aberta/em_recebimento para esta mesa
        // Isso evita criar duplicatas caso existingOrder não tenha sido passado corretamente
        const [abertas, emFechamento] = await Promise.all([
          localDB.entities.Order.filter({ table_id: table.id, status: 'aberta' }),
          localDB.entities.Order.filter({ table_id: table.id, status: 'em_recebimento' }),
        ]);
        const existente = [...abertas, ...emFechamento][0];

        if (existente) {
          // Já existe comanda para esta mesa — usa ela em vez de criar nova
          setOrder(existente);
          setServiceFeeEnabled(existente.service_fee_enabled !== false);
        } else {
          const newOrder = await localDB.entities.Order.create({
            table_id: table.id,
            table_number: table.number,
            table_type: table.type,
            waiter_id: waiter.id,
            waiter_name: waiter.name,
            status: 'aberta',
            items: [],
            subtotal: 0,
            service_fee: 0,
            total: 0,
            opened_at: new Date().toISOString(),
          });
          await localDB.entities.Table.update(table.id, { status: 'ocupada' });
          queryClient.invalidateQueries({ queryKey: ['tables'] });
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          setOrder(newOrder);
        }
      }
    } catch (e) {
      console.error('[GarcomComanda] Erro ao carregar:', e);
      setLoadError(e.message || 'Erro ao conectar com o servidor');
    }
  };

  // feeEnabled permite passar explicitamente (ex.: ao fazer toggle antes do state atualizar)
  const recalc = (items, feeEnabled = serviceFeeEnabled) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const service_fee = feeEnabled ? subtotal * 0.1 : 0;
    return { subtotal, service_fee, total: subtotal + service_fee };
  };

  const updateOrder = async (newItems) => {
    const totals = recalc(newItems);
    const updated = { ...order, items: newItems, ...totals, service_fee_enabled: serviceFeeEnabled };
    setOrder(updated);
    await localDB.entities.Order.update(order.id, { items: newItems, ...totals, service_fee_enabled: serviceFeeEnabled });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  // Ativa/desativa a taxa de serviço de 10% e salva na ordem
  const toggleServiceFee = async () => {
    const newEnabled = !serviceFeeEnabled;
    setServiceFeeEnabled(newEnabled);
    const totals = recalc(order.items || [], newEnabled);
    const updated = { ...order, ...totals, service_fee_enabled: newEnabled };
    setOrder(updated);
    await localDB.entities.Order.update(order.id, { ...totals, service_fee_enabled: newEnabled });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const addItem = (product, modifiers = [], userNote = '', qty = 1) => addItemsBulk([{ product, modifiers, qty, userNote }]);

  const buildItemsFromEntries = (entries, baseItems) => {
    const items = [...baseItems];
    entries.forEach(({ product, modifiers = [], qty = 1, userNote = '' }) => {
      const extraPrice = modifiers.reduce((s, m) => s + (m.price || 0), 0);
      const unitPrice = product.price + extraPrice;
      const modifierNames = modifiers.map(m => m.name).join(', ');
      const fullNotes = [modifierNames, userNote].filter(Boolean).join(' | ');
      // Só mescla com item existente se ele ainda estiver pendente (não enviado)
      const existing = modifiers.length === 0 && !userNote
        ? items.findIndex(i => i.product_id === product.id && !i.notes && !i.modifiers?.length && i.status === 'pendente')
        : -1;
      if (existing >= 0) {
        items[existing] = { ...items[existing], quantity: items[existing].quantity + qty, total: (items[existing].quantity + qty) * items[existing].unit_price };
      } else {
        // Cria novo item pendente — mesmo que já exista um enviado (para reimpressão)
        items.push({ product_id: product.id, product_name: product.name, quantity: qty, unit_price: unitPrice, total: unitPrice * qty, status: 'pendente', notes: fullNotes, modifiers });
      }
    });
    return items;
  };

  const addItemsBulk = (entries) => {
    const items = buildItemsFromEntries(entries, order.items || []);
    updateOrder(items);
  };

  const addBulkAndSend = async (entries) => {
    if (!perms.can_send_to_kitchen) { deny('Sem permissão para enviar ao bar/cozinha'); return; }
    setSendingOrder(true);
    try {
      const items = buildItemsFromEntries(entries, order.items || []);
      const totals = recalc(items);
      const updatedOrder = { ...order, items, ...totals };
      setOrder(updatedOrder);
      const pending = items.filter(i => i.status === 'pendente');
      if (pending.length) printAutoByDept(updatedOrder, products, pending);
      const sentItems = items.map(i => i.status === 'pendente' ? { ...i, status: 'preparando' } : i);
      const sentTotals = recalc(sentItems);
      const finalOrder = { ...updatedOrder, items: sentItems, ...sentTotals };
      setOrder(finalOrder);
      await localDB.entities.Order.update(order.id, { items: sentItems, ...sentTotals });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSuccessMsg('Pedido enviado!');
    } catch {
      deny('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setSendingOrder(false);
    }
  };

  const changeQty = (idx, delta) => {
    const item = (order.items || [])[idx];
    if (item && item.status !== 'pendente') {
      setEditAuth({ idx, delta });
      return;
    }
    applyQtyChange(idx, delta);
  };

  const applyQtyChange = (idx, delta) => {
    const items = [...(order.items || [])];
    const newQty = items[idx].quantity + delta;
    if (newQty <= 0) items.splice(idx, 1);
    else items[idx] = { ...items[idx], quantity: newQty, total: newQty * items[idx].unit_price };
    updateOrder(items);
  };

  const saveNote = () => {
    const items = [...(order.items || [])];
    items[noteItem] = { ...items[noteItem], notes: noteText };
    updateOrder(items);
    setNoteItem(null);
  };

  const sendToKitchenBar = async () => {
    if (!perms.can_send_to_kitchen) { deny('Sem permissão para enviar ao bar/cozinha'); return; }
    setSendingOrder(true);
    try {
      const pending = (order.items || []).filter(i => i.status === 'pendente');
      const updatedItems = (order.items || []).map(i => i.status === 'pendente' ? { ...i, status: 'preparando' } : i);
      if (pending.length) printAutoByDept(order, products, pending);
      await updateOrder(updatedItems);
      setSuccessMsg('Pedido enviado!');
    } catch {
      deny('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setSendingOrder(false);
    }
  };

  const handleCloseOrder = () => {
    if (!perms.can_close_order) { deny('Sem permissão para fechar comanda'); return; }
    setShowClose(true);
  };

  const handleTransfer = () => {
    if (!perms.can_transfer_table) { deny('Sem permissão para transferir mesa'); return; }
    setShowTransfer(true);
  };

  const closeOrder = async (payMethod, discountVal = 0) => {
    const discount = Math.max(0, discountVal);
    const finalTotal = Math.max(0, (order.subtotal || 0) + (order.service_fee || 0) - discount);
    await localDB.entities.Order.update(order.id, {
      status: 'fechada',
      payment_method: payMethod,
      discount,
      total: finalTotal,
      closed_at: new Date().toISOString(),
    });
    await Promise.all([
      localDB.entities.Table.update(order.table_id, { status: 'livre' }),
      deductStockForOrder(order),
      linkOrderToCashier(order.id), // Vincula ao caixa aberto para histórico
    ]);
    queryClient.invalidateQueries({ queryKey: ['tables'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['cashiers'] });
    onBack();
  };

  const cancelOrder = () => setShowCancelAuth(true);

  const doCancelOrder = async () => {
    await localDB.entities.Order.update(order.id, { status: 'cancelada' });
    if (order.table_id) await localDB.entities.Table.update(order.table_id, { status: 'livre' });
    queryClient.invalidateQueries({ queryKey: ['tables'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    onBack();
  };

  // Libera a mesa quando a comanda está vazia (requer auth de gerência)
  const handleLiberarMesa = async () => {
    await localDB.entities.Order.update(order.id, { status: 'cancelada' });
    // Garante retorno ao status livre independente do status atual
    await localDB.entities.Table.update(table.id, { status: 'livre' });
    queryClient.invalidateQueries({ queryKey: ['tables'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    onBack();
  };

  // Imprime conta e bloqueia a comanda em "aguardando pagamento"
  const handlePrintBill = async () => {
    if (!perms.can_print_bill) { deny('Sem permissão para imprimir conta'); return; }
    printCustomerBill(order);
    const updated = { ...order, status: 'em_recebimento' };
    setOrder(updated);
    await localDB.entities.Order.update(order.id, { status: 'em_recebimento' });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    setSuccessMsg('Conta impressa — mesa em recebimento');
  };

  // Reabre a comanda (requer senha de gerência/admin)
  const doReopenOrder = async () => {
    const updated = { ...order, status: 'aberta' };
    setOrder(updated);
    await localDB.entities.Order.update(order.id, { status: 'aberta' });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    setSuccessMsg('Comanda reaberta!');
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
        <div className="text-3xl">⚠️</div>
        <p className="text-sm text-destructive font-medium">Erro ao carregar comanda</p>
        <p className="text-xs text-muted-foreground max-w-xs">{loadError}</p>
        <Button size="sm" onClick={loadData}>Tentar novamente</Button>
        <button onClick={onBack} className="text-xs text-muted-foreground underline">Voltar</button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh max-w-2xl mx-auto bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          <button onClick={onBack} className="p-2 -ml-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm text-foreground leading-tight">
              {order.table_type === 'balcao' ? '🍺 Balcão' : `🪑 Mesa ${order.table_number || ''}`}
            </h2>
            <p className="text-xs text-muted-foreground">{order.items?.length || 0} itens</p>
          </div>

          <button
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 ${perms.can_transfer_table ? 'text-blue-400 hover:bg-blue-500/10 active:bg-blue-500/20' : 'text-muted-foreground/30 opacity-50'}`}
            onClick={handleTransfer}
            title={perms.can_transfer_table ? 'Transferir mesa' : 'Sem permissão'}
          >
            <ArrowRightLeft className="w-6 h-6" />
            <span className="text-[9px] font-medium leading-none">Transferir</span>
          </button>

          <button
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 ${perms.can_cancel_order ? 'text-destructive hover:bg-destructive/10 active:bg-destructive/20' : 'text-muted-foreground/30 opacity-50'}`}
            onClick={cancelOrder}
            title={perms.can_cancel_order ? 'Cancelar comanda' : 'Sem permissão'}
          >
            <X className="w-6 h-6" />
            <span className="text-[9px] font-medium leading-none">Cancelar</span>
          </button>

          <Button
            size="sm"
            className={`gap-1 text-sm h-14 px-3 ${perms.can_close_order ? '' : 'opacity-50'}`}
            onClick={handleCloseOrder}
            disabled={order.status === 'em_recebimento' || !(order.items?.length > 0)}
            title={perms.can_close_order ? 'Fechar conta' : 'Sem permissão'}
          >
            <Check className="w-4 h-4" /> Fechar Conta
          </Button>
        </div>
      </div>

      {/* Banner: em recebimento */}
      {order.status === 'em_recebimento' && (
        <div className="mx-3 mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 text-sm font-medium">
          <Clock className="w-4 h-4 shrink-0" />
          <span>Aguardando pagamento — conta impressa. Nenhum item pode ser adicionado.</span>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-auto px-3 py-2.5 space-y-2">
        <AnimatePresence>
          {(order.items || []).map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`flex items-center gap-2 p-3 rounded-xl border bg-card ${
                item.status === 'preparando' ? 'border-amber-500/40' :
                item.status === 'pronto' ? 'border-emerald-500/40' : 'border-border'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{item.product_name}</p>
                {item.notes && <p className="text-xs text-amber-400 mt-0.5 truncate">📝 {item.notes}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">R$ {item.unit_price.toFixed(2)} · <span className="font-semibold text-primary">R$ {item.total.toFixed(2)}</span></p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.status !== 'pendente' ? (
                  <>
                    <button onClick={() => changeQty(idx, -1)} className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground/40" title="Item enviado — requer autorização">
                      <Lock className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => changeQty(idx, 1)} className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center text-muted-foreground/40" title="Item enviado — requer autorização">
                      <Lock className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => changeQty(idx, -1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary/70">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => changeQty(idx, 1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary/70">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              {order.status !== 'em_recebimento' && (
                <button onClick={() => { setNoteItem(idx); setNoteText(item.notes || ''); }} className="p-2 text-muted-foreground hover:text-amber-400 shrink-0">
                  <StickyNote className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {(!order.items || order.items.length === 0) && (
          <div className="text-center py-12">
            <div className="text-3xl mb-2">🍽️</div>
            <p className="text-muted-foreground text-sm">Comanda vazia. Adicione itens!</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card px-3 py-3 space-y-2 pb-safe">

        {/* Comanda VAZIA + mesa ocupada — liberar (requer auth de gerência) */}
        {(!order.items || order.items.length === 0) && order.status === 'aberta' && table?.status === 'ocupada' ? (
          <Button
            variant="outline"
            className="w-full h-12 gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-base"
            onClick={() => setShowLiberarAuth(true)}
          >
            <DoorOpen className="w-5 h-5" /> Liberar Mesa
          </Button>
        ) : order.status === 'em_recebimento' ? (
          /* EM FECHAMENTO — aguardando pagamento, somente caixa/gerência finaliza */
          <>
            <div className="flex justify-between font-bold text-foreground text-base border-b border-border pb-2 mb-1">
              <span>Total</span>
              <span className="text-primary">R$ {(order.total || 0).toFixed(2)}</span>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 mb-1">
              <p className="text-xs text-amber-400 text-center font-medium">
                🔒 Fechamento registrado — finalização pelo caixa
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full h-11 gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={() => setShowReopenAuth(true)}
            >
              <Unlock className="w-4 h-4" /> Reabrir Comanda (autorização)
            </Button>
          </>
        ) : (
          /* NORMAL — comanda aberta com itens */
          <>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span><span>R$ {(order.subtotal || 0).toFixed(2)}</span>
            </div>
            {/* Toggle taxa de serviço 10% */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={serviceFeeEnabled ? 'text-muted-foreground' : 'text-muted-foreground/50'}>
                  Serviço (10%)
                </span>
                {/* Switch toggle */}
                <button
                  onClick={toggleServiceFee}
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                    serviceFeeEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  title={serviceFeeEnabled ? 'Desativar taxa de serviço' : 'Ativar taxa de serviço'}
                >
                  <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${
                    serviceFeeEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className={`text-[10px] font-medium ${serviceFeeEnabled ? 'text-primary' : 'text-muted-foreground/40'}`}>
                  {serviceFeeEnabled ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <span className={serviceFeeEnabled ? 'text-muted-foreground' : 'text-muted-foreground/40 line-through'}>
                R$ {(order.service_fee || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
              <span>Total</span>
              <span className="text-primary">R$ {(order.total || 0).toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="gap-2 h-11" onClick={() => setShowProducts(true)}>
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
              <Button
                variant="outline"
                className={`gap-1.5 h-11 ${
                  perms.can_send_to_kitchen
                    ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                    : 'opacity-50 border-border text-muted-foreground'
                }`}
                onClick={sendToKitchenBar}
                disabled={sendingOrder || !(order.items || []).some(i => i.status === 'pendente')}
                title={perms.can_send_to_kitchen ? 'Enviar para bar/cozinha' : 'Sem permissão'}
              >
                {sendingOrder
                  ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  : <Printer className="w-4 h-4" />}
                {sendingOrder ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
            <Button
              variant="outline"
              className={`w-full h-10 gap-1.5 ${
                perms.can_print_bill
                  ? 'border-purple-500/40 text-purple-400 hover:bg-purple-500/10'
                  : 'opacity-50 border-border text-muted-foreground'
              }`}
              onClick={handlePrintBill}
              title={perms.can_print_bill ? 'Imprimir conta' : 'Sem permissão'}
            >
              <Receipt className="w-4 h-4" /> Imprimir Conta
            </Button>
          </>
        )}
      </div>

      {/* Toasts */}
      <AnimatePresence>
        {denied && <PermDeniedToast msg={denied} onClose={() => setDenied(null)} />}
        {successMsg && <SuccessToast msg={successMsg} onClose={() => setSuccessMsg(null)} />}
      </AnimatePresence>

      <CancelAuthModal
        open={showCancelAuth}
        onClose={() => setShowCancelAuth(false)}
        onConfirm={doCancelOrder}
        label="comanda"
      />

      <EditAuthModal
        open={editAuth !== null}
        onClose={() => setEditAuth(null)}
        onConfirm={() => { applyQtyChange(editAuth.idx, editAuth.delta); setEditAuth(null); }}
        itemName={editAuth !== null ? (order.items || [])[editAuth.idx]?.product_name : ''}
      />

      <ProductSelector
        open={showProducts}
        onClose={() => setShowProducts(false)}
        products={products}
        onAdd={addItem}
        onAddBulk={addItemsBulk}
        onSend={perms.can_send_to_kitchen ? sendToKitchenBar : undefined}
      />

      {perms.can_transfer_table && (
        <TransferTableDialog
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
          order={order}
          onTransferred={(newTable, transferMode, destOrder) => {
            setShowTransfer(false);
            if (transferMode === 'full' && !destOrder) {
              // Mesa inteira → mesa livre: atualiza local
              setOrder(prev => ({ ...prev, table_id: newTable.id, table_number: newTable.number, table_type: newTable.type }));
              setSuccessMsg(`Mesa transferida para ${newTable.type === 'balcao' ? 'Balcão' : 'Mesa'} ${newTable.number}`);
            } else if (transferMode === 'full' && destOrder) {
              // Mesa inteira → mesa ocupada (agrupou): sai da comanda pois foi cancelada
              setSuccessMsg(`Itens agrupados na Mesa ${newTable.number}`);
              onBack();
            } else if (transferMode === 'items') {
              // Itens específicos: recarrega a comanda origem
              setSuccessMsg(`Itens transferidos para Mesa ${newTable.number}`);
              loadData();
            }
          }}
        />
      )}

      <CloseOrderDialog
        open={showClose}
        onClose={() => setShowClose(false)}
        order={order}
        canDiscount={perms.can_apply_discount}
        canPrint={perms.can_print_bill}
        onConfirm={closeOrder}
      />

      {/* Auth para liberar mesa vazia (somente gerência/admin) */}
      <AdminAuthModal
        open={showLiberarAuth}
        onClose={() => setShowLiberarAuth(false)}
        onConfirm={handleLiberarMesa}
        title="Liberar Mesa"
        description="Nenhum item adicionado. Somente gerência ou administração pode liberar a mesa."
        confirmLabel="Liberar Mesa"
        confirmClass="bg-emerald-600 hover:bg-emerald-700"
        confirmIcon={<DoorOpen className="w-4 h-4 mr-1" />}
      />

      {/* Auth para reabrir comanda (admin/gerência) */}
      <AdminAuthModal
        open={showReopenAuth}
        onClose={() => setShowReopenAuth(false)}
        onConfirm={doReopenOrder}
      />

      <Dialog open={noteItem !== null} onOpenChange={() => setNoteItem(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Observação do Item</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ex: sem cebola..." className="bg-secondary border-border" rows={3} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setNoteItem(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={saveNote}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Modal de autorização exclusivo para gerência/administração
function AdminAuthModal({
  open, onClose, onConfirm,
  title = 'Autorização necessária',
  description = 'Somente gerência ou administração pode executar esta ação.',
  confirmLabel = 'Confirmar',
  confirmClass = 'bg-amber-600 hover:bg-amber-700',
  confirmIcon = <Unlock className="w-4 h-4 mr-1" />,
}) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => { setPassword(''); setError(''); setLoading(false); onClose(); };

  const handleConfirm = async () => {
    if (!password.trim()) { setError('Digite a senha de gerência ou administração'); return; }
    setLoading(true);
    try {
      const admins = await fetch('/api/admin_users').then(r => r.json()).catch(() => []);
      const admin = admins.find(
        a => a.active !== false && a.password === password.trim() &&
          (a.role === 'proprietario' || a.role === 'administrador' || a.role === 'gerente')
      );
      if (!admin) {
        setError('Senha incorreta ou sem permissão de gerência/administração');
        setLoading(false);
        return;
      }
      handleClose();
      onConfirm();
    } catch {
      setError('Erro ao verificar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="w-5 h-5" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
            <p className="text-sm text-amber-400 font-medium">{description}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Digite a senha de um responsável.</p>
          </div>
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Senha de gerência / administração"
              className="bg-secondary border-border pr-10"
              autoFocus
            />
            <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
            <Button className={`flex-1 ${confirmClass}`} onClick={handleConfirm} disabled={loading}>
              {loading ? 'Verificando...' : <>{confirmIcon}{confirmLabel}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CloseOrderDialog({ open, onClose, order, canDiscount, canPrint, onConfirm }) {
  const [payMethod, setPayMethod] = useState('dinheiro');
  const [discount, setDiscount] = useState('0');
  if (!order) return null;
  const discountVal = canDiscount ? (parseFloat(discount) || 0) : 0;
  const finalTotal = Math.max(0, (order.total || 0) - discountVal);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Fechar Comanda</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary p-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span><span>R$ {(order.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Serviço (10%)</span><span>R$ {(order.service_fee || 0).toFixed(2)}</span>
            </div>
            {canDiscount && (
              <div className="flex justify-between text-sm text-muted-foreground items-center">
                <span>Desconto</span>
                <Input value={discount} onChange={e => setDiscount(e.target.value)} type="number" className="w-24 h-6 text-xs text-right bg-background border-border" />
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-2">
              <span>Total Final</span>
              <span className="text-primary">R$ {finalTotal.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <Label>Forma de Pagamento</Label>
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger className="mt-1.5 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                <SelectItem value="cartao_credito">💳 Cartão de Crédito</SelectItem>
                <SelectItem value="cartao_debito">💳 Cartão de Débito</SelectItem>
                <SelectItem value="pix">⚡ Pix</SelectItem>
                <SelectItem value="misto">🔀 Misto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canPrint && (
            <Button variant="outline" size="sm" onClick={() => printCustomerBill({ ...order, total: finalTotal })} className="gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
              <Receipt className="w-4 h-4" /> Imprimir Conta
            </Button>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onConfirm(payMethod, discountVal)}>
              <Check className="w-4 h-4 mr-1" /> Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
