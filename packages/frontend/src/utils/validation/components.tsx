/**
 * Reusable Form Components with Built-in Validation
 * 
 * These components integrate with react-hook-form and provide
 * consistent validation UI across the application.
 */

import React from 'react';
import { Control, FieldError, FieldValues, Path } from 'react-hook-form';
import { 
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPasswordStrength } from './schemas';

// ===========================
// Types
// ===========================

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface SelectOption {
  label: string;
  value: string;
}

// ===========================
// Text Input Field
// ===========================

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
  type = 'text',
  ...props
}: BaseFieldProps<T> & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input
              {...field}
              {...props}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ===========================
// Email Field
// ===========================

export function EmailField<T extends FieldValues>(props: BaseFieldProps<T>) {
  return (
    <TextField
      {...props}
      type="email"
      autoComplete="email"
      placeholder={props.placeholder || 'Enter your email'}
    />
  );
}

// ===========================
// Password Field with Toggle
// ===========================

export function PasswordField<T extends FieldValues>({
  showStrength = false,
  ...props
}: BaseFieldProps<T> & { showStrength?: boolean }) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <FormField
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className={props.className}>
          {props.label && <FormLabel>{props.label}</FormLabel>}
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                type={showPassword ? 'text' : 'password'}
                placeholder={props.placeholder || 'Enter your password'}
                disabled={props.disabled}
                autoComplete="current-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </FormControl>
          {showStrength && field.value && (
            <PasswordStrengthIndicator password={field.value} />
          )}
          {props.description && <FormDescription>{props.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ===========================
// Password Strength Indicator
// ===========================

function PasswordStrengthIndicator({ password }: { password: string }) {
  const { score, feedback } = getPasswordStrength(password);
  
  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
  ];
  
  const strengthLabels = [
    'Very Weak',
    'Weak',
    'Fair',
    'Good',
    'Strong',
  ];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`h-1 w-full rounded-full ${
              i < score ? strengthColors[score - 1] : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength: {strengthLabels[Math.max(0, score - 1)]}
      </p>
      {feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc list-inside">
          {feedback.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ===========================
// Textarea Field
// ===========================

export function TextareaField<T extends FieldValues>({
  rows = 3,
  ...props
}: BaseFieldProps<T> & { rows?: number }) {
  return (
    <FormField
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className={props.className}>
          {props.label && <FormLabel>{props.label}</FormLabel>}
          <FormControl>
            <Textarea
              {...field}
              placeholder={props.placeholder}
              disabled={props.disabled}
              rows={rows}
            />
          </FormControl>
          {props.description && <FormDescription>{props.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ===========================
// Checkbox Field
// ===========================

export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  className,
}: BaseFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={`flex flex-row items-start space-x-3 space-y-0 ${className}`}>
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            {label && (
              <FormLabel className="cursor-pointer">
                {label}
              </FormLabel>
            )}
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}

// ===========================
// Select Field
// ===========================

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder = 'Select an option',
  disabled,
  className,
  options,
}: BaseFieldProps<T> & { options: SelectOption[] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ===========================
// Form Error Summary
// ===========================

export function FormErrorSummary({ errors }: { errors: Record<string, FieldError> }) {
  const errorMessages = Object.entries(errors).map(([field, error]) => ({
    field,
    message: error?.message || 'Invalid value',
  }));

  if (errorMessages.length === 0) return null;

  return (
    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      <p className="font-medium mb-1">Please fix the following errors:</p>
      <ul className="list-disc list-inside space-y-1">
        {errorMessages.map(({ field, message }) => (
          <li key={field}>
            <span className="font-medium capitalize">{field.replace(/_/g, ' ')}</span>: {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===========================
// Submit Button with Loading
// ===========================

export function SubmitButton({
  isSubmitting,
  label = 'Submit',
  loadingLabel = 'Submitting...',
  className,
  ...props
}: {
  isSubmitting: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="submit"
      disabled={isSubmitting}
      className={className}
      {...props}
    >
      {isSubmitting ? loadingLabel : label}
    </Button>
  );
}