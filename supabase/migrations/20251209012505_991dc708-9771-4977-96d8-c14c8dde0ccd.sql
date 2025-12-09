-- Remover constraint antiga
ALTER TABLE public.message_campaigns 
DROP CONSTRAINT IF EXISTS message_campaigns_status_check;

-- Criar nova constraint com todos os status permitidos
ALTER TABLE public.message_campaigns 
ADD CONSTRAINT message_campaigns_status_check 
CHECK (status = ANY (ARRAY['pending', 'in_progress', 'completed', 'failed', 'paused', 'cancelled']));