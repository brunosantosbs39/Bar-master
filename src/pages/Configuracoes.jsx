import { useState } from 'react';
import { localDB } from '@/lib/localDB';
import { useTables, useCreateTable } from '@/hooks/useTables';
import { useWaiters, useCreateWaiter, useUpdateWaiter, useDeleteWaiter } from '@/hooks/useWaiters';
import { Trash2, Power, Settings, Table2, UserPlus, User, Phone, Key, Shield, Check } from 'lucide-react';
import PrinterSettings from '@/components/PrinterSettings';
import HappyHourSettings from '@/components/HappyHourSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { exportData, importData, resetData } from '@/lib/backup';

const typeConfig = {
  mesa: { label: 'Mesa', icon: '🪑' },
  balcao: { label: 'Balcão', icon: '🍺' },
  delivery: { label: 'Delivery', icon: '🛵' },
};

const DEFAULT_PERMISSIONS = {
  can_send_to_kitchen: true,
  can_close_order: true,
  can_print_bill: true,
  can_cancel_order: false,
  can_apply_discount: false,
  can_transfer_table: false,
};

const PERMISSION_LABELS = {
  can_send_to_kitchen: { label: 'Enviar pedido p/ cozinha/bar', icon: '📤' },
  can_close_order: { label: 'Fechar comanda', icon: '✅' },
  can_print_bill: { label: 'Imprimir conta', icon: '🖨️' },
  can_cancel_order: { label: 'Cancelar comanda', icon: '❌' },
  can_apply_discount: { label: 'Aplicar desconto', icon: '💸' },
  can_transfer_table: { label: 'Transferir mesa', icon: '🔄' },
};

export default function Configuracoes() {
  const qc = useQueryClient();
  const [showAddWaiter, setShowAddWaiter] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState(null);
  const [waiterForm, setWaiterForm] = useState({ name: '', nickname: '', phone: '', password: '' });
  const [expandedWaiter, setExpandedWaiter] = useState(null);
  const [importError, setImportError] = useState('');

  const { data: tables = [], isLoading: loadingTables } = useTables();
  const { data: waiters = [], isLoading: loadingWaiters } = useWaiters();
  const loading = loadingTables || loadingWaiters;

  const createWaiter = useCreateWaiter();
  const updateWaiter = useUpdateWaiter();
  const deleteWaiterMutation = useDeleteWaiter();

  const toggleTable = async (table) => {
    await localDB.entities.Table.update(table.id, { active: !table.active });
    qc.invalidateQueries({ queryKey: ['tables'] });
  };

  const deleteTable = async (id) => {
    await localDB.entities.Table.delete(id);
    qc.invalidateQueries({ queryKey: ['tables'] });
  };

  const addWaiter = async () => {
    if (!waiterForm.name.trim()) return;
    await createWaiter.mutateAsync({ ...waiterForm, active: true, permissions: { ...DEFAULT_PERMISSIONS } });
    setWaiterForm({ name: '', nickname: '', phone: '', password: '' });
    setShowAddWaiter(false);
  };

  const toggleWaiter = async (waiter) => {
    await updateWaiter.mutateAsync({ id: waiter.id, data: { active: !waiter.active } });
  };

  const deleteWaiter = async (id) => {
    await deleteWaiterMutation.mutateAsync(id);
  };

  const openEdit = (waiter) => {
    setEditingWaiter({ ...waiter });
    setExpandedWaiter(null);
  };

  const saveEdit = async () => {
    await updateWaiter.mutateAsync({
      id: editingWaiter.id,
      data: {
        name: editingWaiter.name,
        nickname: editingWaiter.nickname,
        phone: editingWaiter.phone,
        password: editingWaiter.password,
        permissions: editingWaiter.permissions,
      }
    });
    setEditingWaiter(null);
  };

  const togglePerm = (key) => {
    setEditingWaiter(prev => ({
      ...prev,
      permissions: {
        ...(prev.permissions || DEFAULT_PERMISSIONS),
        [key]: !(prev.permissions?.[key] ?? DEFAULT_PERMISSIONS[key])
      }
    }));
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barmaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = importData(ev.target.result);
      if (result.success) {
        qc.invalidateQueries();
        setImportError('');
        alert('Dados importados com sucesso!');
      } else {
        setImportError(result.error);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (!confirm('Tem certeza? Isso vai apagar TODOS os dados e restaurar o padrão.')) return;
    resetData();
    qc.invalidateQueries();
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie mesas, garçons e permissões</p>
        </div>
      </div>

      {/* Waiters section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">Garçons</span>
          <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">{waiters.length} total</Badge>
          <Button size="sm" variant="outline" className="gap-1.5 ml-2" onClick={() => setShowAddWaiter(true)}>
            <UserPlus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : waiters.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">Nenhum garçom cadastrado</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setShowAddWaiter(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Cadastrar primeiro garçom
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {waiters.map((w, i) => {
              const isExpanded = expandedWaiter === w.id;
              const perms = w.permissions || DEFAULT_PERMISSIONS;
              return (
                <motion.div key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <div className={`flex items-center gap-3 px-4 py-3 ${!w.active ? 'opacity-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{w.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">
                        {w.name}{w.nickname ? ` (${w.nickname})` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {w.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />{w.phone}
                          </span>
                        )}
                        {w.password ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <Key className="w-3 h-3" />Com senha
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Key className="w-3 h-3" />Sem senha
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-xs border shrink-0 ${w.active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-secondary text-muted-foreground border-border'}`}>
                      {w.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <button onClick={() => setExpandedWaiter(isExpanded ? null : w.id)} className="text-muted-foreground hover:text-primary transition-colors" title="Permissões">
                      <Shield className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(w)} className="text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                      <Key className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleWaiter(w)} className="text-muted-foreground hover:text-foreground transition-colors" title={w.active ? 'Desativar' : 'Ativar'}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteWaiter(w.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Permissions quick view */}
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-secondary/50">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Shield className="w-3 h-3" /> Permissões de {w.nickname || w.name.split(' ')[0]}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(PERMISSION_LABELS).map(([key, { label, icon }]) => {
                          const enabled = perms[key] ?? DEFAULT_PERMISSIONS[key];
                          return (
                            <div key={key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-secondary text-muted-foreground'}`}>
                              <span>{icon}</span>
                              <span className="flex-1 leading-tight">{label}</span>
                              {enabled && <Check className="w-3 h-3 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2 gap-1.5 text-xs h-7" onClick={() => openEdit(w)}>
                        Editar permissões
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tables section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Table2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">Mesas e Locais</span>
          <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">{tables.length} total</Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tables.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Nenhuma mesa cadastrada</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tables.map((table, i) => (
              <motion.div key={table.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-4 px-4 py-3 ${!table.active ? 'opacity-50' : ''}`}>
                <span className="text-xl">{typeConfig[table.type]?.icon || '🪑'}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">{typeConfig[table.type]?.label} {table.number}</p>
                  {table.capacity && <p className="text-xs text-muted-foreground">{table.capacity} lugares</p>}
                </div>
                <Badge className={`text-xs border ${table.active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {table.active ? 'Ativa' : 'Inativa'}
                </Badge>
                <button onClick={() => toggleTable(table)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Power className="w-4 h-4" />
                </button>
                <button onClick={() => deleteTable(table.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <HappyHourSettings />

      <PrinterSettings />

      <div className="p-4 rounded-xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Acesso Garçom</h3>
        <p className="text-xs text-muted-foreground mb-2">Compartilhe este link com seus garçons:</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-secondary px-3 py-2 rounded-lg text-primary truncate">
            {window.location.origin}/GarcomLogin
          </code>
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/GarcomLogin`)}>
            Copiar
          </Button>
        </div>
      </div>

      {/* Backup section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-base">💾</span>
          <span className="font-semibold text-sm text-foreground">Backup de Dados</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Exporte todos os dados para um arquivo JSON ou restaure a partir de um backup anterior.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
              📤 Exportar Backup
            </Button>
            <label>
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <span className="cursor-pointer">📥 Importar Backup</span>
              </Button>
            </label>
            <Button size="sm" variant="outline" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={handleReset}>
              🗑️ Resetar Dados
            </Button>
          </div>
          {importError && <p className="text-xs text-destructive">{importError}</p>}
        </div>
      </div>

      {/* Add Waiter Dialog */}
      <Dialog open={showAddWaiter} onOpenChange={setShowAddWaiter}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" /> Novo Garçom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome completo *</Label>
              <Input value={waiterForm.name} onChange={e => setWaiterForm({ ...waiterForm, name: e.target.value })} placeholder="Ex: João Silva" className="mt-1.5 bg-secondary border-border" />
            </div>
            <div>
              <Label>Apelido</Label>
              <Input value={waiterForm.nickname} onChange={e => setWaiterForm({ ...waiterForm, nickname: e.target.value })} placeholder="Ex: João" className="mt-1.5 bg-secondary border-border" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={waiterForm.phone} onChange={e => setWaiterForm({ ...waiterForm, phone: e.target.value })} placeholder="Ex: (11) 99999-9999" className="mt-1.5 bg-secondary border-border" />
            </div>
            <div>
              <Label>Senha de acesso</Label>
              <Input value={waiterForm.password} onChange={e => setWaiterForm({ ...waiterForm, password: e.target.value })} type="text" placeholder="Senha para login" className="mt-1.5 bg-secondary border-border" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddWaiter(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={addWaiter} disabled={!waiterForm.name.trim()}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Waiter Dialog */}
      <Dialog open={!!editingWaiter} onOpenChange={() => setEditingWaiter(null)}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Editar Garçom</DialogTitle>
          </DialogHeader>
          {editingWaiter && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Nome completo</Label>
                <Input value={editingWaiter.name} onChange={e => setEditingWaiter(p => ({ ...p, name: e.target.value }))} className="mt-1.5 bg-secondary border-border" />
              </div>
              <div>
                <Label>Apelido</Label>
                <Input value={editingWaiter.nickname || ''} onChange={e => setEditingWaiter(p => ({ ...p, nickname: e.target.value }))} placeholder="Opcional" className="mt-1.5 bg-secondary border-border" />
              </div>
              <div>
                <Label>Senha de acesso</Label>
                <Input value={editingWaiter.password || ''} onChange={e => setEditingWaiter(p => ({ ...p, password: e.target.value }))} type="text" placeholder="Nova senha" className="mt-1.5 bg-secondary border-border" />
              </div>

              <div>
                <Label className="flex items-center gap-1.5 mb-2"><Shield className="w-3.5 h-3.5 text-primary" /> Permissões</Label>
                <div className="space-y-2">
                  {Object.entries(PERMISSION_LABELS).map(([key, { label, icon }]) => {
                    const enabled = editingWaiter.permissions?.[key] ?? DEFAULT_PERMISSIONS[key];
                    return (
                      <button
                        key={key}
                        onClick={() => togglePerm(key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
                          enabled
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-border bg-secondary text-muted-foreground'
                        }`}
                      >
                        <span className="text-base">{icon}</span>
                        <span className="flex-1">{label}</span>
                        <div className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? 'bg-emerald-500' : 'bg-border'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditingWaiter(null)}>Cancelar</Button>
                <Button className="flex-1" onClick={saveEdit}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
