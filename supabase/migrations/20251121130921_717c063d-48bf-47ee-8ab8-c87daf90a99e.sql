-- Criar tabela de logs de ações administrativas
CREATE TABLE public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX idx_admin_action_logs_admin_user_id ON public.admin_action_logs(admin_user_id);
CREATE INDEX idx_admin_action_logs_created_at ON public.admin_action_logs(created_at DESC);
CREATE INDEX idx_admin_action_logs_action_type ON public.admin_action_logs(action_type);

-- Habilitar RLS
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar os logs
CREATE POLICY "Admins can view all action logs"
ON public.admin_action_logs
FOR SELECT
USING (public.is_admin());

-- Apenas admins podem inserir logs (via edge functions)
CREATE POLICY "Admins can insert action logs"
ON public.admin_action_logs
FOR INSERT
WITH CHECK (public.is_admin());

-- Comentários para documentação
COMMENT ON TABLE public.admin_action_logs IS 'Registra todas as ações administrativas para auditoria';
COMMENT ON COLUMN public.admin_action_logs.action_type IS 'Tipo de ação: view_support_chat, manage_role, etc';
COMMENT ON COLUMN public.admin_action_logs.details IS 'Detalhes adicionais da ação em formato JSON';