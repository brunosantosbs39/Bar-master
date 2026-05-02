import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, X, Plus, Send, Barcode, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ModifiersDialog from '@/components/ModifiersDialog';
import { getActiveHappyHour, applyHappyHourPrice } from '@/lib/happyHourUtils';
import { AnimatePresence, motion } from 'framer-motion';

const categoryEmoji = {
  cervejas: '🍺', destilados: '🥃', drinks: '🍹', vinhos: '🍷',
  nao_alcoolicos: '🥤', bebidas: '🧃', petiscos: '🍟', porcoes: '🍖',
  pratos: '🍽️', sobremesas: '🍰'
};

const categoryLabel = {
  cervejas: 'Cervejas', destilados: 'Destilados', drinks: 'Drinks', vinhos: 'Vinhos',
  nao_alcoolicos: 'Não Alcoólicos', bebidas: 'Bebidas', petiscos: 'Petiscos',
  porcoes: 'Porções', pratos: 'Pratos', sobremesas: 'Sobremesas'
};

// ── Barcode scanner detection ─────────────────────────────────────────────────
// Leitores USB simulam teclado: digitam o código muito rápido (<80ms entre teclas)
// e enviam Enter ao final. Detectamos esse padrão via keydown global.
const BARCODE_INTERVAL_MS = 80;  // máx ms entre teclas do leitor
const BARCODE_MIN_LEN      = 3;  // mínimo de caracteres para considerar

function useBarcodeScanner({ active, onScan }) {
  const bufferRef  = useRef('');
  const timerRef   = useRef(null);
  const lastKeyRef = useRef(0);

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = '';
    if (code.length >= BARCODE_MIN_LEN) onScan(code);
  }, [onScan]);

  useEffect(() => {
    if (!active) return;

    const handleKey = (e) => {
      // Ignora se o foco está em input/textarea (não intercepta digitação normal)
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const now = Date.now();
      const gap = now - lastKeyRef.current;
      lastKeyRef.current = now;

      if (e.key === 'Enter') {
        clearTimeout(timerRef.current);
        flush();
        return;
      }

      // Se demorou muito, reseta o buffer
      if (gap > BARCODE_INTERVAL_MS * 3 && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Só acumula caracteres imprimíveis
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, BARCODE_INTERVAL_MS * 4);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(timerRef.current);
    };
  }, [active, flush]);
}

// ── Toast de feedback do scanner ─────────────────────────────────────────────
function ScanToast({ type, message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium max-w-xs w-fit ${
        type === 'ok'
          ? 'bg-emerald-600 text-white'
          : 'bg-destructive text-white'
      }`}
    >
      {type === 'ok'
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProductSelector({ open, onClose, products, onAdd, onAddBulk, onSend }) {
  const [search, setSearch]           = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [modifierProduct, setModifierProduct] = useState(null);
  const [noteProduct, setNoteProduct] = useState(null);
  const [noteForProduct, setNoteForProduct] = useState('');
  const [noteQty, setNoteQty]         = useState(1);
  const [added, setAdded]             = useState({});
  const [happyHour, setHappyHour]     = useState(null);
  const [sending, setSending]         = useState(false);

  // ── Barcode mode ────────────────────────────────────────────────────────────
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanToast, setScanToast]     = useState(null); // { type, message }
  const barcodeRef = useRef(null);

  const totalAdded = Object.values(added).reduce((s, v) => s + v, 0);

  useEffect(() => {
    if (open) getActiveHappyHour().then(setHappyHour);
  }, [open]);

  // Quando modo barcode é ativado, foca no input dedicado
  useEffect(() => {
    if (barcodeMode && open) {
      setTimeout(() => barcodeRef.current?.focus(), 80);
    }
  }, [barcodeMode, open]);

  // ── Barcode scan handler ────────────────────────────────────────────────────
  const handleBarcodeScanned = useCallback((code) => {
    const product = products.find(p =>
      p.code && p.code.trim().toLowerCase() === code.trim().toLowerCase()
    );
    if (!product) {
      setScanToast({ type: 'err', message: `Código "${code}" não encontrado` });
      return;
    }
    if (!product.available) {
      setScanToast({ type: 'err', message: `"${product.name}" está indisponível` });
      return;
    }
    const p = productWithDiscount(product);
    onAdd(p, [], '', 1);
    setAdded(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    setScanToast({ type: 'ok', message: `+1 ${product.name}` });
    setBarcodeInput('');
  }, [products, onAdd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listener global para leitores USB (apenas quando barcodeMode está desligado,
  // pois quando ligado usamos o input dedicado)
  useBarcodeScanner({
    active: open && !barcodeMode,
    onScan: handleBarcodeScanned,
  });

  // Submit do input dedicado (Enter ou blur com valor)
  const handleBarcodeInputKey = (e) => {
    if (e.key === 'Enter') {
      const code = barcodeInput.trim();
      if (code) handleBarcodeScanned(code);
      setBarcodeInput('');
    }
  };

  // ── Produto com desconto happy hour ─────────────────────────────────────────
  const productWithDiscount = (product) => {
    const discountedPrice = applyHappyHourPrice(product, happyHour);
    return discountedPrice !== product.price ? { ...product, price: discountedPrice } : product;
  };

  // ── Filtros e agrupamento ────────────────────────────────────────────────────
  const isSearching = search.trim().length > 0;
  const categories  = useMemo(() => [...new Set(products.map(p => p.category))], [products]);

  const filteredProducts = useMemo(() => {
    if (!isSearching && !activeCategory) return [];
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          (p.code || '').toLowerCase().includes(search.toLowerCase());
      const matchCat = !activeCategory || p.category === activeCategory;
      return isSearching ? matchSearch : matchCat;
    });
  }, [products, search, activeCategory, isSearching]);

  const groupedByCategory = useMemo(() => {
    if (isSearching || activeCategory) return null;
    return categories.reduce((acc, cat) => {
      acc[cat] = products.filter(p => p.category === cat);
      return acc;
    }, {});
  }, [products, categories, isSearching, activeCategory]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleProductClick = (product) => {
    if (product.modifiers?.length > 0) {
      setModifierProduct(product);
    } else {
      setNoteProduct(product);
      setNoteForProduct('');
      setNoteQty(1);
    }
  };

  const handleNoteConfirm = () => {
    if (!noteProduct) return;
    const qty = Math.max(1, noteQty);
    onAdd(productWithDiscount(noteProduct), [], noteForProduct.trim(), qty);
    setAdded(prev => ({ ...prev, [noteProduct.id]: (prev[noteProduct.id] || 0) + qty }));
    setNoteProduct(null);
    setNoteForProduct('');
    setNoteQty(1);
  };

  const handleModifierConfirm = (product, selectedModifiers) => {
    onAdd(productWithDiscount(product), selectedModifiers, '');
    setAdded(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    setModifierProduct(null);
  };

  const handleClose = () => {
    setSearch('');
    setActiveCategory(null);
    setAdded({});
    setSending(false);
    setBarcodeMode(false);
    setBarcodeInput('');
    onClose();
  };

  const handleSend = async () => {
    if (!onSend || totalAdded === 0) return;
    setSending(true);
    onClose();
    await onSend();
    setSending(false);
  };

  // ── Renderização de listas ────────────────────────────────────────────────────
  const renderProducts = (list, grid = true) => {
    if (grid) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.map(p => (
            <ProductCard key={p.id} product={p} addedCount={added[p.id] || 0} happyHour={happyHour} onClick={() => handleProductClick(p)} />
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {list.map(p => (
          <ProductListItem key={p.id} product={p} addedCount={added[p.id] || 0} happyHour={happyHour} onClick={() => handleProductClick(p)} />
        ))}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="bg-card border-border max-w-2xl h-dvh sm:h-[90vh] flex flex-col p-0 rounded-none sm:rounded-xl">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">Adicionar ao Pedido</DialogTitle>
              {/* Botão modo leitor de código de barras */}
              <button
                onClick={() => setBarcodeMode(v => !v)}
                title={barcodeMode ? 'Desativar leitor de código de barras' : 'Ativar leitor de código de barras'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  barcodeMode
                    ? 'bg-primary/15 border-primary text-primary'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                {barcodeMode ? 'Leitor ativo' : 'Leitor'}
              </button>
            </div>

            {/* Happy hour banner */}
            {happyHour && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
                🎉 <span className="font-bold">{happyHour.name}</span> ativo! {happyHour.discount_percent}% de desconto
                {happyHour.categories?.length ? ` em ${happyHour.categories.join(', ')}` : ' em todos os produtos'}
                · até {happyHour.end_time}
              </div>
            )}

            {/* ── Modo leitor de código de barras ── */}
            {barcodeMode ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs">
                  <Barcode className="w-4 h-4 shrink-0 animate-pulse" />
                  <span>Modo leitor ativo — aponte o scanner para o código de barras do produto ou digite abaixo</span>
                </div>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={barcodeRef}
                    type="text"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeInputKey}
                    placeholder="Código de barras (Enter para confirmar)"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  💡 Leitores USB funcionam automaticamente — apenas aponte e escaneie
                </p>
              </div>
            ) : (
              /* ── Busca normal ── */
              <>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setActiveCategory(null); }}
                    placeholder="Buscar produto ou código..."
                    className="pl-9 pr-9 bg-secondary border-border"
                    autoComplete="off"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 mt-2 scrollbar-hide">
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      !activeCategory ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    Todos
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                        activeCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {categoryEmoji[cat]} {categoryLabel[cat] || cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </DialogHeader>

          {/* ── Lista de produtos ── */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* Quando modo barcode: mostra todos os produtos com código cadastrado */}
            {barcodeMode && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Produtos com código de barras cadastrado ({products.filter(p => p.code).length}):
                </p>
                {products.filter(p => p.code && p.available).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Nenhum produto com código cadastrado.</p>
                    <p className="text-xs text-muted-foreground mt-1">Cadastre o código no Cardápio → Editar produto → campo "Código".</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {products.filter(p => p.code && p.available).map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleProductClick(p)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left hover:border-primary/50 ${
                          added[p.id] ? 'border-primary bg-primary/10' : 'border-border bg-secondary'
                        }`}
                      >
                        <Barcode className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-md shrink-0">{p.code}</span>
                        <span className="flex-1 text-sm font-medium text-foreground truncate">{p.name}</span>
                        <span className="font-bold text-primary text-sm shrink-0">R$ {p.price.toFixed(2)}</span>
                        {added[p.id] > 0 && (
                          <span className="text-xs font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full shrink-0">×{added[p.id]}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modo normal */}
            {!barcodeMode && (
              <>
                {isSearching && (
                  filteredProducts.length === 0
                    ? <p className="text-center text-muted-foreground text-sm py-8">Nenhum produto encontrado</p>
                    : renderProducts(filteredProducts, false)
                )}

                {!isSearching && activeCategory && renderProducts(filteredProducts, true)}

                {!isSearching && !activeCategory && groupedByCategory && (
                  <div className="space-y-6">
                    {categories.map(cat => {
                      const items = groupedByCategory[cat];
                      if (!items?.length) return null;
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-base">{categoryEmoji[cat]}</span>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                              {categoryLabel[cat] || cat}
                            </h3>
                            <span className="text-xs text-muted-foreground">({items.length})</span>
                          </div>
                          {renderProducts(items, true)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {onSend && totalAdded > 0 && (
            <div className="px-4 py-3 border-t border-border shrink-0">
              <Button
                className="w-full h-12 gap-2 text-base"
                onClick={handleSend}
                disabled={sending}
              >
                {sending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {sending ? 'Enviando...' : `Enviar ${totalAdded} ${totalAdded === 1 ? 'item' : 'itens'}`}
              </Button>
            </div>
          )}
        </DialogContent>

        <ModifiersDialog
          open={!!modifierProduct}
          onClose={() => setModifierProduct(null)}
          product={modifierProduct}
          onConfirm={handleModifierConfirm}
        />

        <Dialog open={!!noteProduct} onOpenChange={() => setNoteProduct(null)}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base leading-tight">{noteProduct?.name}</DialogTitle>
              {noteProduct && (
                <p className="text-sm font-bold text-primary">
                  {productWithDiscount(noteProduct).price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quantidade</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNoteQty(q => Math.max(1, q - 1))}
                    className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/70 active:scale-95 transition-all text-xl font-bold"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center text-2xl font-black text-foreground">{noteQty}</span>
                  <button
                    onClick={() => setNoteQty(q => q + 1)}
                    className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all text-xl font-bold"
                  >
                    +
                  </button>
                </div>
                {noteProduct && (
                  <p className="text-xs text-center text-muted-foreground mt-1.5">
                    Total: <span className="font-bold text-primary">
                      {(productWithDiscount(noteProduct).price * noteQty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observação</p>
                <Textarea
                  value={noteForProduct}
                  onChange={e => setNoteForProduct(e.target.value)}
                  placeholder="Ex: sem cebola, bem passado, molho à parte..."
                  rows={2}
                  className="bg-secondary border-border resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleNoteConfirm(); }}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-12" onClick={() => setNoteProduct(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1 h-12 text-base font-bold" onClick={handleNoteConfirm}>
                  Adicionar {noteQty > 1 ? `(${noteQty}×)` : ''}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Dialog>

      {/* Toast de feedback do scanner (fora do Dialog para evitar z-index) */}
      <AnimatePresence>
        {scanToast && (
          <ScanToast
            type={scanToast.type}
            message={scanToast.message}
            onClose={() => setScanToast(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Componentes de card ───────────────────────────────────────────────────────

function ProductCard({ product, addedCount, happyHour, onClick }) {
  const hasModifiers = product.modifiers?.length > 0;
  const discountedPrice = applyHappyHourPrice(product, happyHour);
  const hasDiscount = happyHour && discountedPrice < product.price;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all w-full hover:border-primary/60 active:scale-95 ${
        addedCount > 0 ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:bg-secondary/70'
      }`}
    >
      {addedCount > 0 && (
        <span className="absolute top-2 right-2 text-xs font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">×{addedCount}</span>
      )}
      {hasDiscount && (
        <span className="absolute top-2 left-2 text-[10px] font-bold text-black bg-amber-400 px-1.5 py-0.5 rounded-full">-{happyHour.discount_percent}%</span>
      )}
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="w-full h-20 object-cover rounded-lg mb-2" />
      ) : (
        <span className="text-2xl mb-2">{categoryEmoji[product.category] || '📦'}</span>
      )}
      <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2 flex-1">{product.name}</p>
      {product.code && (
        <span className="text-[10px] text-muted-foreground font-mono mt-0.5">#{product.code}</span>
      )}
      {hasModifiers && (
        <span className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full mt-0.5">✨ Adicionais</span>
      )}
      <div className="mt-2">
        {hasDiscount && (
          <p className="text-xs text-muted-foreground line-through">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        )}
        <p className={`font-bold text-sm ${hasDiscount ? 'text-amber-400' : 'text-primary'}`}>{discountedPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>
    </button>
  );
}

function ProductListItem({ product, addedCount, happyHour, onClick }) {
  const hasModifiers = product.modifiers?.length > 0;
  const discountedPrice = applyHappyHourPrice(product, happyHour);
  const hasDiscount = happyHour && discountedPrice < product.price;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left hover:border-primary/60 active:scale-95 ${
        addedCount > 0 ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:bg-secondary/70'
      }`}
    >
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <span className="text-xl">{categoryEmoji[product.category] || '📦'}</span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
        {product.description && <p className="text-xs text-muted-foreground truncate">{product.description}</p>}
        <div className="flex items-center gap-2 mt-0.5">
          {product.code && <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">#{product.code}</span>}
          {hasDiscount && <p className="text-xs text-muted-foreground line-through">{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
          <p className={`font-bold text-xs ${hasDiscount ? 'text-amber-400' : 'text-primary'}`}>{discountedPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          {hasDiscount && <span className="text-[10px] font-bold text-black bg-amber-400 px-1.5 py-0.5 rounded-full">-{happyHour.discount_percent}%</span>}
          {hasModifiers && <span className="text-[10px] text-amber-400">✨ adicionais</span>}
        </div>
      </div>
      {addedCount > 0 ? (
        <span className="text-xs font-bold text-primary bg-primary/15 px-2 py-1 rounded-full">×{addedCount}</span>
      ) : (
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
    </button>
  );
}
