import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronLeft } from 'lucide-react';
import type { CategoryPizzaSize, Product, ProductCategory, SelectedComplement } from '@/types';
import { fmt } from '@/lib/utils';
import {
  buildAssembledPizzaSelection,
  calculatePizzaHighestPrice,
  getActiveProductPizzaSizes,
  getCategoryPizzaSizes,
} from '@/lib/pizza';

interface PizzaOrderStepProps {
  category: ProductCategory;
  products: Product[];
  initialProduct?: Product | null;
  searchQuery?: string;
  onBack: () => void;
  onReview?: () => void;
  reviewItemCount?: number;
  onComplete: (payload: {
    assembledProduct: Product;
    selectedFlavorComplements: SelectedComplement[];
    basePrice: number;
    mode: 'customize' | 'direct';
  }) => void;
}

/** Visual SVG icon representing 1, 2, 3, or 4 pizza slices as shown in the reference UI. */
function PizzaSliceIcon({ slices, active }: { slices: number; active: boolean }) {
  const fill = active ? '#ffffff' : '#9ca3af';
  const stroke = active ? '#7c3aed' : '#ffffff';

  if (slices <= 1) {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill={fill} />
      </svg>
    );
  }

  if (slices === 2) {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill={fill} />
        <line x1="16" y1="2" x2="16" y2="30" stroke={stroke} strokeWidth="2.6" />
      </svg>
    );
  }

  if (slices === 3) {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill={fill} />
        <line x1="16" y1="16" x2="16" y2="2" stroke={stroke} strokeWidth="2.5" />
        <line x1="16" y1="16" x2="4" y2="24" stroke={stroke} strokeWidth="2.5" />
        <line x1="16" y1="16" x2="28" y2="24" stroke={stroke} strokeWidth="2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" className="w-6 h-6 shrink-0" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill={fill} />
      <line x1="16" y1="2" x2="16" y2="30" stroke={stroke} strokeWidth="2.5" />
      <line x1="2" y1="16" x2="30" y2="16" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}

export function PizzaOrderStep({
  category,
  products,
  initialProduct,
  searchQuery = '',
  onBack,
  onReview,
  reviewItemCount = 0,
  onComplete,
}: PizzaOrderStepProps) {
  const categoryProducts = useMemo(
    () => products.filter(p => p.active !== false && p.categoryId === category.id),
    [products, category.id],
  );

  // Collect all sizes available across the category and its active products
  const availableSizes = useMemo(() => {
    const baseSizes = getCategoryPizzaSizes(category);
    const sizeMap = new Map<string, { size: CategoryPizzaSize; minPrice: number; maxFlavors: number }>();

    for (const s of baseSizes) {
      sizeMap.set(s.id.toUpperCase(), {
        size: s,
        minPrice: Infinity,
        maxFlavors: s.maxFlavors,
      });
    }

    for (const prod of categoryProducts) {
      const prodSizes = getActiveProductPizzaSizes(prod, category);
      for (const ps of prodSizes) {
        const key = ps.id.toUpperCase();
        const existing = sizeMap.get(key);
        if (existing) {
          if (ps.price > 0 && ps.price < existing.minPrice) existing.minPrice = ps.price;
          if (ps.maxFlavors > existing.maxFlavors) existing.maxFlavors = ps.maxFlavors;
        } else {
          sizeMap.set(key, {
            size: { id: ps.id, name: ps.name, maxFlavors: ps.maxFlavors },
            minPrice: ps.price > 0 ? ps.price : Infinity,
            maxFlavors: ps.maxFlavors,
          });
        }
      }
    }

    return Array.from(sizeMap.values()).map(entry => ({
      ...entry.size,
      maxFlavors: Math.max(1, Math.min(4, entry.maxFlavors || 1)),
      minPrice: Number.isFinite(entry.minPrice) ? entry.minPrice : 0,
    }));
  }, [category, categoryProducts]);

  const [selectedSizeId, setSelectedSizeId] = useState<string>(() => availableSizes[0]?.id || 'G');
  const [flavorCount, setFlavorCount] = useState<number>(1);
  const [selectedFlavorIds, setSelectedFlavorIds] = useState<string[]>(() =>
    initialProduct ? [initialProduct.id] : [],
  );

  const selectedSize = useMemo(
    () => availableSizes.find(s => s.id.toUpperCase() === selectedSizeId.toUpperCase()) || availableSizes[0],
    [availableSizes, selectedSizeId],
  );

  useEffect(() => {
    if (selectedSize && flavorCount > selectedSize.maxFlavors) {
      setFlavorCount(selectedSize.maxFlavors);
    }
  }, [selectedSize, flavorCount]);

  useEffect(() => {
    if (selectedFlavorIds.length > flavorCount) {
      setSelectedFlavorIds(prev => prev.slice(0, flavorCount));
    }
  }, [flavorCount, selectedFlavorIds.length]);

  const normalize = (s?: string | null) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const q = normalize(searchQuery);

  // Filter products that offer the currently selected size
  const flavorsForSize = useMemo(() => {
    if (!selectedSize) return [];
    return categoryProducts
      .map(prod => {
        const activeSizes = getActiveProductPizzaSizes(prod, category);
        const match = activeSizes.find(s => s.id.toUpperCase() === selectedSize.id.toUpperCase());
        if (!match) return null;
        return {
          product: prod,
          sizeConfig: match,
          sizePrice: match.price > 0 ? match.price : prod.price || 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter(
        item =>
          !q ||
          normalize(item.product.name).includes(q) ||
          normalize(item.product.description).includes(q) ||
          normalize(item.product.searchCode).includes(q),
      );
  }, [categoryProducts, category, selectedSize, q]);

  const maxFlavorsForSize = useMemo(() => {
    if (!selectedSize) return 1;
    const maxFromProducts = flavorsForSize.reduce(
      (max, item) => Math.max(max, item.sizeConfig.maxFlavors || 1),
      selectedSize.maxFlavors || 1,
    );
    return Math.max(1, Math.min(4, maxFromProducts));
  }, [selectedSize, flavorsForSize]);

  const flavorCountOptions = useMemo(
    () => Array.from({ length: maxFlavorsForSize }, (_, i) => i + 1),
    [maxFlavorsForSize],
  );

  const selectedFlavorEntries = useMemo(
    () =>
      selectedFlavorIds
        .map(id => flavorsForSize.find(f => f.product.id === id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f)),
    [selectedFlavorIds, flavorsForSize],
  );

  const currentPrice = useMemo(
    () => calculatePizzaHighestPrice(selectedFlavorEntries.map(e => ({ price: e.sizePrice }))),
    [selectedFlavorEntries],
  );

  const handleSelectSingleFlavor = (entry: { product: Product; sizePrice: number }) => {
    if (!selectedSize) return;
    const { assembledProduct, selectedFlavorComplements, basePrice } = buildAssembledPizzaSelection({
      category,
      size: selectedSize,
      flavorCount: 1,
      selectedProducts: [entry],
    });
    onComplete({
      assembledProduct,
      selectedFlavorComplements,
      basePrice,
      mode: 'customize',
    });
  };

  const toggleMultiFlavor = (productId: string) => {
    setSelectedFlavorIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      }
      if (prev.length >= flavorCount) {
        return prev;
      }
      return [...prev, productId];
    });
  };

  const handleConfirmMultiFlavors = (mode: 'customize' | 'direct' = 'customize') => {
    if (!selectedSize || selectedFlavorEntries.length === 0) return;
    const { assembledProduct, selectedFlavorComplements, basePrice } = buildAssembledPizzaSelection({
      category,
      size: selectedSize,
      flavorCount,
      selectedProducts: selectedFlavorEntries,
    });
    onComplete({
      assembledProduct,
      selectedFlavorComplements,
      basePrice,
      mode,
    });
  };

  const canConfirmMulti =
    flavorCount >= 2 && selectedFlavorEntries.length === flavorCount;

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top configuration header: Etapa 1 (Tamanho) + Etapa 2 (Quantos sabores?) */}
      <div className="p-3 sm:p-4 bg-card border-b border-border space-y-3 shrink-0 shadow-xs">
        {/* Etapa 1: Tamanho */}
        <div>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
            1. Qual o tamanho?
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {availableSizes.map(sz => {
              const isSelected = selectedSize?.id.toUpperCase() === sz.id.toUpperCase();
              return (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => {
                    setSelectedSizeId(sz.id);
                    if (flavorCount > sz.maxFlavors) {
                      setFlavorCount(sz.maxFlavors);
                    }
                  }}
                  className={`flex flex-col items-start justify-between p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30'
                      : 'bg-background hover:bg-muted border-border text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="font-extrabold text-xs sm:text-sm truncate">{sz.name}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      até {sz.maxFlavors} {sz.maxFlavors === 1 ? 'sabor' : 'sab.'}
                    </span>
                  </div>
                  {sz.minPrice > 0 && (
                    <span
                      className={`text-[11px] font-semibold mt-1 ${
                        isSelected ? 'text-primary-foreground/90' : 'text-primary'
                      }`}
                    >
                      a partir de R$ {fmt(sz.minPrice)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Etapa 2: Quantos sabores? */}
        <div>
          <span className="block text-sm font-extrabold text-foreground mb-2">
            quantos sabores?
          </span>
          <div className="grid grid-cols-4 gap-2 max-w-md">
            {flavorCountOptions.map(num => {
              const isSelected = flavorCount === num;
              return (
                <button
                  key={num}
                  type="button"
                  aria-label={`${num} ${num === 1 ? 'sabor' : 'sabores'}`}
                  aria-pressed={isSelected}
                  onClick={() => setFlavorCount(num)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 font-extrabold text-base transition-all ${
                    isSelected
                      ? 'bg-[#7c2289] border-[#7c2289] text-white shadow-md scale-[1.02]'
                      : 'bg-background border-border text-muted-foreground hover:border-[#7c2289]/50 hover:text-foreground'
                  }`}
                >
                  <PizzaSliceIcon slices={num} active={isSelected} />
                  <span>{num}</span>
                </button>
              );
            })}
          </div>
          {flavorCount >= 2 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Marque <strong>{flavorCount} sabores</strong> abaixo ({selectedFlavorEntries.length} de {flavorCount}{' '}
              {selectedFlavorEntries.length === 1 ? 'selecionado' : 'selecionados'}) · Preço pelo maior valor.
            </p>
          )}
        </div>
      </div>

      {/* Etapa 3: Lista de sabores */}
      <div className="flex-1 overflow-y-auto divide-y divide-border bg-card">
        {flavorsForSize.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground italic">
            Nenhum sabor disponível para este tamanho.
          </div>
        ) : (
          flavorsForSize.map(entry => {
            const { product, sizePrice } = entry;
            const isChecked = selectedFlavorIds.includes(product.id);
            const isDisabled = flavorCount >= 2 && !isChecked && selectedFlavorIds.length >= flavorCount;

            if (flavorCount === 1) {
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelectSingleFlavor(entry)}
                  className="w-full p-3.5 sm:p-4 flex items-start justify-between gap-3 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug">
                      {product.name}
                    </h4>
                    <p className="text-xs sm:text-sm font-bold text-[#9333ea] dark:text-[#c084fc]">
                      a partir de R$ {fmt(sizePrice)}
                    </p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            }

            return (
              <label
                key={product.id}
                onClick={e => {
                  e.preventDefault();
                  if (!isDisabled) toggleMultiFlavor(product.id);
                }}
                className={`w-full p-3.5 sm:p-4 flex items-start gap-3.5 text-left transition-colors select-none ${
                  isDisabled
                    ? 'opacity-45 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-muted/40'
                } ${isChecked ? 'bg-[#7c2289]/8' : ''}`}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={isDisabled}
                  aria-label={product.name}
                  onCheckedChange={() => {
                    if (!isDisabled) toggleMultiFlavor(product.id);
                  }}
                  className="mt-1 h-5 w-5 rounded border-2 border-muted-foreground/50 data-[state=checked]:bg-[#7c2289] data-[state=checked]:border-[#7c2289]"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug">
                      {product.name}
                    </h4>
                    {isChecked && (
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[#7c2289] text-white shrink-0">
                        1/{flavorCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-[#9333ea] dark:text-[#c084fc]">
                    a partir de R$ {fmt(sizePrice)}
                  </p>
                  {product.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>

      {/* Footer action bar */}
      <div className="p-3 bg-card border-t border-border flex items-center justify-between gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-11 px-4 text-xs font-bold flex items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> VOLTAR
        </Button>

        {flavorCount >= 2 ? (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Button
              type="button"
              disabled={!canConfirmMulti}
              onClick={() => handleConfirmMultiFlavors('customize')}
              className="flex-1 sm:flex-initial h-11 px-5 text-xs sm:text-sm font-extrabold bg-[#7c2289] hover:bg-[#641b6f] text-white flex items-center justify-center gap-2 shadow-md"
            >
              <Check className="h-4 w-4" />
              {canConfirmMulti
                ? `CONTINUAR · R$ ${fmt(currentPrice)}`
                : `ESCOLHA ${flavorCount - selectedFlavorEntries.length} SABOR(ES)`}
            </Button>
          </div>
        ) : onReview ? (
          <Button
            type="button"
            onClick={onReview}
            disabled={reviewItemCount === 0}
            className="flex-1 sm:flex-initial h-11 px-5 text-xs font-black bg-[#0052cc] hover:bg-[#003d99] text-white flex items-center justify-center gap-2 rounded-lg shadow-md"
          >
            <Check className="h-4 w-4" /> REVISAR{reviewItemCount > 0 ? ` (${reviewItemCount})` : ''}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground font-medium">
            Toque em um sabor para selecionar
          </span>
        )}
      </div>
    </div>
  );
}
