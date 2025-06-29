const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'spheroseg',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function updatePassword() {
  const client = await pool.connect();
  try {
    const hashedPassword = await bcrypt.hash('test123', 10);
    await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [hashedPassword, 'dev@example.com']
    );
    console.log('Password updated successfully for dev@example.com');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

updatePassword();