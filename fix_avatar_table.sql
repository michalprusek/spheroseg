-- Add missing columns to avatar_files table
ALTER TABLE avatar_files 
ADD COLUMN id UUID DEFAULT gen_random_uuid() NOT NULL,
ADD COLUMN original_name VARCHAR(255),
ADD COLUMN mime_type VARCHAR(100),
ADD COLUMN file_size INTEGER,
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Remove old primary key and add new one
ALTER TABLE avatar_files DROP CONSTRAINT avatar_files_pkey;
ALTER TABLE avatar_files ADD PRIMARY KEY (id);

-- Add unique constraint on user_id
ALTER TABLE avatar_files ADD CONSTRAINT avatar_files_user_id_unique UNIQUE (user_id);