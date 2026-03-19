import { Clock, ShoppingBag, User, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function useElapsed(openedAt) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const calc = () => {
      if (!openedAt) return setElapsed('');
      const diff = Math.floor((Date.now() - new Date(openedAt).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0) setElapsed(`${h}h ${m}min`);
      else if (m > 0) setElapsed(`${m}min ${s}s`);
      else setElapsed(`${s}s`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [openedAt]);
  return elapsed;
}

export default function TableSummaryModal({ table, order, open, onClose, onOpenOrder }) {
  const navigate = useNavigate();
  const elapsed = useElapsed(order?.opened_at);

  if (!table) return null;

  const goToOrder = () => {
    onClose();
    if (onOpenOrder) {
      onOpenOrder(order);
    } else {
      navigate(`/Comandas?table=${table.id}&type=${table.type}&number=${table.number}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {table.type === 'balcao' ? '🍺 Balcão' : table.type === 'delivery' ? '🛵 Delivery' : `🪑 Mesa ${table.number}`}
            <span className="ml-auto text-xs font-normal text-amber-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {elapsed}
            </span>
          </DialogTitle>
        </DialogHeader>

        {order ? (
          <div className="space-y-3">
            {/* Waiter */}
            {order.waiter_name && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm">
                <User className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Garçom:</span>
                <span className="font-medium text-foreground">{order.waiter_name}</span>
              </div>
            )}

            {/* Items list */}
            <div className="rounded-xl bg-secondary divide-y divide-border overflow-hidden">
              {(order.items || []).length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">Nenhum item ainda</p>
              ) : (
                (order.items || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 text-center">{item.quantity}×</span>
                      <span className="text-foreground">{item.product_name}</span>
                    </div>
                    <span className="text-primary font-medium">R$ {item.total.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="space-y-1 px-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Serviço (10%)</span>
                <span>R$ {(order.service_fee || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2 mt-2">
                <span>Total</span>
                <span className="text-primary">R$ {(order.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <Button className="w-full gap-2 mt-1" onClick={goToOrder}>
              <ShoppingBag className="w-4 h-4" /> Abrir Comanda
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm mb-4">Nenhuma comanda aberta para esta mesa.</p>
            <Button className="w-full gap-2" onClick={goToOrder}>
              <ShoppingBag className="w-4 h-4" /> Abrir Nova Comanda
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}