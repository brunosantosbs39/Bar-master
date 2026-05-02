import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, Check, X, ChevronLeft, StickyNote, Send, Receipt, User, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { printCustomerBill, printAutoByDept } from '@/components/PrintTicket';
import ProductSelector from '@/components/ProductSelector';
import TransferTableDialog from '@/components/TransferTableDialog';
import { deductStockForOrder } from '@/lib/stockUtils';
import CancelAuthModal from '@/components/CancelAuthModal';
import { localDB } from '@/lib/localDB';
import { useOrders, useCreateOrder, ORDER_KEY } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { useWaiters } from '@/hooks/useWaiters';

const categoryEmoji = {
  cervejas: '🍺', destilados: '🥃', drinks: '🍹', vinhos: '🍷',
  nao_alcoolicos: '🥤', bebidas: '🧃', petiscos: '🍟', porcoes: '🍖',
  pratos: '🍽️', sobremesas: '🍰'
};

const statusColor = {
  aberta: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  preparando: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  em_recebimento: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  fechada: 'bg-secondary text-muted-foreground border-border',
  cancelada: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function Comandas() {
  const qc = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showProducts, setShowProducts] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [noteItem, setNoteItem] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [sendingOrder, setSendingOrder] = useState(false);
  const [showCancelAuth, setShowCancelAuth] = useState(false);
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const tableId = urlParams.get('table');
  const tableType = urlParams.get('type');
  const tableNumber = urlParams.get('number');

  // Busca aberta e em_recebimento separadamente para garantir compatibilidade
  const { data: ordersAberta = [], isLoading: loadingAberta } = useOrders({ status: 'aberta' });
  const { data: ordersFechamento = [], isLoading: loadingFechamento } = useOrders({ status: 'em_recebimento' });
  const orders = [...ordersAberta, ...ordersFechamento];
  const loadingOrders = loadingAberta || loadingFechamento;
  const { data: products = [], isLoading: loadingProducts } = useProducts({ available: true });
  const { data: waiters = [], isLoading: loadingWaiters } = useWaiters({ active: true });
  const createOrderMutation = useCreateOrder();

  const loading = loadingOrders || loadingProducts || loadingWaiters;

  // Auto-open existing order for table
  const autoOrder = tableId ? orders.find(o => o.table_id === tableId && o.status === 'aberta') : null;
  const effectiveOrder = selectedOrder || autoOrder;

  const refreshOrder = async (orderId) => {
    const updated = await localDB.entities.Order.get(orderId);
    setSelectedOrder(updated);
    qc.invalidateQueries({ queryKey: ORDER_KEY });
  };

  const openNewOrder = async (waiterId) => {
    const waiter = waiters.find(w => w.id === waiterId);
    const order = await createOrderMutation.mutateAsync({
      table_id: tableId || null,
      table_number: tableNumber ? Number(tableNumber) : null,
      table_type: tableType || 'mesa',
      waiter_id: waiterId || null,
      waiter_name: waiter?.name || null,
      status: 'aberta',
      items: [],
      subtotal: 0,
      service_fee: 0,
      discount: 0,
      total: 0,
      opened_at: new Date().toISOString(),
    });
    if (tableId) await localDB.entities.Table.update(tableId, { status: 'ocupada' });
    setSelectedOrder(order);
    setShowNewOrder(false);
    qc.invalidateQueries({ queryKey: ['tables'] });
  };

  const openNewOrderManual = async (waiterId) => {
    const waiter = waiters.find(w => w.id === waiterId);
    const order = await createOrderMutation.mutateAsync({
      table_id: null,
      table_number: null,
      table_type: 'mesa',
      waiter_id: waiterId || null,
      waiter_name: waiter?.name || null,
      status: 'aberta',
      items: [],
      subtotal: 0,
      service_fee: 0,
      discount: 0,
      total: 0,
      opened_at: new Date().toISOString(),
    });
    setSelectedOrder(order);
    setShowNewOrder(false);
  };

  const addItem = async (product, modifiers = []) => {
    if (!effectiveOrder) return;
    const items = [...(effectiveOrder.items || [])];
    const extraPrice = modifiers.reduce((s, m) => s + (m.price || 0), 0);
    const unitPrice = product.price + extraPrice;
    const modifierNames = modifiers.map(m => m.name).join(', ');
    const existIdx = modifiers.length === 0 ? items.findIndex(i => i.product_id === product.id && !i.modifiers?.length) : -1;
    if (existIdx >= 0) {
      items[existIdx].quantity += 1;
      items[existIdx].total = items[existIdx].quantity * items[existIdx].unit_price;
    } else {
      items.push({ product_id: product.id, product_name: product.name, quantity: 1, unit_price: unitPrice, total: unitPrice, notes: modifierNames, modifiers, status: 'pendente' });
    }
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const service_fee = subtotal * 0.1;
    const total = subtotal + service_fee - (effectiveOrder.discount || 0);
    const updated = await localDB.entities.Order.update(effectiveOrder.id, { items, subtotal, service_fee, total });
    setSelectedOrder(updated);
    qc.invalidateQueries({ queryKey: ORDER_KEY });
  };

  const changeQty = async (idx, delta) => {
    const items = [...(effectiveOrder.items || [])];
    items[idx].quantity = Math.max(0, items[idx].quantity + delta);
    if (items[idx].quantity === 0) items.splice(idx, 1);
    else items[idx].total = items[idx].quantity * items[idx].unit_price;
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const service_fee = subtotal * 0.1;
    const total = subtotal + service_fee - (effectiveOrder.discount || 0);
    const updated = await localDB.entities.Order.update(effectiveOrder.id, { items, subtotal, service_fee, total });
    setSelectedOrder(updated);
    qc.invalidateQueries({ queryKey: ORDER_KEY });
  };

  const sendToKitchenBar = async () => {
    setSendingOrder(true);
    try {
      const pending = (effectiveOrder.items || []).filter(i => i.status === 'pendente');
      if (pending.length) printAutoByDept(effectiveOrder, products, pending);
      const items = (effectiveOrder.items || []).map(item =>
        item.status === 'pendente' ? { ...item, status: 'preparando' } : item
      );
      const updated = await localDB.entities.Order.update(effectiveOrder.id, { items, status: 'preparando' });
      setSelectedOrder(updated);
      qc.invalidateQueries({ queryKey: ORDER_KEY });
    } finally {
      setSendingOrder(false);
    }
  };

  const saveNote = async () => {
    const items = [...(effectiveOrder.items || [])];
    items[noteItem].notes = noteText;
    const updated = await localDB.entities.Order.update(effectiveOrder.id, { items });
    setSelectedOrder(updated);
    qc.invalidateQueries({ queryKey: ORDER_KEY });
    setNoteItem(null);
  };

  const closeOrder = async (paymentMethod, discountVal) => {
    const discount = Math.max(0, discountVal || 0);
    const finalTotal = Math.max(0, (effectiveOrder.subtotal || 0) + (effectiveOrder.service_fee || 0) - discount);
    await localDB.entities.Order.update(effectiveOrder.id, {
      status: 'fechada',
      payment_method: paymentMethod,
      discount,
      total: finalTotal,
      closed_at: new Date().toISOString(),
    });
    if (effectiveOrder.table_id) await localDB.entities.Table.update(effectiveOrder.table_id, { status: 'livre' });
    await deductStockForOrder(effectiveOrder);
    // Link to active cashier
    try {
      const cashiers = await localDB.entities.Cashier.filter({ status: 'aberto' });
      if (cashiers.length > 0) {
        const cashier = cashiers[0];
        const linked = cashier.linked_order_ids || [];
        if (!linked.includes(effectiveOrder.id)) {
          await localDB.entities.Cashier.update(cashier.id, { linked_order_ids: [...linked, effectiveOrder.id] });
        }
      }
    } catch { /* silently fail */ }
    setSelectedOrder(null);
    setShowClose(false);
    qc.invalidateQueries({ queryKey: ORDER_KEY });
    qc.invalidateQueries({ queryKey: ['tables'] });
    qc.invalidateQueries({ queryKey: ['cashiers'] });
    navigate('/Mesas');
  };

  const cancelOrder = () => setShowCancelAuth(true);

  const doCancelOrder = async () => {
    await localDB.entities.Order.update(effectiveOrder.id, { status: 'cancelada' });
    if (effectiveOrder.table_id) await localDB.entities.Table.update(effectiveOrder.table_id, { status: 'livre' });
    setSelectedOrder(null);
    qc.invalidateQueries({ queryKey: ORDER_KEY });
    qc.invalidateQueries({ queryKey: ['tables'] });
    navigate('/Mesas');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // List of open orders
  if (!effectiveOrder) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Comandas Abertas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{orders.length} ativas</p>
          </div>
          <Button onClick={() => setShowNewOrder(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Nova Comanda
          </Button>
        </div>
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-muted-foreground mb-4">Nenhuma comanda aberta</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedOrder(order)}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/40 transition-all"
              >
                <div>
                  <div className="font-semibold text-foreground">
                    {order.table_type === 'delivery' ? '🛵 Delivery' :
                     order.table_type === 'balcao' ? '🍺 Balcão' : `🪑 Mesa ${order.table_number || ''}`}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{order.items?.length || 0} itens</span>
                    {order.waiter_name && (
                      <span className="text-xs text-primary/70 flex items-center gap-1">
                        <User className="w-3 h-3" />{order.waiter_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">R$ {(order.total || 0).toFixed(2)}</div>
                  <Badge className={`text-xs border mt-1 ${statusColor[order.status]}`}>{order.status}</Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <WaiterPickerDialog
          open={showNewOrder}
          onClose={() => setShowNewOrder(false)}
          waiters={waiters}
          tableId={tableId}
          onConfirm={tableId ? openNewOrder : openNewOrderManual}
        />
      </div>
    );
  }

  // Active order detail
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => { setSelectedOrder(null); navigate('/Comandas'); }} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground">
              {effectiveOrder.table_type === 'delivery' ? '🛵 Delivery' :
               effectiveOrder.table_type === 'balcao' ? '🍺 Balcão' : `🪑 Mesa ${effectiveOrder.table_number || ''}`}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{effectiveOrder.items?.length || 0} itens · {effectiveOrder.status}</p>
              {effectiveOrder.waiter_name && (
                <span className="text-xs text-primary/80 flex items-center gap-1">
                  <User className="w-3 h-3" />{effectiveOrder.waiter_name}
                </span>
              )}
            </div>
          </div>
          {effectiveOrder.table_id && (
            <Button size="sm" variant="outline" className="gap-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" onClick={() => setShowTransfer(true)}>
              <ArrowRightLeft className="w-4 h-4" />
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={cancelOrder}>
            <X className="w-4 h-4" />
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setShowClose(true)}>
            <Check className="w-4 h-4" /> Fechar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        <AnimatePresence>
          {(effectiveOrder.items || []).map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-card transition-all ${
                item.status === 'preparando' ? 'border-amber-500/40' :
                item.status === 'pronto' ? 'border-emerald-500/40' : 'border-border'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-foreground truncate">{item.product_name}</p>
                  {item.status === 'preparando' && <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">Preparando</span>}
                  {item.status === 'pronto' && <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">Pronto</span>}
                </div>
                {item.notes && <p className="text-xs text-amber-400 mt-0.5 truncate">📝 {item.notes}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">R$ {item.unit_price.toFixed(2)} un.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => changeQty(idx, -1)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                <button onClick={() => changeQty(idx, 1)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="text-right min-w-[70px]">
                <p className="font-bold text-sm text-primary">R$ {item.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setNoteItem(idx); setNoteText(item.notes || ''); }} className="text-muted-foreground hover:text-amber-400 transition-colors">
                <StickyNote className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {(!effectiveOrder.items || effectiveOrder.items.length === 0) && (
          <div className="text-center py-12">
            <div className="text-3xl mb-2">🍽️</div>
            <p className="text-muted-foreground text-sm">Comanda vazia. Adicione itens!</p>
          </div>
        )}

        <Button className="w-full gap-2 mt-2" onClick={() => setShowProducts(true)}>
          <Plus className="w-4 h-4" /> Adicionar Itens
        </Button>
      </div>

      <div className="border-t border-border bg-card px-4 py-3 space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span><span>R$ {(effectiveOrder.subtotal || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Serviço (10%)</span><span>R$ {(effectiveOrder.service_fee || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
          <span>Total</span><span className="text-primary">R$ {(effectiveOrder.total || 0).toFixed(2)}</span>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={sendToKitchenBar} disabled={sendingOrder || !effectiveOrder.items?.length}>
            <Send className="w-4 h-4" />
            {sendingOrder ? 'Enviando...' : 'Enviar Pedido'}
          </Button>
          <Button variant="outline" className="gap-1.5 border-purple-500/40 text-purple-400 hover:bg-purple-500/10" onClick={() => printCustomerBill(effectiveOrder)}>
            <Receipt className="w-4 h-4" /> Conta
          </Button>
        </div>
      </div>

      <ProductSelector open={showProducts} onClose={() => setShowProducts(false)} products={products} onAdd={addItem} />

      <TransferTableDialog
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        order={effectiveOrder}
        onTransferred={(newTable) => {
          setSelectedOrder(prev => ({ ...prev, table_id: newTable.id, table_number: newTable.number, table_type: newTable.type }));
          setShowTransfer(false);
        }}
      />

      <CloseOrderDialog open={showClose} onClose={() => setShowClose(false)} order={effectiveOrder} onConfirm={closeOrder} />

      <CancelAuthModal
        open={showCancelAuth}
        onClose={() => setShowCancelAuth(false)}
        onConfirm={doCancelOrder}
        label="comanda"
      />

      <Dialog open={noteItem !== null} onOpenChange={() => setNoteItem(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Observação do Item</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ex: sem cebola, bem passado..." className="bg-secondary border-border" rows={3} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setNoteItem(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={saveNote}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WaiterPickerDialog({ open, onClose, waiters, onConfirm }) {
  const [waiterId, setWaiterId] = useState('');
  const handleConfirm = () => { onConfirm(waiterId || null); setWaiterId(''); };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Nova Comanda</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Garçom Responsável</Label>
            <Select value={waiterId} onValueChange={setWaiterId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar garçom (opcional)" /></SelectTrigger>
              <SelectContent>
                {waiters.map(w => <SelectItem key={w.id} value={w.id}>{w.name}{w.nickname ? ` (${w.nickname})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleConfirm}>Abrir Comanda</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CloseOrderDialog({ open, onClose, order, onConfirm }) {
  const [payMethod, setPayMethod] = useState('dinheiro');
  const [discount, setDiscount] = useState('0');
  if (!order) return null;
  const discountVal = parseFloat(discount) || 0;
  const finalTotal = (order.total || 0) - discountVal;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Fechar Comanda</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {order.waiter_name && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm">
              <User className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Garçom:</span>
              <span className="font-medium text-foreground">{order.waiter_name}</span>
            </div>
          )}
          <div className="rounded-xl bg-secondary p-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>R$ {(order.subtotal || 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-muted-foreground"><span>Serviço (10%)</span><span>R$ {(order.service_fee || 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Desconto</span>
              <Input value={discount} onChange={e => setDiscount(e.target.value)} type="number" className="w-24 h-6 text-xs text-right bg-background border-border" />
            </div>
            <div className="flex justify-between font-bold text-foreground border-t border-border pt-2">
              <span>Total Final</span><span className="text-primary">R$ {Math.max(0, finalTotal).toFixed(2)}</span>
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => printCustomerBill({ ...order, discount: discountVal, total: Math.max(0, finalTotal) })} className="gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
              <Receipt className="w-4 h-4" /> Imprimir Conta
            </Button>
          </div>
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
