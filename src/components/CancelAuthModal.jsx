/**
 * CancelAuthModal — exige senha de quem tem permissão de cancelar antes de executar o cancelamento.
 * Valida contra:
 *   - Garçons com can_cancel_order: true
 *   - Usuários admin (proprietário / administrador)
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Eye, EyeOff, Lock } from 'lucide-react';

async function findAuthorizedUser(password) {
  const [waiters, admins] = await Promise.all([
    fetch('/api/waiters').then(r => r.json()).catch(() => []),
    fetch('/api/admin_users').then(r => r.json()).catch(() => []),
  ]);

  // Garçom ativo com can_cancel_order e senha correta
  const waiter = waiters.find(
    w => w.active !== false && w.password === password && w.permissions?.can_cancel_order === true
  );
  if (waiter) return { name: waiter.nickname || waiter.name.split(' ')[0], type: 'garcom' };

  // Admin ativo (proprietário ou administrador) com senha correta
  const admin = admins.find(
    a => a.active !== false && a.password === password &&
      (a.role === 'proprietario' || a.role === 'administrador')
  );
  if (admin) return { name: admin.name, type: 'admin' };

  return null;
}

export default function CancelAuthModal({ open, onClose, onConfirm, label = 'comanda' }) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setPassword('');
    setError('');
    setLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    setError('');
    if (!password.trim()) { setError('Digite a senha de autorização'); return; }
    setLoading(true);
    try {
      const authorized = await findAuthorizedUser(password.trim());
      if (!authorized) {
        setError('Senha incorreta ou sem permissão de cancelamento');
        setLoading(false);
        return;
      }
      handleClose();
      onConfirm();
    } catch {
      setError('Erro ao verificar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            Autorizar Cancelamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5">
            <p className="text-sm text-destructive font-medium">
              Cancelar {label} é irreversível.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Digite a senha de um responsável com permissão de cancelamento.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Lock className="w-3.5 h-3.5" /> Senha de autorização
            </label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder="Senha de quem autoriza"
                className="bg-secondary border-border pr-10"
                autoFocus
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-destructive mt-1.5 font-medium">{error}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Confirmar cancelamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
