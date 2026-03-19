import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';

export default function TransferTableDialog({ open, onClose, order, onTransferred }) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadFreeTables();
      setSelectedTable(null);
    }
  }, [open]);

  const loadFreeTables = async () => {
    const all = await base44.entities.Table.filter({ status: 'livre', active: true });
    // Exclude delivery type
    setTables(all.filter(t => t.type !== 'delivery'));
  };

  const handleTransfer = async () => {
    if (!selectedTable || !order) return;
    setLoading(true);

    // Update the order with the new table info
    await base44.entities.Order.update(order.id, {
      table_id: selectedTable.id,
      table_number: selectedTable.number,
      table_type: selectedTable.type,
    });

    // Mark old table as free (if it was a table)
    if (order.table_id) {
      await base44.entities.Table.update(order.table_id, { status: 'livre' });
    }

    // Mark new table as occupied
    await base44.entities.Table.update(selectedTable.id, { status: 'ocupada' });

    setLoading(false);
    onTransferred(selectedTable);
  };

  const typeLabel = { mesa: '🪑 Mesa', balcao: '🍺 Balcão' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" /> Transferir Mesa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">Selecione a mesa de destino (apenas mesas livres):</p>

          {tables.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🚫</div>
              <p className="text-sm text-muted-foreground">Nenhuma mesa livre disponível.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto">
              {tables.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTable(t)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedTable?.id === t.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-foreground hover:border-primary/40'
                  }`}
                >
                  <div className="text-lg">{t.type === 'balcao' ? '🍺' : '🪑'}</div>
                  <div className="text-xs font-semibold mt-0.5">
                    {t.type === 'balcao' ? 'Balcão' : `Mesa ${t.number}`}
                  </div>
                  {t.capacity && <div className="text-[10px] text-muted-foreground">{t.capacity} pessoas</div>}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleTransfer}
              disabled={!selectedTable || loading}
            >
              <ArrowRightLeft className="w-4 h-4" />
              {loading ? 'Transferindo...' : 'Transferir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}