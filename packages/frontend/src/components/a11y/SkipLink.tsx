import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SkipLinkProps {
  targetId: string;
  className?: string;
}

/**
 * SkipLink component for keyboard users to skip navigation
 * This component is visually hidden until focused
 */
const SkipLink: React.FC<SkipLinkProps> = ({ targetId, className }) => {
  const { t } = useLanguage();

  return (
    <a href={`#${targetId}`} className={`skip-link ${className || ''}`} data-testid="skip-link">
      {t('accessibility.skipToContent', 'Skip to main content')}
    </a>
  );
};

export default SkipLink;
