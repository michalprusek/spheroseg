const fs = require('fs');
const path = require('path');

/**
 * @param {import('pg').Pool} db - PostgreSQL connection pool
 */
async function up(db) {
  const sqlPath = path.join(__dirname, 'add-project-shares-table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Running migration: add project shares table');
  await db.query(sql);
  console.log('Successfully added project_shares table');
}

/**
 * @param {import('pg').Pool} db - PostgreSQL connection pool
 */
async function down(db) {
  console.log('Rolling back migration: drop project shares table');
  
  // Drop the view first
  await db.query('DROP VIEW IF EXISTS user_shared_projects');
  
  // Drop the table with cascade to remove dependent objects
  await db.query('DROP TABLE IF EXISTS project_shares CASCADE');
  
  console.log('Successfully dropped project_shares table');
}

module.exports = {
  up,
  down
};