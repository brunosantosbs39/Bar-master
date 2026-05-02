import { useState, useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, ShoppingBag, DollarSign, Package, Users, Trophy, Calendar, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316'];

const payLabels = {
  dinheiro: '💵 Dinheiro',
  cartao_credito: '💳 Crédito',
  cartao_debito: '💳 Débito',
  pix: '⚡ Pix',
  misto: '🔀 Misto',
};

// Formata ISO para data local BR
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// Input[type=date] espera "YYYY-MM-DD"
function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function Relatorios() {
  const { data: orders = [], isLoading: loading } = useOrders({ status: 'fechada' });

  const [period, setPeriod] = useState('today');
  const [tab, setTab] = useState('vendas');

  // Filtro personalizado
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(toInputDate(today));
  const [dateTo, setDateTo] = useState(toInputDate(today));
  const [showCustom, setShowCustom] = useState(false);

  // Histórico: controle de expansão de comanda
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [histSearch, setHistSearch] = useState('');

  // ─── Filtragem por período ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = new Date();
    return orders.filter(o => {
      if (!o.closed_at) return false;
      const d = new Date(o.closed_at);

      if (period === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (period === 'week') {
        return (now - d) / 86400000 <= 7;
      }
      if (period === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (period === 'custom') {
        // Compara apenas datas (ignora hora) — inclui os dois extremos
        const from = new Date(dateFrom + 'T00:00:00');
        const to   = new Date(dateTo   + 'T23:59:59');
        return d >= from && d <= to;
      }
      return true; // 'all'
    });
  }, [orders, period, dateFrom, dateTo]);

  // ─── Métricas ─────────────────────────────────────────────────────────────────
  const totalRevenue = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders  = filtered.length;
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalItems   = filtered.reduce((s, o) => s + (o.items?.reduce((ss, i) => ss + i.quantity, 0) || 0), 0);

  // Top produtos
  const productMap = {};
  filtered.forEach(order => {
    (order.items || []).forEach(item => {
      if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
      productMap[item.product_name].qty     += item.quantity;
      productMap[item.product_name].revenue += item.total;
    });
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

  // Receita por dia
  const dayMap = {};
  filtered.forEach(o => {
    if (!o.closed_at) return;
    const d = new Date(o.closed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    dayMap[d] = (dayMap[d] || 0) + (o.total || 0);
  });
  const dayData = Object.entries(dayMap)
    .map(([date, total]) => ({ date, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  // Formas de pagamento
  const payMap = {};
  filtered.forEach(o => {
    if (!o.payment_method) return;
    payMap[o.payment_method] = (payMap[o.payment_method] || 0) + 1;
  });
  const payData = Object.entries(payMap).map(([name, value]) => ({ name: payLabels[name] || name, value }));

  // Garçons
  const waiterMap = {};
  filtered.forEach(o => {
    if (!o.waiter_name) return;
    const key = o.waiter_name;
    if (!waiterMap[key]) waiterMap[key] = { name: key, orders: 0, revenue: 0, items: 0 };
    waiterMap[key].orders  += 1;
    waiterMap[key].revenue += o.total || 0;
    waiterMap[key].items   += o.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  });
  const waiterData = Object.values(waiterMap).sort((a, b) => b.revenue - a.revenue);

  // Histórico: ordena do mais recente ao mais antigo + busca por mesa/garçom
  const histOrders = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
    if (!histSearch.trim()) return sorted;
    const q = histSearch.toLowerCase();
    return sorted.filter(o =>
      String(o.table_number).includes(q) ||
      (o.waiter_name || '').toLowerCase().includes(q) ||
      (o.payment_method || '').toLowerCase().includes(q)
    );
  }, [filtered, histSearch]);

  const stats = [
    { label: 'Receita Total',      value: `R$ ${totalRevenue.toFixed(2)}`, icon: DollarSign,  color: 'text-amber-400'  },
    { label: 'Comandas Fechadas',  value: totalOrders,                      icon: ShoppingBag, color: 'text-emerald-400'},
    { label: 'Ticket Médio',       value: `R$ ${avgTicket.toFixed(2)}`,     icon: TrendingUp,  color: 'text-blue-400'   },
    { label: 'Itens Vendidos',     value: totalItems,                       icon: Package,     color: 'text-purple-400' },
  ];

  // ─── Label do período ─────────────────────────────────────────────────────────
  const periodLabel = {
    today:  'Hoje',
    week:   'Últimos 7 dias',
    month:  'Este mês',
    all:    'Todo o histórico',
    custom: dateFrom === dateTo
      ? new Date(dateFrom + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : `${new Date(dateFrom + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} → ${new Date(dateTo + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
  }[period];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análise de vendas e desempenho</p>
        </div>

        {/* Seletor de período */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1 bg-secondary rounded-xl p-1 flex-wrap">
            {[
              ['today', 'Hoje'],
              ['week', '7 dias'],
              ['month', 'Mês'],
              ['all', 'Tudo'],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => { setPeriod(v); setShowCustom(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {l}
              </button>
            ))}
            {/* Botão personalizado */}
            <button
              onClick={() => { setPeriod('custom'); setShowCustom(v => !v); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === 'custom' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3 h-3" />
              Período
              {period === 'custom' && (showCustom ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
          </div>

          {/* Inputs de data personalizada */}
          <AnimatePresence>
            {period === 'custom' && showCustom && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 shadow-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">De</span>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={e => setDateFrom(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    max={toInputDate(new Date())}
                    onChange={e => setDateTo(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setShowCustom(false)}
                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    Aplicar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badge do período ativo */}
          <span className="text-xs text-muted-foreground">
            📅 {periodLabel} — <strong className="text-foreground">{totalOrders}</strong> comanda{totalOrders !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="p-4 rounded-xl border border-border bg-card"
          >
            <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 w-fit">
        {[
          ['vendas',   <TrendingUp className="w-3.5 h-3.5" />,  'Vendas'],
          ['garcons',  <Users       className="w-3.5 h-3.5" />,  'Garçons'],
          ['historico',<FileText    className="w-3.5 h-3.5" />,  'Histórico'],
        ].map(([v, icon, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Vendas ── */}
      {tab === 'vendas' && (
        <>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Receita por dia */}
            <div className="p-4 rounded-xl border border-border bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">Receita por Dia</h3>
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dayData} barSize={24}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={v => [`R$ ${v.toFixed(2)}`, 'Receita']}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
              )}
            </div>

            {/* Formas de pagamento */}
            <div className="p-4 rounded-xl border border-border bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">Formas de Pagamento</h3>
              {payData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={payData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                        {payData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {payData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground text-xs flex-1 truncate">{d.name}</span>
                        <span className="font-semibold text-xs text-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
              )}
            </div>
          </div>

          {/* Produtos mais vendidos */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Produtos Mais Vendidos</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, i) => {
                  const maxQty = topProducts[0].qty;
                  return (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-foreground truncate">{p.name}</span>
                          <span className="text-muted-foreground ml-2 whitespace-nowrap">{p.qty} un · R$ {p.revenue.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-6">Sem vendas no período</p>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Garçons ── */}
      {tab === 'garcons' && (
        <div className="space-y-4">
          {waiterData.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-border bg-card">
              <div className="text-4xl mb-3">👨‍🍳</div>
              <p className="text-muted-foreground">Nenhum dado de garçom no período</p>
              <p className="text-xs text-muted-foreground mt-1">Certifique-se de selecionar um garçom ao abrir a comanda</p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-border bg-card">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">Receita por Garçom</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={waiterData} barSize={32}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                      formatter={v => [`R$ ${Number(v).toFixed(2)}`, 'Receita']}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" /> Ranking de Garçons
                </h3>
                <div className="space-y-3">
                  {waiterData.map((w, i) => {
                    const maxRev = waiterData[0].revenue;
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <motion.div
                        key={w.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-secondary"
                      >
                        <span className="text-xl w-8 text-center">{medals[i] || `${i + 1}º`}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-foreground truncate">{w.name}</span>
                            <span className="font-bold text-primary text-sm ml-2">R$ {w.revenue.toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 bg-border rounded-full overflow-hidden mb-1.5">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${maxRev > 0 ? (w.revenue / maxRev) * 100 : 0}%`, background: COLORS[i % COLORS.length] }}
                            />
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{w.orders} comanda{w.orders !== 1 ? 's' : ''}</span>
                            <span>·</span>
                            <span>{w.items} itens</span>
                            <span>·</span>
                            <span>Ticket médio R$ {w.orders > 0 ? (w.revenue / w.orders).toFixed(2) : '0.00'}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Histórico ── */}
      {tab === 'historico' && (
        <div className="space-y-3">
          {/* Busca rápida */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Buscar por mesa, garçom ou pagamento..."
              value={histSearch}
              onChange={e => setHistSearch(e.target.value)}
              className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {histSearch && (
              <button onClick={() => setHistSearch('')} className="text-xs text-muted-foreground hover:text-foreground px-2">✕</button>
            )}
          </div>

          {/* Totalizador do período */}
          {histOrders.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm">
              <span className="text-muted-foreground">{histOrders.length} comanda{histOrders.length !== 1 ? 's' : ''} no período</span>
              <span className="font-bold text-primary">Total: R$ {histOrders.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)}</span>
            </div>
          )}

          {histOrders.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-border bg-card">
              <div className="text-4xl mb-3">🗂️</div>
              <p className="text-muted-foreground text-sm">Nenhuma comanda encontrada no período</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste o filtro de data ou busca acima</p>
            </div>
          ) : (
            <div className="space-y-2">
              {histOrders.map((o, i) => {
                const isExp = expandedOrder === o.id;
                const tableLabel =
                  o.table_type === 'balcao' ? `🍺 Balcão ${o.table_number}` :
                  o.table_type === 'delivery' ? `🛵 Delivery #${o.table_number}` :
                  `🪑 Mesa ${o.table_number}`;
                const itemsQty = (o.items || []).reduce((s, i) => s + i.quantity, 0);
                return (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    {/* Cabeçalho da comanda */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                      onClick={() => setExpandedOrder(isExp ? null : o.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{tableLabel}</span>
                          {o.waiter_name && (
                            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">
                              👤 {o.waiter_name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">
                            {payLabels[o.payment_method] || o.payment_method || '—'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDate(o.closed_at)} · {itemsQty} item{itemsQty !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 mr-1">
                        <p className="font-bold text-primary text-sm">R$ {(o.total || 0).toFixed(2)}</p>
                        {(o.discount || 0) > 0 && (
                          <p className="text-xs text-destructive">-R$ {o.discount.toFixed(2)} desc.</p>
                        )}
                      </div>
                      {isExp
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Detalhes expandidos */}
                    <AnimatePresence>
                      {isExp && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                            {/* Itens */}
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Itens</p>
                              <div className="space-y-1">
                                {(o.items || []).map((item, idx) => (
                                  <div key={idx} className="flex items-start justify-between text-sm gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-foreground">{item.quantity}× {item.product_name}</span>
                                      {item.notes && (
                                        <span className="text-xs text-amber-400 ml-1">· {item.notes}</span>
                                      )}
                                    </div>
                                    <span className="text-muted-foreground shrink-0">R$ {(item.total || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Totais */}
                            <div className="border-t border-border pt-2 space-y-1 text-sm">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>R$ {(o.subtotal || 0).toFixed(2)}</span>
                              </div>
                              {(o.service_fee || 0) > 0 && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Serviço (10%)</span>
                                  <span>R$ {o.service_fee.toFixed(2)}</span>
                                </div>
                              )}
                              {(o.discount || 0) > 0 && (
                                <div className="flex justify-between text-destructive">
                                  <span>Desconto</span>
                                  <span>−R$ {o.discount.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-foreground border-t border-border pt-1">
                                <span>Total</span>
                                <span className="text-primary">R$ {(o.total || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
