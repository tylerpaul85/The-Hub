-- Add post_type column to content_items
ALTER TABLE public.content_items 
ADD COLUMN post_type text NOT NULL DEFAULT 'post';

-- Allow any authenticated user to select/insert/update this column
-- (Permissions are already granted on the table level, but for clarity, no extra GRANT is needed here)
