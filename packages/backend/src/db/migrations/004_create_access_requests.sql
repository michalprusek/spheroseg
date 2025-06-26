-- Create access_requests table for handling access requests
CREATE TABLE IF NOT EXISTS access_requests (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id)
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

-- Add comment
COMMENT ON TABLE access_requests IS 'Stores user access requests for the application';