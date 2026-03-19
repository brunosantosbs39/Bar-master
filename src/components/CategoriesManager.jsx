import { useState } from 'react';
import { useCustomCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useProducts';
import { useQueryClient } from '@tanstack/react-query';
import { localDB } from '@/lib/localDB';
import { Plus, Pencil, Trash2, ToggleRight, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BUILT_IN_CATEGORIES = [
  { value: 'cervejas', label: '🍺 Cervejas', emoji: '🍺', print_dept: 'bar', builtin: true },
  { value: 'destilados', label: '🥃 Destilados', emoji: '🥃', print_dept: 'bar', builtin: true },
  { value: 'drinks', label: '🍹 Drinks', emoji: '🍹', print_dept: 'bar', builtin: true },
  { value: 'vinhos', label: '🍷 Vinhos', emoji: '🍷', print_dept: 'bar', builtin: true },
  { value: 'nao_alcoolicos', label: '🥤 Não Alcoólicos', emoji: '🥤', print_dept: 'bar', builtin: true },
  { value: 'bebidas', label: '🧃 Bebidas', emoji: '🧃', print_dept: 'bar', builtin: true },
  { value: 'petiscos', label: '🍟 Petiscos', emoji: '🍟', print_dept: 'cozinha', builtin: true },
  { value: 'porcoes', label: '🍖 Porções', emoji: '🍖', print_dept: 'cozinha', builtin: true },
  { value: 'pratos', label: '🍽️ Pratos', emoji: '🍽️', print_dept: 'cozinha', builtin: true },
  { value: 'sobremesas', label: '🍰 Sobremesas', emoji: '🍰', print_dept: 'cozinha', builtin: true },
];

const emptyForm = { value: '', label: '', emoji: '🍽️', print_dept: 'bar', active: true, order: 0 };

export default function CategoriesManager({ onCategoriesChange }) {
  const { data: custom = [], isLoading: loading } = useCustomCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const sorted = [...custom].sort((a, b) => (a.order || 0) - (b.order || 0));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, order: custom.length + BUILT_IN_CATEGORIES.length });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ ...c });
    setShowForm(true);
  };

  const generateSlug = (label) => {
    return label.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const save = async () => {
    const data = { ...form };
    if (!editing && !data.value) {
      data.value = generateSlug(data.label);
    }
    if (editing) {
      await updateCategory.mutateAsync({ id: editing.id, data });
    } else {
      await createCategory.mutateAsync(data);
    }
    setShowForm(false);
    onCategoriesChange && onCategoriesChange();
  };

  const handleDelete = async (id) => {
    await deleteCategory.mutateAsync(id);
    onCategoriesChange && onCategoriesChange();
  };

  const toggleActive = async (c) => {
    await updateCategory.mutateAsync({ id: c.id, data: { active: !c.active } });
    onCategoriesChange && onCategoriesChange();
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Categorias do Sistema</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BUILT_IN_CATEGORIES.map(c => (
            <div key={c.value} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30 opacity-60">
              <span className="text-base">{c.emoji}</span>
              <span className="text-sm text-foreground flex-1 truncate">{c.label.split(' ').slice(1).join(' ')}</span>
              <span className="text-[10px] text-muted-foreground border border-border px-1.5 rounded-full">padrão</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 mt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Categorias Personalizadas</h3>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl">
          <div className="text-3xl mb-2">🏷️</div>
          <p className="text-muted-foreground text-sm mb-3">Nenhuma categoria personalizada</p>
          <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="w-4 h-4" /> Criar categoria</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(c => (
            <div key={c.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-card transition-all ${c.active ? 'border-border' : 'border-border opacity-50'}`}>
              <span className="text-xl">{c.emoji || '🏷️'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{c.label}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {c.value} · {c.print_dept === 'bar' ? '🍺 Bar' : c.print_dept === 'cozinha' ? '🍳 Cozinha' : '🚫 Sem impressão'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(c)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {c.active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => openEdit(c)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-3">
              <div className="w-20">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} className="mt-1.5 bg-secondary border-border text-center text-xl" placeholder="🍽️" maxLength={2} />
              </div>
              <div className="flex-1">
                <Label>Nome *</Label>
                <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} className="mt-1.5 bg-secondary border-border" placeholder="Ex: Combos" />
              </div>
            </div>

            {!editing && (
              <div>
                <Label>ID da categoria</Label>
                <Input
                  value={form.value || generateSlug(form.label)}
                  onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  className="mt-1.5 bg-secondary border-border text-xs text-muted-foreground"
                  placeholder="gerado automaticamente"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Identificador único (sem espaços ou acentos)</p>
              </div>
            )}

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

            <div>
              <Label>Ordem</Label>
              <Input type="number" value={form.order ?? 0} onChange={e => setForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))} className="mt-1.5 bg-secondary border-border w-24" />
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
