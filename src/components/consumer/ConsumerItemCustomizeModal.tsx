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
    setSelectedObs(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
  };

  const updateCompQty = (comp: { name: string; price: number }, delta: number) => {
    setComplements(prev => {
      const existing = prev.find(c => c.name === comp.name);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(c => c.name !== comp.name);
        return prev.map(c => (c.name === comp.name ? { ...c, quantity: newQty } : c));
      } else if (delta > 0) {
        return [...prev, { name: comp.name, price: comp.price, quantity: 1 }];
      }
      return prev;
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
    <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs font-sans">
      <div className="bg-[#252526] text-white w-full max-w-4xl rounded-md shadow-2xl overflow-hidden border border-[#3c3c3c] flex flex-col h-[90vh] max-h-[700px] animate-in zoom-in-95 duration-150">
        
        {/* Title Bar */}
        <div className="bg-[#1e1e1e] px-4 py-2 flex justify-between items-center border-b border-[#333333] shrink-0">
          <span className="text-sm font-semibold text-gray-200">Personalizar Item</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#333333] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-header Bar (Quantity, Item Name, Total Price) */}
        <div className="bg-[#2b2b2b] px-4 py-3 border-b border-[#383838] flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center bg-[#1e1e1e] border border-[#444444] rounded">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-8 h-8 flex items-center justify-center text-blue-400 hover:bg-[#333333] font-bold text-lg border-r border-[#444444] transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-bold text-base text-white">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-8 h-8 flex items-center justify-center text-blue-400 hover:bg-[#333333] font-bold text-lg border-l border-[#444444] transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Product Title */}
            <h2 className="text-lg font-bold text-white truncate max-w-md">{product.name}</h2>
          </div>

          {/* Price Tag */}
          <div className="text-right">
            <span className="text-2xl font-extrabold text-[#38bdf8] drop-shadow-sm">
              {fmt(totalPrice)}
            </span>
          </div>
        </div>

        {/* Body Split (2 Columns) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#383838] overflow-hidden bg-[#222222]">
          
          {/* Left Column: Observações */}
          <div className="flex flex-col h-full overflow-hidden p-3 bg-[#242424]">
            <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
              Observações
            </h3>

            {/* Search Bar */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Pesquisar aqui..."
                value={obsSearch}
                onChange={e => setObsSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-[#1e1e1e] border-[#3a3a3a] text-gray-200 placeholder:text-gray-500 focus-visible:ring-blue-500"
              />
            </div>

            {/* Checkbox List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 border border-[#333333] rounded bg-[#1e1e1e] p-2 mb-3">
              {filteredNotes.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 text-center">Nenhuma observação cadastrada</p>
              ) : (
                filteredNotes.map(obs => {
                  const isChecked = selectedObs.includes(obs.name);
                  return (
                    <label
                      key={obs.id}
                      onClick={() => toggleObs(obs.name)}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer text-xs font-medium transition-colors border ${
                        isChecked
                          ? 'bg-[#1d4ed8]/30 border-blue-500 text-white'
                          : 'bg-[#282828] border-transparent hover:bg-[#333333] text-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleObs(obs.name)}
                        className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
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
                className="h-9 text-xs bg-[#1e1e1e] border-[#3a3a3a] text-gray-200 placeholder:text-gray-500 focus-visible:ring-blue-500"
              />
            </div>
          </div>

          {/* Right Column: Complementos */}
          <div className="flex flex-col h-full overflow-hidden p-3 bg-[#242424]">
            <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
              Complementos
            </h3>

            {/* Search Bar */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Pesquisar aqui..."
                value={compSearch}
                onChange={e => setCompSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-[#1e1e1e] border-[#3a3a3a] text-gray-200 placeholder:text-gray-500 focus-visible:ring-blue-500"
              />
            </div>

            {/* Complements List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-[#333333] rounded bg-[#1e1e1e] p-2">
              {filteredComplements.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 text-center">Nenhum complemento disponível</p>
              ) : (
                filteredComplements.map(comp => {
                  const qty = getCompQty(comp.name);
                  return (
                    <div
                      key={comp.id}
                      className={`flex justify-between items-center p-2 rounded text-xs border transition-colors ${
                        qty > 0 ? 'bg-[#1e293b] border-blue-500/50' : 'bg-[#282828] border-transparent'
                      }`}
                    >
                      <span className="font-semibold text-gray-200 truncate max-w-[200px]">
                        {comp.name} {comp.price > 0 ? `(${fmt(comp.price)})` : ''}
                      </span>

                      {/* Quantity Selector */}
                      <div className="flex items-center bg-[#18181b] border border-[#3f3f46] rounded">
                        <button
                          type="button"
                          onClick={() => updateCompQty(comp, -1)}
                          disabled={qty <= 0}
                          className="w-7 h-7 flex items-center justify-center text-blue-400 hover:bg-[#333333] disabled:opacity-30 disabled:hover:bg-transparent font-bold border-r border-[#3f3f46]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center font-bold text-gray-200">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCompQty(comp, 1)}
                          className="w-7 h-7 flex items-center justify-center text-blue-400 hover:bg-[#333333] font-bold border-l border-[#3f3f46]"
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
        <div className="bg-[#1e1e1e] p-3 border-t border-[#333333] flex justify-between items-center shrink-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-[#2e2e2e] text-xs h-9 px-4 flex items-center gap-1.5 font-medium"
          >
            <ChevronLeft className="h-4 w-4" /> Cancelar
          </Button>

          <Button
            onClick={handleSave}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs h-9 px-5 flex items-center gap-2 font-bold shadow-md active:scale-95 transition-all"
          >
            <Check className="h-4 w-4 stroke-[3]" /> Adicionar Item
          </Button>
        </div>
      </div>
    </div>
  );
}
