import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Minus, Plus, Check, ChevronLeft, Search, X } from 'lucide-react';
import { Product, OrderItem } from '@/types';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';

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
  const [obsSearch, setObsSearch] = useState<string>('');
  const [compSearch, setCompSearch] = useState<string>('');

  const categoryId = product?.categoryId;

  const availableNotes = useMemo(() => {
    return noteOptions.filter(
      o => o.active && o.type === 'note' && (!categoryId || o.categoryIds.length === 0 || o.categoryIds.includes(categoryId))
    );
  }, [noteOptions, categoryId]);

  const availableComplements = useMemo(() => {
    return noteOptions.filter(
      o => o.active && o.type === 'complement' && (!categoryId || o.categoryIds.length === 0 || o.categoryIds.includes(categoryId))
    );
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
      setObsSearch('');
      setCompSearch('');
    }
  }, [open, itemToEdit]);

  if (!open || !product) return null;

  const filteredNotes = availableNotes.filter(n => n.name.toLowerCase().includes(obsSearch.toLowerCase()));
  const filteredComplements = availableComplements.filter(c => c.name.toLowerCase().includes(compSearch.toLowerCase()));

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
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans">
      <div className="bg-card text-card-foreground w-full max-w-4xl rounded-md shadow-2xl overflow-hidden border border-border flex flex-col h-[90vh] max-h-[700px] animate-in zoom-in-95 duration-150">
        
        {/* Title Bar */}
        <div className="bg-muted/70 px-4 py-2 flex justify-between items-center border-b border-border shrink-0">
          <span className="text-sm font-bold text-foreground">Personalizar Item</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-header Bar (Quantity, Item Name, Total Price) */}
        <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center bg-background border border-input rounded">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center text-primary hover:bg-muted font-bold text-lg border-r border-input transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-bold text-base text-foreground">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 flex items-center justify-center text-primary hover:bg-muted font-bold text-lg border-l border-input transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Product Title */}
            <h2 className="text-lg font-bold text-foreground truncate max-w-md">{product.name}</h2>
          </div>

          {/* Price Tag */}
          <div className="text-right">
            <span className="text-2xl font-extrabold text-primary drop-shadow-sm">
              R$ {fmt(totalPrice)}
            </span>
          </div>
        </div>

        {/* Body Split (2 Columns) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden bg-background">
          
          {/* Left Column: Observações */}
          <div className="flex flex-col h-full overflow-hidden p-3 bg-muted/10">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              Observações
            </h3>

            {/* Search Bar */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar observações..."
                value={obsSearch}
                onChange={e => setObsSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              />
            </div>

            {/* Checkbox List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 border border-border rounded bg-background p-2 mb-3">
              {filteredNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-3 text-center">Nenhuma observação cadastrada</p>
              ) : (
                filteredNotes.map(obs => {
                  const isChecked = selectedObs.includes(obs.name);
                  return (
                    <label
                      key={obs.id}
                      onClick={() => toggleObs(obs.name)}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer text-xs font-semibold transition-colors border ${
                        isChecked
                          ? 'bg-primary/15 border-primary text-foreground'
                          : 'bg-card border-border/60 hover:bg-muted text-foreground'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleObs(obs.name)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <span>{obs.name}</span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Additional Text Input */}
            <div className="shrink-0">
              <Input
                placeholder="Digite aqui outras observações..."
                value={otherNotes}
                onChange={e => setOtherNotes(e.target.value)}
                className="h-9 text-xs bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Right Column: Complementos */}
          <div className="flex flex-col h-full overflow-hidden p-3 bg-muted/10">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              Complementos
            </h3>

            {/* Search Bar */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Pesquisar complementos..."
                value={compSearch}
                onChange={e => setCompSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
              />
            </div>

            {/* Complements List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-border rounded bg-background p-2">
              {filteredComplements.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-3 text-center">Nenhum complemento disponível</p>
              ) : (
                filteredComplements.map(comp => {
                  const qty = getCompQty(comp.name);
                  return (
                    <div
                      key={comp.id}
                      className={`flex justify-between items-center p-2 rounded text-xs border transition-colors ${
                        qty > 0 ? 'bg-primary/10 border-primary/50' : 'bg-card border-border/60 hover:bg-muted'
                      }`}
                    >
                      <span className="font-semibold text-foreground truncate max-w-[200px]">
                        {comp.name} {comp.price > 0 ? `(R$ ${fmt(comp.price)})` : ''}
                      </span>

                      {/* Quantity Selector */}
                      <div className="flex items-center bg-background border border-input rounded">
                        <button
                          type="button"
                          onClick={() => updateCompQty(comp, -1)}
                          disabled={qty <= 0}
                          className="w-7 h-7 flex items-center justify-center text-primary hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent font-bold border-r border-input"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center font-bold text-foreground">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCompQty(comp, 1)}
                          className="w-7 h-7 flex items-center justify-center text-primary hover:bg-muted font-bold border-l border-input"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="bg-muted/60 p-3 border-t border-border flex justify-between items-center shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs h-9 px-4 flex items-center gap-1.5 font-bold border-border"
          >
            <ChevronLeft className="h-4 w-4" /> Cancelar
          </Button>

          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-5 flex items-center gap-2 font-bold shadow-md active:scale-95 transition-all"
          >
            <Check className="h-4 w-4 stroke-[3]" /> Adicionar Item
          </Button>
        </div>
      </div>
    </div>
  );
}
