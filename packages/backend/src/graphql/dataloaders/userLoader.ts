import DataLoader from 'dataloader';
import { Pool } from 'pg';

export function createUserLoader(db: Pool) {
  return new DataLoader<string, any>(async (userIds) => {
    const query = `
      SELECT * FROM users 
      WHERE id = ANY($1::uuid[])
    `;
    
    const result = await db.query(query, [userIds]);
    
    // Create a map for O(1) lookup
    const userMap = new Map();
    result.rows.forEach(user => {
      userMap.set(user.id, user);
    });
    
    // Return users in the same order as requested
    return userIds.map(id => userMap.get(id) || null);
  });
}