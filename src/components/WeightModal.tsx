import React, { useState } from 'react';
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

  const handleDigit = (d: string) => {
    if (d === '.' && value.includes('.')) return;
    if (value.includes('.') && value.split('.')[1]?.length >= 3) return;
    setValue(prev => prev + d);
  };

  const handleConfirm = () => {
    if (weight > 0) {
      onConfirm(weight);
      setValue('');
      onClose();
    }
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

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
