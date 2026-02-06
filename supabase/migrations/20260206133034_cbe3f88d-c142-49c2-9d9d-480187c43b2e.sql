-- =============================================
-- SISTEMA DE INDICAÇÃO (REFERRAL) - MIGRAÇÃO
-- =============================================

-- 1. Adicionar campos de referral na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- 2. Criar tabela de indicações
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  referrer_bonus_applied BOOLEAN NOT NULL DEFAULT false,
  referred_bonus_applied BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(referred_user_id) -- Um usuário só pode ser indicado uma vez
);

-- 3. Habilitar RLS na tabela referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para referrals
-- Usuários podem ver indicações onde são o referrer OU o referred
CREATE POLICY "Users can view own referrals as referrer"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users can view own referrals as referred"
ON public.referrals FOR SELECT
USING (auth.uid() = referred_user_id);

-- Apenas o sistema pode inserir/atualizar (via SECURITY DEFINER functions)
CREATE POLICY "System can insert referrals"
ON public.referrals FOR INSERT
WITH CHECK (false);

CREATE POLICY "System can update referrals"
ON public.referrals FOR UPDATE
USING (false);

-- 5. Função para gerar código de referral único (6 caracteres alfanuméricos)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Gerar código de 6 caracteres (A-Z, 0-9)
    new_code := upper(substr(md5(random()::text), 1, 6));
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
    
    -- Sair do loop se o código for único
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- 6. Função para criar referral quando usuário se cadastra com código
CREATE OR REPLACE FUNCTION public.create_referral_on_signup(
  p_referred_user_id UUID,
  p_referral_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_user_id UUID;
BEGIN
  -- Buscar o usuário que possui este código de indicação
  SELECT id INTO v_referrer_user_id
  FROM profiles
  WHERE referral_code = p_referral_code;
  
  -- Se não encontrou o referrer, retorna false
  IF v_referrer_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Não permitir auto-indicação
  IF v_referrer_user_id = p_referred_user_id THEN
    RETURN false;
  END IF;
  
  -- Verificar se o usuário já foi indicado
  IF EXISTS(SELECT 1 FROM referrals WHERE referred_user_id = p_referred_user_id) THEN
    RETURN false;
  END IF;
  
  -- Criar o registro de indicação
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer_user_id, p_referred_user_id, p_referral_code, 'pending');
  
  -- Atualizar o referred_by_code no perfil do indicado
  UPDATE profiles
  SET referred_by_code = p_referral_code
  WHERE id = p_referred_user_id;
  
  RETURN true;
END;
$$;

-- 7. Função para aplicar bonus de referral (+30 dias)
CREATE OR REPLACE FUNCTION public.apply_referral_bonus(
  p_referred_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_referrer_user_id UUID;
  v_result JSONB;
BEGIN
  -- Buscar o referral pendente para este usuário
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_user_id = p_referred_user_id
    AND status IN ('pending', 'completed')
    AND (referrer_bonus_applied = false OR referred_bonus_applied = false);
  
  -- Se não encontrou referral elegível
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_eligible_referral');
  END IF;
  
  v_referrer_user_id := v_referral.referrer_user_id;
  
  -- Aplicar bonus ao INDICADO (+30 dias)
  IF NOT v_referral.referred_bonus_applied THEN
    UPDATE user_subscriptions
    SET current_period_end = COALESCE(current_period_end, now()) + INTERVAL '30 days',
        updated_at = now()
    WHERE user_id = p_referred_user_id;
    
    UPDATE referrals
    SET referred_bonus_applied = true
    WHERE id = v_referral.id;
  END IF;
  
  -- Aplicar bonus ao INDICADOR (+30 dias)
  IF NOT v_referral.referrer_bonus_applied THEN
    UPDATE user_subscriptions
    SET current_period_end = COALESCE(current_period_end, now()) + INTERVAL '30 days',
        updated_at = now()
    WHERE user_id = v_referrer_user_id;
    
    UPDATE referrals
    SET referrer_bonus_applied = true
    WHERE id = v_referral.id;
  END IF;
  
  -- Marcar referral como recompensado
  UPDATE referrals
  SET status = 'rewarded',
      completed_at = now()
  WHERE id = v_referral.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_user_id', v_referrer_user_id,
    'referred_user_id', p_referred_user_id,
    'bonus_days', 30
  );
END;
$$;

-- 8. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_code ON public.profiles(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);