import * as React from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface FormHelperTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  status?: 'default' | 'error' | 'success' | 'info';
  icon?: boolean;
}

const FormHelperText = React.forwardRef<HTMLParagraphElement, FormHelperTextProps>(
  ({ className, status = 'default', icon = true, children, ...props }, ref) => {
    const statusClasses = {
      default: 'text-muted-foreground/80',
      error: 'text-destructive',
      success: 'text-green-600 dark:text-green-400',
      info: 'text-blue-600 dark:text-blue-400',
    };

    const IconComponent = {
      default: Info,
      error: AlertCircle,
      success: CheckCircle2,
      info: Info,
    }[status];

    return (
      <p
        ref={ref}
        className={cn('text-xs mt-1.5 flex items-start gap-1.5', statusClasses[status], className)}
        {...props}
      >
        {icon && status !== 'default' && <IconComponent className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
        <span>{children}</span>
      </p>
    );
  },
);

FormHelperText.displayName = 'FormHelperText';

export { FormHelperText };
