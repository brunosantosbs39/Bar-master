import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { useWaiterSession } from '@/lib/WaiterSessionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useBranding } from '@/lib/useBranding';

export default function GarcomLogin() {
  const { barName } = useBranding();
  const [waiters, setWaiters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { login, waiter } = useWaiterSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (waiter) navigate('/GarcomApp');
  }, [waiter]);

  useEffect(() => {
    localDB.entities.Waiter.filter({ active: true }).then(list => {
      setWaiters(list);
      setLoading(false);
    });
  }, []);

  const handleLogin = () => {
    setError('');
    if (!selected) { setError('Selecione seu nome'); return; }
    if (!selected.password) { setError('Sem senha cadastrada. Peça ao proprietário.'); return; }
    if (password !== selected.password) { setError('Senha incorreta'); return; }
    login(selected);
    navigate('/GarcomApp');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="text-5xl mb-3">🍺</div>
          <h1 className="text-2xl font-black text-foreground">{barName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesso do Garçom</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          {/* Waiter selection */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Selecione seu nome</p>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {waiters.map(w => (
                  <button
                    key={w.id}
                    onClick={() => { setSelected(w); setPassword(''); setError(''); }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                      selected?.id === w.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary text-foreground hover:border-primary/40'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="font-bold text-primary text-sm">{w.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-xs font-semibold leading-tight">{w.nickname || w.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            )}
            {waiters.length === 0 && !loading && (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhum garçom cadastrado</p>
            )}
          </div>

          {/* Password */}
          {selected && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Senha de {selected.nickname || selected.name.split(' ')[0]}
              </p>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  placeholder="Digite sua senha"
                  className="pr-10 bg-secondary border-border"
                  autoFocus
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
            </div>
          )}

          <Button className="w-full" onClick={handleLogin} disabled={!selected}>
            Entrar
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Proprietário / Admin?{' '}
          <button onClick={() => navigate('/AdminLogin')} className="text-primary hover:underline">
            Acesso completo
          </button>
        </p>
      </div>
    </div>
  );
}
