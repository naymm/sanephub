import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatMonetaryAmount, parseMonetaryAmount } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type MonetaryInputProps = {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
};

/**
 * Campo monetário pt-AO: formata ao perder foco; enquanto edita mantém texto livre.
 */
export function MonetaryInput({ value, onChange, disabled, className, id, placeholder = '0,00' }: MonetaryInputProps) {
  const [focused, setFocused] = useState(false);
  const [str, setStr] = useState('');

  useEffect(() => {
    if (!focused) setStr('');
  }, [value, focused]);

  const displayValue = () => {
    if (focused) return str;
    return formatMonetaryAmount(value);
  };

  if (disabled) {
    return (
      <Input
        id={id}
        readOnly
        disabled
        className={cn(className)}
        value={formatMonetaryAmount(value)}
        placeholder={value ? undefined : placeholder}
      />
    );
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      className={cn(className)}
      value={displayValue()}
      onFocus={() => {
        setFocused(true);
        setStr(formatMonetaryAmount(value));
      }}
      onBlur={() => {
        setFocused(false);
        const n = parseMonetaryAmount(str);
        onChange(n);
      }}
      onChange={e => {
        const raw = e.target.value;
        setStr(raw);
        onChange(parseMonetaryAmount(raw));
      }}
    />
  );
}
