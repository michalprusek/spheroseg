const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/spheroseg'
});

async function fixStuckQueuedImages() {
  try {
    // Find all images with 'queued' status that have old incomplete tasks
    const stuckImages = await pool.query(`
      SELECT DISTINCT i.id, i.name, i.segmentation_status, i.project_id, i.updated_at,
             st.id as task_id, st.status as task_status, st.created_at as task_created
      FROM images i
      LEFT JOIN segmentation_tasks st ON i.id = st.image_id
      WHERE i.segmentation_status = 'queued'
      AND (
        (st.status = 'processing' AND st.created_at < NOW() - INTERVAL '1 hour')
        OR st.id IS NULL
      )
      ORDER BY i.updated_at DESC
    `);
    
    console.log(`\n=== Found ${stuckImages.rows.length} stuck images ===`);
    console.table(stuckImages.rows);
    
    if (stuckImages.rows.length === 0) {
      console.log('No stuck images found!');
      return;
    }
    
    // Ask for confirmation
    console.log('\nThese images appear to be stuck. Would you like to:');
    console.log('1. Reset them to "without_segmentation" status');
    console.log('2. Create new segmentation tasks for them');
    console.log('3. Do nothing (exit)');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Enter your choice (1-3): ', async (choice) => {
      switch (choice) {
        case '1':
          await resetToWithoutSegmentation(stuckImages.rows);
          break;
        case '2':
          await createNewTasks(stuckImages.rows);
          break;
        default:
          console.log('Exiting without changes.');
      }
      
      readline.close();
      await pool.end();
    });
    
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

async function resetToWithoutSegmentation(images) {
  console.log('\n=== Resetting images to "without_segmentation" ===');
  
  for (const image of images) {
    try {
      // Update image status
      await pool.query(
        "UPDATE images SET segmentation_status = 'without_segmentation', updated_at = NOW() WHERE id = $1",
        [image.id]
      );
      
      // Delete any existing segmentation results
      await pool.query(
        "DELETE FROM segmentation_results WHERE image_id = $1",
        [image.id]
      );
      
      // Mark any existing tasks as failed
      if (image.task_id) {
        await pool.query(
          "UPDATE segmentation_tasks SET status = 'failed'::task_status, error = 'Task stuck in processing', updated_at = NOW() WHERE id = $1",
          [image.task_id]
        );
      }
      
      console.log(`✅ Reset ${image.name} (${image.id})`);
      
    } catch (error) {
      console.error(`❌ Failed to reset ${image.name}:`, error.message);
    }
  }
  
  console.log('\nDone! Images have been reset. You can now trigger new segmentation tasks.');
}

async function createNewTasks(images) {
  console.log('\n=== Creating new segmentation tasks ===');
  
  for (const image of images) {
    try {
      // First, mark any old tasks as failed
      if (image.task_id) {
        await pool.query(
          "UPDATE segmentation_tasks SET status = 'failed'::task_status, error = 'Task stuck in processing', updated_at = NOW() WHERE id = $1",
          [image.task_id]
        );
      }
      
      // Get image path
      const imageData = await pool.query(
        'SELECT storage_path FROM images WHERE id = $1',
        [image.id]
      );
      
      if (imageData.rows.length === 0) {
        console.error(`❌ Could not find storage path for ${image.name}`);
        continue;
      }
      
      const imagePath = imageData.rows[0].storage_path;
      
      // Create new task
      const taskId = require('crypto').randomBytes(16).toString('hex');
      await pool.query(
        `INSERT INTO segmentation_tasks 
         (id, image_id, image_path, parameters, priority, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'queued', NOW(), NOW())`,
        [taskId, image.id, imagePath, {model_type: 'resunet'}, 5]
      );
      
      // Update segmentation_results
      await pool.query(
        `INSERT INTO segmentation_results (image_id, status, created_at, updated_at) 
         VALUES ($1, 'queued', NOW(), NOW())
         ON CONFLICT (image_id) 
         DO UPDATE SET status = 'queued', updated_at = NOW()`,
        [image.id]
      );
      
      console.log(`✅ Created new task ${taskId} for ${image.name}`);
      
    } catch (error) {
      console.error(`❌ Failed to create task for ${image.name}:`, error.message);
    }
  }
  
  console.log('\nDone! New tasks have been created. The ML service should pick them up soon.');
  console.log('You can check the status with: docker-compose logs -f ml');
}

// Run the fix
fixStuckQueuedImages();