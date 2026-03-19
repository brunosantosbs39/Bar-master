import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, ImagePlus, X, ChevronDown, ChevronUp, Tag, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import BannersManager from '@/components/BannersManager';
import CategoriesManager from '@/components/CategoriesManager';

const BUILTIN_CATEGORIES = [
  { value: 'cervejas', label: '🍺 Cervejas', print_dept: 'bar' },
  { value: 'destilados', label: '🥃 Destilados', print_dept: 'bar' },
  { value: 'drinks', label: '🍹 Drinks', print_dept: 'bar' },
  { value: 'vinhos', label: '🍷 Vinhos', print_dept: 'bar' },
  { value: 'nao_alcoolicos', label: '🥤 Não Alcoólicos', print_dept: 'bar' },
  { value: 'bebidas', label: '🧃 Bebidas', print_dept: 'bar' },
  { value: 'petiscos', label: '🍟 Petiscos', print_dept: 'cozinha' },
  { value: 'porcoes', label: '🍖 Porções', print_dept: 'cozinha' },
  { value: 'pratos', label: '🍽️ Pratos', print_dept: 'cozinha' },
  { value: 'sobremesas', label: '🍰 Sobremesas', print_dept: 'cozinha' },
];

const getEmptyProduct = (firstCategory) => ({
  name: '', description: '', price: '', category: firstCategory || 'cervejas',
  code: '', available: true, print_dept: 'bar', image_url: '', modifiers: []
});

export default function Cardapio() {
  const [tab, setTab] = useState('produtos');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [allCategories, setAllCategories] = useState(BUILTIN_CATEGORIES);
  const [form, setForm] = useState(getEmptyProduct('cervejas'));
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);
  const [newMod, setNewMod] = useState({ name: '', price: '', type: 'optional' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProducts();
    loadCustomCategories();
  }, []);

  const loadCustomCategories = async () => {
    const custom = await base44.entities.CustomCategory.list();
    const activeCustom = custom.filter(c => c.active).map(c => ({
      value: c.value,
      label: `${c.emoji || '🏷️'} ${c.label}`,
      print_dept: c.print_dept || 'bar'
    }));
    setAllCategories([...BUILTIN_CATEGORIES, ...activeCustom]);
  };

  const loadProducts = async () => {
    setLoading(true);
    const data = await base44.entities.Product.list();
    setProducts(data);
    setLoading(false);
  };

  const openCreate = () => {
    const firstCat = allCategories[0]?.value || 'cervejas';
    setEditing(null);
    setForm(getEmptyProduct(firstCat));
    setShowForm(true);
    setShowModifiers(false);
    setNewMod({ name: '', price: '', type: 'optional' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const openEdit = (p) => {
    setEditing(p);
    const catDept = allCategories.find(c => c.value === p.category)?.print_dept || 'bar';
    setForm({ ...p, price: String(p.price), print_dept: p.print_dept || catDept, image_url: p.image_url || '', modifiers: p.modifiers || [] });
    setShowForm(true);
    setShowModifiers(false);
    setNewMod({ name: '', price: '', type: 'optional' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addModifier = () => {
    if (!newMod.name.trim()) return;
    const mod = { name: newMod.name.trim(), price: parseFloat(newMod.price) || 0, type: newMod.type };
    setForm(p => ({ ...p, modifiers: [...(p.modifiers || []), mod] }));
    setNewMod({ name: '', price: '', type: 'optional' });
  };

  const removeModifier = (idx) => {
    setForm(p => ({ ...p, modifiers: p.modifiers.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    const data = { ...form, price: parseFloat(form.price) || 0 };
    if (editing) {
      await base44.entities.Product.update(editing.id, data);
    } else {
      await base44.entities.Product.create(data);
    }
    setShowForm(false);
    loadProducts();
  };

  const deleteProduct = async (id) => {
    await base44.entities.Product.delete(id);
    loadProducts();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, image_url: file_url }));
    setUploadingImage(false);
  };

  const toggleAvailable = async (p) => {
    await base44.entities.Product.update(p.id, { available: !p.available });
    loadProducts();
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = allCategories.reduce((acc, cat) => {
    const items = filtered.filter(p => p.category === cat.value);
    if (items.length) acc[cat.value] = { label: cat.label, items };
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cardápio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} produtos cadastrados</p>
        </div>
        {tab === 'produtos' && (
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Novo Produto
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-6 w-fit">
        {[
          { key: 'produtos', label: '📋 Produtos' },
          { key: 'categorias', label: '🏷️ Categorias' },
          { key: 'banners', label: '🖼️ Banners' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categorias' && <CategoriesManager onCategoriesChange={loadCustomCategories} />}
      {tab === 'banners' && <BannersManager />}

      {tab === 'produtos' && (
        <div>
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-44 bg-secondary border-border">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {allCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            Object.entries(grouped).map(([catKey, { label, items }]) => (
              <div key={catKey} className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  {label} <span className="text-xs font-normal">({items.length})</span>
                </h2>
                <div className="space-y-2">
                  <AnimatePresence>
                    {items.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${
                          p.available ? 'border-border' : 'border-border opacity-50'
                        }`}
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 text-xl">
                            {allCategories.find(c => c.value === p.category)?.label?.split(' ')[0] || '🍽️'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground truncate">{p.name}</span>
                            {!p.available && <Badge variant="outline" className="text-xs text-muted-foreground border-border">Indisponível</Badge>}
                            {p.code && <span className="text-xs text-muted-foreground">#{p.code}</span>}
                            {p.print_dept === 'bar' && <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">🍺 Bar</span>}
                            {p.print_dept === 'cozinha' && <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full">🍳 Cozinha</span>}
                            {p.print_dept === 'nenhum' && <span className="text-[10px] bg-secondary text-muted-foreground border border-border px-1.5 py-0.5 rounded-full">🚫 Sem impressão</span>}
                          </div>
                          {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary text-sm whitespace-nowrap">
                            R$ {p.price.toFixed(2)}
                          </span>
                          <button onClick={() => toggleAvailable(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {p.available ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button onClick={() => openEdit(p)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )}

          {!loading && products.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🍺</div>
              <p className="text-muted-foreground mb-4">Cardápio vazio</p>
              <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Adicionar produto</Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Foto do Produto</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  {form.image_url ? (
                    <div className="relative">
                      <img src={form.image_url} alt="preview" className="w-20 h-20 rounded-lg object-cover border border-border" />
                      <button
                        onClick={() => setForm(p => ({ ...p, image_url: '' }))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-secondary border border-dashed border-border flex items-center justify-center">
                      <ImagePlus className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="w-4 h-4" />
                    {uploadingImage ? 'Enviando...' : form.image_url ? 'Trocar foto' : 'Adicionar foto'}
                  </Button>
                </div>
              </div>
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1.5 bg-secondary border-border" placeholder="Nome do produto" />
              </div>
              <div>
                <Label>Preço (R$) *</Label>
                <Input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} type="number" step="0.01" className="mt-1.5 bg-secondary border-border" placeholder="0,00" />
              </div>
              <div>
                <Label>Código</Label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className="mt-1.5 bg-secondary border-border" placeholder="Opcional" />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1.5 bg-secondary border-border" placeholder="Opcional" />
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={v => {
                  const dept = allCategories.find(c => c.value === v)?.print_dept || 'bar';
                  setForm(p => ({ ...p, category: v, print_dept: dept }));
                }}>
                  <SelectTrigger className="mt-1.5 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Imprimir no envio</Label>
                <Select value={form.print_dept || 'bar'} onValueChange={v => setForm(p => ({ ...p, print_dept: v }))}>
                  <SelectTrigger className="mt-1.5 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">🍺 Bar</SelectItem>
                    <SelectItem value="cozinha">🍳 Cozinha</SelectItem>
                    <SelectItem value="nenhum">🚫 Não imprimir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Modifiers Section */}
            <div className="col-span-2 border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                onClick={() => setShowModifiers(v => !v)}
              >
                <span className="flex items-center gap-2">
                  ✨ Adicionais / Modificadores
                  {(form.modifiers?.length > 0) && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{form.modifiers.length}</span>
                  )}
                </span>
                {showModifiers ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showModifiers && (
                <div className="px-3 pb-3 space-y-2 border-t border-border">
                  {(form.modifiers || []).map((mod, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm">
                      <span className="flex-1 text-foreground">{mod.name}</span>
                      {mod.price > 0 && <span className="text-primary text-xs">+R$ {mod.price.toFixed(2)}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${mod.type === 'required' ? 'text-destructive border-destructive/30' : 'text-muted-foreground border-border'}`}>
                        {mod.type === 'required' ? 'Obrigatório' : 'Opcional'}
                      </span>
                      <button onClick={() => removeModifier(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newMod.name}
                      onChange={e => setNewMod(p => ({ ...p, name: e.target.value }))}
                      placeholder="Nome (ex: sem gelo)"
                      className="flex-1 h-8 text-xs bg-background border-border"
                      onKeyDown={e => e.key === 'Enter' && addModifier()}
                    />
                    <Input
                      value={newMod.price}
                      onChange={e => setNewMod(p => ({ ...p, price: e.target.value }))}
                      placeholder="+R$"
                      type="number"
                      step="0.50"
                      className="w-20 h-8 text-xs bg-background border-border"
                    />
                    <select
                      value={newMod.type}
                      onChange={e => setNewMod(p => ({ ...p, type: e.target.value }))}
                      className="h-8 text-xs bg-background border border-border rounded-md px-2 text-foreground"
                    >
                      <option value="optional">Opcional</option>
                      <option value="required">Obrigatório</option>
                    </select>
                    <Button type="button" size="sm" className="h-8 px-2" onClick={addModifier}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2 flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}