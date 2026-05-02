import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { useTables, useCreateTable } from '@/hooks/useTables';
import { useWaiters, useCreateWaiter, useUpdateWaiter, useDeleteWaiter } from '@/hooks/useWaiters';
import { Trash2, Power, Settings, Table2, UserPlus, User, Phone, Key, Shield, Check, Crown, ShieldCheck, Lock, Eye, EyeOff, ChevronDown, ChevronUp, Beer } from 'lucide-react';
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
import { useAuth } from '@/lib/AuthContext';
import { useBranding } from '@/lib/useBranding';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import toast from 'react-hot-toast';

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

const ROLE_CONFIG = {
  proprietario: { label: 'Proprietário', icon: Crown,        color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  administrador: { label: 'Administrador', icon: ShieldCheck, color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  caixa:         { label: 'Caixa',         icon: Lock,        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
};

const ALL_PAGES = [
  { key: 'Mesas',         label: 'Mesas',      icon: '🪑' },
  { key: 'Cardapio',      label: 'Cardápio',   icon: '📋' },
  { key: 'Estoque',       label: 'Estoque',    icon: '📦' },
  { key: 'Caixa',         label: 'Caixa',      icon: '💰' },
  { key: 'Relatorios',    label: 'Relatórios', icon: '📊' },
  { key: 'QRCodes',       label: 'QR Codes',   icon: '🔲' },
  { key: 'Configuracoes', label: 'Config.',    icon: '⚙️' },
];

const DEFAULT_PAGES_BY_ROLE = {
  administrador: ['Mesas', 'Cardapio', 'Estoque', 'Caixa', 'Relatorios', 'QRCodes', 'Configuracoes'],
  caixa: ['Caixa'],
};

function SystemUsersSection() {
  const { role, getPermissions } = useAuth();
  const perms = getPermissions();
  const canManage = role === 'proprietario' || perms.can_manage_users;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'caixa' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    fetch('/api/admin_users')
      .then(r => r.json())
      .then(list => { setUsers(list); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  if (!canManage) return null;

  const openAdd = () => {
    setForm({ name: '', username: '', password: '', role: 'caixa' });
    setError('');
    setShowPass(false);
    setShowAdd(true);
  };

  const openEdit = (u) => {
    const pages = u.permissions?.pages || DEFAULT_PAGES_BY_ROLE[u.role] || [];
    setEditingUser({ ...u, permissions: { ...u.permissions, pages } });
    setError('');
    setShowPass(false);
  };

  const handleCreate = async () => {
    setError('');
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError('Preencha todos os campos'); return;
    }
    if (form.password.length < 4) { setError('Senha mínima de 4 caracteres'); return; }
    const existing = users.find(u => u.username === form.username.trim().toLowerCase());
    if (existing) { setError('Usuário já cadastrado'); return; }
    setSaving(true);
    try {
      const pages = DEFAULT_PAGES_BY_ROLE[form.role] || [];
      const can_manage_users = form.role === 'administrador';
      const can_manage_waiters = form.role !== 'caixa';
      await fetch('/api/admin_users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          active: true,
          permissions: { pages, can_manage_users, can_manage_waiters },
        }),
      });
      loadUsers();
      setShowAdd(false);
    } catch { setError('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    setError('');
    if (!editingUser.name.trim()) { setError('Nome obrigatório'); return; }
    setSaving(true);
    try {
      const body = {
        name: editingUser.name.trim(),
        active: editingUser.active,
        permissions: editingUser.permissions,
      };
      if (editingUser.password?.trim()) body.password = editingUser.password.trim();
      await fetch(`/api/admin_users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      loadUsers();
      setEditingUser(null);
    } catch { setError('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    await fetch(`/api/admin_users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    });
    loadUsers();
  };

  const deleteUser = async (u) => {
    if (u.role === 'proprietario' && users.filter(x => x.role === 'proprietario').length <= 1) {
      alert('Não é possível excluir o único Proprietário.'); return;
    }
    if (!confirm(`Excluir usuário "${u.name}"?`)) return;
    await fetch(`/api/admin_users/${u.id}`, { method: 'DELETE' });
    loadUsers();
  };

  const togglePage = (page) => {
    setEditingUser(prev => {
      const pages = prev.permissions?.pages || [];
      const has = pages.includes(page);
      return { ...prev, permissions: { ...prev.permissions, pages: has ? pages.filter(p => p !== page) : [...pages, page] } };
    });
  };

  const toggleEditPerm = (key) => {
    setEditingUser(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions?.[key] }
    }));
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-foreground">Usuários do Sistema</span>
        <Badge variant="outline" className="ml-auto text-xs border-border text-muted-foreground">{users.length} total</Badge>
        <Button size="sm" variant="outline" className="gap-1.5 ml-2" onClick={openAdd}>
          <UserPlus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {users.map((u, i) => {
            const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.administrador;
            const RoleIcon = cfg.icon;
            const pages = u.permissions?.pages || DEFAULT_PAGES_BY_ROLE[u.role] || [];
            return (
              <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 px-4 py-3 ${!u.active ? 'opacity-50' : ''}`}>
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <RoleIcon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{u.name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                    <Badge className={`text-[10px] border px-1.5 py-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
                    <span className="text-[10px] text-muted-foreground">{pages.length} páginas</span>
                  </div>
                </div>
                <Badge className={`text-xs border shrink-0 ${u.active ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {u.active ? 'Ativo' : 'Inativo'}
                </Badge>
                <button onClick={() => openEdit(u)} className="text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                  <Key className="w-4 h-4" />
                </button>
                {u.role !== 'proprietario' && (
                  <>
                    <button onClick={() => toggleActive(u)} className="text-muted-foreground hover:text-foreground transition-colors" title={u.active ? 'Desativar' : 'Ativar'}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteUser(u)} className="text-muted-foreground hover:text-destructive transition-colors" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}
          {users.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário cadastrado</p>
          )}
        </div>
      )}

      {/* Dialog criar usuário */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" /> Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Função</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {['administrador', 'caixa'].map(r => {
                  const cfg = ROLE_CONFIG[r];
                  const Ic = cfg.icon;
                  return (
                    <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        form.role === r ? `${cfg.bg} ${cfg.color} border-current` : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                      }`}>
                      <Ic className="w-4 h-4" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Nome completo</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Maria Silva" className="mt-1.5 bg-secondary border-border" autoFocus />
            </div>
            <div>
              <Label>Usuário (login)</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Ex: maria" className="mt-1.5 bg-secondary border-border" autoCapitalize="none" />
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative mt-1.5">
                <Input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 4 caracteres" className="bg-secondary border-border pr-10" />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Acesso padrão para {ROLE_CONFIG[form.role]?.label}:</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(DEFAULT_PAGES_BY_ROLE[form.role] || []).map(p => {
                  const pg = ALL_PAGES.find(x => x.key === p);
                  return <span key={p} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{pg?.icon} {pg?.label}</span>;
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Edite as permissões após criar.</p>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={saving}>{saving ? 'Salvando...' : 'Criar usuário'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog editar usuário */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="bg-card border-border max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Editar Usuário</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Nome completo</Label>
                <Input value={editingUser.name} onChange={e => setEditingUser(p => ({ ...p, name: e.target.value }))} className="mt-1.5 bg-secondary border-border" />
              </div>
              <div>
                <Label>Nova senha (deixe em branco para manter)</Label>
                <div className="relative mt-1.5">
                  <Input type={showPass ? 'text' : 'password'} value={editingUser.password || ''} onChange={e => setEditingUser(p => ({ ...p, password: e.target.value }))} placeholder="Nova senha" className="bg-secondary border-border pr-10" />
                  <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Páginas acessíveis */}
              <div>
                <Label className="flex items-center gap-1.5 mb-2">🖥️ Páginas com acesso</Label>
                <div className="space-y-1.5">
                  {ALL_PAGES.map(pg => {
                    const pages = editingUser.permissions?.pages || [];
                    const has = pages.includes(pg.key);
                    return (
                      <button key={pg.key} onClick={() => togglePage(pg.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                          has ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'
                        }`}>
                        <span>{pg.icon}</span>
                        <span className="flex-1">{pg.label}</span>
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${has ? 'bg-primary' : 'bg-border'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${has ? 'left-4' : 'left-0.5'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permissões de gestão */}
              {editingUser.role !== 'proprietario' && (
                <div>
                  <Label className="flex items-center gap-1.5 mb-2">🔑 Permissões de gestão</Label>
                  <div className="space-y-1.5">
                    {[
                      { key: 'can_manage_waiters', label: 'Gerenciar garçons', icon: '👨‍🍳' },
                      { key: 'can_manage_users',   label: 'Gerenciar usuários do sistema', icon: '👤' },
                    ].map(({ key, label, icon }) => {
                      const enabled = editingUser.permissions?.[key] || false;
                      return (
                        <button key={key} onClick={() => toggleEditPerm(key)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                            enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-border bg-secondary text-muted-foreground'
                          }`}>
                          <span>{icon}</span>
                          <span className="flex-1">{label}</span>
                          <div className={`w-9 h-5 rounded-full transition-colors relative ${enabled ? 'bg-emerald-500' : 'bg-border'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Configuracoes() {
  const qc = useQueryClient();
  const [showAddWaiter, setShowAddWaiter] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState(null);
  const [waiterForm, setWaiterForm] = useState({ name: '', nickname: '', phone: '', password: '' });
  const [expandedWaiter, setExpandedWaiter] = useState(null);
  const [importError, setImportError] = useState('');
  const [localIP, setLocalIP] = useState('');

  useEffect(() => {
    fetch('/api/local-ip')
      .then(r => r.json())
      .then(d => { if (d.ip) setLocalIP(d.ip); })
      .catch(() => {});
  }, []);

  const { logoUrl, bannerUrl } = useBranding();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [brandName, setBrandName]         = useState('');
  const [logoFile,  setLogoFile]          = useState(null);
  const [logoPreview, setLogoPreview]     = useState(null);
  const [bannerFile, setBannerFile]       = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [savingBrand, setSavingBrand]     = useState(false);

  useEffect(() => {
    if (settings?.bar_name !== undefined) setBrandName(settings.bar_name || '');
  }, [settings?.bar_name]);

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

  const handleExport = async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(brandName || 'barmaster').toLowerCase().replace(/\s+/g, '-')}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = await importData(ev.target.result);
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

  const handleReset = async () => {
    if (!confirm('Tem certeza? Isso vai apagar TODOS os dados e restaurar o padrão.')) return;
    await resetData();
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const saveBranding = async () => {
    setSavingBrand(true);
    try {
      let newLogoUrl   = settings?.logo_url   || null;
      let newBannerUrl = settings?.banner_url || null;

      if (logoFile) {
        const fd = new FormData();
        fd.append('file', logoFile);
        fd.append('type', 'logo');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao enviar logo');
        }
        const data = await res.json();
        newLogoUrl = data.url;
      }

      if (bannerFile) {
        const fd = new FormData();
        fd.append('file', bannerFile);
        fd.append('type', 'banner');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao enviar banner');
        }
        const data = await res.json();
        newBannerUrl = data.url;
      }

      await updateSettings.mutateAsync({
        bar_name:   brandName.trim() || null,
        logo_url:   newLogoUrl,
        banner_url: newBannerUrl,
      });

      setLogoFile(null);
      setBannerFile(null);
      toast.success('Identidade atualizada!');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSavingBrand(false);
    }
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

      {/* Identidade do Estabelecimento */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Beer className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">Identidade do Estabelecimento</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="brand-name" className="text-sm">Nome do estabelecimento</Label>
            <Input
              id="brand-name"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="Ex: Bar do João"
              className="max-w-sm"
            />
          </div>

          {/* Logo */}
          <div className="space-y-1.5">
            <Label className="text-sm">Logo</Label>
            <div className="flex items-center gap-3">
              {(logoPreview || logoUrl) && (
                <img
                  src={logoPreview || logoUrl}
                  alt="Logo"
                  className="w-12 h-12 rounded-lg object-contain border border-border bg-background"
                />
              )}
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-secondary transition-colors">
                  Escolher logo
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
              <span className="text-xs text-muted-foreground">PNG, JPG ou SVG · máx 5MB</span>
            </div>
          </div>

          {/* Banner */}
          <div className="space-y-1.5">
            <Label className="text-sm">Banner do cardápio</Label>
            <div className="space-y-2">
              {(bannerPreview || bannerUrl) && (
                <img
                  src={bannerPreview || bannerUrl}
                  alt="Banner"
                  className="w-full max-w-sm h-20 rounded-lg object-cover border border-border"
                />
              )}
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-secondary transition-colors">
                  Escolher banner
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleBannerChange}
                />
              </label>
              <p className="text-xs text-muted-foreground">Recomendado: 1200×400px · JPG ou WEBP · máx 5MB</p>
            </div>
          </div>

          <Button
            onClick={saveBranding}
            disabled={savingBrand}
            size="sm"
            className="gap-1.5"
          >
            {savingBrand ? 'Salvando...' : 'Salvar identidade'}
          </Button>
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

      <SystemUsersSection />

      <div className="p-4 rounded-xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Acesso Garçom</h3>
        <p className="text-xs text-muted-foreground mb-2">Compartilhe este link com seus garçons (fixo, não muda ao reiniciar):</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-secondary px-3 py-2 rounded-lg text-primary truncate">
            {localIP ? `http://${localIP}:5173/GarcomLogin` : 'Carregando...'}
          </code>
          <Button size="sm" variant="outline" disabled={!localIP} onClick={() => navigator.clipboard.writeText(`http://${localIP}:5173/GarcomLogin`)}>
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
