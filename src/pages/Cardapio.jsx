import { useState, useRef, useEffect, useMemo } from 'react';
import { useProducts, useCustomCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, useReorderProducts } from '@/hooks/useProducts';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, ImagePlus, X, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import BannersManager from '@/components/BannersManager';
import CategoriesManager from '@/components/CategoriesManager';
import { BUILTIN_CATEGORIES } from '@/lib/categories';

const getEmptyProduct = (firstCategory) => ({
  name: '', description: '', price: '', category: firstCategory || 'cervejas',
  code: '', available: true, print_dept: 'bar', image_url: '', modifiers: []
});

export default function Cardapio() {
  const [tab, setTab] = useState('produtos');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(getEmptyProduct('cervejas'));
  const [showModifiers, setShowModifiers] = useState(false);
  const [newMod, setNewMod] = useState({ name: '', price: '', type: 'optional' });
  const fileInputRef = useRef(null);

  const { data: products = [], isLoading: loading } = useProducts();
  const { data: customCategories = [] } = useCustomCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const reorderProducts = useReorderProducts();

  // Derivar allCategories respeitando category_order do settings
  const allCategories = useMemo(() => {
    const customActive = customCategories
      .filter(c => c.active)
      .map(c => ({
        value: c.value,
        label: `${c.emoji || '🏷️'} ${c.label}`,
        print_dept: c.print_dept || 'bar',
      }));

    const base = [
      ...BUILTIN_CATEGORIES.map(c => ({ value: c.value, label: c.label, print_dept: c.print_dept })),
      ...customActive,
    ];

    if (!settings?.category_order) return base;

    const baseValues = base.map(c => c.value);
    // Filtrar stale values (categorias que foram deletadas)
    const validOrder = settings.category_order.filter(v => baseValues.includes(v));
    // Adicionar ao final categorias novas que ainda não estão na order salva
    const missing = baseValues.filter(v => !validOrder.includes(v));
    const finalOrder = [...validOrder, ...missing];
    return finalOrder.map(v => base.find(c => c.value === v)).filter(Boolean);
  }, [settings, customCategories]);

  // Guard para disparar a inicialização apenas uma vez
  const categoryOrderInitialized = useRef(false);

  // Inicializar category_order no settings se ainda não existir.
  // Aguarda ambas as queries resolverem para não perder categorias custom.
  useEffect(() => {
    if (settingsLoading || loading) return;
    if (categoryOrderInitialized.current) return;
    if (settings && !settings.category_order && allCategories.length > 0) {
      categoryOrderInitialized.current = true;
      const initialOrder = allCategories.map(c => c.value);
      updateSettings.mutate({ category_order: initialOrder });
    }
  }, [settingsLoading, loading, settings, allCategories]);

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
      await updateProduct.mutateAsync({ id: editing.id, data });
    } else {
      await createProduct.mutateAsync(data);
    }
    setShowForm(false);
  };

  const deleteProduct = async (id) => {
    await deleteProductMutation.mutateAsync(id);
  };

  const duplicateProduct = async (p) => {
    // eslint-disable-next-line no-unused-vars
    const { id, ...data } = p;
    await createProduct.mutateAsync({
      ...data,
      name: `Cópia de ${p.name}`,
      code: p.code ? `${p.code}-copia` : '',
      available: false, // começa indisponível para revisão antes de publicar
    });
    toast.success(`"${p.name}" duplicado — revise e ative quando pronto`);
  };

  const toggleAvailable = async (p) => {
    await updateProduct.mutateAsync({ id: p.id, data: { available: !p.available } });
  };

  // canDrag: desabilita arrasto quando filtro ou busca estão ativos
  const canDrag = search === '' && filterCat === 'all';

  const handleDragEnd = (result) => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === 'CATEGORY') {
      // Reordenar só entre as visíveis (índices contíguos)
      const visibleOrder = visibleCategories.map(c => c.value);
      const newVisibleOrder = [...visibleOrder];
      const [moved] = newVisibleOrder.splice(source.index, 1);
      newVisibleOrder.splice(destination.index, 0, moved);

      // Reconstruir a ordem completa: substituir os valores visíveis pela nova ordem
      const fullOrder = allCategories.map(c => c.value);
      const newFullOrder = [...fullOrder];
      let visibleIdx = 0;
      for (let i = 0; i < newFullOrder.length; i++) {
        if (visibleOrder.includes(newFullOrder[i])) {
          newFullOrder[i] = newVisibleOrder[visibleIdx++];
        }
      }

      const previousSettings = queryClient.getQueryData(['settings']);
      queryClient.setQueryData(['settings'], (old) => ({ ...old, category_order: newFullOrder }));

      updateSettings.mutate(
        { category_order: newFullOrder },
        {
          onError: () => {
            queryClient.setQueryData(['settings'], previousSettings);
            toast.error('Falha ao salvar ordem das categorias. Tente novamente.');
          },
        }
      );
    }
    if (type === 'PRODUCT') {
      const catKey = source.droppableId;
      const catItems = grouped[catKey]?.items ?? [];
      if (!catItems.length) return;

      const newItems = [...catItems];
      const [moved] = newItems.splice(source.index, 1);
      newItems.splice(destination.index, 0, moved);

      const updates = newItems.map((p, i) => ({ id: p.id, sort_order: i }));

      reorderProducts.mutate(updates, {
        onError: () => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
          toast.error('Falha ao salvar ordem dos produtos. Tente novamente.');
        },
      });
    }
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = allCategories.reduce((acc, cat) => {
    const catItems = filtered.filter(p => p.category === cat.value);
    // Produtos com sort_order definido vêm ordenados; sem sort_order mantêm posição original (índice).
    const items = catItems.slice().sort((a, b) => {
      const ai = a.sort_order != null ? a.sort_order : catItems.indexOf(a) + 10000;
      const bi = b.sort_order != null ? b.sort_order : catItems.indexOf(b) + 10000;
      return ai - bi;
    });
    if (items.length) acc[cat.value] = { label: cat.label, items };
    return acc;
  }, {});

  // Categorias visíveis = só as que têm produtos na view atual (índices contíguos para @hello-pangea/dnd)
  const visibleCategories = allCategories.filter(cat => !!grouped[cat.value]);

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

      {tab === 'categorias' && <CategoriesManager />}
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

          {!loading && products.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🍺</div>
              <p className="text-muted-foreground mb-4">Cardápio vazio</p>
              <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Adicionar produto</Button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Aviso quando filtro está ativo */}
              {!canDrag && (search !== '' || filterCat !== 'all') && (
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span>⠿</span> Limpe os filtros para reordenar
                </p>
              )}

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="categories" type="CATEGORY" isDropDisabled={!canDrag}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {visibleCategories.map((cat, index) => {
                        const catData = grouped[cat.value]; // sempre definido
                        return (
                          <Draggable
                            key={cat.value}
                            draggableId={cat.value}
                            index={index}
                            isDragDisabled={!canDrag}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`mb-8 ${snapshot.isDragging ? 'opacity-70' : ''}`}
                              >
                                {/* Header da categoria com handle de arrasto */}
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                  {canDrag && (
                                    <span
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none"
                                      title="Arrastar para reordenar"
                                    >
                                      ⠿
                                    </span>
                                  )}
                                  {catData.label} <span className="text-xs font-normal">({catData.items.length})</span>
                                </h2>

                                <Droppable droppableId={cat.value} type="PRODUCT" isDropDisabled={!canDrag}>
                                  {(prodProvided) => (
                                    <div
                                      ref={prodProvided.innerRef}
                                      {...prodProvided.droppableProps}
                                      className="space-y-2"
                                    >
                                      {catData.items.map((p, i) => (
                                        <Draggable
                                          key={p.id}
                                          draggableId={p.id}
                                          index={i}
                                          isDragDisabled={!canDrag}
                                        >
                                          {(prodDraggable, prodSnapshot) => (
                                            <div
                                              ref={prodDraggable.innerRef}
                                              {...prodDraggable.draggableProps}
                                              className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${
                                                p.available ? 'border-border' : 'border-border opacity-50'
                                              } ${prodSnapshot.isDragging ? 'shadow-lg ring-1 ring-primary/30' : ''}`}
                                            >
                                              {canDrag && (
                                                <span
                                                  {...prodDraggable.dragHandleProps}
                                                  className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none flex-shrink-0 text-base"
                                                  title="Arrastar para reordenar"
                                                >
                                                  ⠿
                                                </span>
                                              )}

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
                                                <span className="font-bold text-primary text-sm whitespace-nowrap">R$ {p.price.toFixed(2)}</span>
                                                <button onClick={() => toggleAvailable(p)} title={p.available ? 'Desativar' : 'Ativar'} className="text-muted-foreground hover:text-foreground transition-colors">
                                                  {p.available ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                                                </button>
                                                <button onClick={() => duplicateProduct(p)} title="Duplicar produto" className="text-muted-foreground hover:text-blue-400 transition-colors">
                                                  <Copy className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openEdit(p)} title="Editar produto" className="text-muted-foreground hover:text-foreground transition-colors">
                                                  <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => deleteProduct(p.id)} title="Excluir produto" className="text-muted-foreground hover:text-destructive transition-colors">
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {prodProvided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </>
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
                <div className="mt-1.5">
                  {form.image_url ? (
                    <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border group">
                      <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-medium backdrop-blur-sm"
                        >
                          Trocar foto
                        </button>
                        <button
                          onClick={() => { setForm(p => ({ ...p, image_url: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="px-3 py-1.5 bg-destructive/80 hover:bg-destructive rounded-lg text-white text-xs font-medium"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-36 rounded-xl border-2 border-dashed border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
                    >
                      <ImagePlus className="w-8 h-8 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">Clique para adicionar foto</p>
                        <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG ou WebP — máx. 5MB</p>
                      </div>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { alert('Imagem muito grande. Máximo 5MB.'); return; }
                      const reader = new FileReader();
                      reader.onload = ev => setForm(p => ({ ...p, image_url: ev.target.result }));
                      reader.readAsDataURL(file);
                    }}
                  />
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
