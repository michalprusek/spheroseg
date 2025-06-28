import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

const LoadingFallback: React.FC = () => {
  const { t } = useTranslations();

  // Log when this component mounts
  useEffect(() => {
    console.log('LoadingFallback component mounted');

    return () => {
      console.log('LoadingFallback component unmounted');
    };
  }, []);

  // Provide a fallback text in case translations aren't loaded yet
  const loadingText = t('common.loadingApplication') || 'Loading application...';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">{loadingText}</p>
    </div>
  );
};

export default LoadingFallback;
