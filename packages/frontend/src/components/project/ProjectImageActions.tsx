import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ProjectImage, ImageStatus } from '@/types'; // Import ImageStatus
import apiClient from '@/lib/apiClient';
import axios from 'axios';

interface UseProjectImageActionsProps {
  projectId?: string;
  onImagesChange: (images: ProjectImage[]) => void;
  images: ProjectImage[];
}

export const useProjectImageActions = ({ projectId, onImagesChange, images }: UseProjectImageActionsProps) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [isResegmenting, setIsResegmenting] = useState<Record<string, boolean>>({});

  const handleDeleteImage = useCallback(async (imageId: string) => {
    setIsDeleting(prev => ({ ...prev, [imageId]: true }));
    try {
      // Find the project ID for this image
      const image = images.find(img => img.id === imageId);
      if (!image || !projectId) {
        throw new Error('Image or project not found');
      }

      // Use the new API endpoint with project ID
      await apiClient.delete(`/projects/${projectId}/images/${imageId}`);
      toast.success('Image deleted successfully');
      const updatedImages = images.filter(img => img.id !== imageId);
      onImagesChange(updatedImages);
    } catch (err: unknown) {
      let message = 'Failed to delete image';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      console.error("Error deleting image:", err);
      toast.error(message);
    } finally {
      setIsDeleting(prev => ({ ...prev, [imageId]: false }));
    }
  }, [images, onImagesChange, projectId]);

  const handleOpenSegmentationEditor = useCallback((imageId: string) => {
    if (!projectId) {
      console.error("Cannot open editor without project ID");
      toast.error("Cannot open editor: Project context missing.");
      return;
    }
    navigate(`/projects/${projectId}/segmentation/${imageId}`);
  }, [navigate, projectId]);

  const handleResegment = useCallback(async (imageId: string) => {
    setIsResegmenting(prev => ({ ...prev, [imageId]: true }));
    toast.info('Spouštím opětovnou segmentaci pomocí neuronové sítě ResUNet...');
    try {
      // Okamžitě aktualizujeme status obrázku na 'processing' v UI
      // Toto zajistí okamžitou zpětnou vazbu uživateli
      const updatedImages = images.map(img => {
        if (img.id === imageId) {
          return { ...img, segmentationStatus: 'processing' as ImageStatus };
        }
        return img;
      });
      onImagesChange(updatedImages);

      // Přidáme parametr model_type, aby bylo jasné, že chceme použít ResUNet
      // Důležité: Parametry musí být předány přímo, ne v objektu parameters
      await apiClient.post(`/images/segmentation/trigger-batch`, {
        imageIds: [imageId],
        priority: 5, // Vysoká priorita pro re-trigger
        model_type: 'resunet' // Explicitně specifikujeme model
      });
      toast.success('Úloha opětovné segmentace pomocí neuronové sítě byla úspěšně zařazena.');
    } catch (err: unknown) {
      let message = 'Failed to trigger re-segmentation';
      if (axios.isAxiosError(err)) {
        message = err.response?.data?.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      console.error("Error triggering re-segmentation via batch endpoint:", err);
      toast.error(message);

      // V případě chyby vrátíme status na původní
      const originalImages = images.map(img => {
        if (img.id === imageId && img.segmentationStatus === 'processing') {
          return { ...img, segmentationStatus: 'failed' as ImageStatus };
        }
        return img;
      });
      onImagesChange(originalImages);
    } finally {
      setIsResegmenting(prev => ({ ...prev, [imageId]: false }));
    }
  }, [images, onImagesChange]);

  return {
    handleDeleteImage,
    handleOpenSegmentationEditor,
    handleResegment,
    isDeleting,
    isResegmenting,
  };
};
