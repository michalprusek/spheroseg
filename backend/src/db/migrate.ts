import path from 'path';
import fs from 'fs/promises';
import { query } from './connection';
import { config } from '@config/app';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface Migration {
  name: string;
  up: string;
  down: string;
}

async function getMigrationFiles(): Promise<string[]> {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files
    .filter(file => file.endsWith('.sql'))
    .sort();
}

async function parseMigration(file: string): Promise<Migration> {
  const content = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
  const parts = content.split('-- Down migration:');
  
  return {
    name: file,
    up: parts[0].trim(),
    down: parts[1] ? parts[1].trim() : ''
  };
}

async function getExecutedMigrations(): Promise<string[]> {
  try {
    const result = await query<{name: string}>('SELECT name FROM migrations ORDER BY id');
    return result.map(row => row.name);
  } catch (error) {
    // If migrations table doesn't exist yet, return empty array
    if ((error as Error).message.includes('relation "migrations" does not exist')) {
      return [];
    }
    throw error;
  }
}

async function runMigration(migration: Migration): Promise<void> {
  console.log(`Running migration: ${migration.name}`);
  await query(migration.up);
}

async function runMigrations(): Promise<void> {
  console.log('Starting database migrations...');
  
  const migrationFiles = await getMigrationFiles();
  const executedMigrations = await getExecutedMigrations();
  
  for (const file of migrationFiles) {
    if (!executedMigrations.includes(file)) {
      const migration = await parseMigration(file);
      await runMigration(migration);
    }
  }
  
  console.log('Database migrations completed successfully');
}

async function main() {
  try {
    await runMigrations();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runMigrations };