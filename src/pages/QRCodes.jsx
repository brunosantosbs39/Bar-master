import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBranding } from '@/lib/useBranding';
import { useMenuUrl } from '@/lib/useMenuUrl';

export default function QRCodes() {
  const { barName } = useBranding();
  const menuUrl = useMenuUrl();

  const downloadQR = () => {
    const svg = document.getElementById('qr-unico');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 580;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 500, 580);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 50, 50, 400, 400);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(barName, 250, 490);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText('Escaneie para ver o cardápio', 250, 525);
      const a = document.createElement('a');
      a.download = `qr-${barName.toLowerCase().replace(/\s+/g, '-')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <QrCode className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">QR Code do Cardápio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clientes escaneiam e acessam o cardápio direto no celular
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl border border-border bg-card">
        {/* QR Code */}
        <div className="p-4 bg-white rounded-2xl shadow-sm">
          <QRCodeSVG
            id="qr-unico"
            value={menuUrl}
            size={220}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Nome do estabelecimento */}
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{barName}</p>
          <p className="text-xs text-muted-foreground mt-1">Escaneie para ver o cardápio</p>
        </div>

        {/* URL */}
        <div className="w-full p-3 rounded-xl bg-secondary border border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">Link do cardápio</p>
          <p className="font-mono text-xs text-foreground break-all">{menuUrl}</p>
        </div>

        {/* Botões */}
        <div className="flex gap-3 w-full">
          <Button className="flex-1 gap-2" onClick={downloadQR}>
            <Download className="w-4 h-4" /> Baixar QR Code
          </Button>
          <a
            href={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium text-foreground"
          >
            <ExternalLink className="w-4 h-4" /> Abrir
          </a>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        💡 Imprima e cole nas mesas. O mesmo QR funciona para todas.
      </p>
    </div>
  );
}
