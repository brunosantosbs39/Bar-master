import { useState, useEffect } from 'react';
import { Printer, Wifi, WifiOff, CheckCircle, AlertCircle, Info, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isQZTrayAvailable, checkQZTrayStatus, savePrinterConfig, printViaNetwork, buildEscPosKitchen, buildDensityCommand, EPSON_MODELS, defaultPrinterConfig } from '@/lib/printerConfig';

const DEPTS = [
  { key: 'bar', label: '🍺 Impressora do Bar', color: 'amber' },
  { key: 'cozinha', label: '🍳 Impressora da Cozinha', color: 'orange' },
];

export default function PrinterSettings() {
  const [config, setConfig] = useState(defaultPrinterConfig);
  const [loading, setLoading] = useState(true);
  const [qzAvailable, setQzAvailable] = useState(null);
  const [qzReason, setQzReason] = useState(null);
  const [qzRawError, setQzRawError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState({});
  const [winPrinters, setWinPrinters] = useState([]);

  useEffect(() => {
    fetch('/api/printers')
      .then(r => r.json())
      .then(cfg => {
        const merged = {
          bar:     { ...defaultPrinterConfig.bar,     ...(cfg.bar     || {}) },
          cozinha: { ...defaultPrinterConfig.cozinha, ...(cfg.cozinha || {}) },
        };
        setConfig(merged);
        setQzAvailable(false);
      })
      .catch(() => setQzAvailable(false))
      .finally(() => setLoading(false));

    // Busca impressoras Windows instaladas
    fetch('/api/printers-list')
      .then(r => r.json())
      .then(d => setWinPrinters(d.printers || []))
      .catch(() => {});
  }, []);

  const update = (dept, field, value) => {
    setConfig(prev => ({ ...prev, [dept]: { ...prev[dept], [field]: value } }));
    setSaved(false);
    if (field === 'method' && value === 'qztray' && qzAvailable === false) {
      checkQZTrayStatus().then(({ available, reason, rawError }) => { setQzAvailable(available); setQzReason(reason); setQzRawError(rawError); });
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(await res.text());
      savePrinterConfig(config); // sincroniza localStorage para PrintTicket usar client-side
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Erro ao salvar impressoras: ' + e.message);
    }
  };

  const testPrint = async (dept) => {
    const { method, name, ip, port, enabled, printDensity } = config[dept];
    if (!enabled) return;
    setTesting(t => ({ ...t, [dept]: true }));
    const densityCmd = buildDensityCommand(printDensity ?? 4);
    const densityLabel = `Intensidade: ${printDensity ?? 4}/8`;
    const testEscPos = `\x1B\x40${densityCmd}\x1B\x61\x01TESTE DE IMPRESSAO\n${dept.toUpperCase()}\n${new Date().toLocaleString('pt-BR')}\n${densityLabel}\n\x1B\x61\x00--------------------------------\n\n\n\n\x1D\x56\x41\x00`;
    try {
      if (method === 'network') {
        if (!ip) { alert('Informe o IP da impressora.'); return; }
        await printViaNetwork(ip, port || '9100', testEscPos);
      } else if (method === 'qztray') {
        const qzOk = await isQZTrayAvailable().catch(() => false);
        setQzAvailable(qzOk);
        if (!qzOk) { alert('QZ Tray não está disponível. Verifique se está aberto e conectado.'); return; }
        const { printViaQZTray } = await import('@/lib/printerConfig');
        await printViaQZTray(name, testEscPos);
      } else {
        // browser — abre popup separado para não escurecer a tela principal
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@page{size:80mm auto;margin:0}body{font-family:monospace;padding:8px;width:80mm}</style></head><body><b>TESTE DE IMPRESSÃO</b><br>${dept.toUpperCase()}<br>${new Date().toLocaleString('pt-BR')}</body></html>`;
        const popup = window.open('', '_blank', 'width=420,height=400,toolbar=0,scrollbars=1,status=0,menubar=0,location=0');
        if (popup) {
          popup.document.write(html);
          popup.document.close();
          popup.focus();
          setTimeout(() => { popup.print(); setTimeout(() => popup.close(), 800); }, 200);
        }
      }
    } catch (e) {
      alert('Erro ao imprimir: ' + e.message);
    } finally {
      setTesting(t => ({ ...t, [dept]: false }));
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Printer className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm text-foreground">Impressoras de Rede</span>

        {/* QZ Tray status */}
        <div className="ml-auto flex items-center gap-2">
          {qzAvailable === null && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Verificando QZ Tray...
            </span>
          )}
          {qzAvailable === true && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Wifi className="w-3 h-3" /> QZ Tray ativo
            </span>
          )}
          {qzAvailable === false && (
            <span className="flex flex-col items-end gap-0.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <WifiOff className="w-3 h-3" />
                <span>QZ Tray offline</span>
                {qzReason === 'no_script' && (
                  <span className="text-amber-400/80 ml-1">— script não carregado</span>
                )}
                {qzReason === 'not_running' && (
                  <span className="text-amber-400/80 ml-1">— falha na conexão</span>
                )}
              {qzReason === 'blocked' && (
                  <span className="text-red-400/80 ml-1">— site bloqueado no QZ Tray</span>
                )}
                {qzReason === 'timeout' && (
                  <span className="text-amber-400/80 ml-1">— autorize na bandeja do sistema</span>
                )}
                {qzReason === 'security_error' && (
                  <span className="text-red-400/80 ml-1">— configure allow-unsigned=true</span>
                )}
              </span>
              {qzRawError && (
                <span className="text-[10px] text-red-400/70 max-w-xs text-right leading-tight">{qzRawError}</span>
              )}
            </span>
          )}
          <button
            onClick={() => {
              setQzAvailable(null);
              setQzReason(null);
              setQzRawError(null);
              checkQZTrayStatus()
                .then(({ available, reason, rawError }) => { setQzAvailable(available); setQzReason(reason); setQzRawError(rawError); })
                .catch((e) => { setQzAvailable(false); setQzReason('not_running'); setQzRawError(String(e?.message || e)); });
            }}
            className="text-xs text-muted-foreground hover:text-primary underline transition-colors"
            title="Verificar conexão QZ Tray"
          >
            Verificar
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Info banner */}
        <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <b>3 modos disponíveis:</b><br />
            <b>Rede (TCP):</b> Impressora térmica com IP fixo na rede (porta padrão 9100). Mais simples e recomendado.<br />
            <b>QZ Tray:</b> Impressora USB/local via <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="underline">QZ Tray</a>.<br />
            <b>Navegador:</b> Abre diálogo de impressão do browser.
          </div>
        </div>

        {DEPTS.map(({ key, label }) => {
          const dept = config[key] || defaultPrinterConfig[key];
          return (
            <div key={key} className="space-y-3 p-3 rounded-xl border border-border bg-secondary/40">
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
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: 'winusb', label: '🖨️ USB (Windows)' },
                      { val: 'network', label: '🌐 Rede (TCP)' },
                      { val: 'browser', label: '🌐 Navegador' },
                      { val: 'qztray', label: '💻 QZ Tray' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => update(key, 'method', opt.val)}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          dept.method === opt.val
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* USB Windows */}
                  {dept.method === 'winusb' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Impressora instalada no Windows
                      </Label>
                      {winPrinters.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {winPrinters.map(p => (
                            <button
                              key={p}
                              onClick={() => update(key, 'name', p)}
                              className={`px-2 py-1 rounded text-xs border transition-all text-left ${
                                dept.name === p
                                  ? 'border-primary bg-primary/15 text-primary'
                                  : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhuma impressora encontrada</p>
                      )}
                      <Input
                        value={dept.name || ''}
                        onChange={e => update(key, 'name', e.target.value)}
                        placeholder="Ex: EPSON TM-T20 Receipt"
                        className="bg-secondary border-border text-sm h-9"
                      />
                      <p className="text-xs text-muted-foreground">
                        Imprime direto via servidor Windows — sem QZ Tray.
                      </p>
                    </div>
                  )}

                  {/* Rede (TCP) */}
                  {dept.method === 'network' && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          IP da impressora
                        </Label>
                        <Input
                          value={dept.ip || ''}
                          onChange={e => update(key, 'ip', e.target.value)}
                          placeholder="Ex: 192.168.100.200"
                          className="bg-secondary border-border text-sm h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Porta TCP (padrão: 9100)
                        </Label>
                        <Input
                          value={dept.port || '9100'}
                          onChange={e => update(key, 'port', e.target.value)}
                          placeholder="9100"
                          className="bg-secondary border-border text-sm h-9 w-28"
                        />
                      </div>
                    </div>
                  )}

                  {/* QZ Tray */}
                  {dept.method === 'qztray' && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Nome da impressora (exato, como aparece no Windows/Mac)
                      </Label>
                      <Input
                        value={dept.name || ''}
                        onChange={e => update(key, 'name', e.target.value)}
                        placeholder="EPSON TM-T20 Receipt"
                        className="bg-secondary border-border text-sm h-9"
                      />
                      {!qzAvailable && qzReason === 'no_script' && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Script QZ Tray não carregou — recarregue a página.
                        </p>
                      )}
                      {!qzAvailable && qzReason === 'not_running' && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          QZ Tray não está aberto — inicie o app na bandeja do sistema.
                        </p>
                      )}
                      {!qzAvailable && qzReason === 'timeout' && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          QZ Tray aguardando aprovação — clique em <b className="mx-0.5">Allow</b> na notificação da bandeja do sistema.
                        </p>
                      )}
                      {!qzAvailable && qzReason === 'security_error' && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Erro de segurança — adicione <code className="bg-red-900/30 px-1 rounded">allow-unsigned=true</code> no qz-tray.properties.
                        </p>
                      )}
                      {!qzAvailable && !qzReason && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          QZ Tray não detectado — clique em Verificar para diagnóstico.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Modelo da impressora */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground block">Modelo Epson</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {EPSON_MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            update(key, 'model', m.id);
                            if (!dept.model || dept.printDensity === (EPSON_MODELS.find(x => x.id === dept.model)?.defaultDensity ?? 4)) {
                              update(key, 'printDensity', m.defaultDensity);
                            }
                          }}
                          className={`px-2 py-1 rounded text-xs border transition-all ${
                            dept.model === m.id
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Intensidade de impressão */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Intensidade de impressão
                      </Label>
                      <span className="text-xs font-mono text-foreground">
                        {dept.printDensity ?? 4}/8
                        {(dept.printDensity ?? 4) <= 2 && ' — Claro'}
                        {(dept.printDensity ?? 4) >= 3 && (dept.printDensity ?? 4) <= 5 && ' — Normal'}
                        {(dept.printDensity ?? 4) >= 6 && (dept.printDensity ?? 4) <= 7 && ' — Escuro'}
                        {(dept.printDensity ?? 4) === 8 && ' — Máximo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-8">Leve</span>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={1}
                        value={dept.printDensity ?? 4}
                        onChange={e => update(key, 'printDensity', Number(e.target.value))}
                        className="flex-1 accent-primary h-2"
                      />
                      <span className="text-xs text-muted-foreground w-8 text-right">Escuro</span>
                    </div>
                    <div className="flex justify-between px-8">
                      {[0,1,2,3,4,5,6,7,8].map(v => (
                        <button
                          key={v}
                          onClick={() => update(key, 'printDensity', v)}
                          className={`w-5 h-5 rounded text-[10px] border transition-all ${
                            (dept.printDensity ?? 4) === v
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Test button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => testPrint(key)}
                    disabled={testing[key]}
                  >
                    {testing[key]
                      ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <Printer className="w-3 h-3" />}
                    {testing[key] ? 'Enviando...' : 'Imprimir Teste'}
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