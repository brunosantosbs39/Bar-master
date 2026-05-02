import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { useWaiterSession } from '@/lib/WaiterSessionContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ShoppingBag, LogOut, Shield, Check, X, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useMenuUrl } from '@/lib/useMenuUrl';
import { useBranding } from '@/lib/useBranding';
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

const DEFAULT_PERMS = {
  can_send_to_kitchen: true,
  can_close_order: true,
  can_print_bill: true,
  can_cancel_order: false,
  can_apply_discount: false,
  can_transfer_table: false,
};

const PERM_LABELS = {
  can_send_to_kitchen: 'Enviar pedido',
  can_close_order:     'Fechar comanda',
  can_print_bill:      'Imprimir conta',
  can_cancel_order:    'Cancelar comanda',
  can_apply_discount:  'Dar desconto',
  can_transfer_table:  'Transferir mesa',
};

function PermissoesBadge({ waiter }) {
  const [open, setOpen] = useState(false);
  const perms = { ...DEFAULT_PERMS, ...(waiter?.permissions || {}) };
  const ativos = Object.values(perms).filter(Boolean).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Shield className="w-3.5 h-3.5" />
        {ativos}/{Object.keys(perms).length} permissões
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-56 rounded-xl border border-border bg-card shadow-xl p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suas permissões</p>
          {Object.entries(PERM_LABELS).map(([key, label]) => {
            const allowed = perms[key];
            return (
              <div key={key} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${allowed ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground/50 bg-secondary'}`}>
                {allowed ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QRModal({ open, onClose }) {
  const menuUrl = useMenuUrl();
  const { barName } = useBranding();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-5 bg-white rounded-3xl p-8 max-w-xs w-full"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-black font-black text-xl text-center">{barName}</p>
        <QRCodeSVG
          value={menuUrl}
          size={220}
          level="M"
          includeMargin={false}
        />
        <p className="text-gray-500 text-sm text-center">Escaneie para ver o cardápio</p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

export default function GarcomApp() {
  const { waiter, logout } = useWaiterSession();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryTable, setSummaryTable] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!waiter) { navigate('/GarcomLogin'); return; }
    loadData();
  }, [waiter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Busca status em duas requisições separadas para garantir compatibilidade
      const [t, oAberta, oFechamento] = await Promise.all([
        localDB.entities.Table.filter({ active: true }),
        localDB.entities.Order.filter({ status: 'aberta' }),
        localDB.entities.Order.filter({ status: 'em_recebimento' }),
      ]);
      setTables(t);
      setOrders([...oAberta, ...oFechamento]);
    } catch (e) {
      console.error('[GarcomApp] Erro ao carregar mesas:', e);
    } finally {
      setLoading(false);
    }
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
        <PermissoesBadge waiter={waiter} />
        <button
          onClick={() => setShowQR(true)}
          className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/70 transition-all"
          title="Mostrar QR Code do cardápio"
        >
          <QrCode className="w-6 h-6" />
          <span className="text-[9px] font-medium leading-none">QR Code</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/70 transition-all"
          title="Sair"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[9px] font-medium leading-none">Sair</span>
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
                      const isEmFechamento = order?.status === 'em_recebimento';
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
                            isEmFechamento
                              ? 'border-purple-500/70 bg-purple-500/10 shadow-purple-500/10 shadow-md'
                              : status === 'ocupada'
                              ? 'border-amber-500/70 bg-amber-500/10 shadow-amber-500/10 shadow-md'
                              : 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
                          }`}
                        >
                          <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                            isEmFechamento ? 'bg-purple-400 animate-pulse' :
                            status === 'ocupada' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                          }`} />
                          <div className="mb-2">
                            <span className={`text-2xl font-black ${
                              isEmFechamento ? 'text-purple-300' :
                              status === 'ocupada' ? 'text-amber-300' : 'text-emerald-300'
                            }`}>
                              {type === 'delivery' ? `#${table.number}` : table.number}
                            </span>
                          </div>
                          {isEmFechamento ? (
                            <Badge className="text-xs border mb-2 bg-purple-500/15 text-purple-400 border-purple-500/30">🔒 Fechamento</Badge>
                          ) : (
                            <Badge className={`text-xs border mb-2 ${cfg.color}`}>{cfg.label}</Badge>
                          )}
                          {table.capacity && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Users className="w-3 h-3" /><span>{table.capacity} lug.</span>
                            </div>
                          )}
                          {order && (
                            <div className={`flex items-center gap-1 text-xs mt-1 font-semibold ${isEmFechamento ? 'text-purple-400' : 'text-amber-400'}`}>
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

      <QRModal open={showQR} onClose={() => setShowQR(false)} />

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