import { runMigrations } from './migrate';
import { connectToDatabase } from './connection';

export async function setupDatabase(): Promise<void> {
  try {
    // First connect to the database
    await connectToDatabase();
    
    // Then run migrations
    await runMigrations();
    
    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  }
}
