const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/spheroseg'
});

async function createUser() {
  try {
    const hashedPassword = await bcrypt.hash('Test123456!', 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (email) DO UPDATE SET password = $3 RETURNING *',
      ['test', 'test@example.com', hashedPassword]
    );
    console.log('User created/updated:', result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createUser();