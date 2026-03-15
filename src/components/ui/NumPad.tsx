import { Delete, CornerDownLeft } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  showDecimal?: boolean;
  className?: string;
  buttonClassName?: string;
  enableKeyboard?: boolean;
}

export function NumPad({ 
  value, 
  onChange, 
  onSubmit,
  maxLength = 10,
  showDecimal = false,
  className,
  buttonClassName,
  enableKeyboard = true
}: NumPadProps) {
  const handlePress = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  useEffect(() => {
    if (!enableKeyboard) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.key >= '0' && event.key <= '9') {
        handlePress(event.key);
        return;
      }
      if (showDecimal && event.key === '.') {
        handlePress('.');
        return;
      }
      if (event.key === 'Backspace') {
        handleDelete();
        return;
      }
      if (event.key === 'Escape') {
        handleClear();
        return;
      }
      if (event.key === 'Enter' && onSubmit) {
        onSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enableKeyboard, showDecimal, onSubmit, value]);

  const buttons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [showDecimal ? '.' : 'C', '0', 'DEL'],
  ];

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {buttons.flat().map((btn, idx) => {
        if (btn === 'DEL') {
          return (
            <button
              key={idx}
              onClick={handleDelete}
              className={cn('numpad-btn bg-warning/20 text-warning hover:bg-warning/30', buttonClassName)}
            >
              <Delete className="h-6 w-6" />
            </button>
          );
        }
        if (btn === 'C') {
          return (
            <button
              key={idx}
              onClick={handleClear}
              className={cn('numpad-btn bg-destructive/20 text-destructive hover:bg-destructive/30', buttonClassName)}
            >
              C
            </button>
          );
        }
        return (
          <button
            key={idx}
            onClick={() => handlePress(btn)}
            className={cn('numpad-btn', buttonClassName)}
          >
            {btn}
          </button>
        );
      })}
      
      {onSubmit && (
        <button
          onClick={onSubmit}
          className="numpad-btn col-span-3 bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
        >
          <CornerDownLeft className="h-6 w-6 mr-2" />
          Confirmar
        </button>
      )}
    </div>
  );
}

// Teclado numérico para PIN
interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value?: string) => void;
  maxLength?: number;
  error?: string;
}

export function PinPad({ 
  value, 
  onChange, 
  onSubmit, 
  maxLength = 4,
  error 
}: PinPadProps) {
  const handlePress = (digit: string) => {
    if (value.length < maxLength) {
      const newValue = value + digit;
      onChange(newValue);
      if (newValue.length === maxLength) {
        setTimeout(() => onSubmit(newValue), 150);
      }
    }
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.key >= '0' && event.key <= '9') {
        handlePress(event.key);
        return;
      }
      if (event.key === 'Backspace') {
        handleDelete();
        return;
      }
      if (event.key === 'Enter' && value.length === maxLength) {
        onSubmit(value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [value, maxLength]);

  return (
    <div className="space-y-6">
      {/* Display de PIN */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: maxLength }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all',
              idx < value.length
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-secondary',
              idx === value.length && !error && 'ring-2 ring-primary/30',
              value.length === maxLength && !error && 'border-success/60 bg-success/10 text-success',
              error && 'border-destructive animate-shake'
            )}
          >
            {idx < value.length ? '•' : ''}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-center text-destructive text-sm">{error}</p>
      )}

      {/* Teclado */}
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handlePress(num.toString())}
            className="numpad-btn h-16 text-2xl"
          >
            {num}
          </button>
        ))}
        <div /> {/* Espacio vacío */}
        <button
          onClick={() => handlePress('0')}
          className="numpad-btn h-16 text-2xl"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="numpad-btn h-16 bg-secondary hover:bg-secondary/80"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
