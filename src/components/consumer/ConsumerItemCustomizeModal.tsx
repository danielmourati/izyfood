import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Minus, Plus, Check, ChevronLeft, X } from 'lucide-react';
import { Product, OrderItem } from '@/types';
import { useStore } from '@/contexts/StoreContext';
import { fmt, sortAllAdditionalsFirst } from '@/lib/utils';

interface ConsumerItemCustomizeModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  itemToEdit?: OrderItem | null;
  onConfirm: (payload: {
    quantity: number;
    selectedNotes: string[];
    otherNotes: string;
    selectedComplements: { name: string; price: number; quantity: number }[];
  }) => void;
}

export function ConsumerItemCustomizeModal({
  open,
  onClose,
  product,
  itemToEdit,
  onConfirm,
}: ConsumerItemCustomizeModalProps) {
  const { noteOptions } = useStore();
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedObs, setSelectedObs] = useState<string[]>([]);
  const [otherNotes, setOtherNotes] = useState<string>('');
  const [complements, setComplements] = useState<{ name: string; price: number; quantity: number }[]>([]);

  const categoryId = product?.categoryId;

  const availableNotes = useMemo(() => {
    return sortAllAdditionalsFirst(noteOptions.filter(
      o => o.active && o.type === 'note' && (!categoryId || o.categoryIds.includes(categoryId))
    ));
  }, [noteOptions, categoryId]);

  const availableComplements = useMemo(() => {
    return sortAllAdditionalsFirst(noteOptions.filter(
      o => o.active && o.type === 'complement' && (!categoryId || o.categoryIds.includes(categoryId))
    ));
  }, [noteOptions, categoryId]);

  useEffect(() => {
    if (open) {
      if (itemToEdit) {
        setQuantity(itemToEdit.quantity || 1);
        setSelectedObs(itemToEdit.selectedNotes || []);
        setOtherNotes(itemToEdit.otherNotes || '');
        setComplements(itemToEdit.selectedComplements || []);
      } else {
        setQuantity(1);
        setSelectedObs([]);
        setOtherNotes('');
        setComplements([]);
      }
    }
  }, [open, itemToEdit]);

  if (!open || !product) return null;

  const freeOptions = sortAllAdditionalsFirst([
    ...availableComplements.filter(c => !(c.price > 0)),
    ...availableNotes.filter(n => !availableComplements.some(c => c.name === n.name)),
  ]);
  const paidOptions = availableComplements.filter(c => c.price > 0);
  const isFreeSelected = (opt: { name: string; type: string }) =>
    opt.type === 'note' ? selectedObs.includes(opt.name) : getCompQty(opt.name) > 0;
  const toggleFree = (opt: { name: string; type: string; price: number }) => {
    if (opt.type === 'note') { toggleObs(opt.name); return; }
    setComplements(prev => prev.some(c => c.name === opt.name)
      ? prev.filter(c => c.name !== opt.name)
      : [...prev, { name: opt.name, price: 0, quantity: 1 }]);
  };
  const freeSelectedCount = freeOptions.filter(isFreeSelected).length;
  const paidSelectedCount = paidOptions.filter(c => getCompQty(c.name) > 0).length;

  const toggleObs = (name: string) => {
    setSelectedObs(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const updateCompQty = (comp: { name: string; price: number }, delta: number) => {
    setComplements(prev => {
      const existing = prev.find(c => c.name === comp.name);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(c => c.name !== comp.name);
        return prev.map(c => c.name === comp.name ? { ...c, quantity: newQty } : c);
      } else {
        if (delta <= 0) return prev;
        return [...prev, { name: comp.name, price: comp.price, quantity: delta }];
      }
    });
  };

  const getCompQty = (name: string) => {
    return complements.find(c => c.name === name)?.quantity || 0;
  };

  const compsTotalUnit = complements.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const unitPrice = (product.price || 0) + compsTotalUnit;
  const totalPrice = unitPrice * quantity;

  const handleSave = () => {
    onConfirm({
      quantity,
      selectedNotes: selectedObs,
      otherNotes: otherNotes.trim(),
      selectedComplements: complements,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 font-sans">
      <div className="bg-card text-card-foreground w-full max-w-4xl rounded-none sm:rounded-md shadow-2xl overflow-hidden border-0 sm:border border-border flex flex-col h-full sm:h-[90vh] sm:max-h-[700px] animate-in zoom-in-95 duration-150">
        
        {/* Title Bar */}
        <div className="bg-primary px-4 py-3 sm:py-2 flex justify-between items-center border-b border-border shrink-0">
          <span className="text-sm font-bold text-primary-foreground">Personalizar Item</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar personalização"
            className="h-8 w-8 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/15"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Sub-header Bar (Quantity, Item Name, Total Price) */}
        <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between shrink-0 gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center bg-background border border-input rounded">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-none text-primary hover:bg-muted font-bold text-lg border-r border-input"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-bold text-base text-foreground">{quantity}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 rounded-none text-primary hover:bg-muted font-bold text-lg border-l border-input"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Product Title */}
            <h2 className="text-sm sm:text-lg font-bold text-foreground truncate max-w-md">{product.name}</h2>
          </div>

          {/* Price Tag */}
          <div className="text-right">
            <span className="text-lg sm:text-2xl font-extrabold text-primary drop-shadow-sm whitespace-nowrap">
              R$ {fmt(totalPrice)}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-3 space-y-3">
          <Accordion type="multiple" defaultValue={['free', 'paid']} className="space-y-2">
            {freeOptions.length > 0 && (
              <AccordionItem value="free" className="border border-border rounded bg-card px-3">
                <AccordionTrigger className="py-3 text-sm font-bold hover:no-underline">
                  Adicionais (Grátis){freeSelectedCount > 0 ? ` · ${freeSelectedCount}` : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-3">
                  {freeOptions.map(opt => {
                    const checked = isFreeSelected(opt);
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        key={opt.id}
                        onClick={() => toggleFree(opt)}
                        className={`w-full flex items-center gap-3 p-2 rounded text-left text-xs font-semibold border transition-colors ${checked ? 'bg-primary/15 border-primary' : 'bg-background border-border/60 hover:bg-muted'}`}
                      >
                        <span className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${checked ? 'border-primary' : 'border-muted-foreground'}`}>
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
                  Adicionais (Pagos){paidSelectedCount > 0 ? ` · ${paidSelectedCount}` : ''}
                </AccordionTrigger>
                <AccordionContent className="space-y-1.5 pb-3">
                  {paidOptions.map(comp => {
                    const qty = getCompQty(comp.name);
                    return (
                      <div key={comp.id} className={`flex justify-between items-center gap-2 p-2 rounded text-xs border ${qty > 0 ? 'bg-primary/10 border-primary/50' : 'bg-background border-border/60'}`}>
                        <span className="font-semibold text-foreground min-w-0 truncate">{comp.name} <span className="text-primary">R$ {fmt(comp.price)}</span></span>
                        <div className="flex items-center bg-background border border-input rounded shrink-0">
                          <Button type="button" variant="ghost" size="icon" onClick={() => updateCompQty(comp, -1)} disabled={qty <= 0} className="w-7 h-7 rounded-none text-destructive disabled:opacity-30 border-r border-input">
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold text-foreground">{qty}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => updateCompQty(comp, 1)} className="w-7 h-7 rounded-none text-success border-l border-input">
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
          {freeOptions.length === 0 && paidOptions.length === 0 && (
            <p className="text-xs text-muted-foreground italic p-3 text-center">Nenhum adicional disponível</p>
          )}
          <Input
            placeholder="Digite aqui outras observações..."
            value={otherNotes}
            onChange={e => setOtherNotes(e.target.value)}
            className="h-9 text-xs bg-background"
          />
        </div>

        {/* Footer Action Buttons */}
        <div className="bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border grid grid-cols-2 gap-2 shrink-0 shadow-[0_-4px_12px_hsl(var(--foreground)/0.08)]">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm h-12 px-4 flex items-center gap-1.5 font-bold border-border"
          >
            <ChevronLeft className="h-4 w-4" /> VOLTAR
          </Button>

          <Button
            onClick={handleSave}
            className="w-full bg-success hover:bg-success/90 text-success-foreground text-sm h-12 px-5 flex items-center gap-2 font-bold shadow-md active:scale-95 transition-all"
          >
            <Check className="h-4 w-4 stroke-[3]" /> OK
          </Button>
        </div>
      </div>
    </div>
  );
}
