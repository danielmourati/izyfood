import * as React from 'react';

import { Input } from '@/components/ui/input';
import { maskBRLInput } from '@/lib/utils';

type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'inputMode' | 'onChange'> & {
  onValueChange: (value: string) => void;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ onValueChange, value, placeholder = 'R$ 0,00', ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onValueChange(maskBRLInput(event.target.value))}
    />
  ),
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };