import apiClient from '@/lib/apiClient';
import type { ProjectImage, SegmentationResult } from '@/pages/segmentation/types';

/**
 * Batch fetch segmentations for all images in a project.
 * Returns a mapping from imageId to SegmentationResult (or null if missing).
 */
export async function fetchAllSegmentationsForImages(images: ProjectImage[]): Promise<Record<string, SegmentationResult | null>> {
  const results: Record<string, SegmentationResult | null> = {};

  // TODO: If backend supports batch endpoint, use it here for efficiency
  // For now, fetch each segmentation individually in parallel
  await Promise.all(
    images.map(async (img) => {
      try {
        const res = await apiClient.get(`/images/${img.id}/segmentation`);
        results[img.id] = res.data as SegmentationResult;
      } catch (err: any) {
        // If not found (404), treat as no segmentation
        if (err.response && err.response.status === 404) {
          results[img.id] = null;
        } else {
          // Log and propagate other errors
          console.error(`Error fetching segmentation for image ${img.id}:`, err);
          results[img.id] = null;
        }
      }
    })
  );
  return results;
}
