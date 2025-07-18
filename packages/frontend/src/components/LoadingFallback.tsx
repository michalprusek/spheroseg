import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingFallback: React.FC = () => {
  // Don't use translations here as this component may render before i18next is initialized
  // This is used as a Suspense fallback, so it needs to be completely independent
  const loadingText = 'Loading application...';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">{loadingText}</p>
    </div>
  );
};

export default LoadingFallback;
