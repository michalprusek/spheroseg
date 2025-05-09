-- Add project_shares table for project sharing functionality

-- Create table for project shares
CREATE TABLE IF NOT EXISTS project_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id), -- Project owner who initiated the share
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Shared with user (NULL if pending invitation)
    email VARCHAR(255) NOT NULL, -- Email address for invitation/identification
    permission VARCHAR(20) NOT NULL DEFAULT 'view', -- Permission level: 'view', 'edit', etc.
    invitation_token VARCHAR(255), -- Token for invitation links (NULL once accepted)
    invitation_expires_at TIMESTAMPTZ, -- Expiration time for invitation (NULL once accepted)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint to prevent duplicate shares
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_shares_unique 
ON project_shares(project_id, email) 
WHERE invitation_token IS NULL; -- Only enforce uniqueness for accepted invitations

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_user_id ON project_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_email ON project_shares(email);
CREATE INDEX IF NOT EXISTS idx_project_shares_invitation_token ON project_shares(invitation_token) 
WHERE invitation_token IS NOT NULL;

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_project_shares_updated_at ON project_shares;
CREATE TRIGGER update_project_shares_updated_at BEFORE UPDATE
ON project_shares FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for easier querying of shared projects
CREATE OR REPLACE VIEW user_shared_projects AS
SELECT 
    p.*,
    ps.permission,
    ps.user_id AS shared_with_user_id,
    u.email AS owner_email,
    u.name AS owner_name
FROM 
    projects p
JOIN 
    project_shares ps ON p.id = ps.project_id
JOIN 
    users u ON p.user_id = u.id
WHERE 
    ps.invitation_token IS NULL; -- Only accepted invitations