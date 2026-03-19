import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Minus, Send, Receipt, Check, X, StickyNote, ArrowRightLeft, Printer } from 'lucide-react';
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

export default function GarcomComanda({ waiter, table, existingOrder, onBack }) {
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [showProducts, setShowProducts] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [noteItem, setNoteItem] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [sendingOrder, setSendingOrder] = useState(false);
  const queryClient = useQueryClient();

  const perms = waiter?.permissions || {};

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const prods = await localDB.entities.Product.filter({ available: true });
    setProducts(prods);

    if (existingOrder) {
      setOrder(existingOrder);
    } else {
      // Create new order
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
  };

  const recalc = (items) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const service_fee = subtotal * 0.1;
    return { subtotal, service_fee, total: subtotal + service_fee };
  };

  const updateOrder = async (newItems) => {
    const totals = recalc(newItems);
    const updated = { ...order, items: newItems, ...totals };
    setOrder(updated);
    await localDB.entities.Order.update(order.id, { items: newItems, ...totals });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const addItem = (product, modifiers = []) => {
    addItemsBulk([{ product, modifiers, qty: 1 }]);
  };

  const buildItemsFromEntries = (entries, baseItems) => {
    const items = [...baseItems];
    entries.forEach(({ product, modifiers = [], qty = 1 }) => {
      const extraPrice = modifiers.reduce((s, m) => s + (m.price || 0), 0);
      const unitPrice = product.price + extraPrice;
      const modifierNames = modifiers.map(m => m.name).join(', ');
      const existing = modifiers.length === 0 ? items.findIndex(i => i.product_id === product.id && !i.notes && !i.modifiers?.length) : -1;
      if (existing >= 0) {
        items[existing] = { ...items[existing], quantity: items[existing].quantity + qty, total: (items[existing].quantity + qty) * items[existing].unit_price };
      } else {
        items.push({
          product_id: product.id,
          product_name: product.name,
          quantity: qty,
          unit_price: unitPrice,
          total: unitPrice * qty,
          status: 'pendente',
          notes: modifierNames,
          modifiers: modifiers,
        });
      }
    });
    return items;
  };

  const addItemsBulk = (entries) => {
    const items = buildItemsFromEntries(entries, order.items || []);
    updateOrder(items);
  };

  // Called when user clicks "Enviar" in ProductSelector — adds items AND sends to kitchen atomically
  const addBulkAndSend = async (entries) => {
    setSendingOrder(true);
    const items = buildItemsFromEntries(entries, order.items || []);
    // Save first
    const totals = recalc(items);
    const updatedOrder = { ...order, items, ...totals };
    setOrder(updatedOrder);
    await localDB.entities.Order.update(order.id, { items, ...totals });
    // Print before changing status so we capture the pending items
    const pending = items.filter(i => i.status === 'pendente');
    if (pending.length) printAutoByDept(updatedOrder, products, pending);
    const sentItems = items.map(i => i.status === 'pendente' ? { ...i, status: 'preparando' } : i);
    const sentTotals = recalc(sentItems);
    const finalOrder = { ...updatedOrder, items: sentItems, ...sentTotals };
    setOrder(finalOrder);
    await localDB.entities.Order.update(order.id, { items: sentItems, ...sentTotals });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    setSendingOrder(false);
  };

  const changeQty = (idx, delta) => {
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
    setSendingOrder(true);
    const pending = (order.items || []).filter(i => i.status === 'pendente');
    if (pending.length) printAutoByDept(order, products, pending);
    const updatedItems = (order.items || []).map(i => i.status === 'pendente' ? { ...i, status: 'preparando' } : i);
    await updateOrder(updatedItems);
    setSendingOrder(false);
  };

  // Wrapper for ProductSelector onSend — receives cart entries and does add+send atomically
  const handleProductSend = perms.can_send_to_kitchen !== false
    ? (entries) => addBulkAndSend(entries)
    : undefined;

  const closeOrder = async (payMethod) => {
    await localDB.entities.Order.update(order.id, {
      status: 'fechada',
      payment_method: payMethod,
      closed_at: new Date().toISOString(),
    });
    await Promise.all([
      localDB.entities.Table.update(order.table_id, { status: 'livre' }),
      deductStockForOrder(order),
    ]);
    queryClient.invalidateQueries({ queryKey: ['tables'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['cashiers'] });
    onBack();
  };

  const cancelOrder = async () => {
    if (!perms.can_cancel_order) return;
    await localDB.entities.Order.update(order.id, { status: 'cancelada' });
    if (order.table_id) await localDB.entities.Table.update(order.table_id, { status: 'livre' });
    queryClient.invalidateQueries({ queryKey: ['tables'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    onBack();
  };

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground">
              {order.table_type === 'balcao' ? '🍺 Balcão' : `🪑 Mesa ${order.table_number || ''}`}
            </h2>
            <p className="text-xs text-muted-foreground">{order.items?.length || 0} itens</p>
          </div>
          {perms.can_transfer_table && order.table_id && (
            <Button size="sm" variant="outline" className="gap-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" onClick={() => setShowTransfer(true)}>
              <ArrowRightLeft className="w-4 h-4" />
            </Button>
          )}
          {perms.can_cancel_order && (
            <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={cancelOrder}>
              <X className="w-4 h-4" />
            </Button>
          )}
          {perms.can_close_order !== false && (
            <Button size="sm" className="gap-1" onClick={() => setShowClose(true)}>
              <Check className="w-4 h-4" /> Fechar
            </Button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        <AnimatePresence>
          {(order.items || []).map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`flex items-center gap-3 p-3 rounded-xl border bg-card ${
                item.status === 'preparando' ? 'border-amber-500/40' :
                item.status === 'pronto' ? 'border-emerald-500/40' : 'border-border'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{item.product_name}</p>
                {item.notes && <p className="text-xs text-amber-400 mt-0.5">📝 {item.notes}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">R$ {item.unit_price.toFixed(2)} un.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => changeQty(idx, -1)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button onClick={() => changeQty(idx, 1)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="text-right min-w-[70px]">
                <p className="font-bold text-sm text-primary">R$ {item.total.toFixed(2)}</p>
              </div>
              <button onClick={() => { setNoteItem(idx); setNoteText(item.notes || ''); }} className="text-muted-foreground hover:text-amber-400">
                <StickyNote className="w-4 h-4" />
              </button>
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
      <div className="border-t border-border bg-card px-4 py-3 space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span><span>R$ {(order.subtotal || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Serviço (10%)</span><span>R$ {(order.service_fee || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
          <span>Total</span>
          <span className="text-primary">R$ {(order.total || 0).toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 gap-2" onClick={() => setShowProducts(true)}>
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
          {perms.can_send_to_kitchen !== false && (
            <Button
              variant="outline"
              className="flex-1 gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={sendToKitchenBar}
              disabled={sendingOrder || !(order.items || []).some(i => i.status === 'pendente')}
            >
              {sendingOrder ? (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              {sendingOrder ? 'Enviando...' : 'Enviar'}
            </Button>
          )}
        </div>
        {perms.can_print_bill !== false && (
          <Button variant="outline" className="w-full gap-1.5 border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
            onClick={() => printCustomerBill(order)}>
            <Receipt className="w-4 h-4" /> Imprimir Conta
          </Button>
        )}
      </div>

      <ProductSelector open={showProducts} onClose={() => setShowProducts(false)} products={products} onAdd={addItem} onAddBulk={addItemsBulk} onSend={handleProductSend} />

      {perms.can_transfer_table && (
        <TransferTableDialog
          open={showTransfer}
          onClose={() => setShowTransfer(false)}
          order={order}
          onTransferred={(newTable) => {
            setOrder(prev => ({ ...prev, table_id: newTable.id, table_number: newTable.number, table_type: newTable.type }));
            setShowTransfer(false);
          }}
        />
      )}

      {/* Close order dialog */}
      <CloseOrderDialog
        open={showClose}
        onClose={() => setShowClose(false)}
        order={order}
        canDiscount={perms.can_apply_discount}
        canPrint={perms.can_print_bill !== false}
        onConfirm={closeOrder}
      />

      {/* Note dialog */}
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
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onConfirm(payMethod)}>
              <Check className="w-4 h-4 mr-1" /> Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
