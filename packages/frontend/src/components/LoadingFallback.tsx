import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const LoadingFallback: React.FC = () => {
  // Log when this component mounts
  useEffect(() => {
    console.log('LoadingFallback component mounted');

    return () => {
      console.log('LoadingFallback component unmounted');
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Loading application...</p>
    </div>
  );
};

export default LoadingFallback;
