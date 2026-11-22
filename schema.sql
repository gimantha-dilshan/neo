-- ==========================================
-- Neo WhatsApp AI Bot - Supabase Schema
-- ==========================================

-- 1. Create the messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    jid TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'model', 'ai')),
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Create index on JID and ID for ultra-fast history lookups
CREATE INDEX IF NOT EXISTS idx_messages_jid_id ON public.messages (jid, id DESC);

-- 3. Configure Row Level Security (RLS)
-- If you use service_role key, it bypasses RLS automatically.
-- The policies below ensure both anon and service_role can read/write.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on messages"
    ON public.messages
    FOR SELECT
    USING (true);

CREATE POLICY "Allow insert on messages"
    ON public.messages
    FOR INSERT
    WITH CHECK (true);

