import DataLoader from 'dataloader';
import { Pool } from 'pg';

export function createSegmentationLoader(db: Pool) {
  return new DataLoader<string, any>(async (imageIds) => {
    const query = `
      SELECT sr.*, c.feature_data
      FROM segmentation_results sr
      LEFT JOIN (
        SELECT segmentation_result_id, 
               json_agg(feature_data) as feature_data
        FROM cells
        GROUP BY segmentation_result_id
      ) c ON sr.id = c.segmentation_result_id
      WHERE sr.image_id = ANY($1::uuid[])
    `;
    
    const result = await db.query(query, [imageIds]);
    
    // Create a map for O(1) lookup by image_id
    const segmentationMap = new Map();
    result.rows.forEach(segmentation => {
      segmentationMap.set(segmentation.image_id, segmentation);
    });
    
    // Return segmentations in the same order as requested image IDs
    return imageIds.map(id => segmentationMap.get(id) || null);
  });
}