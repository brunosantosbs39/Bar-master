import { useState, useEffect } from 'react';
import { Printer, Wifi, WifiOff, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loadPrinterConfig, savePrinterConfig, isQZTrayAvailable, defaultPrinterConfig } from '@/lib/printerConfig';

const DEPTS = [
  { key: 'bar', label: '🍺 Impressora do Bar', color: 'amber' },
  { key: 'cozinha', label: '🍳 Impressora da Cozinha', color: 'orange' },
];

export default function PrinterSettings() {
  const [config, setConfig] = useState(loadPrinterConfig());
  const [qzAvailable, setQzAvailable] = useState(null); // null=checking, true, false
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    isQZTrayAvailable().then(setQzAvailable);
  }, []);

  const update = (dept, field, value) => {
    setConfig(prev => ({
      ...prev,
      [dept]: { ...prev[dept], [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    savePrinterConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const testPrint = (dept) => {
    const { method, name, enabled } = config[dept];
    if (!enabled) return;
    if (method === 'browser') {
      const win = window.open('', '_blank', 'width=320,height=400');
      if (!win) { alert('Permita pop-ups para testar a impressão.'); return; }
      win.document.write(`
        <html><body style="font-family:monospace;padding:16px;">
          <b>TESTE DE IMPRESSÃO</b><br>
          Departamento: ${dept.toUpperCase()}<br>
          Método: Navegador<br>
          ${new Date().toLocaleString('pt-BR')}
          <script>window.onload=()=>{window.print();window.close();}<\/script>
        </body></html>
      `);
      win.document.close();
    } else if (method === 'qztray') {
      if (!qzAvailable) { alert('QZ Tray não está disponível.'); return; }
      import('@/lib/printerConfig').then(({ printViaQZTray }) => {
        printViaQZTray(name, `TESTE DE IMPRESSAO\n${dept.toUpperCase()}\n${new Date().toLocaleString('pt-BR')}\n\n\n\n`)
          .catch(e => alert('Erro ao imprimir: ' + e.message));
      });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Printer className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-foreground">Impressoras de Rede</span>

        {/* QZ Tray status */}
        <div className="ml-auto flex items-center gap-1.5">
          {qzAvailable === null && (
            <span className="text-xs text-muted-foreground">Verificando QZ Tray...</span>
          )}
          {qzAvailable === true && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Wifi className="w-3 h-3" /> QZ Tray ativo
            </span>
          )}
          {qzAvailable === false && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <WifiOff className="w-3 h-3" /> QZ Tray offline
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Info banner */}
        <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <b>Impressão via rede:</b> Instale o <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="underline">QZ Tray</a> no computador conectado à impressora térmica e configure o nome da impressora abaixo.
            Sem QZ Tray, o sistema usa a impressão padrão do navegador.
          </div>
        </div>

        {DEPTS.map(({ key, label }) => {
          const dept = config[key] || defaultPrinterConfig[key];
          return (
            <div key={key} className="space-y-3 p-3 rounded-xl border border-border bg-secondary/40">
              {/* Dept header + enable toggle */}
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">{label}</span>
                <button
                  onClick={() => update(key, 'enabled', !dept.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${dept.enabled ? 'bg-emerald-500' : 'bg-border'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${dept.enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {dept.enabled && (
                <>
                  {/* Method selector */}
                  <div className="flex gap-2">
                    {[
                      { val: 'browser', label: '🖨️ Navegador' },
                      { val: 'qztray', label: '🌐 QZ Tray' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => update(key, 'method', opt.val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          dept.method === opt.val
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Printer name (only for QZ Tray) */}
                  {dept.method === 'qztray' && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Nome da impressora (exato, como aparece no Windows/Mac)
                      </Label>
                      <Input
                        value={dept.name}
                        onChange={e => update(key, 'name', e.target.value)}
                        placeholder={`Ex: EPSON TM-T20 ${key === 'bar' ? '(Bar)' : '(Cozinha)'}`}
                        className="bg-secondary border-border text-sm h-8"
                      />
                      {!qzAvailable && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          QZ Tray não detectado — instale e inicie antes de usar.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Test button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => testPrint(key)}
                  >
                    <Printer className="w-3 h-3" /> Imprimir Teste
                  </Button>
                </>
              )}
            </div>
          );
        })}

        <Button className="w-full gap-2" onClick={handleSave}>
          {saved ? <><CheckCircle className="w-4 h-4" /> Salvo!</> : <><Printer className="w-4 h-4" /> Salvar Configurações</>}
        </Button>
      </div>
    </div>
  );
}