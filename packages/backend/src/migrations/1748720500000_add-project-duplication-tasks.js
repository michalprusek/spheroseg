/**
 * Migration to add project duplication tasks table
 * 
 * This migration adds a new table to track project duplication status
 * and support asynchronous processing of large projects.
 */

exports.up = async (pgm) => {
  // Create project duplication tasks table
  pgm.createTable('project_duplication_tasks', {
    id: { type: 'uuid', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    original_project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'SET NULL' },
    new_project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'SET NULL' },
    status: { 
      type: 'text', 
      notNull: true, 
      default: 'pending',
      check: "status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')" 
    },
    progress: { type: 'integer', default: 0 },
    processed_items: { type: 'integer', default: 0 },
    total_items: { type: 'integer', default: 0 },
    options: { type: 'jsonb', default: '{}' },
    error_message: { type: 'text' },
    result: { type: 'jsonb' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') }
  });

  // Add indexes for faster lookups
  pgm.createIndex('project_duplication_tasks', 'user_id');
  pgm.createIndex('project_duplication_tasks', 'original_project_id');
  pgm.createIndex('project_duplication_tasks', 'new_project_id');
  pgm.createIndex('project_duplication_tasks', 'status');
  pgm.createIndex('project_duplication_tasks', ['user_id', 'status']);

  // Create a function to update the updated_at timestamp
  pgm.createFunction(
    'update_updated_at_column',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
    },
    `
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    `
  );

  // Create a trigger to update the updated_at column on update
  pgm.createTrigger(
    'project_duplication_tasks',
    'update_updated_at_timestamp',
    {
      when: 'BEFORE',
      operation: 'UPDATE',
      level: 'ROW',
      function: 'update_updated_at_column',
    }
  );
};

exports.down = async (pgm) => {
  // Drop the trigger
  pgm.dropTrigger('project_duplication_tasks', 'update_updated_at_timestamp', { ifExists: true });
  
  // Drop the table (which will cascade to indexes)
  pgm.dropTable('project_duplication_tasks', { ifExists: true, cascade: true });
};