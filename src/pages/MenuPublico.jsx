import { useState, useEffect, useRef } from 'react';
import { localDB } from '@/lib/localDB';
import { Search, X, ChevronRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const categoryBg = {
  cervejas: 'from-amber-900/60 to-amber-800/20',
  destilados: 'from-orange-900/60 to-orange-800/20',
  drinks: 'from-pink-900/60 to-pink-800/20',
  vinhos: 'from-red-900/60 to-red-800/20',
  nao_alcoolicos: 'from-green-900/60 to-green-800/20',
  bebidas: 'from-blue-900/60 to-blue-800/20',
  petiscos: 'from-yellow-900/60 to-yellow-800/20',
  porcoes: 'from-orange-900/60 to-orange-800/20',
  pratos: 'from-teal-900/60 to-teal-800/20',
  sobremesas: 'from-purple-900/60 to-purple-800/20',
};

export default function MenuPublico() {
  const [products, setProducts] = useState([]);
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('todos');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const categoryRefs = useRef({});
  const scrollRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const tableId = urlParams.get('table');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const prods = await localDB.entities.Product.filter({ available: true });
    setProducts(prods);
    if (tableId) {
      const tables = await localDB.entities.Table.filter({ id: tableId });
      if (tables.length > 0) setTable(tables[0]);
    }
    setLoading(false);
  };

  const categories = [...new Set(products.map(p => p.category))];

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'todos' || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const grouped = {};
  filtered.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  const scrollToCategory = (cat) => {
    setActiveCategory(cat);
    if (cat !== 'todos' && categoryRefs.current[cat]) {
      categoryRefs.current[cat].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const tableLabel = table
    ? (table.type === 'balcao' ? '🍺 Balcão' : table.type === 'delivery' ? '🛵 Delivery' : `🪑 Mesa ${table.number}`)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080503] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-bounce">🍽️</div>
          <span className="text-amber-200/60 text-sm tracking-widest uppercase">Carregando cardápio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080503] text-white max-w-lg mx-auto relative">

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-amber-950/80 via-[#0f0804] to-[#080503] pt-10 pb-6 px-5">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 80% 20%, #d97706 0%, transparent 40%)`
        }} />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white leading-none">
                Cardápio
              </h1>
              {tableLabel && (
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium">
                  {tableLabel}
                </span>
              )}
            </div>
            <div className="text-4xl">🍻</div>
          </div>

          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveCategory('todos'); }}
              placeholder="Buscar no cardápio..."
              className="w-full pl-10 pr-9 py-3 rounded-2xl bg-white/8 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-500/60 focus:bg-white/10 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Pills - Sticky */}
      {!search && (
        <div className="sticky top-0 z-20 bg-[#080503]/95 backdrop-blur-xl border-b border-white/5">
          <div ref={scrollRef} className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
            <CategoryPill label="Tudo" emoji="✨" active={activeCategory === 'todos'} onClick={() => setActiveCategory('todos')} />
            {categories.map(cat => (
              <CategoryPill
                key={cat}
                label={categoryLabel[cat] || cat}
                emoji={categoryEmoji[cat] || '📦'}
                active={activeCategory === cat}
                onClick={() => scrollToCategory(cat)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Banner aviso */}
      <div className="mx-4 mt-4 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300/70 text-center">
        Chame o garçom para fazer seu pedido 😊
      </div>

      {/* Products */}
      <div className="px-4 py-4 space-y-8 pb-20">
        {Object.keys(grouped).length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-white/30 text-sm">Nenhum item encontrado</p>
          </div>
        )}

        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} ref={el => categoryRefs.current[cat] = el}>
            {/* Category Header */}
            <div className={`flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r ${categoryBg[cat] || 'from-white/5 to-transparent'} border border-white/5`}>
              <span className="text-2xl">{categoryEmoji[cat] || '📦'}</span>
              <div>
                <h2 className="font-bold text-white text-base leading-none">{categoryLabel[cat] || cat}</h2>
                <p className="text-white/40 text-xs mt-0.5">{items.length} {items.length === 1 ? 'item' : 'itens'}</p>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 gap-3">
              {items.map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cat={cat}
                  idx={idx}
                  onClick={() => setSelectedProduct(product)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryPill({ label, emoji, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
        active
          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
          : 'bg-white/6 text-white/60 border border-white/8 hover:bg-white/10'
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function ProductCard({ product, cat, idx, onClick }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      onClick={onClick}
      className="text-left rounded-2xl overflow-hidden bg-white/4 border border-white/8 hover:border-amber-500/30 hover:bg-white/6 transition-all active:scale-95 group"
    >
      {/* Image */}
      <div className="relative w-full aspect-square overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${categoryBg[cat] || 'from-white/5 to-transparent'}`}>
            <span className="text-4xl">{categoryEmoji[cat] || '📦'}</span>
          </div>
        )}
        {/* Price badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
          <span className="text-amber-400 font-bold text-xs">R$ {product.price.toFixed(2)}</span>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="font-semibold text-white text-sm leading-tight line-clamp-2">{product.name}</p>
        {product.description && (
          <p className="text-white/50 text-xs mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        {product.modifiers?.length > 0 && (
          <span className="inline-block mt-1.5 text-[10px] text-amber-400/80 border border-amber-500/20 bg-amber-500/8 px-1.5 py-0.5 rounded-full">
            ✨ adicionais
          </span>
        )}
      </div>
    </motion.button>
  );
}

function ProductModal({ product, onClose }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 28, stiffness: 400 }}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[#111008] rounded-t-3xl z-50 shadow-2xl max-h-[85vh] flex flex-col"
      >
        {/* Product image */}
        {product.image_url ? (
          <div className="relative h-56 overflow-hidden flex-shrink-0">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111008] via-transparent to-transparent" />
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-6xl bg-gradient-to-br from-amber-950/50 to-transparent flex-shrink-0">
            {categoryEmoji[product.category] || '📦'}
          </div>
        )}

        <div className="px-5 pb-8 pt-3 overflow-y-auto flex-1">
          {/* Close handle */}
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

          <h2 className="text-2xl font-black text-white leading-tight">{product.name}</h2>
          <div className="flex items-center justify-between mt-2">
            <span className="text-amber-400 text-2xl font-black">R$ {product.price.toFixed(2)}</span>
            <span className="text-xs text-white/40 bg-white/6 px-2 py-1 rounded-full">
              {categoryEmoji[product.category]} {categoryLabel[product.category] || product.category}
            </span>
          </div>

          {product.description && (
            <p className="text-white/60 text-sm mt-3 leading-relaxed">{product.description}</p>
          )}

          {product.modifiers?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">Adicionais disponíveis</p>
              <div className="flex flex-wrap gap-2">
                {product.modifiers.map((m, i) => (
                  <span key={i} className="text-xs bg-white/6 border border-white/10 text-white/70 px-3 py-1.5 rounded-full">
                    {m.name}{m.price > 0 ? ` +R$ ${m.price.toFixed(2)}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full mt-6 py-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-sm hover:bg-amber-500/25 transition-colors"
          >
            Chame o garçom para pedir 🙋
          </button>
        </div>
      </motion.div>
    </>
  );
}
