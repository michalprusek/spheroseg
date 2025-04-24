/* eslint-disable @typescript-eslint/naming-convention */

exports.shorthands = undefined;

exports.up = pgm => {
    // Enable UUID extension
    pgm.createExtension('uuid-ossp', { ifNotExists: true });

    // Create image_status enum type
    pgm.createType('image_status', ['pending', 'processing', 'completed', 'failed']);

    // Users table
    pgm.createTable('users', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        email: { type: 'varchar(255)', notNull: true, unique: true },
        password_hash: { type: 'varchar(255)', notNull: true },
        created_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamptz', default: pgm.func('current_timestamp') }
    });

    // User profiles table
    pgm.createTable('user_profiles', {
        user_id: { type: 'uuid', primaryKey: true, references: 'users(id)', onDelete: 'CASCADE' },
        username: { type: 'varchar(50)', unique: true },
        full_name: { type: 'varchar(100)' },
        title: { type: 'varchar(100)' },
        organization: { type: 'varchar(100)' },
        bio: { type: 'text' },
        location: { type: 'varchar(100)' },
        avatar_url: { type: 'varchar(255)' },
        preferred_language: { type: 'varchar(10)' },
        created_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamptz', default: pgm.func('current_timestamp') }
    });

    // Projects table
    pgm.createTable('projects', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
        title: { type: 'varchar(255)', notNull: true },
        description: { type: 'text' },
        created_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamptz', default: pgm.func('current_timestamp') }
    });
    pgm.createIndex('projects', 'user_id');

    // Images table
    pgm.createTable('images', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
        user_id: { type: 'uuid', notNull: true, references: 'users(id)' }, // Add reference constraint
        name: { type: 'varchar(255)', notNull: true },
        storage_path: { type: 'varchar(512)', notNull: true },
        thumbnail_path: { type: 'varchar(512)' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        metadata: { type: 'jsonb' },
        status: { type: 'image_status', default: 'pending' },
        created_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamptz', default: pgm.func('current_timestamp') }
    });
    pgm.createIndex('images', 'project_id');
    pgm.createIndex('images', 'user_id');

    // Segmentation results table
    pgm.createTable('segmentation_results', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        image_id: { type: 'uuid', notNull: true, unique: true, references: 'images(id)', onDelete: 'CASCADE' },
        result_data: { type: 'jsonb' },
        parameters: { type: 'jsonb' },
        status: { type: 'image_status', default: 'pending' },
        created_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamptz', default: pgm.func('current_timestamp') }
    });
    pgm.createIndex('segmentation_results', 'image_id');

    // Access requests table
    pgm.createTable('access_requests', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
        user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
        email: { type: 'varchar(255)', notNull: true },
        name: { type: 'varchar(100)' },
        organization: { type: 'varchar(100)' },
        reason: { type: 'text' },
        status: { type: 'varchar(20)', default: 'pending' },
        created_at: { type: 'timestamptz', default: pgm.func('current_timestamp') },
        updated_at: { type: 'timestamptz', default: pgm.func('current_timestamp') }
    });
    pgm.createIndex('access_requests', 'email');
    pgm.createIndex('access_requests', 'status');

    // Trigger function and triggers for updated_at
    pgm.createFunction(
        'update_updated_at_column', 
        [], 
        { returns: 'trigger', language: 'plpgsql' }, 
        `
BEGIN
   NEW.updated_at = NOW(); 
   RETURN NEW;
END;
`
    );
    const tables = ['users', 'user_profiles', 'projects', 'images', 'segmentation_results', 'access_requests'];
    tables.forEach(table => {
        pgm.createTrigger(table, `update_${table}_updated_at`, {
            when: 'BEFORE', 
            operation: 'UPDATE', 
            level: 'ROW', 
            function: 'update_updated_at_column'
        });
    });
};

exports.down = pgm => {
    const tables = ['access_requests', 'segmentation_results', 'images', 'projects', 'user_profiles', 'users'];
    tables.forEach(table => {
        // Drop trigger if exists (more robust)
        pgm.dropTrigger(table, `update_${table}_updated_at`, { ifExists: true });
        // Drop table if exists
        pgm.dropTable(table, { ifExists: true, cascade: true });
    });
    
    // Drop the trigger function
    pgm.dropFunction('update_updated_at_column', [], { ifExists: true });

    // Drop the enum type
    pgm.dropType('image_status', { ifExists: true });

    // Optional: Drop the extension if it's no longer needed by other parts of the DB
    // pgm.dropExtension('uuid-ossp', { ifExists: true });
}; 