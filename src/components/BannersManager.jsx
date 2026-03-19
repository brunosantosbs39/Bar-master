import { useState, useEffect, useRef } from 'react';
import { localDB } from '@/lib/localDB';
import { Plus, Pencil, Trash2, ImagePlus, X, ToggleRight, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BANNER_ENTITY = 'banners';
const emptyBanner = { title: '', subtitle: '', image_url: '', bg_color: '#1a1a2e', text_color: '#ffffff', active: true, order: 0 };

// Using localDB with a custom banners collection
const BannerDB = {
  list: () => localDB.entities.Settings.list().then(() => {
    try {
      const raw = localStorage.getItem('bm_banners');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }),
  create: (data) => {
    const items = JSON.parse(localStorage.getItem('bm_banners') || '[]');
    const now = new Date().toISOString();
    const item = { ...data, id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, created_at: now, updated_at: now };
    items.push(item);
    localStorage.setItem('bm_banners', JSON.stringify(items));
    return Promise.resolve(item);
  },
  update: (id, data) => {
    const items = JSON.parse(localStorage.getItem('bm_banners') || '[]');
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) { items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() }; }
    localStorage.setItem('bm_banners', JSON.stringify(items));
    return Promise.resolve(items[idx]);
  },
  delete: (id) => {
    const items = JSON.parse(localStorage.getItem('bm_banners') || '[]').filter(i => i.id !== id);
    localStorage.setItem('bm_banners', JSON.stringify(items));
    return Promise.resolve();
  },
};

export default function BannersManager() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyBanner);
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await BannerDB.list();
    setBanners(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyBanner, order: banners.length });
    setShowForm(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({ ...b });
    setShowForm(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    if (editing) {
      await BannerDB.update(editing.id, form);
    } else {
      await BannerDB.create(form);
    }
    setShowForm(false);
    load();
  };

  const deleteBanner = async (id) => {
    await BannerDB.delete(id);
    load();
  };

  const toggleActive = async (b) => {
    await BannerDB.update(b.id, { active: !b.active });
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{banners.length} banners cadastrados</p>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Novo Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <div className="text-4xl mb-3">🖼️</div>
          <p className="text-muted-foreground mb-4">Nenhum banner cadastrado</p>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Criar primeiro banner</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className={`rounded-xl border overflow-hidden transition-all ${b.active ? 'border-border' : 'border-border opacity-50'}`}>
              {/* Preview */}
              <div
                className="relative h-24 flex items-center px-5 gap-4"
                style={{ backgroundColor: b.bg_color || '#1a1a2e' }}
              >
                {b.image_url && (
                  <img src={b.image_url} alt={b.title} className="h-16 w-16 rounded-lg object-cover flex-shrink-0" />
                )}
                <div>
                  <p className="font-bold text-lg leading-tight" style={{ color: b.text_color || '#fff' }}>{b.title}</p>
                  {b.subtitle && <p className="text-sm opacity-80" style={{ color: b.text_color || '#fff' }}>{b.subtitle}</p>}
                </div>
                {!b.active && (
                  <span className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded-full">Inativo</span>
                )}
              </div>
              {/* Controls */}
              <div className="flex items-center justify-between px-4 py-2 bg-card border-t border-border">
                <span className="text-xs text-muted-foreground">Ordem: {b.order ?? 0}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleActive(b)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {b.active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => openEdit(b)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteBanner(b.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Banner' : 'Novo Banner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="mt-1.5 bg-secondary border-border" placeholder="Ex: Promoção de verão!" />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Input value={form.subtitle} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))} className="mt-1.5 bg-secondary border-border" placeholder="Ex: Cervejas com 30% off até 20h" />
            </div>

            <div>
              <Label>URL da Imagem</Label>
              <div className="mt-1.5 flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="preview" className="w-20 h-16 rounded-lg object-cover border border-border" />
                    <button onClick={() => setForm(p => ({ ...p, image_url: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-16 rounded-lg bg-secondary border border-dashed border-border flex items-center justify-center">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <Input
                  placeholder="https://..."
                  value={form.image_url}
                  onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                  className="flex-1 bg-secondary border-border text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cor de fundo</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input type="color" value={form.bg_color || '#1a1a2e'} onChange={e => setForm(p => ({ ...p, bg_color: e.target.value }))} className="w-10 h-9 rounded-md cursor-pointer border border-border bg-transparent" />
                  <Input value={form.bg_color || '#1a1a2e'} onChange={e => setForm(p => ({ ...p, bg_color: e.target.value }))} className="bg-secondary border-border text-xs" placeholder="#000000" />
                </div>
              </div>
              <div>
                <Label>Cor do texto</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input type="color" value={form.text_color || '#ffffff'} onChange={e => setForm(p => ({ ...p, text_color: e.target.value }))} className="w-10 h-9 rounded-md cursor-pointer border border-border bg-transparent" />
                  <Input value={form.text_color || '#ffffff'} onChange={e => setForm(p => ({ ...p, text_color: e.target.value }))} className="bg-secondary border-border text-xs" placeholder="#ffffff" />
                </div>
              </div>
            </div>

            <div>
              <Label>Ordem de exibição</Label>
              <Input type="number" value={form.order ?? 0} onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))} className="mt-1.5 bg-secondary border-border w-24" />
            </div>

            {/* Preview */}
            <div className="rounded-xl overflow-hidden border border-border">
              <p className="text-xs text-muted-foreground px-3 py-1.5 border-b border-border">Preview</p>
              <div className="h-20 flex items-center px-5 gap-3" style={{ backgroundColor: form.bg_color || '#1a1a2e' }}>
                {form.image_url && <img src={form.image_url} alt="preview" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />}
                <div>
                  <p className="font-bold leading-tight" style={{ color: form.text_color || '#fff' }}>{form.title || 'Título do banner'}</p>
                  {form.subtitle && <p className="text-sm opacity-80" style={{ color: form.text_color || '#fff' }}>{form.subtitle}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
