-- Fix project_shares table for email invitations
-- Make user_id nullable for pending invitations
ALTER TABLE project_shares 
ALTER COLUMN user_id DROP NOT NULL;

-- Add invitation_expires_at column if it doesn't exist
ALTER TABLE project_shares 
ADD COLUMN IF NOT EXISTS invitation_expires_at timestamp with time zone;

-- Update the unique constraint to allow multiple NULL user_ids
ALTER TABLE project_shares DROP CONSTRAINT IF EXISTS project_shares_project_id_user_id_key;

-- Create a partial unique index that only applies when user_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS project_shares_project_id_user_id_unique 
ON project_shares (project_id, user_id) 
WHERE user_id IS NOT NULL;

-- Create index for invitation token lookups
CREATE INDEX IF NOT EXISTS idx_project_shares_invitation_token 
ON project_shares (invitation_token) 
WHERE invitation_token IS NOT NULL;

-- Update the updated_at trigger to handle updates
CREATE OR REPLACE FUNCTION update_project_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_shares_updated_at ON project_shares;
CREATE TRIGGER update_project_shares_updated_at
BEFORE UPDATE ON project_shares
FOR EACH ROW
EXECUTE FUNCTION update_project_shares_updated_at();