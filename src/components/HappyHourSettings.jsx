import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { Plus, Trash2, Power, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { invalidateHappyHourCache } from '@/lib/happyHourUtils';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CATEGORIES = [
  { value: 'cervejas', label: '🍺 Cervejas' },
  { value: 'destilados', label: '🥃 Destilados' },
  { value: 'drinks', label: '🍹 Drinks' },
  { value: 'vinhos', label: '🍷 Vinhos' },
  { value: 'nao_alcoolicos', label: '🥤 Não Alcoólicos' },
  { value: 'bebidas', label: '🧃 Bebidas' },
  { value: 'petiscos', label: '🍟 Petiscos' },
  { value: 'porcoes', label: '🍖 Porções' },
  { value: 'pratos', label: '🍽️ Pratos' },
  { value: 'sobremesas', label: '🍰 Sobremesas' },
];

const EMPTY_FORM = {
  name: 'Happy Hour',
  discount_percent: 20,
  start_time: '17:00',
  end_time: '19:00',
  days_of_week: [1, 2, 3, 4, 5],
  categories: [],
  active: true,
};

// HappyHour stored in a separate localStorage key
const HappyHourDB = {
  list: () => {
    try {
      const raw = localStorage.getItem('bm_happyhour');
      return Promise.resolve(raw ? JSON.parse(raw) : []);
    } catch { return Promise.resolve([]); }
  },
  create: (data) => {
    const items = JSON.parse(localStorage.getItem('bm_happyhour') || '[]');
    const now = new Date().toISOString();
    const item = { ...data, id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, created_at: now };
    items.push(item);
    localStorage.setItem('bm_happyhour', JSON.stringify(items));
    return Promise.resolve(item);
  },
  update: (id, data) => {
    const items = JSON.parse(localStorage.getItem('bm_happyhour') || '[]');
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) items[idx] = { ...items[idx], ...data };
    localStorage.setItem('bm_happyhour', JSON.stringify(items));
    return Promise.resolve(items[idx]);
  },
  delete: (id) => {
    const items = JSON.parse(localStorage.getItem('bm_happyhour') || '[]').filter(i => i.id !== id);
    localStorage.setItem('bm_happyhour', JSON.stringify(items));
    return Promise.resolve();
  },
  filter: (filters) => {
    return HappyHourDB.list().then(items => {
      return items.filter(item => Object.entries(filters).every(([k, v]) => item[k] === v));
    });
  },
};

// Export for use in happyHourUtils
export { HappyHourDB };

export default function HappyHourSettings() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
    setLoading(true);
    const data = await HappyHourDB.list();
    setRules(data);
    setLoading(false);
  };

  const save = async () => {
    await HappyHourDB.create({ ...form });
    invalidateHappyHourCache();
    setShowForm(false);
    setForm(EMPTY_FORM);
    loadRules();
  };

  const toggle = async (rule) => {
    await HappyHourDB.update(rule.id, { active: !rule.active });
    invalidateHappyHourCache();
    loadRules();
  };

  const remove = async (id) => {
    await HappyHourDB.delete(id);
    invalidateHappyHourCache();
    loadRules();
  };

  const toggleDay = (d) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(d)
        ? prev.days_of_week.filter(x => x !== d)
        : [...prev.days_of_week, d]
    }));
  };

  const toggleCat = (c) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(c)
        ? prev.categories.filter(x => x !== c)
        : [...prev.categories, c]
    }));
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-foreground">Happy Hour / Promoções</span>
        <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">{rules.length} regras</Badge>
        <Button size="sm" variant="outline" className="gap-1.5 ml-2" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5" /> Nova
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">Nenhuma promoção configurada</p>
          <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Criar Happy Hour
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rules.map(rule => (
            <div key={rule.id} className={`flex items-center gap-3 px-4 py-3 ${!rule.active ? 'opacity-50' : ''}`}>
              <div className="text-2xl">🎉</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-foreground">{rule.name}</p>
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs border">
                    -{rule.discount_percent}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rule.start_time} – {rule.end_time}
                  {rule.days_of_week?.length ? ` · ${rule.days_of_week.map(d => DAYS[d]).join(', ')}` : ' · Todos os dias'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rule.categories?.length ? rule.categories.join(', ') : 'Todos os produtos'}
                </p>
              </div>
              <button onClick={() => toggle(rule)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Power className="w-4 h-4" />
              </button>
              <button onClick={() => remove(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Nova Promoção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1.5 bg-secondary border-border" />
            </div>
            <div>
              <Label>Desconto (%)</Label>
              <Input type="number" min="1" max="100" value={form.discount_percent} onChange={e => setForm(p => ({ ...p, discount_percent: Number(e.target.value) }))} className="mt-1.5 bg-secondary border-border" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Início</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className="mt-1.5 bg-secondary border-border" />
              </div>
              <div className="flex-1">
                <Label>Fim</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className="mt-1.5 bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Dias da semana (vazio = todos)</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      form.days_of_week.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Categorias com desconto (vazio = todas)</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c.value} onClick={() => toggleCat(c.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      form.categories.includes(c.value) ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground'
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={save} disabled={!form.name || !form.discount_percent}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
