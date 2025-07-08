// Change to the backend directory first
process.chdir(__dirname);

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/spheroseg',
});

async function updateTestUserPassword() {
  const client = await pool.connect();
  try {
    const hashedPassword = await bcrypt.hash('testuser123', 10);
    const result = await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email',
      [hashedPassword, 'testuser@test.com']
    );
    
    if (result.rows.length > 0) {
      console.log('Password updated successfully for:', result.rows[0].email);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateTestUserPassword();