import * as React from 'react';
import { cn } from '@/lib/utils';
import { Upload } from 'lucide-react';

export interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: boolean;
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, label = 'Choose file', icon = true, ...props }, ref) => {
    const [fileName, setFileName] = React.useState<string>('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        setFileName(e.target.files[0].name);
      } else {
        setFileName('');
      }

      // Call the original onChange handler if provided
      if (props.onChange) {
        props.onChange(e);
      }
    };

    return (
      <div className="relative">
        <input
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
          ref={ref}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background shadow-sm transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-1 focus-within:border-primary/80 cursor-pointer',
            className,
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="truncate">{fileName || label}</span>
            {icon && <Upload className="ml-2 h-4 w-4 shrink-0 opacity-70" />}
          </div>
        </div>
      </div>
    );
  },
);

FileInput.displayName = 'FileInput';

export { FileInput };
