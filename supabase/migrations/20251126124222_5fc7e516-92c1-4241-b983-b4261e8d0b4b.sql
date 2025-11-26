-- Create daily_send_limits table to track message sending limits
CREATE TABLE IF NOT EXISTS public.daily_send_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_send_limits ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_send_limits
CREATE POLICY "Users can view own daily limits"
  ON public.daily_send_limits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily limits"
  ON public.daily_send_limits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily limits"
  ON public.daily_send_limits
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to get or create today's limit
CREATE OR REPLACE FUNCTION public.get_daily_limit(p_user_id UUID)
RETURNS TABLE (
  messages_sent INTEGER,
  limit_value INTEGER,
  remaining INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert if not exists (atomic operation)
  INSERT INTO public.daily_send_limits (user_id, date, messages_sent, limit_value)
  VALUES (p_user_id, CURRENT_DATE, 0, 50)
  ON CONFLICT (user_id, date) DO NOTHING;
  
  -- Return current stats
  RETURN QUERY
  SELECT 
    dl.messages_sent,
    dl.limit_value,
    GREATEST(0, dl.limit_value - dl.messages_sent) as remaining
  FROM public.daily_send_limits dl
  WHERE dl.user_id = p_user_id 
    AND dl.date = CURRENT_DATE;
END;
$$;

-- Function to increment daily sent count
CREATE OR REPLACE FUNCTION public.increment_daily_sent(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert if not exists
  INSERT INTO public.daily_send_limits (user_id, date, messages_sent, limit_value)
  VALUES (p_user_id, CURRENT_DATE, p_count, 50)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    messages_sent = daily_send_limits.messages_sent + p_count,
    updated_at = NOW();
END;
$$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_daily_send_limits_user_date 
  ON public.daily_send_limits(user_id, date);

-- Add trigger to update updated_at
CREATE TRIGGER update_daily_send_limits_updated_at
  BEFORE UPDATE ON public.daily_send_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();