import React from 'react';
import { srOnlyStyle } from '@/utils/accessibility';

interface VisuallyHiddenProps {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

/**
 * Component for content that should be visible only to screen readers
 * Visually hidden but accessible to screen readers
 */
const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Component = 'span',
  className,
  ...props
}) => {
  return (
    <Component
      className={`sr-only ${className || ''}`}
      style={srOnlyStyle}
      {...props}
    >
      {children}
    </Component>
  );
};

export default VisuallyHidden;
