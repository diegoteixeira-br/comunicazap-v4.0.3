-- Criar tabela para histórico de chat de suporte
CREATE TABLE public.support_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

-- Política para usuários visualizarem suas próprias mensagens
CREATE POLICY "Users can view own chat messages"
  ON public.support_chat_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política para usuários inserirem suas próprias mensagens
CREATE POLICY "Users can insert own chat messages"
  ON public.support_chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Índice para melhorar performance nas consultas
CREATE INDEX idx_support_chat_messages_user_id_created_at 
  ON public.support_chat_messages(user_id, created_at DESC);