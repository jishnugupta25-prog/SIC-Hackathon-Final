-- Add reference_number column to crime_reports table
ALTER TABLE crime_reports ADD COLUMN IF NOT EXISTS reference_number VARCHAR(10) UNIQUE NOT NULL DEFAULT '';

-- Update existing records with generated reference numbers
UPDATE crime_reports SET reference_number = LPAD(id::text, 10, '0') WHERE reference_number = '';

-- Remove the default after migration
ALTER TABLE crime_reports ALTER COLUMN reference_number DROP DEFAULT;
