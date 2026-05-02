import { useState } from 'react';
import { Plus, Users, Clock, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import MesaDetalhe from '@/components/MesaDetalhe';
import { useTables, useCreateTable } from '@/hooks/useTables';
import { useOrders } from '@/hooks/useOrders';

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

export default function Mesas() {
  const { data: tables = [], isLoading: loadingTables } = useTables();
  // Busca ordens abertas e em fechamento em consultas separadas e combina
  const { data: ordersAberta = [], isLoading: loadingAberta } = useOrders({ status: 'aberta' });
  const { data: ordersFechamento = [], isLoading: loadingFechamento } = useOrders({ status: 'em_recebimento' });
  const orders = [...ordersAberta, ...ordersFechamento];
  const loadingOrders = loadingAberta || loadingFechamento;
  const createTableMutation = useCreateTable();
  const loading = loadingTables || loadingOrders;

  const [showNew, setShowNew] = useState(false);
  const [newTable, setNewTable] = useState({ number: '', type: 'mesa', capacity: '' });
  const [selectedTable, setSelectedTable] = useState(null);

  const createTable = async () => {
    if (!newTable.number || !newTable.type) return;
    await createTableMutation.mutateAsync({
      number: Number(newTable.number),
      type: newTable.type,
      capacity: Number(newTable.capacity) || 4,
      status: 'livre',
      active: true
    });
    setShowNew(false);
    setNewTable({ number: '', type: 'mesa', capacity: '' });
  };

  const openOrder = (table) => {
    setSelectedTable(table);
  };

  const getTableOrder = (tableId) => orders.find(o => o.table_id === tableId);

  const grouped = {
    mesa: tables.filter(t => t.type === 'mesa' && t.active),
    balcao: tables.filter(t => t.type === 'balcao' && t.active),
    delivery: tables.filter(t => t.type === 'delivery' && t.active),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (selectedTable) {
    return (
      <MesaDetalhe
        table={selectedTable}
        existingOrder={getTableOrder(selectedTable.id) || null}
        onBack={() => setSelectedTable(null)}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mesas & Atendimento</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tables.filter(t => t.active).length} locais ativos</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nova Mesa
        </Button>
      </div>

      {Object.entries(grouped).map(([type, items]) => (
        items.length > 0 && (
          <div key={type} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{typeConfig[type].icon}</span>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{typeConfig[type].label}s</h2>
              <span className="text-xs text-muted-foreground">({items.length})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((table, i) => {
                const order = getTableOrder(table.id);
                const isEmFechamento = order?.status === 'em_recebimento';
                const status = order ? 'ocupada' : table.status;
                const cfg = statusConfig[status] || statusConfig.livre;
                return (
                  <motion.div
                    key={table.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => openOrder(table)}
                    className={`relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${
                      isEmFechamento
                        ? 'border-purple-500/70 bg-purple-500/10 shadow-purple-500/10 shadow-md'
                        : status === 'ocupada'
                        ? 'border-amber-500/70 bg-amber-500/10 shadow-amber-500/10 shadow-md'
                        : status === 'reservada'
                        ? 'border-blue-500/50 bg-blue-500/8'
                        : 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60'
                    }`}
                  >
                    {/* Status dot */}
                    <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                      isEmFechamento ? 'bg-purple-400 animate-pulse' :
                      status === 'ocupada' ? 'bg-amber-400 animate-pulse' :
                      status === 'reservada' ? 'bg-blue-400' : 'bg-emerald-400'
                    }`} />

                    <div className="mb-3">
                      <span className={`text-2xl font-black ${
                        isEmFechamento ? 'text-purple-300' :
                        status === 'ocupada' ? 'text-amber-300' :
                        status === 'reservada' ? 'text-blue-300' : 'text-emerald-300'
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
                        <Users className="w-3 h-3" />
                        <span>{table.capacity} lug.</span>
                      </div>
                    )}
                    {order && (
                      <div className={`flex items-center gap-1 text-xs mt-1.5 font-semibold ${isEmFechamento ? 'text-purple-400' : 'text-amber-400'}`}>
                        <ShoppingBag className="w-3 h-3" />
                        <span>R$ {(order.total || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {order?.items?.length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                      </div>
                    )}
                    {!order && status === 'livre' && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        <span>Livre</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )
      ))}

      {tables.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🪑</div>
          <p className="text-muted-foreground mb-4">Nenhuma mesa cadastrada ainda</p>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Adicionar primeira mesa
          </Button>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Nova Mesa / Local</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Número / Nome</Label>
              <Input
                placeholder="Ex: 1, 2, 3..."
                value={newTable.number}
                onChange={e => setNewTable(p => ({ ...p, number: e.target.value }))}
                className="mt-1.5 bg-secondary border-border"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newTable.type} onValueChange={v => setNewTable(p => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1.5 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mesa">🪑 Mesa</SelectItem>
                  <SelectItem value="balcao">🍺 Balcão</SelectItem>
                  <SelectItem value="delivery">🛵 Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Capacidade (opcional)</Label>
              <Input
                placeholder="Ex: 4"
                type="number"
                value={newTable.capacity}
                onChange={e => setNewTable(p => ({ ...p, capacity: e.target.value }))}
                className="mt-1.5 bg-secondary border-border"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={createTable}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
