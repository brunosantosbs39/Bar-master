import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Package, Plus, AlertTriangle, TrendingDown, TrendingUp, Edit2, Trash2, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct'];

const emptyForm = {
  name: '', product_id: '', product_name: '', unit: 'un',
  quantity: 0, min_quantity: 0, deduct_per_sale: 1, active: true,
};

export default function Estoque() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showMovements, setShowMovements] = useState(null); // stock item id
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [tab, setTab] = useState('estoque'); // 'estoque' | 'alertas'

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([
      base44.entities.StockItem.list('-updated_date'),
      base44.entities.Product.list(),
    ]);
    setItems(s);
    setProducts(p);
    setLoading(false);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({ ...item });
    setEditingItem(item);
    setShowForm(true);
  };

  const handleProductSelect = (productId) => {
    const p = products.find(p => p.id === productId);
    setForm(f => ({ ...f, product_id: productId, product_name: p?.name || '', name: f.name || p?.name || '' }));
  };

  const saveItem = async () => {
    if (!form.name.trim()) return;
    if (editingItem) {
      await base44.entities.StockItem.update(editingItem.id, form);
    } else {
      await base44.entities.StockItem.create(form);
    }
    setShowForm(false);
    loadAll();
  };

  const deleteItem = async (id) => {
    await base44.entities.StockItem.delete(id);
    loadAll();
  };

  const openAdjust = (item) => {
    setAdjustItem(item);
    setAdjustQty('');
    setAdjustNotes('');
  };

  const saveAdjust = async (type) => {
    if (!adjustQty || isNaN(adjustQty)) return;
    const qty = parseFloat(adjustQty);
    const before = adjustItem.quantity || 0;
    const after = type === 'entrada' ? before + qty : Math.max(0, before - qty);

    await Promise.all([
      base44.entities.StockItem.update(adjustItem.id, { quantity: after }),
      base44.entities.StockMovement.create({
        stock_item_id: adjustItem.id,
        stock_item_name: adjustItem.name,
        type: type === 'entrada' ? 'entrada' : 'ajuste',
        quantity: qty,
        quantity_before: before,
        quantity_after: after,
        notes: adjustNotes || `Ajuste manual - ${type}`,
      }),
    ]);
    setAdjustItem(null);
    loadAll();
  };

  const loadMovements = async (stockId) => {
    const mvs = await base44.entities.StockMovement.filter({ stock_item_id: stockId }, '-created_date', 30);
    setMovements(mvs);
    setShowMovements(stockId);
  };

  const alerts = items.filter(i => i.active && (i.quantity || 0) <= (i.min_quantity || 0) && i.min_quantity > 0);
  const activeItems = items.filter(i => i.active);

  const displayItems = tab === 'alertas' ? alerts : activeItems;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
            <p className="text-sm text-muted-foreground">Controle de inventário</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Novo Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-foreground">{activeItems.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Itens ativos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className={`text-2xl font-black ${alerts.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{alerts.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Alertas</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-black text-foreground">{items.filter(i => (i.quantity || 0) === 0).length}</p>
          <p className="text-xs text-muted-foreground mt-1">Zerados</p>
        </div>
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            <strong>{alerts.length} {alerts.length === 1 ? 'item abaixo' : 'itens abaixo'}</strong> da quantidade mínima!
          </p>
          <button onClick={() => setTab('alertas')} className="ml-auto text-xs text-amber-400 underline">Ver</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1">
        {[['estoque', 'Todos os Itens'], ['alertas', `Alertas ${alerts.length > 0 ? `(${alerts.length})` : ''}`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{tab === 'alertas' ? 'Nenhum alerta no momento 🎉' : 'Nenhum item cadastrado'}</p>
            {tab === 'estoque' && <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={openAdd}><Plus className="w-3.5 h-3.5" /> Cadastrar primeiro item</Button>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence>
              {displayItems.map((item, i) => {
                const isLow = item.min_quantity > 0 && (item.quantity || 0) <= item.min_quantity;
                const isEmpty = (item.quantity || 0) === 0;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-2 h-10 rounded-full shrink-0 ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.product_name && (
                          <span className="text-xs text-muted-foreground">📦 {item.product_name}</span>
                        )}
                        {isLow && !isEmpty && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Estoque baixo
                          </span>
                        )}
                        {isEmpty && (
                          <span className="text-xs text-red-400">⚠️ Zerado</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-lg leading-none ${isEmpty ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-foreground'}`}>
                        {item.quantity ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.unit}</p>
                    </div>
                    {item.min_quantity > 0 && (
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-xs text-muted-foreground">mín. {item.min_quantity}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openAdjust(item)} title="Ajustar" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => loadMovements(item.id)} title="Histórico" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <History className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(item)} title="Editar" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteItem(item.id)} title="Excluir" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {editingItem ? 'Editar Item' : 'Novo Item de Estoque'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Vincular a produto (opcional)</Label>
              <Select value={form.product_id || 'none'} onValueChange={v => v === 'none' ? setForm(f => ({ ...f, product_id: '', product_name: '' })) : handleProductSelect(v)}>
                <SelectTrigger className="mt-1.5 bg-secondary border-border"><SelectValue placeholder="Selecionar produto..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Vincule a um produto para baixa automática ao fechar comandas</p>
            </div>
            <div>
              <Label>Nome do item *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Cerveja Long Neck" className="mt-1.5 bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="mt-1.5 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deduzir por venda</Label>
                <Input type="number" value={form.deduct_per_sale} onChange={e => setForm(f => ({ ...f, deduct_per_sale: parseFloat(e.target.value) || 1 }))} className="mt-1.5 bg-secondary border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade atual</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} className="mt-1.5 bg-secondary border-border" />
              </div>
              <div>
                <Label>Quantidade mínima</Label>
                <Input type="number" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: parseFloat(e.target.value) || 0 }))} placeholder="Alerta" className="mt-1.5 bg-secondary border-border" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveItem} disabled={!form.name.trim()}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={!!adjustItem} onOpenChange={() => setAdjustItem(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Estoque — {adjustItem?.name}</DialogTitle>
          </DialogHeader>
          {adjustItem && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
                <Package className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Quantidade atual</p>
                  <p className="text-2xl font-black text-foreground">{adjustItem.quantity ?? 0} <span className="text-sm font-normal text-muted-foreground">{adjustItem.unit}</span></p>
                </div>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0" className="mt-1.5 bg-secondary border-border" autoFocus />
              </div>
              <div>
                <Label>Observação (opcional)</Label>
                <Input value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder="Ex: compra de fornecedor" className="mt-1.5 bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => saveAdjust('entrada')}>
                  <TrendingUp className="w-4 h-4" /> Entrada
                </Button>
                <Button variant="outline" className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => saveAdjust('saida')}>
                  <TrendingDown className="w-4 h-4" /> Saída
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Movements Dialog */}
      <Dialog open={!!showMovements} onOpenChange={() => setShowMovements(null)}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Histórico</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {movements.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">Nenhuma movimentação</p>
            ) : movements.map((m, i) => (
              <div key={m.id || i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  m.type === 'entrada' ? 'bg-emerald-500/20 text-emerald-400' :
                  m.type === 'saida' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {m.type === 'entrada' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{new Date(m.created_date).toLocaleString('pt-BR')}</p>
                  <p className="text-sm text-foreground font-medium">
                    {m.type === 'entrada' ? '+' : '-'}{m.quantity} → {m.quantity_after}
                  </p>
                  {m.notes && <p className="text-xs text-muted-foreground truncate">{m.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}