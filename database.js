import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const isSupabaseConfigured =
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your_project_url');

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// In-memory fallback if Supabase is not configured or fails
const inMemoryHistory = new Map();
// Cache for mapping JID -> PushName (display name)
export const knownUsers = new Map();

// Group message buffer: chatJid -> array of { senderJid, senderName, text, timestamp }
const groupBuffers = new Map();

/**
 * Records a message sent in a group chat for contextual awareness
 */
export function recordGroupMessage(chatJid, senderJid, senderName, text) {
    if (!chatJid || !text) return;
    if (!groupBuffers.has(chatJid)) {
        groupBuffers.set(chatJid, []);
    }
    const buf = groupBuffers.get(chatJid);
    buf.push({
        senderJid,
        senderName: senderName || "Member",
        text,
        timestamp: Date.now()
    });
    if (buf.length > 25) buf.shift(); // keep last 25 group messages
}

/**
 * Gets recent messages sent in a group chat
 */
export function getRecentGroupMessages(chatJid, count = 10) {
    const buf = groupBuffers.get(chatJid) || [];
    return buf.slice(-count);
}

/**
 * Records a user's display name
 */
export async function recordUser(jid, name) {
    if (!jid || !name) return;
    knownUsers.set(jid, name);
    if (supabase) {
        try {
            await supabase.from('users').upsert([{ jid, name }], { onConflict: 'jid' });
        } catch (e) {
            // Silently fall back to in-memory map
        }
    }
}

/**
 * Gets a user's display name if known
 */
export function getUserName(jid) {
    return knownUsers.get(jid) || null;
}

/**
 * Gets the most recent user messages sent by a specific user
 */
export async function getRecentUserMessages(jid, count = 3) {
    const history = await getChatHistory(jid, count * 2);
    return history
        .filter(m => m.role === 'user')
        .slice(-count)
        .map(m => m.parts.map(p => p.text).join(' '));
}

/**
 * Initializes database connection check
 */
export async function initDB() {
    if (!supabase) {
        console.log('[DATABASE] Supabase not configured. Using in-memory conversation memory.');
        return;
    }

    try {
        const { error } = await supabase.from('messages').select('id').limit(1);
        if (error) throw error;
        console.log('[DATABASE] Successfully connected to Supabase Cloud Database.');
    } catch (error) {
        console.warn('[DATABASE] Supabase connection warning (using local fallback if needed):', error.message);
    }
}

/**
 * Saves a message to cloud database (with memory fallback)
 */
export async function saveMessage(jid, role, content, type = 'text') {
    // Save to memory cache (retains up to 100 recent messages per user in RAM)
    if (!inMemoryHistory.has(jid)) {
        inMemoryHistory.set(jid, []);
    }
    const memList = inMemoryHistory.get(jid);
    memList.push({ role, content, type, timestamp: Date.now() });
    if (memList.length > 100) memList.shift();

    // If Supabase is active, persist to database
    if (supabase) {
        try {
            const { error } = await supabase
                .from('messages')
                .insert([{ jid, role, content, type }]);
            if (error) {
                console.error('[DATABASE] Error saving message to Supabase:', error.message);
            }
        } catch (err) {
            console.error('[DATABASE] Supabase save error:', err.message);
        }
    }
}

/**
 * Gets the last N messages for a specific user
 */
export async function getChatHistory(jid, limit = 24) {
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('role, content')
                .eq('jid', jid)
                .order('id', { ascending: false })
                .limit(limit);

            if (!error && data && data.length > 0) {
                return data.reverse().map(m => ({
                    role: m.role === 'ai' ? 'model' : m.role,
                    parts: [{ text: m.content }]
                }));
            }
        } catch (err) {
            console.warn('[DATABASE] History fetch fallback to memory:', err.message);
        }
    }

    // Fallback to in-memory history
    const list = inMemoryHistory.get(jid) || [];
    const recent = list.slice(-limit);
    return recent.map(m => ({
        role: m.role === 'ai' ? 'model' : m.role,
        parts: [{ text: m.content }]
    }));
}
