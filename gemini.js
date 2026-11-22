import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { getChatHistory } from './database.js';

dotenv.config();

// Initialize clients for high availability failover
const primaryClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const backupClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY });

/**
 * MODEL TIER LIST - ordered best to most available:
 *
 * Tier 1: gemini-3.8-flash       — Latest stable, best intelligence, multimodal (text + image + audio)
 * Tier 2: gemini-3.5-flash       — Strong, fast, high token capacity
 * Tier 3: gemini-3.5-flash-lite  — Lightweight 3.5, very high RPM, good for rapid conversations
 * Tier 4: gemini-3.1-flash-lite  — Solid lite fallback, low latency
 * Tier 5: gemini-2.5-flash       — Stable legacy fast model, 1M token context
 * Tier 6: gemini-2.5-flash-lite  — Most rate-permissive (30 RPM), highest daily safety net
 *
 * When Primary API key is exhausted across all 6 tiers → retries all 6 on the BACKUP API key.
 * Total protection: 12 cascading fallback attempts before giving up.
 */
export const MODEL_TIERS = [
    'gemini-3.5-flash-lite',       // Best & latest
    'gemini-3.5-flash',       // Very strong, fast
    'gemini-3.1-flash-lite',  // Good lite fallback
    'gemini-2.5-flash',       // Highest RPM safety net (30 RPM)
    'gemini-2.5-flash-lite', 
];
const CHAT_HISTORY_LIMIT = parseInt(process.env.CHAT_HISTORY_LIMIT || '24', 10);

const NEO_SYSTEM_INSTRUCTION = `You are 'Neo', a witty, helpful, and highly intelligent AI WhatsApp assistant. You work seamlessly in both private 1-on-1 chats and group chats.

CREATOR INFORMATION:
If anyone asks who made you, who your creator is, or about your developer, answer that SpineGrid Solutions are your creators.

WHATSAPP FORMATTING RULES (STRICT):
You are communicating directly inside WhatsApp. You MUST format text using WhatsApp markup. NEVER use Markdown headers (no #, ##) or Markdown tables.
1. BOLD: Use single asterisks (*Text*).
2. ITALICS: Use underscores (_text_).
3. STRIKETHROUGH: Use tildes (~text~).
4. MONOSPACE / CODE: Use triple backticks (\`\`\`text\`\`\`).
5. HEADINGS: Use bold text with relevant emoji when helpful (e.g., *💡 Tip:* or *📌 Note:*).
6. READABILITY: Keep paragraphs concise with blank lines in between.
7. LISTS: Use clean bullet points (• or -).

CRITICAL RULE - NO NAME TAGS:
NEVER start your response with 'Neo:', '*Neo:*', '*🤖 Neo:*', or any self-referencing prefix. Start directly with your response text.

GROUP CHAT RULES & IDENTITY DISCRIMINATION (CRITICAL):
You operate in group chats where many people speak. Pay strict attention to who is who:
1. SENDER VS. SUBJECT:
   - The person speaking to you right now is identified in "[Asking User: <Name>]".
   - Do NOT confuse the asking user with other members being discussed or quoted.
   - Do not attribute another member's words or actions to the asking user.

2. QUESTIONS ABOUT OTHER MEMBERS:
   - When asked "Who is [Member]?", "What did [Member] say?", or "What does [Member] think?":
     Look at "[Tagged / Referenced Members Information]" and "[Recent Group Chat Messages]".
     Accurately reflect what that member actually said or asked in this group.
   - If no recent messages or details are available for that member, honestly say:
     "I don't have enough recent messages from [Member] in this group to tell you."
     NEVER hallucinate fake personal details, biographies, or made-up statements about real people.

3. REPLIES & QUOTED MESSAGES:
   - When a user quotes another member's message (shown in "[Quoted Message from <Author>]: ...") and asks you to explain, translate, critique, or respond to it, understand that <Author> wrote that quoted text, while the asking user is prompting you about it.

4. SUMMARIZING GROUP DISCUSSIONS:
   - When asked to summarize what happened in the group or what people were discussing, use "[Recent Group Chat Messages]" to provide a clear, neutral summary highlighting who said what.

5. GENERAL INQUIRIES:
   - If the user asks an unrelated general question (e.g. coding, math, science, trivia), answer it directly without randomly bringing up group members.

6. MENTIONS / TAGS:
   - When referring to a specific member, using their tag (e.g. @94771234567) or their name allows WhatsApp to highlight them. Keep responses concise so group chats stay readable.

COMMANDS & BOT FEATURES:
Users invoke commands with prefix '.'. If a user types a command incorrectly or asks how to use a feature, guide them:
- Ask AI: .<question> (or image + .<caption/prompt>)
- Image Gen: .draw <prompt> (aliases: .imagine, .generate, .img)
- Games: .ttt (Tic-Tac-Toe), .c4 (Connect Four), .wcg (Word Chain)
- System: .ping (status), .help or .menu (full guide), . (quick start)

Be engaging, accurate, natural, and helpful across all topics.`;

export async function askGemini(jid, prompt, mimes = [], modelIndex = 0, useBackupKey = false) {
    const activeClient = useBackupKey ? backupClient : primaryClient;
    const modelChoice = MODEL_TIERS[modelIndex] || MODEL_TIERS[0];

    try {
        const history = await getChatHistory(jid, CHAT_HISTORY_LIMIT);
        const currentParts = [{ text: prompt }];

        mimes.forEach(m => {
            currentParts.push({
                inlineData: {
                    mimeType: m.mimeType,
                    data: m.data
                }
            });
        });

        const contents = [...history, { role: 'user', parts: currentParts }];

        console.log(`[NEO] Asking Gemini [Model: ${modelChoice} (Tier ${modelIndex + 1}/${MODEL_TIERS.length}) | Key: ${useBackupKey ? 'BACKUP' : 'PRIMARY'}]...`);

        const result = await activeClient.models.generateContent({
            model: modelChoice,
            contents: contents,
            config: {
                systemInstruction: NEO_SYSTEM_INSTRUCTION,
            }
        });

        const rawText = result.text || "";
        // Strip any leading bot name tag if present
        return rawText.replace(/^(\*?🤖?\s*Neo:?\*?\s*|\*Neo:\*\s*)/i, '').trim() || rawText;

    } catch (error) {
        console.error(`[NEO] Error with ${modelChoice} (${useBackupKey ? 'BACKUP' : 'PRIMARY'}):`, error.message);

        // 1. Try next model in the tier list on the current API key
        if (modelIndex + 1 < MODEL_TIERS.length) {
            const nextModel = MODEL_TIERS[modelIndex + 1];
            console.log(`⚠️ Falling back to ${nextModel} (${useBackupKey ? 'BACKUP' : 'PRIMARY'} Key)...`);
            return await askGemini(jid, prompt, mimes, modelIndex + 1, useBackupKey);
        }

        // 2. If all models failed on the Primary key, switch to the Backup key (starting from tier 0)
        if (!useBackupKey && process.env.GEMINI_API_KEY_2 && process.env.GEMINI_API_KEY_2 !== process.env.GEMINI_API_KEY) {
            console.log(`🚨 PRIMARY KEY EXHAUSTED across all ${MODEL_TIERS.length} models. Switching to BACKUP API KEY...`);
            return await askGemini(jid, prompt, mimes, 0, true);
        }

        // 3. Exhausted all models across both keys
        if (error.message?.includes('429')) {
            return "⚠️ *System Overload:* All AI model tiers are currently busy cooling down from high traffic. Please try again in 2 minutes! 🧠💤";
        }

        throw error;
    }
}

/**
 * Generates an image using the best available free pipeline:
 *
 * Stage 1: Gemini native image generation (Primary Key) — if available on your plan
 * Stage 2: Gemini native image generation (Backup Key) — if different key
 * Stage 3: Pollinations.ai FLUX Realism (high quality, free, unlimited) — primary free fallback
 * Stage 4: Pollinations.ai FLUX standard (most reliable free fallback)
 *
 * Note: Gemini image models require specific API access. If your key returns 404,
 * the pipeline automatically skips to Pollinations without delay.
 */
export async function generateAIImage(prompt) {
    const GEMINI_IMAGE_MODELS = [
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-image',
    ];

    // Helper: try Gemini native image generation on a given client
    async function tryGeminiImageGen(client, keyLabel) {
        for (const model of GEMINI_IMAGE_MODELS) {
            try {
                console.log(`[IMAGE GEN] Trying ${model} (${keyLabel})...`);
                const response = await client.models.generateImages({
                    model,
                    prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: '1:1',
                    },
                });
                const bytes = response?.generatedImages?.[0]?.image?.imageBytes;
                if (bytes) {
                    return {
                        buffer: Buffer.from(bytes, 'base64'),
                        engine: model
                    };
                }
            } catch (err) {
                const msg = err.message || '';
                // 404 = model not available on this key plan → skip silently, no retry
                if (msg.includes('404') || msg.includes('not found')) {
                    console.warn(`[IMAGE GEN] ${model} not available (404). Skipping Gemini image tier.`);
                    return null; // stop trying other Gemini image models too
                }
                // 429 or other → log and try next model
                console.warn(`[IMAGE GEN] ${model} (${keyLabel}) failed: ${msg.slice(0, 80)}`);
            }
        }
        return null;
    }

    // Helper: try Pollinations.ai with given model
    async function tryPollinations(model, label) {
        const seed = Math.floor(Math.random() * 1_000_000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${model}&width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;
        console.log(`[IMAGE GEN] Trying Pollinations ${label}...`);
        const res = await fetch(url);
        if (!res.ok || res.headers.get('content-type')?.includes('json')) {
            throw new Error(`Pollinations ${label} returned HTTP ${res.status}`);
        }
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength < 1000) throw new Error(`Pollinations ${label}: response too small (${arrayBuf.byteLength} bytes)`);
        return {
            buffer: Buffer.from(arrayBuf),
            engine: `FLUX ${label}`
        };
    }

    // Stage 1: Primary Gemini Key
    const result1 = await tryGeminiImageGen(primaryClient, 'Primary Key');
    if (result1) return result1;

    // Stage 2: Backup Gemini Key (only if it's a different key)
    const hasDifferentBackup =
        process.env.GEMINI_API_KEY_2 &&
        process.env.GEMINI_API_KEY_2 !== process.env.GEMINI_API_KEY;

    if (hasDifferentBackup) {
        const result2 = await tryGeminiImageGen(backupClient, 'Backup Key');
        if (result2) return result2;
    }

    // Stage 3: Pollinations FLUX Realism (best free quality, ~60-80KB realistic images)
    try {
        return await tryPollinations('flux-realism', 'Realism');
    } catch (err) {
        console.warn(`[IMAGE GEN] FLUX Realism failed: ${err.message}`);
    }

    // Stage 4: Pollinations FLUX standard (most reliable free fallback)
    return await tryPollinations('flux', 'Standard');
}
