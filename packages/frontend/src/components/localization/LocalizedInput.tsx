import React, { useState, useEffect, useRef } from 'react';
import { useLocalizedInput } from '@/hooks/useLocalization';
import { cn } from '@/utils/cn';

interface LocalizedNumberInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

/**
 * Number input that handles locale-specific formatting
 */
export function LocalizedNumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  decimals,
  className,
  disabled,
  required,
  error,
  onBlur,
  onFocus,
}: LocalizedNumberInputProps) {
  const { parseNumber, formatNumberInput } = useLocalizedInput();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update display value when value changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatNumberInput(value, decimals));
    }
  }, [value, decimals, isFocused, formatNumberInput]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    // Allow empty input
    if (inputValue === '') {
      onChange(null);
      return;
    }

    // Parse the number
    const parsed = parseNumber(inputValue);
    
    if (parsed !== null) {
      // Apply constraints
      let constrained = parsed;
      if (min !== undefined && parsed < min) constrained = min;
      if (max !== undefined && parsed > max) constrained = max;
      
      onChange(constrained);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number on focus for easier editing
    if (value !== null) {
      setDisplayValue(value.toString());
    }
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format on blur
    setDisplayValue(formatNumberInput(value, decimals));
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow increment/decrement with arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentValue = value || 0;
      const stepValue = step || 1;
      const newValue = e.key === 'ArrowUp' 
        ? currentValue + stepValue 
        : currentValue - stepValue;
      
      // Apply constraints
      let constrained = newValue;
      if (min !== undefined && newValue < min) constrained = min;
      if (max !== undefined && newValue > max) constrained = max;
      
      onChange(constrained);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={cn(
        'px-3 py-2 border rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        'dark:bg-gray-800 dark:border-gray-700',
        error && 'border-red-500 focus:ring-red-500',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      inputMode="decimal"
      autoComplete="off"
    />
  );
}

interface LocalizedCurrencyInputProps extends Omit<LocalizedNumberInputProps, 'decimals'> {
  currency?: string;
}

/**
 * Currency input that handles locale-specific formatting
 */
export function LocalizedCurrencyInput({
  value,
  onChange,
  currency = 'USD',
  placeholder,
  min = 0,
  max,
  className,
  disabled,
  required,
  error,
  onBlur,
  onFocus,
}: LocalizedCurrencyInputProps) {
  const { parseCurrency, formatCurrencyInput } = useLocalizedInput();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrencyInput(value, currency));
    }
  }, [value, currency, isFocused, formatCurrencyInput]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    // Allow empty input
    if (inputValue === '') {
      onChange(null);
      return;
    }

    // Parse the currency value
    const parsed = parseCurrency(inputValue);
    
    if (parsed !== null) {
      // Apply constraints
      let constrained = parsed;
      if (min !== undefined && parsed < min) constrained = min;
      if (max !== undefined && parsed > max) constrained = max;
      
      onChange(constrained);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show number without currency symbol on focus
    if (value !== null) {
      setDisplayValue(value.toFixed(2));
    }
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format with currency on blur
    setDisplayValue(formatCurrencyInput(value, currency));
    onBlur?.();
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={cn(
        'px-3 py-2 border rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        'dark:bg-gray-800 dark:border-gray-700',
        error && 'border-red-500 focus:ring-red-500',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      inputMode="decimal"
      autoComplete="off"
    />
  );
}

interface LocalizedDateInputProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  placeholder?: string;
  min?: Date;
  max?: Date;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  showTime?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

/**
 * Date input with locale-aware formatting
 */
export function LocalizedDateInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  className,
  disabled,
  required,
  error,
  showTime,
  onBlur,
  onFocus,
}: LocalizedDateInputProps) {
  const { formatDate, formatDateTime, language } = useLocalization();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused && value) {
      setDisplayValue(showTime ? formatDateTime(value) : formatDate(value));
    } else if (!value) {
      setDisplayValue('');
    }
  }, [value, showTime, isFocused, formatDate, formatDateTime]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show native date input value format
    if (value) {
      const isoString = value.toISOString();
      setDisplayValue(showTime ? isoString.slice(0, 16) : isoString.slice(0, 10));
    }
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format for display
    if (value) {
      setDisplayValue(showTime ? formatDateTime(value) : formatDate(value));
    }
    onBlur?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (!inputValue) {
      onChange(null);
      return;
    }

    const date = new Date(inputValue);
    if (!isNaN(date.getTime())) {
      // Apply constraints
      let constrained = date;
      if (min && date < min) constrained = min;
      if (max && date > max) constrained = max;
      
      onChange(constrained);
    }
  };

  // Use native input when focused, custom display when not
  if (isFocused) {
    return (
      <input
        ref={inputRef}
        type={showTime ? 'datetime-local' : 'date'}
        value={value ? (showTime 
          ? value.toISOString().slice(0, 16)
          : value.toISOString().slice(0, 10)
        ) : ''}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min?.toISOString().slice(0, showTime ? 16 : 10)}
        max={max?.toISOString().slice(0, showTime ? 16 : 10)}
        disabled={disabled}
        required={required}
        className={cn(
          'px-3 py-2 border rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'dark:bg-gray-800 dark:border-gray-700',
          error && 'border-red-500 focus:ring-red-500',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onFocus={handleFocus}
      placeholder={placeholder || (showTime ? 'DD/MM/YYYY HH:MM' : 'DD/MM/YYYY')}
      readOnly
      disabled={disabled}
      required={required}
      className={cn(
        'px-3 py-2 border rounded-lg cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        'dark:bg-gray-800 dark:border-gray-700',
        error && 'border-red-500 focus:ring-red-500',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    />
  );
}