import { useState } from 'react';
import { Eye, EyeOff, Crown, ShieldCheck, Lock, User, ArrowLeft } from 'lucide-react';
import { useBranding } from '@/lib/useBranding';

const ROLE_LABELS = {
  proprietario: { label: 'Proprietário', icon: Crown, color: 'text-yellow-400', desc: 'Acesso total ao sistema' },
  administrador: { label: 'Administrador', icon: ShieldCheck, color: 'text-blue-400', desc: 'Gestão completa do negócio' },
  caixa: { label: 'Caixa', icon: Lock, color: 'text-emerald-400', desc: 'Funções de caixa' },
};

// ── Tela de Setup Inicial ────────────────────────────────────────────────────
function SetupInicial({ onDone }) {
  const { barName } = useBranding();
  const [step, setStep] = useState(1); // 1=boas vindas, 2=criar proprietário
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setError('');
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError('Preencha todos os campos'); return;
    }
    if (form.password !== form.confirm) {
      setError('As senhas não coincidem'); return;
    }
    if (form.password.length < 4) {
      setError('Senha mínima de 4 caracteres'); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin_users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          role: 'proprietario',
          active: true,
        }),
      });
      const created = await res.json();
      const { password: _, ...safeUser } = created;
      onDone(safeUser);
    } catch {
      setError('Erro ao criar conta. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-6xl mb-2">🍺</div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Bem-vindo ao {barName}!</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Primeiro acesso detectado. Vamos criar a conta do proprietário para começar.
            </p>
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Criar minha conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-yellow-500/15 mb-3">
            <Crown className="w-6 h-6 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Criar conta do Proprietário</h2>
          <p className="text-xs text-muted-foreground mt-1">Esta conta tem acesso total ao sistema</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Nome completo</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: João Silva"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Usuário (login)</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: joao"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Senha</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Mínimo 4 caracteres"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Confirmar senha</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Repita a senha"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar conta e entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tela de Login Normal ─────────────────────────────────────────────────────
export default function AdminLogin({ onLogin, needsSetup }) {
  const { barName } = useBranding();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (needsSetup) {
    return <SetupInicial onDone={onLogin} />;
  }

  const handleLogin = async () => {
    setError('');
    if (!username.trim() || !password.trim()) { setError('Preencha usuário e senha'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin_users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Erro ao entrar');
        return;
      }
      const user = await res.json();
      onLogin(user);
    } catch {
      setError('Servidor offline. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-5">
        {/* Logo */}
        <div className="text-center">
          <div className="text-5xl mb-3">🍺</div>
          <h1 className="text-2xl font-black text-foreground">{barName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesso Administrativo</p>
        </div>

        {/* Roles info */}
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ROLE_LABELS).map(([role, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={role} className="bg-card rounded-xl border border-border p-2.5 text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${cfg.color}`} />
                <p className="text-xs font-semibold text-foreground">{cfg.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{cfg.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Form */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Usuário
            </label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Digite seu usuário"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Senha
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="w-full px-3 py-2 pr-10 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Digite sua senha"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          É garçom?{' '}
          <a href="/GarcomLogin" className="text-primary hover:underline">
            Acessar como garçom
          </a>
        </p>
      </div>
    </div>
  );
}
