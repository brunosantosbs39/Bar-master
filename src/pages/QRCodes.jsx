import { useState, useEffect } from 'react';
import { localDB } from '@/lib/localDB';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const typeLabel = {
  mesa: { label: 'Mesa', icon: '🪑' },
  balcao: { label: 'Balcão', icon: '🍺' },
  delivery: { label: 'Delivery', icon: '🛵' },
};

export default function QRCodes() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const appUrl = window.location.origin;

  useEffect(() => {
    localDB.entities.Table.filter({ active: true }).then(data => {
      setTables(data.filter(t => t.type !== 'delivery'));
      setLoading(false);
    });
  }, []);

  const getMenuUrl = (table) => `${appUrl}/menu?table=${table.id}`;

  const downloadQR = (table) => {
    const svg = document.getElementById(`qr-${table.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 480);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 50, 50, 300, 300);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${typeLabel[table.type]?.label || ''} ${table.number}`, 200, 400);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText('Escaneie para ver o cardápio', 200, 430);
      const a = document.createElement('a');
      a.download = `qr-${table.type}-${table.number}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <QrCode className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">QR Codes das Mesas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clientes escaneiam e fazem pedidos direto pelo celular
          </p>
        </div>
      </div>

      <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300">
        💡 O link do cardápio é: <span className="font-mono text-xs break-all">{appUrl}/menu</span> — funciona sem login para os clientes.
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🪑</div>
          <p className="text-muted-foreground">Nenhuma mesa/balcão ativo. Cadastre mesas em Configurações.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table, i) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-col items-center p-4 rounded-2xl border border-border bg-card"
            >
              <p className="font-bold text-foreground mb-3 text-sm">
                {typeLabel[table.type]?.icon} {typeLabel[table.type]?.label} {table.number}
              </p>
              <div className="p-2 bg-white rounded-xl mb-3">
                <QRCodeSVG
                  id={`qr-${table.id}`}
                  value={getMenuUrl(table)}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-xs"
                  onClick={() => downloadQR(table)}
                >
                  <Download className="w-3 h-3" /> Baixar
                </Button>
                <a
                  href={getMenuUrl(table)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-background hover:bg-secondary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
