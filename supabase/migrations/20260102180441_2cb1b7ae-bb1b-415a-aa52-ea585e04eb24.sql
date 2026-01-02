-- Add 'blocked' status to message_campaigns
-- First drop the existing constraint if it exists
ALTER TABLE public.message_campaigns DROP CONSTRAINT IF EXISTS message_campaigns_status_check;

-- Add new constraint with 'blocked' status
ALTER TABLE public.message_campaigns 
ADD CONSTRAINT message_campaigns_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'paused', 'scheduled', 'blocked'));