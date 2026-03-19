import { useState, useMemo, useEffect } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ModifiersDialog from '@/components/ModifiersDialog';
import { getActiveHappyHour, applyHappyHourPrice } from '@/lib/happyHourUtils';

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

export default function ProductSelector({ open, onClose, products, onAdd, onAddBulk, onSend }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [modifierProduct, setModifierProduct] = useState(null);
  const [added, setAdded] = useState({});
  const [happyHour, setHappyHour] = useState(null);

  useEffect(() => {
    if (open) getActiveHappyHour().then(setHappyHour);
  }, [open]);

  const isSearching = search.trim().length > 0;
  const categories = useMemo(() => [...new Set(products.map(p => p.category))], [products]);

  const filteredProducts = useMemo(() => {
    if (!isSearching && !activeCategory) return [];
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
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

  const productWithDiscount = (product) => {
    const discountedPrice = applyHappyHourPrice(product, happyHour);
    return discountedPrice !== product.price ? { ...product, price: discountedPrice } : product;
  };

  const handleProductClick = (product) => {
    if (product.modifiers?.length > 0) {
      setModifierProduct(product);
    } else {
      onAdd(productWithDiscount(product), []);
      setAdded(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    }
  };

  const handleModifierConfirm = (product, selectedModifiers) => {
    onAdd(productWithDiscount(product), selectedModifiers);
    setAdded(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }));
    setModifierProduct(null);
  };

  const handleClose = () => {
    setSearch('');
    setActiveCategory(null);
    setAdded({});
    onClose();
  };

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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-2xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">Adicionar ao Pedido</DialogTitle>
          {happyHour && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
              🎉 <span className="font-bold">{happyHour.name}</span> ativo! {happyHour.discount_percent}% de desconto
              {happyHour.categories?.length ? ` em ${happyHour.categories.join(', ')}` : ' em todos os produtos'}
              · até {happyHour.end_time}
            </div>
          )}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveCategory(null); }}
              placeholder="Buscar produto..."
              className="pl-9 pr-9 bg-secondary border-border"
              autoComplete="off"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!isSearching && (
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
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
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
        </div>
      </DialogContent>

      <ModifiersDialog
        open={!!modifierProduct}
        onClose={() => setModifierProduct(null)}
        product={modifierProduct}
        onConfirm={handleModifierConfirm}
      />
    </Dialog>
  );
}

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