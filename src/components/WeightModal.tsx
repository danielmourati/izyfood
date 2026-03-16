import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface WeightModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  pricePerKg: number;
  onConfirm: (weight: number) => void;
}

export function WeightModal({ open, onClose, productName, pricePerKg, onConfirm }: WeightModalProps) {
  const [value, setValue] = useState('');

  const weight = parseFloat(value) || 0;
  const total = weight * pricePerKg;

  const handleDigit = useCallback((d: string) => {
    setValue(prev => {
      if (d === '.' && prev.includes('.')) return prev;
      if (prev.includes('.') && prev.split('.')[1]?.length >= 3) return prev;
      return prev + d;
    });
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

  // Reset when opening
  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  // Global keyboard listener
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        handleDigit('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setValue(prev => prev.slice(0, -1));
      } else if (e.key === 'Delete') {
        e.preventDefault();
        setValue('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Need to read current value via ref-like pattern
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, handleDigit]);

  // Separate effect for Enter key to access latest value
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, handleConfirm]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center">{productName}</DialogTitle>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">R$ {pricePerKg.toFixed(2)}/kg</p>

        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{value || '0'} <span className="text-lg text-muted-foreground">kg</span></p>
          <p className="text-lg font-semibold text-primary mt-1">R$ {total.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Digite o peso no teclado ou use os botões</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9','.','0',''].map((d, i) => (
            d !== '' ? (
              <Button key={i} variant="outline" className="h-12 text-lg font-semibold" onClick={() => handleDigit(d)}>
                {d}
              </Button>
            ) : (
              <Button key={i} variant="ghost" className="h-12 text-sm" onClick={() => setValue('')}>
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
