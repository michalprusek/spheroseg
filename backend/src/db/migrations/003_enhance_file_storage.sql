-- Up migration: Enhances file storage with metadata and organization
BEGIN;

-- Add additional metadata fields to files table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'mimetype') THEN
        ALTER TABLE files ADD COLUMN mimetype VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'original_name') THEN
        ALTER TABLE files ADD COLUMN original_name VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'description') THEN
        ALTER TABLE files ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'is_public') THEN
        ALTER TABLE files ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'storage_path') THEN
        ALTER TABLE files ADD COLUMN storage_path VARCHAR(512) NOT NULL DEFAULT '';
    END IF;
END $$;

-- Create index for faster file listing
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_category_id ON files(category_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

-- Record this migration
INSERT INTO migrations (name) VALUES ('003_enhance_file_storage.sql');

COMMIT;

-- Down migration: Removes added schema
BEGIN;

ALTER TABLE files
DROP COLUMN IF EXISTS mimetype,
DROP COLUMN IF EXISTS original_name,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS is_public,
DROP COLUMN IF EXISTS storage_path;

DROP INDEX IF EXISTS idx_files_user_id;
DROP INDEX IF EXISTS idx_files_category_id;
DROP INDEX IF EXISTS idx_files_created_at;

COMMIT;