import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Check, ChevronLeft, Minus, Plus } from 'lucide-react';
import type { CategoryPizzaSize, Product, ProductCategory, ProductNoteOption, SelectedComplement } from '@/types';
import { useStore } from '@/contexts/StoreContext';
import {
  fmt,
  isBorderOption,
  isObservationOption,
  isPriorityObservationOption,
  sortAllAdditionalsFirst,
  sortObservationsFirst,
} from '@/lib/utils';
import {
  buildAssembledPizzaSelection,
  calculatePizzaHighestPrice,
  getActiveProductPizzaSizes,
  getAllowedFlavorCountsForItem,
  getCategoryPizzaSizes,
  isProductPizzaFlavor,
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
    quantity?: number;
    selectedNotes?: string[];
    otherNotes?: string;
    selectedComplements?: SelectedComplement[];
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
  const { noteOptions } = useStore();

  const categoryProducts = useMemo(
    () => products.filter(p => p.active !== false && p.categoryId === category.id),
    [products, category.id],
  );

  // Flavors available for selection in multi-flavor mode (excludes combos / non-flavor items)
  const flavorPoolProducts = useMemo(
    () => categoryProducts.filter(isProductPizzaFlavor),
    [categoryProducts],
  );

  // When an initialProduct is selected, scope sizes to that product's active sizes
  const availableSizes = useMemo(() => {
    if (initialProduct) {
      const prodSizes = getActiveProductPizzaSizes(initialProduct, category);
      return prodSizes.map(ps => ({
        id: ps.id,
        name: ps.name,
        maxFlavors: Math.max(1, Math.min(4, ps.maxFlavors || 1)),
        minPrice: ps.price > 0 ? ps.price : initialProduct.price || 0,
      }));
    }

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
  }, [initialProduct, category, categoryProducts]);

  const [selectedSizeId, setSelectedSizeId] = useState<string>(() => availableSizes[0]?.id || 'G');
  const selectedSize = useMemo(
    () => availableSizes.find(s => s.id.toUpperCase() === selectedSizeId.toUpperCase()) || availableSizes[0],
    [availableSizes, selectedSizeId],
  );

  // Determine allowed flavor counts ("quantos sabores?") for the current item + selected size
  const flavorCountOptions = useMemo(
    () => getAllowedFlavorCountsForItem(initialProduct, selectedSize),
    [initialProduct, selectedSize],
  );

  // Single-flavor item mode: selected product is a single flavor (not combo) and only allows 1 flavor
  const isSingleFlavorOnly = useMemo(() => {
    if (!initialProduct || initialProduct.isCombo) return false;
    return availableSizes.every(sz => {
      const counts = getAllowedFlavorCountsForItem(initialProduct, sz);
      return counts.length === 1 && counts[0] === 1;
    });
  }, [initialProduct, availableSizes]);

  const [flavorCount, setFlavorCount] = useState<number>(() => flavorCountOptions[0] ?? 1);
  const [selectedFlavorIds, setSelectedFlavorIds] = useState<string[]>(() =>
    initialProduct && isProductPizzaFlavor(initialProduct) ? [initialProduct.id] : [],
  );

  // Inline customization state for single-flavor mode (Observações, Bordas, Complementos, Quantidade)
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedObs, setSelectedObs] = useState<string[]>([]);
  const [otherNotes, setOtherNotes] = useState<string>('');
  const [complements, setComplements] = useState<SelectedComplement[]>([]);

  // Reset state when initialProduct changes
  useEffect(() => {
    const firstSize = availableSizes[0];
    setSelectedSizeId(firstSize?.id || 'G');
    const initialCounts = getAllowedFlavorCountsForItem(initialProduct, firstSize);
    setFlavorCount(initialCounts[0] ?? 1);
    setSelectedFlavorIds(initialProduct && isProductPizzaFlavor(initialProduct) ? [initialProduct.id] : []);
    setQuantity(1);
    setSelectedObs([]);
    setOtherNotes('');
    setComplements([]);
  }, [initialProduct?.id]);

  // Keep flavorCount within allowed options when size changes
  useEffect(() => {
    if (flavorCountOptions.length > 0 && !flavorCountOptions.includes(flavorCount)) {
      setFlavorCount(flavorCountOptions[0]);
    }
  }, [flavorCountOptions, flavorCount]);

  useEffect(() => {
    if (selectedFlavorIds.length > flavorCount) {
      setSelectedFlavorIds(prev => prev.slice(0, flavorCount));
    }
  }, [flavorCount, selectedFlavorIds.length]);

  const normalize = (s?: string | null) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const q = normalize(searchQuery);

  // Flavors available for the selected size (from flavorPoolProducts, excluding combos)
  const flavorsForSize = useMemo(() => {
    if (!selectedSize) return [];
    return flavorPoolProducts
      .map(prod => {
        const activeSizes = getActiveProductPizzaSizes(prod, category);
        const match =
          activeSizes.find(s => s.id.toUpperCase() === selectedSize.id.toUpperCase()) ||
          activeSizes[0];
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
  }, [flavorPoolProducts, category, selectedSize, q]);

  const selectedFlavorEntries = useMemo(
    () =>
      selectedFlavorIds
        .map(id => flavorsForSize.find(f => f.product.id === id))
        .filter((f): f is NonNullable<typeof f> => Boolean(f)),
    [selectedFlavorIds, flavorsForSize],
  );

  // Inline note/complement options for single-flavor mode
  const availableNotes = useMemo(() => {
    const raw = noteOptions.filter(
      o => o.active && isObservationOption(o) && (!category.id || o.categoryIds.includes(category.id)),
    );
    const seen = new Set<string>();
    const unique = raw.filter(o => {
      const key = o.name.trim().toLocaleLowerCase('pt-BR');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return sortObservationsFirst(unique);
  }, [noteOptions, category.id]);

  const availableComplements = useMemo(() => {
    return sortAllAdditionalsFirst(
      noteOptions.filter(
        o =>
          o.active &&
          o.type === 'complement' &&
          !isObservationOption(o) &&
          (!category.id || o.categoryIds.includes(category.id)),
      ),
    );
  }, [noteOptions, category.id]);

  const toSavedClassification = (cls?: string): SelectedComplement['classification'] =>
    cls === 'flavor' ? 'flavor' : cls === 'border' ? 'border' : cls ? 'additional' : undefined;

  const asAdditional = availableComplements
    .filter(c => c.classification !== 'flavor')
    .map(c => {
      if (c.classification === 'both') return { ...c, classification: 'additional' as const };
      if (isBorderOption(c)) return { ...c, classification: 'border' as const };
      return c;
    });
  const borderOptions = asAdditional.filter(c => c.classification === 'border');
  const freeBorders = borderOptions.filter(c => !(c.price > 0));
  const paidBorders = borderOptions.filter(c => c.price > 0);
  const nonBorderAdditional = asAdditional.filter(c => c.classification !== 'border');
  const freeOptions = sortAllAdditionalsFirst(nonBorderAdditional.filter(c => !(c.price > 0)));
  const paidOptions = nonBorderAdditional.filter(c => c.price > 0);

  const sameComp = (c: { name: string; classification?: string }, o: { name: string; classification?: string }) =>
    c.name === o.name && (c.classification === 'flavor') === (o.classification === 'flavor');
  const getCompQty = (name: string, cls?: string) =>
    complements.find(c => sameComp(c, { name, classification: cls }))?.quantity || 0;

  const toggleObs = (name: string) => {
    setSelectedObs(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
  };

  const toggleFree = (opt: ProductNoteOption) => {
    const savedCls = toSavedClassification(opt.classification);
    setComplements(prev =>
      prev.some(c => sameComp(c, opt))
        ? prev.filter(c => !sameComp(c, opt))
        : [
            ...prev,
            {
              name: opt.name,
              price: 0,
              quantity: 1,
              ...(savedCls ? { classification: savedCls } : {}),
            },
          ],
    );
  };

  const updateCompQty = (comp: ProductNoteOption, delta: number) => {
    setComplements(prev => {
      const same = (c: { name: string; classification?: string }) => sameComp(c, comp);
      const existing = prev.find(same);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(c => !same(c));
        return prev.map(c => (same(c) ? { ...c, quantity: newQty } : c));
      }
      if (delta <= 0) return prev;
      const savedCls = toSavedClassification(comp.classification);
      return [
        ...prev,
        {
          name: comp.name,
          price: comp.price,
          quantity: delta,
          ...(savedCls ? { classification: savedCls } : {}),
        },
      ];
    });
  };

  // Price calculations
  const selectedSizePrice = selectedSize?.minPrice ?? initialProduct?.price ?? 0;
  const multiFlavorPrice = useMemo(() => {
    const highest = calculatePizzaHighestPrice(selectedFlavorEntries.map(e => ({ price: e.sizePrice })));
    if (initialProduct?.isCombo && selectedSizePrice > 0) {
      return Math.max(selectedSizePrice, highest);
    }
    return highest;
  }, [selectedFlavorEntries, initialProduct?.isCombo, selectedSizePrice]);

  const compsTotalUnit = complements.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const singleUnitPrice = selectedSizePrice + compsTotalUnit;
  const singleTotalPrice = singleUnitPrice * quantity;

  const handleConfirmSingleFlavor = () => {
    if (!initialProduct || !selectedSize) return;
    const { assembledProduct, selectedFlavorComplements, basePrice } = buildAssembledPizzaSelection({
      category,
      size: selectedSize,
      flavorCount: 1,
      selectedProducts: [{ product: initialProduct, sizePrice: selectedSizePrice }],
    });
    const sortedNotes = [...selectedObs].sort(
      (a, b) => Number(isPriorityObservationOption(b)) - Number(isPriorityObservationOption(a)),
    );
    onComplete({
      assembledProduct,
      selectedFlavorComplements,
      basePrice,
      mode: 'direct',
      quantity,
      selectedNotes: sortedNotes,
      otherNotes: otherNotes.trim(),
      selectedComplements: [...selectedFlavorComplements, ...complements],
    });
  };

  const handleSelectSingleFlavorFromList = (entry: { product: Product; sizePrice: number }) => {
    if (!selectedSize) return;
    const { assembledProduct, selectedFlavorComplements, basePrice } = buildAssembledPizzaSelection({
      category,
      size: selectedSize,
      flavorCount: 1,
      selectedProducts: [entry],
      baseItem: initialProduct?.isCombo ? initialProduct : undefined,
      baseItemSizePrice: initialProduct?.isCombo ? selectedSizePrice : undefined,
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
      baseItem: initialProduct?.isCombo ? initialProduct : undefined,
      baseItemSizePrice: initialProduct?.isCombo ? selectedSizePrice : undefined,
    });
    onComplete({
      assembledProduct,
      selectedFlavorComplements,
      basePrice,
      mode,
    });
  };

  const canConfirmMulti = flavorCount >= 2 && selectedFlavorEntries.length === flavorCount;
  const showFlavorCountSelector = !isSingleFlavorOnly && flavorCountOptions.length > 0 && !(flavorCountOptions.length === 1 && flavorCountOptions[0] === 1);

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Item Header when a specific product is selected (both single-flavor & multi-flavor/combo) */}
      {initialProduct && (
        <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {isSingleFlavorOnly && (
              <div className="flex items-center bg-background border border-input rounded shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(qty => Math.max(1, qty - 1))}
                  className="w-8 h-8 rounded-none text-primary hover:bg-muted font-bold border-r border-input"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-9 text-center font-bold text-sm text-foreground">{quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(qty => qty + 1)}
                  className="w-8 h-8 rounded-none text-primary hover:bg-muted font-bold border-l border-input"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-extrabold text-foreground truncate">
                {initialProduct.name}
              </h2>
              {initialProduct.description && (
                <p className="text-xs text-muted-foreground truncate">{initialProduct.description}</p>
              )}
            </div>
          </div>
          <span className="text-base sm:text-xl font-extrabold text-primary whitespace-nowrap shrink-0">
            R$ {fmt(isSingleFlavorOnly ? singleTotalPrice : selectedSizePrice)}
          </span>
        </div>
      )}

      {/* Top configuration header: Tamanho + (se 2+ sabores) Quantos sabores? */}
      <div className="p-3 sm:p-4 bg-card border-b border-border space-y-3 shrink-0 shadow-xs">
        {/* Etapa 1: Tamanho */}
        <div>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
            {isSingleFlavorOnly ? 'Tamanhos disponíveis' : '1. Qual o tamanho?'}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {availableSizes.map(sz => {
              const isSelected = selectedSize?.id.toUpperCase() === sz.id.toUpperCase();
              return (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setSelectedSizeId(sz.id)}
                  className={`flex flex-col items-start justify-between p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30'
                      : 'bg-background hover:bg-muted border-border text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="font-extrabold text-xs sm:text-sm truncate">{sz.name}</span>
                    {!isSingleFlavorOnly && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        até {sz.maxFlavors} {sz.maxFlavors === 1 ? 'sabor' : 'sab.'}
                      </span>
                    )}
                  </div>
                  {sz.minPrice > 0 && (
                    <span
                      className={`text-[11px] font-semibold mt-1 ${
                        isSelected ? 'text-primary-foreground/90' : 'text-primary'
                      }`}
                    >
                      {isSingleFlavorOnly || initialProduct?.isCombo ? `R$ ${fmt(sz.minPrice)}` : `a partir de R$ ${fmt(sz.minPrice)}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Etapa 2: Quantos sabores? (oculto para sabor único) */}
        {showFlavorCountSelector && (
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
        )}
      </div>

      {/* Corpo principal: Sabor único -> Bordas, Observações e Complementos | 2+ sabores -> Lista de Sabores */}
      {isSingleFlavorOnly ? (
        <div className="flex-1 overflow-y-auto bg-background p-3 space-y-3">
          <Accordion type="multiple" defaultValue={['notes', 'free-borders', 'paid-borders', 'free', 'paid']} className="space-y-2">
            {availableNotes.length > 0 && (
              <AccordionItem value="notes" className="border border-border rounded bg-card px-3">
                <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
                  Observações{selectedObs.length > 0 ? ` · ${selectedObs.length}` : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-3">
                  {availableNotes.map(opt => {
                    const checked = selectedObs.includes(opt.name);
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        key={opt.id}
                        onClick={() => toggleObs(opt.name)}
                        className={`w-full flex items-center gap-3 p-2 rounded text-left text-xs font-semibold border transition-colors ${
                          checked ? 'bg-primary/15 border-primary' : 'bg-background border-border/60 hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                            checked ? 'border-primary' : 'border-muted-foreground'
                          }`}
                        >
                          {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                        <span className="text-foreground">{opt.name}</span>
                      </button>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}

            {freeBorders.length > 0 && (
              <AccordionItem value="free-borders" className="border border-border rounded bg-card px-3">
                <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
                  Bordas (Grátis)
                  {freeBorders.filter(opt => getCompQty(opt.name, opt.classification) > 0).length > 0
                    ? ` · ${freeBorders.filter(opt => getCompQty(opt.name, opt.classification) > 0).length}`
                    : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-3">
                  {freeBorders.map(opt => {
                    const checked = getCompQty(opt.name, opt.classification) > 0;
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        key={opt.id}
                        onClick={() => toggleFree(opt)}
                        className={`w-full flex items-center gap-3 p-2 rounded text-left text-xs font-semibold border transition-colors ${
                          checked ? 'bg-primary/15 border-primary' : 'bg-background border-border/60 hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                            checked ? 'border-primary' : 'border-muted-foreground'
                          }`}
                        >
                          {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                        <span className="text-foreground">{opt.name}</span>
                      </button>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}

            {paidBorders.length > 0 && (
              <AccordionItem value="paid-borders" className="border border-border rounded bg-card px-3">
                <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
                  Bordas (Pagas)
                  {paidBorders.filter(c => getCompQty(c.name, c.classification) > 0).length > 0
                    ? ` · ${paidBorders.filter(c => getCompQty(c.name, c.classification) > 0).length}`
                    : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-1.5 pb-3">
                  {paidBorders.map(comp => {
                    const qty = getCompQty(comp.name, comp.classification);
                    return (
                      <div
                        key={comp.id}
                        className={`flex justify-between items-center gap-2 p-2 rounded text-xs border ${
                          qty > 0 ? 'bg-primary/10 border-primary/50' : 'bg-background border-border/60'
                        }`}
                      >
                        <span className="font-semibold text-foreground min-w-0 truncate">
                          {comp.name} <span className="text-primary">R$ {fmt(comp.price)}</span>
                        </span>
                        <div className="flex items-center bg-background border border-input rounded shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => updateCompQty(comp, -1)}
                            disabled={qty <= 0}
                            className="w-7 h-7 rounded-none text-destructive disabled:opacity-30 border-r border-input"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold text-foreground">{qty}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => updateCompQty(comp, 1)}
                            className="w-7 h-7 rounded-none text-success border-l border-input"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}

            {freeOptions.length > 0 && (
              <AccordionItem value="free" className="border border-border rounded bg-card px-3">
                <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
                  Adicionais (Grátis)
                  {freeOptions.filter(opt => getCompQty(opt.name, opt.classification) > 0).length > 0
                    ? ` · ${freeOptions.filter(opt => getCompQty(opt.name, opt.classification) > 0).length}`
                    : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-3">
                  {freeOptions.map(opt => {
                    const checked = getCompQty(opt.name, opt.classification) > 0;
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        key={opt.id}
                        onClick={() => toggleFree(opt)}
                        className={`w-full flex items-center gap-3 p-2 rounded text-left text-xs font-semibold border transition-colors ${
                          checked ? 'bg-primary/15 border-primary' : 'bg-background border-border/60 hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                            checked ? 'border-primary' : 'border-muted-foreground'
                          }`}
                        >
                          {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                        <span className="text-foreground">{opt.name}</span>
                      </button>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}

            {paidOptions.length > 0 && (
              <AccordionItem value="paid" className="border border-border rounded bg-card px-3">
                <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
                  Adicionais (Pagos)
                  {paidOptions.filter(c => getCompQty(c.name, c.classification) > 0).length > 0
                    ? ` · ${paidOptions.filter(c => getCompQty(c.name, c.classification) > 0).length}`
                    : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-1.5 pb-3">
                  {paidOptions.map(comp => {
                    const qty = getCompQty(comp.name, comp.classification);
                    return (
                      <div
                        key={comp.id}
                        className={`flex justify-between items-center gap-2 p-2 rounded text-xs border ${
                          qty > 0 ? 'bg-primary/10 border-primary/50' : 'bg-background border-border/60'
                        }`}
                      >
                        <span className="font-semibold text-foreground min-w-0 truncate">
                          {comp.name} <span className="text-primary">R$ {fmt(comp.price)}</span>
                        </span>
                        <div className="flex items-center bg-background border border-input rounded shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => updateCompQty(comp, -1)}
                            disabled={qty <= 0}
                            className="w-7 h-7 rounded-none text-destructive disabled:opacity-30 border-r border-input"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold text-foreground">{qty}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => updateCompQty(comp, 1)}
                            className="w-7 h-7 rounded-none text-success border-l border-input"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          <Input
            placeholder="Digite aqui outras observações..."
            value={otherNotes}
            onChange={e => setOtherNotes(e.target.value)}
            className="h-9 text-xs bg-background"
          />
        </div>
      ) : (
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
                    onClick={() => handleSelectSingleFlavorFromList(entry)}
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
      )}

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

        {isSingleFlavorOnly ? (
          <Button
            type="button"
            onClick={handleConfirmSingleFlavor}
            className="flex-1 sm:flex-initial h-11 px-6 text-xs sm:text-sm font-extrabold bg-success hover:bg-success/90 text-success-foreground flex items-center justify-center gap-2 shadow-md"
          >
            <Check className="h-4 w-4 stroke-[3]" /> OK · R$ {fmt(singleTotalPrice)}
          </Button>
        ) : flavorCount >= 2 ? (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Button
              type="button"
              disabled={!canConfirmMulti}
              onClick={() => handleConfirmMultiFlavors('customize')}
              className="flex-1 sm:flex-initial h-11 px-5 text-xs sm:text-sm font-extrabold bg-[#7c2289] hover:bg-[#641b6f] text-white flex items-center justify-center gap-2 shadow-md"
            >
              <Check className="h-4 w-4" />
              {canConfirmMulti
                ? `CONTINUAR · R$ ${fmt(multiFlavorPrice)}`
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
