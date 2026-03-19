import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWaiterSession } from '@/lib/WaiterSessionContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ShoppingBag, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import TableSummaryModal from '@/components/TableSummaryModal';
import GarcomComanda from '@/components/GarcomComanda';

const statusConfig = {
  livre: { label: 'Livre', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  ocupada: { label: 'Ocupada', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  reservada: { label: 'Reservada', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

const typeConfig = {
  mesa: { label: 'Mesa', icon: '🪑' },
  balcao: { label: 'Balcão', icon: '🍺' },
  delivery: { label: 'Delivery', icon: '🛵' },
};

export default function GarcomApp() {
  const { waiter, logout } = useWaiterSession();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryTable, setSummaryTable] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    if (!waiter) { navigate('/GarcomLogin'); return; }
    loadData();
  }, [waiter]);

  const loadData = async () => {
    setLoading(true);
    const [t, o] = await Promise.all([
      base44.entities.Table.filter({ active: true }),
      base44.entities.Order.filter({ status: 'aberta' })
    ]);
    setTables(t);
    setOrders(o);
    setLoading(false);
  };

  const getTableOrder = (tableId) => orders.find(o => o.table_id === tableId);

  const openTable = (table) => {
    const order = getTableOrder(table.id);
    if (order || table.status === 'ocupada') {
      setSummaryTable(table);
    } else {
      // Open new order for this table
      setActiveOrder({ isNew: true, table });
    }
  };

  const grouped = {
    mesa: tables.filter(t => t.type === 'mesa'),
    balcao: tables.filter(t => t.type === 'balcao'),
    delivery: tables.filter(t => t.type === 'delivery'),
  };

  const handleLogout = () => { logout(); navigate('/GarcomLogin'); };

  if (!waiter) return null;

  // Show comanda view
  if (activeOrder) {
    return (
      <GarcomComanda
        waiter={waiter}
        table={activeOrder.table}
        existingOrder={activeOrder.order || null}
        onBack={() => { setActiveOrder(null); loadData(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="text-xl">🍺</div>
        <div className="flex-1">
          <p className="font-bold text-foreground text-sm">Olá, {waiter.nickname || waiter.name.split(' ')[0]}!</p>
          <p className="text-xs text-muted-foreground">Suas mesas</p>
        </div>
        <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors p-2">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([type, items]) =>
              items.length > 0 && (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{typeConfig[type].icon}</span>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{typeConfig[type].label}s</h2>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {items.map((table, i) => {
                      const order = getTableOrder(table.id);
                      const status = order ? 'ocupada' : table.status;
                      const cfg = statusConfig[status] || statusConfig.livre;
                      return (
                        <motion.div
                          key={table.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => openTable(table)}
                          className={`relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${
                            status === 'ocupada'
                              ? 'border-amber-500/70 bg-amber-500/10 shadow-amber-500/10 shadow-md'
                              : 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
                          }`}
                        >
                          <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                            status === 'ocupada' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                          }`} />
                          <div className="mb-2">
                            <span className={`text-2xl font-black ${status === 'ocupada' ? 'text-amber-300' : 'text-emerald-300'}`}>
                              {type === 'delivery' ? `#${table.number}` : table.number}
                            </span>
                          </div>
                          <Badge className={`text-xs border mb-2 ${cfg.color}`}>{cfg.label}</Badge>
                          {table.capacity && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Users className="w-3 h-3" /><span>{table.capacity} lug.</span>
                            </div>
                          )}
                          {order && (
                            <div className="flex items-center gap-1 text-xs text-amber-400 mt-1 font-semibold">
                              <ShoppingBag className="w-3 h-3" />
                              <span>R$ {(order.total || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {!order && status === 'livre' && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3" /><span>Livre</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
            {tables.length === 0 && (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🪑</div>
                <p className="text-muted-foreground text-sm">Nenhuma mesa disponível</p>
              </div>
            )}
          </div>
        )}
      </div>

      <TableSummaryModal
        table={summaryTable}
        order={summaryTable ? getTableOrder(summaryTable.id) : null}
        open={!!summaryTable}
        onClose={() => setSummaryTable(null)}
        onOpenOrder={(order) => {
          setSummaryTable(null);
          setActiveOrder({ order, table: summaryTable });
        }}
      />
    </div>
  );
}