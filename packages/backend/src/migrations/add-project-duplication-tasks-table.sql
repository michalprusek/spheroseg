-- Add project_duplication_tasks table for asynchronous project duplication

-- First check if we already have the task_status enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    END IF;
END$$;

-- Create table for project duplication tasks
CREATE TABLE IF NOT EXISTS project_duplication_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    new_project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Will be NULL until project is created
    status task_status DEFAULT 'pending',
    options JSONB DEFAULT '{}',
    progress INTEGER DEFAULT 0, -- Progress percentage (0-100)
    total_items INTEGER DEFAULT 0, -- Total number of items to be processed
    processed_items INTEGER DEFAULT 0, -- Number of items processed so far
    error_message TEXT, -- Error message if the task failed
    result JSONB, -- Result data (e.g., new project details)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_duplication_tasks_user_id ON project_duplication_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_project_duplication_tasks_original_project_id ON project_duplication_tasks(original_project_id);
CREATE INDEX IF NOT EXISTS idx_project_duplication_tasks_new_project_id ON project_duplication_tasks(new_project_id);
CREATE INDEX IF NOT EXISTS idx_project_duplication_tasks_status ON project_duplication_tasks(status);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_project_duplication_tasks_updated_at ON project_duplication_tasks;
CREATE TRIGGER update_project_duplication_tasks_updated_at BEFORE UPDATE
ON project_duplication_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();