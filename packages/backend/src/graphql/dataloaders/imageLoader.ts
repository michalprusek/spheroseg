import DataLoader from 'dataloader';
import { Pool } from 'pg';

export function createImageLoader(db: Pool) {
  return new DataLoader<string, any>(async (imageIds) => {
    const query = `
      SELECT i.*, 
             p.title as project_title,
             u.name as owner_name,
             u.email as owner_email
      FROM images i
      JOIN projects p ON i.project_id = p.id
      JOIN users u ON i.user_id = u.id
      WHERE i.id = ANY($1::uuid[])
    `;
    
    const result = await db.query(query, [imageIds]);
    
    // Create a map for O(1) lookup
    const imageMap = new Map();
    result.rows.forEach(image => {
      imageMap.set(image.id, image);
    });
    
    // Return images in the same order as requested
    return imageIds.map(id => imageMap.get(id) || null);
  });
}