-- ============================================
-- WHATSAPP AUTH PERSISTENCE TABLE
-- Execute this in Supabase SQL Editor
-- ============================================

-- Create table for storing WhatsApp session
CREATE TABLE IF NOT EXISTS public.whatsapp_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL DEFAULT 'main',
  auth_state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_session_id ON public.whatsapp_auth(session_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.whatsapp_auth ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role has full access to whatsapp_auth"
  ON public.whatsapp_auth
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_auth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_whatsapp_auth_timestamp
  BEFORE UPDATE ON public.whatsapp_auth
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_auth_updated_at();

-- Grant permissions
GRANT ALL ON public.whatsapp_auth TO service_role;
