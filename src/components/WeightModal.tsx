import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fmt } from '@/lib/utils';

interface WeightModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  pricePerKg: number;
  onConfirm: (weight: number) => void;
}

export function WeightModal({ open, onClose, productName, pricePerKg, onConfirm }: WeightModalProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const weight = parseFloat(value) || 0;
  const total = weight * pricePerKg;

  const handleDigit = useCallback((d: string) => {
    setValue(prev => {
      if (d === '.' && prev.includes('.')) return prev;
      if (prev.includes('.') && prev.split('.')[1]?.length >= 3) return prev;
      return prev + d;
    });
    // Refocus input after button click
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleConfirm = useCallback(() => {
    const w = parseFloat(value) || 0;
    if (w > 0) {
      onConfirm(w);
      setValue('');
      onClose();
    }
  }, [value, onConfirm, onClose]);

  const handleClose = useCallback(() => {
    setValue('');
    onClose();
  }, [onClose]);

  // Reset and focus when opening
  useEffect(() => {
    if (open) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(',', '.');
    if (/^\d*\.?\d{0,3}$/.test(raw)) {
      setValue(raw);
    }
  };

  // Display value with comma
  const displayValue = value.replace('.', ',');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center">{productName}</DialogTitle>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">R$ {fmt(pricePerKg)}/kg</p>

        <div className="bg-muted rounded-lg p-4 text-center" onClick={() => inputRef.current?.focus()}>
          <div className="flex items-baseline justify-center gap-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={displayValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="0"
              className="text-3xl font-bold text-foreground bg-transparent border-none outline-none text-center w-24 appearance-none"
              autoComplete="off"
            />
            <span className="text-lg text-muted-foreground">kg</span>
          </div>
          <p className="text-lg font-semibold text-primary mt-1">R$ {fmt(total)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Digite o peso no teclado ou use os botões</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9','.','0',''].map((d, i) => (
            d !== '' ? (
              <Button key={i} variant="outline" className="h-12 text-lg font-semibold" onClick={() => handleDigit(d)} tabIndex={-1}>
                {d}
              </Button>
            ) : (
              <Button key={i} variant="ghost" className="h-12 text-sm" onClick={() => { setValue(''); inputRef.current?.focus(); }} tabIndex={-1}>
                Limpar
              </Button>
            )
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-12" onClick={handleClose}>Cancelar</Button>
          <Button className="flex-1 h-12" onClick={handleConfirm} disabled={weight <= 0}>Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
