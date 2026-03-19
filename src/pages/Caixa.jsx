import { useState } from 'react';
import { useActiveCashier, useCashiers, useOpenCashier, useAddMovement, useCloseCashier } from '@/hooks/useCashier';
import { Wallet, Plus, Lock, ChevronDown, ChevronUp, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const PAY_LABELS = {
  dinheiro: '💵 Dinheiro',
  pix: '⚡ Pix',
  cartao_credito: '💳 Crédito',
  cartao_debito: '💳 Débito',
  misto: '🔀 Misto',
};

const TURNO_LABELS = {
  manha: '🌅 Manhã',
  tarde: '🌤 Tarde',
  noite: '🌙 Noite',
};

function fmt(val) {
  return `R$ ${(val || 0).toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Abrir Caixa ──────────────────────────────────────────────────────────────

function AbrirCaixaDialog({ open, onClose }) {
  const [form, setForm] = useState({ operador: '', turno: 'manha', saldo_inicial: '' });
  const openCashier = useOpenCashier();

  const submit = async () => {
    if (!form.operador.trim()) return;
    await openCashier.mutateAsync({
      operador: form.operador.trim(),
      turno: form.turno,
      saldo_inicial: parseFloat(form.saldo_inicial) || 0,
    });
    setForm({ operador: '', turno: 'manha', saldo_inicial: '' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Abrir Caixa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Operador *</Label>
            <Input
              value={form.operador}
              onChange={e => setForm(p => ({ ...p, operador: e.target.value }))}
              placeholder="Seu nome"
              className="mt-1.5 bg-secondary border-border"
            />
          </div>
          <div>
            <Label>Turno</Label>
            <div className="flex gap-2 mt-1.5">
              {Object.entries(TURNO_LABELS).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setForm(p => ({ ...p, turno: v }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                    form.turno === v
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Saldo inicial (troco/fundo de caixa)</Label>
            <Input
              value={form.saldo_inicial}
              onChange={e => setForm(p => ({ ...p, saldo_inicial: e.target.value }))}
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              className="mt-1.5 bg-secondary border-border"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1"
              onClick={submit}
              disabled={!form.operador.trim() || openCashier.isPending}
            >
              {openCashier.isPending ? 'Abrindo...' : 'Abrir Caixa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Movimentação (Sangria / Reforço) ─────────────────────────────────────────

function MovimentacaoDialog({ open, tipo, cashier, onClose }) {
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const addMovement = useAddMovement();
  const isSangria = tipo === 'sangria';

  const submit = async () => {
    const v = parseFloat(valor);
    if (!v || v <= 0) return;
    await addMovement.mutateAsync({
      cashierId: cashier.id,
      tipo,
      valor: v,
      motivo: motivo.trim() || (isSangria ? 'Sangria de caixa' : 'Reforço de caixa'),
      operador: cashier.operador,
    });
    setValor('');
    setMotivo('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSangria
              ? <ArrowUpCircle className="w-4 h-4 text-destructive" />
              : <ArrowDownCircle className="w-4 h-4 text-emerald-400" />}
            {isSangria ? 'Sangria de Caixa' : 'Reforço de Caixa'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            {isSangria
              ? 'Retirada de dinheiro do caixa (ex: depósito bancário, pagamento a fornecedor).'
              : 'Entrada de dinheiro no caixa (ex: complemento de troco, reforço de fundo).'}
          </p>
          <div>
            <Label>Valor *</Label>
            <Input
              value={valor}
              onChange={e => setValor(e.target.value)}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              className="mt-1.5 bg-secondary border-border"
            />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={isSangria ? 'Ex: depósito bancário' : 'Ex: complemento de troco'}
              className="mt-1.5 bg-secondary border-border"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className={`flex-1 ${isSangria ? 'bg-destructive hover:bg-destructive/90' : ''}`}
              onClick={submit}
              disabled={!valor || parseFloat(valor) <= 0 || addMovement.isPending}
            >
              {addMovement.isPending ? 'Salvando...' : `Confirmar ${isSangria ? 'Sangria' : 'Reforço'}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Fechar Caixa ─────────────────────────────────────────────────────────────

function FecharCaixaDialog({ open, cashier, onClose }) {
  const [saldoReal, setSaldoReal] = useState('');
  const closeCashier = useCloseCashier();

  const movs = cashier?.movimentacoes || [];
  const totalReforcos = movs.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0);
  const totalSangrias = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);

  const submit = async () => {
    await closeCashier.mutateAsync({
      cashierId: cashier.id,
      saldo_real: parseFloat(saldoReal) || 0,
    });
    setSaldoReal('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" /> Fechar Caixa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 rounded-xl bg-secondary space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo inicial</span>
              <span className="font-medium">{fmt(cashier?.saldo_inicial)}</span>
            </div>
            {totalReforcos > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>+ Reforços</span>
                <span>{fmt(totalReforcos)}</span>
              </div>
            )}
            {totalSangrias > 0 && (
              <div className="flex justify-between text-destructive">
                <span>− Sangrias</span>
                <span>{fmt(totalSangrias)}</span>
              </div>
            )}
          </div>
          <div>
            <Label>Dinheiro contado no caixa agora *</Label>
            <Input
              value={saldoReal}
              onChange={e => setSaldoReal(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              className="mt-1.5 bg-secondary border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Conte o dinheiro físico e informe o total exato.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-500/90 text-black font-semibold"
              onClick={submit}
              disabled={closeCashier.isPending}
            >
              {closeCashier.isPending ? 'Fechando...' : 'Fechar Caixa'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Caixa Aberto ─────────────────────────────────────────────────────────────

function CaixaAberto({ cashier }) {
  const [showSangria, setShowSangria] = useState(false);
  const [showReforco, setShowReforco] = useState(false);
  const [showFechar, setShowFechar] = useState(false);
  const [showMovs, setShowMovs] = useState(false);

  const movs = cashier.movimentacoes || [];
  const totalReforcos = movs.filter(m => m.tipo === 'reforco').reduce((s, m) => s + m.valor, 0);
  const totalSangrias = movs.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0);
  const saldoEstimado = (cashier.saldo_inicial || 0) + totalReforcos - totalSangrias;

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-300">Caixa Aberto</span>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border text-xs">
            {TURNO_LABELS[cashier.turno] || cashier.turno}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Operador</p>
            <p className="font-medium text-foreground">{cashier.operador}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Abertura</p>
            <p className="font-medium text-foreground">{fmtDate(cashier.aberto_em)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo inicial</p>
            <p className="font-medium text-foreground">{fmt(cashier.saldo_inicial)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Comandas vinculadas</p>
            <p className="font-medium text-foreground">{(cashier.linked_order_ids || []).length}</p>
          </div>
        </div>
      </div>

      {/* Resumo de movimentações */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-border bg-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Reforços</p>
          <p className="font-bold text-emerald-400">{fmt(totalReforcos)}</p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Sangrias</p>
          <p className="font-bold text-destructive">{fmt(totalSangrias)}</p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Saldo est.</p>
          <p className="font-bold text-primary">{fmt(saldoEstimado)}</p>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          onClick={() => setShowReforco(true)}
        >
          <ArrowDownCircle className="w-4 h-4" /> Reforço
        </Button>
        <Button
          variant="outline"
          className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => setShowSangria(true)}
        >
          <ArrowUpCircle className="w-4 h-4" /> Sangria
        </Button>
      </div>

      {/* Lista de movimentações */}
      {movs.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary/50 transition-colors"
            onClick={() => setShowMovs(!showMovs)}
          >
            <span>Movimentações ({movs.length})</span>
            {showMovs
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showMovs && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-border">
                  {[...movs].reverse().map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      {m.tipo === 'sangria'
                        ? <ArrowUpCircle className="w-4 h-4 text-destructive shrink-0" />
                        : <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground truncate">{m.motivo}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.hora)}</p>
                      </div>
                      <span className={`font-semibold shrink-0 ${m.tipo === 'sangria' ? 'text-destructive' : 'text-emerald-400'}`}>
                        {m.tipo === 'sangria' ? '−' : '+'}{fmt(m.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Fechar caixa */}
      <Button
        className="w-full gap-2 bg-amber-500 hover:bg-amber-500/90 text-black font-semibold"
        onClick={() => setShowFechar(true)}
      >
        <Lock className="w-4 h-4" /> Fechar Caixa
      </Button>

      <MovimentacaoDialog open={showSangria} tipo="sangria" cashier={cashier} onClose={() => setShowSangria(false)} />
      <MovimentacaoDialog open={showReforco} tipo="reforco" cashier={cashier} onClose={() => setShowReforco(false)} />
      <FecharCaixaDialog open={showFechar} cashier={cashier} onClose={() => setShowFechar(false)} />
    </div>
  );
}

// ── Caixa Fechado ─────────────────────────────────────────────────────────────

function CaixaFechado({ onOpen }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
        <Wallet className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-bold text-foreground mb-1">Caixa Fechado</h2>
      <p className="text-sm text-muted-foreground mb-6">Abra o caixa para iniciar um novo turno</p>
      <Button className="gap-2" onClick={onOpen}>
        <Plus className="w-4 h-4" /> Abrir Caixa
      </Button>
    </div>
  );
}

// ── Histórico ─────────────────────────────────────────────────────────────────

function CaixaHistorico() {
  const { data: cashiers = [], isLoading } = useCashiers({ status: 'fechado' });
  const [expanded, setExpanded] = useState(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (cashiers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">🏦</div>
        <p className="text-muted-foreground text-sm">Nenhum caixa fechado ainda</p>
      </div>
    );
  }

  const sorted = [...cashiers].sort((a, b) => new Date(b.fechado_em) - new Date(a.fechado_em));

  return (
    <div className="space-y-2">
      {sorted.map((c, i) => {
        const isExp = expanded === c.id;
        const totalPgto = Object.values(c.resumo_pagamentos || {}).reduce((s, v) => s + v, 0);
        const difClass = c.diferenca > 0 ? 'text-emerald-400' : c.diferenca < 0 ? 'text-destructive' : 'text-muted-foreground';

        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
              onClick={() => setExpanded(isExp ? null : c.id)}
            >
              <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {c.operador} — {TURNO_LABELS[c.turno] || c.turno}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(c.aberto_em)} → {fmtDate(c.fechado_em)}
                </p>
              </div>
              <div className="text-right shrink-0 mr-1">
                <p className="text-sm font-bold text-primary">{fmt(totalPgto)}</p>
                <p className={`text-xs ${difClass}`}>
                  {c.diferenca > 0 ? '+' : ''}{fmt(c.diferenca)} dif.
                </p>
              </div>
              {isExp
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            <AnimatePresence>
              {isExp && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="p-2 rounded-lg bg-secondary">
                        <p className="text-xs text-muted-foreground">Comandas</p>
                        <p className="font-bold text-foreground">{c.total_comandas}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary">
                        <p className="text-xs text-muted-foreground">Itens</p>
                        <p className="font-bold text-foreground">{c.total_itens}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary">
                        <p className="text-xs text-muted-foreground">Saldo real</p>
                        <p className="font-bold text-foreground">{fmt(c.saldo_real)}</p>
                      </div>
                    </div>

                    {/* Pagamentos */}
                    {Object.values(c.resumo_pagamentos || {}).some(v => v > 0) && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Formas de Pagamento
                        </p>
                        <div className="space-y-1">
                          {Object.entries(c.resumo_pagamentos || {})
                            .filter(([, v]) => v > 0)
                            .map(([k, v]) => (
                              <div key={k} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{PAY_LABELS[k] || k}</span>
                                <span className="font-medium text-foreground">{fmt(v)}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Conferência */}
                    <div className="border-t border-border pt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Saldo esperado</span>
                        <span className="font-medium">{fmt(c.saldo_esperado)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Diferença</span>
                        <span className={`font-bold ${difClass}`}>
                          {c.diferenca > 0 ? '+' : ''}{fmt(c.diferenca)}
                        </span>
                      </div>
                    </div>

                    {/* Movimentações */}
                    {(c.movimentacoes || []).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Movimentações
                        </p>
                        {c.movimentacoes.map(m => (
                          <div key={m.id} className="flex justify-between text-xs py-0.5">
                            <span className="text-muted-foreground">
                              {m.tipo === 'sangria' ? '↑' : '↓'} {m.motivo}
                            </span>
                            <span className={m.tipo === 'sangria' ? 'text-destructive' : 'text-emerald-400'}>
                              {m.tipo === 'sangria' ? '−' : '+'}{fmt(m.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────

export default function Caixa() {
  const { data: activeCashier, isLoading } = useActiveCashier();
  const [showAbrir, setShowAbrir] = useState(false);
  const [tab, setTab] = useState('caixa');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Caixa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Controle de turno e movimentações</p>
          </div>
        </div>
        {activeCashier && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Aberto</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('caixa')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'caixa' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" /> Caixa
        </button>
        <button
          onClick={() => setTab('historico')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'historico' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-3.5 h-3.5" /> Histórico
        </button>
      </div>

      {tab === 'caixa' && (
        activeCashier
          ? <CaixaAberto cashier={activeCashier} />
          : <CaixaFechado onOpen={() => setShowAbrir(true)} />
      )}

      {tab === 'historico' && <CaixaHistorico />}

      <AbrirCaixaDialog open={showAbrir} onClose={() => setShowAbrir(false)} />
    </div>
  );
}
