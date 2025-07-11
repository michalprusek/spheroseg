const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/spheroseg'
});

async function checkStuckImages() {
  try {
    // Find all images with 'queued' status
    const queuedImages = await pool.query(`
      SELECT i.id, i.name, i.segmentation_status, i.project_id, i.updated_at
      FROM images i
      WHERE i.segmentation_status = 'queued'
      ORDER BY i.updated_at DESC
    `);
    
    console.log(`\n=== Found ${queuedImages.rows.length} images with 'queued' status ===`);
    console.table(queuedImages.rows);
    
    // For each queued image, check all related tables
    for (const image of queuedImages.rows) {
      console.log(`\n=== Checking image: ${image.name} (${image.id}) ===`);
      
      // Check segmentation_results
      const results = await pool.query(
        'SELECT status, created_at, updated_at FROM segmentation_results WHERE image_id = $1',
        [image.id]
      );
      console.log('Segmentation Results:', results.rows[0] || 'No record');
      
      // Check segmentation_tasks
      const tasks = await pool.query(
        `SELECT id, status, created_at, started_at, completed_at 
         FROM segmentation_tasks 
         WHERE image_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [image.id]
      );
      console.log('Recent Segmentation Tasks:');
      if (tasks.rows.length > 0) {
        console.table(tasks.rows);
      } else {
        console.log('No tasks found');
      }
      
      // Check segmentation_queue
      const queue = await pool.query(
        'SELECT task_id, status, priority, created_at FROM segmentation_queue WHERE image_id = $1',
        [image.id]
      );
      console.log('Segmentation Queue:', queue.rows[0] || 'No record');
    }
    
    // Check if RabbitMQ has any messages
    console.log('\n=== Checking RabbitMQ Status ===');
    const { exec } = require('child_process');
    exec('docker-compose exec rabbitmq rabbitmqctl list_queues name messages', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking RabbitMQ:', error);
        return;
      }
      console.log('RabbitMQ Queue Status:');
      console.log(stdout);
    });
    
    // Check ML service status
    console.log('\n=== Checking ML Service ===');
    exec('docker-compose ps ml', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking ML service:', error);
        return;
      }
      console.log('ML Service Status:');
      console.log(stdout);
    });
    
    // Check recent ML service logs
    exec('docker-compose logs --tail=20 ml | grep -E "(ERROR|WARNING|Received task|completed|failed)"', (error, stdout, stderr) => {
      if (error && error.code !== 1) { // grep returns 1 if no matches
        console.error('Error checking ML logs:', error);
        return;
      }
      console.log('\nRecent ML Service Activity:');
      console.log(stdout || 'No recent activity found');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Don't close pool to allow async exec commands to complete
    setTimeout(() => pool.end(), 5000);
  }
}

checkStuckImages();