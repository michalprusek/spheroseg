-- Add the annotations_object_name column to the segmentations table
ALTER TABLE segmentations ADD COLUMN IF NOT EXISTS annotations_object_name VARCHAR;

-- Create a temporary function for safely adding enum values
DO $$
BEGIN
    -- Check if the 'segmented' value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'segmented' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'segmentationstatus'
        )
    ) THEN
        -- Add the new enum value
        ALTER TYPE segmentationstatus ADD VALUE 'segmented';
    END IF;
END
$$;
