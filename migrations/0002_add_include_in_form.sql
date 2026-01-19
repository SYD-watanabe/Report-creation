-- Add include_in_form column to template_fields table
ALTER TABLE template_fields ADD COLUMN include_in_form INTEGER DEFAULT 1;

-- Update existing records to include all fields by default
UPDATE template_fields SET include_in_form = 1;
