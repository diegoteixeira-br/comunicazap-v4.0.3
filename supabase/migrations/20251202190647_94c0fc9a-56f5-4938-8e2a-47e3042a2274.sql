-- Criar tabela para templates personalizados dos usuários
CREATE TABLE public.user_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'personalizado',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (cada usuário vê apenas seus templates)
CREATE POLICY "Users can view own templates" 
  ON public.user_templates FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" 
  ON public.user_templates FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" 
  ON public.user_templates FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" 
  ON public.user_templates FOR DELETE 
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_templates_updated_at
  BEFORE UPDATE ON public.user_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();