import React, { createContext, useContext } from 'react';
import { SegmentationResult } from '@/lib/segmentation';

interface SegmentationContextType {
  segmentation: SegmentationResult | null;
  loading: boolean;
}

const SegmentationContext = createContext<SegmentationContextType>({
  segmentation: null,
  loading: false,
});

export const useSegmentationContext = () => useContext(SegmentationContext);

interface SegmentationProviderProps {
  children: React.ReactNode;
  segmentation: SegmentationResult | null;
  loading: boolean;
}

export const SegmentationProvider: React.FC<SegmentationProviderProps> = ({ children, segmentation, loading }) => {
  return <SegmentationContext.Provider value={{ segmentation, loading }}>{children}</SegmentationContext.Provider>;
};
