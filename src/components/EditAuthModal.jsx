/**
 * EditAuthModal — exige senha de administrador para editar item já enviado.
 * Aceita apenas: proprietario / administrador.
 * Garçons NÃO podem autorizar, mesmo com permissões especiais.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Eye, EyeOff, Lock } from 'lucide-react';

async function findAdmin(password) {
  const admins = await fetch('/api/admin_users').then(r => r.json()).catch(() => []);
  return admins.find(
    a => a.active !== false && a.password === password &&
      (a.role === 'proprietario' || a.role === 'administrador')
  ) || null;
}

export default function EditAuthModal({ open, onClose, onConfirm, itemName }) {
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
    if (!password.trim()) { setError('Digite a senha de administrador'); return; }
    setLoading(true);
    try {
      const admin = await findAdmin(password.trim());
      if (!admin) {
        setError('Senha incorreta ou sem permissão de administrador');
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
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            Autorizar Edição
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
            <p className="text-sm text-amber-400 font-medium">
              Item já enviado para preparo
            </p>
            {itemName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                "{itemName}"
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Somente administrador pode alterar itens enviados.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Lock className="w-3.5 h-3.5" /> Senha do administrador
            </label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder="Senha de administrador"
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
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Autorizar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
