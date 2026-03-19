import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Plus } from 'lucide-react';

export default function ModifiersDialog({ open, onClose, product, onConfirm }) {
  const [selected, setSelected] = useState([]);

  if (!product) return null;
  const modifiers = product.modifiers || [];

  const toggle = (mod) => {
    setSelected(prev => {
      const exists = prev.find(m => m.name === mod.name);
      if (exists) return prev.filter(m => m.name !== mod.name);
      return [...prev, mod];
    });
  };

  const handleConfirm = () => {
    onConfirm(product, selected);
    setSelected([]);
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    onClose();
  };

  const extraTotal = selected.reduce((s, m) => s + (m.price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{product.name}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">Selecione os adicionais/modificadores</p>
        </DialogHeader>

        <div className="space-y-2 py-1 max-h-72 overflow-y-auto">
          {modifiers.map((mod) => {
            const isSelected = !!selected.find(m => m.name === mod.name);
            return (
              <button
                key={mod.name}
                onClick={() => toggle(mod)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-secondary hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-primary border-primary' : 'border-border'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm font-medium text-foreground">{mod.name}</span>
                  {mod.type === 'required' && (
                    <span className="text-[10px] text-destructive border border-destructive/30 px-1.5 py-0.5 rounded-full">Obrigatório</span>
                  )}
                </div>
                <span className={`text-sm font-semibold ${mod.price > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {mod.price > 0 ? `+R$ ${mod.price.toFixed(2)}` : 'grátis'}
                </span>
              </button>
            );
          })}
        </div>

        {extraTotal > 0 && (
          <div className="flex justify-between text-sm px-1 py-1 border-t border-border">
            <span className="text-muted-foreground">Adicionais</span>
            <span className="font-semibold text-primary">+R$ {extraTotal.toFixed(2)}</span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
          <Button className="flex-1 gap-2" onClick={handleConfirm}>
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}