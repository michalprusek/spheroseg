import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EditorToolbarButtonProps {
  onClick: () => void;
  tooltipText: string;
  icon: ReactNode;
  testId: string;
  isActive?: boolean;
  activeVariant?: 'default' | 'destructive' | 'secondary';
  disabled?: boolean;
}

/**
 * Reusable button component for the editor toolbar with tooltip functionality
 */
const EditorToolbarButton: React.FC<EditorToolbarButtonProps> = ({
  onClick,
  tooltipText,
  icon,
  testId,
  isActive = false,
  activeVariant = 'default',
  disabled = false,
}) => {
  const buttonVariant = isActive ? activeVariant : 'ghost';
  const buttonClassName = `h-9 w-9 ${
    isActive ? '' : 'text-foreground/80 hover:bg-muted hover:text-foreground'
  } ${disabled ? 'disabled:opacity-50' : ''}`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={buttonVariant}
            size="icon"
            className={buttonClassName}
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span>{tooltipText}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EditorToolbarButton;
