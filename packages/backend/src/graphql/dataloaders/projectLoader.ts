import DataLoader from 'dataloader';
import { Pool } from 'pg';

export function createProjectLoader(db: Pool) {
  return new DataLoader<string, any>(async (projectIds) => {
    const query = `
      SELECT p.*, u.name as owner_name, u.email as owner_email
      FROM projects p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ANY($1::uuid[])
    `;
    
    const result = await db.query(query, [projectIds]);
    
    // Create a map for O(1) lookup
    const projectMap = new Map();
    result.rows.forEach(project => {
      projectMap.set(project.id, project);
    });
    
    // Return projects in the same order as requested
    return projectIds.map(id => projectMap.get(id) || null);
  });
}