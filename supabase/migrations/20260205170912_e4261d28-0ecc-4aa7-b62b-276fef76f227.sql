-- Add document column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN document TEXT;

-- Create unique index for document (allows null, but unique when present)
CREATE UNIQUE INDEX idx_profiles_document_unique ON public.profiles(document) WHERE document IS NOT NULL;

-- Create index for fast lookups
CREATE INDEX idx_profiles_document ON public.profiles(document);

-- Update handle_new_user function to include document
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, document)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'document'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;