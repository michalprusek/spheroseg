import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Error: DATABASE_URL environment variable is not set.");
  process.exit(1); // Exit if database URL is not configured
}

const pool = new Pool({
  connectionString: databaseUrl,
  // Optional: Add SSL configuration for production environments
  // ssl: {
  //   rejectUnauthorized: false // Adjust based on your certificate setup
  // }
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool; 