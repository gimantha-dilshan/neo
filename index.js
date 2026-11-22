import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    downloadContentFromMessage,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import { askGemini, generateAIImage } from './gemini.js';
import { handleTicTacToeCommand, handleTicTacToeMove } from './tictactoe.js';
import { handleWordChainCommand, handleWordChainWord, initWordChain } from './wordchain.js';
import {
    initDB,
    saveMessage,
    recordUser,
    getUserName,
    getRecentUserMessages,
    recordGroupMessage,
    getRecentGroupMessages,
    knownUsers
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const botImagePath = path.join(__dirname, 'assets', 'bot-menu-image.jpg');

let cachedBotImage = null;

/**
 * Loads and caches the bot menu image buffer from assets/bot-image.jpg
 */
function getBotImage() {
    if (cachedBotImage) return cachedBotImage;
    try {
        if (fs.existsSync(botImagePath)) {
            cachedBotImage = fs.readFileSync(botImagePath);
            return cachedBotImage;
        }
    } catch (err) {
        console.error('[ASSETS] Error loading bot image:', err.message);
    }
    return null;
}

/**
 * Sends a rich menu card with bot-image.jpg if available, falling back to text
 */
async function sendMenuCard(socket, chatJid, captionText, quotedMsg, mentions = []) {
    const imageBuffer = getBotImage();
    if (imageBuffer) {
        try {
            return await socket.sendMessage(chatJid, {
                image: imageBuffer,
                caption: captionText,
                mentions: mentions
            }, { quoted: quotedMsg });
        } catch (imgErr) {
            console.error('[ASSETS] Failed to send image menu, falling back to text:', imgErr.message);
        }
    }
    return await socket.sendMessage(chatJid, {
        text: captionText,
        mentions: mentions
    }, { quoted: quotedMsg });
}

/**
 * Formats the comprehensive .help / .menu card
 */
function getHelpMenu(greeting) {
    return (
        `╭━━━〔 *NEO AI ASSISTANT* 〕━━━╮\n` +
        `┃  _Intelligent • Fast • Creative_\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `👋 Hello, ${greeting}! I am *Neo*, your smart AI WhatsApp assistant powered by AI.\n\n` +
        `⚡ *Command Prefix:* \`.\` (Always start commands with a dot)\n\n` +
        `╭───『 *💬 AI CHAT & ANSWERS* 』\n` +
        `│ ✦ \`.<question>\`\n` +
        `│   └ Ask anything: facts, math, science, advice\n` +
        `│   _e.g._ \`.Explain quantum computing simply\`\n` +
        `│ ✦ \`.<coding / writing / translate>\`\n` +
        `│   └ Code generation, debugging, essays & translation\n` +
        `│   _e.g._ \`.Write a Python script to scrape a website\`\n` +
        `╰──────────────────────────\n\n` +
        `╭───『 *🎨 AI IMAGE GENERATOR* 』\n` +
        `│ ✦ \`.draw <prompt>\`\n` +
        `│   └ Generate stunning AI artwork and illustrations\n` +
        `│   _e.g._ \`.draw a cyberpunk samurai in rainy Tokyo\`\n` +
        `│ ✦ _Aliases:_ \`.generate\`, \`.imagine\`, \`.img\`\n` +
        `╰──────────────────────────\n\n` +
        `╭───『 *👁️ VISION & IMAGE ANALYSIS* 』\n` +
        `│ ✦ *Send an image* with caption \`.<question>\`\n` +
        `│   └ Identify objects, solve math problems, describe scenes\n` +
        `│ ✦ *Reply to an image* with \`.<question>\`\n` +
        `│   └ Ask questions about any picture in the chat\n` +
        `╰──────────────────────────\n\n` +
        `╭───『 *🎮 TIC-TAC-TOE GAME* 』\n` +
        `│ ✦ \`.ttt\`\n` +
        `│   └ Create or join a Tic-Tac-Toe match\n` +
        `│ ✦ \`.ttt @user\`\n` +
        `│   └ Challenge a specific friend in the group\n` +
        `│ ✦ \`.ttt bot\`\n` +
        `│   └ Play solo against Neo AI\n` +
        `│ ✦ \`1\` - \`9\` or \`.1\` - \`.9\`\n` +
        `│   └ Choose a grid position during your turn\n` +
        `│ ✦ \`.ttt cancel\` / \`.surrender\`\n` +
        `│   └ Cancel game room or forfeit active match\n` +
        `╰──────────────────────────\n\n` +
        `╭───『 *🔤 WORD CHAIN GAME* 』\n` +
        `│ ✦ \`.wcg\`\n` +
        `│   └ Start a multiplayer Word Chain game lobby\n` +
        `│ ✦ *join* or \`.wcg join\`\n` +
        `│   └ Join an active game lobby (min 2 players)\n` +
        `│ ✦ \`.wcg start\`\n` +
        `│   └ Start game immediately when players join\n` +
        `│ ✦ \`.wcg stats\` / \`.wcg end\`\n` +
        `│   └ View live statistics or cancel the match\n` +
        `│ ✦ *surrender*\n` +
        `│   └ Forfeit your turn in an active match\n` +
        `╰──────────────────────────\n\n` +
        `╭───『 *⚙️ UTILITIES & STATUS* 』\n` +
        `│ ✦ \`.ping\`  ― Test latency & check if Neo is online\n` +
        `│ ✦ \`.help\`  ― Open this detailed menu (alias: \`.menu\`)\n` +
        `│ ✦ \`.\`      ― Quick status & welcome card\n` +
        `╰──────────────────────────\n\n`
    );
}

/**
 * Formats the quick-start '.' menu card
 */
function getQuickStartMenu(greeting) {
    return (
        `╭━━━〔 *NEO AI ASSISTANT* 〕━━━╮\n` +
        `┃      _Ready to Assist You_\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `👋 Hey ${greeting}! I am *Neo*, your personal AI companion.\n\n` +
        `I am listening and ready to help! You can ask questions, generate artwork, analyze photos, or play games.\n\n` +
        `🚀 *Quick Start Guide:*\n` +
        `▫️ *Ask me anything:*\n` +
        `   Type \`.\` followed by your question\n` +
        `   _Example:_ \`.Tell me an interesting space fact\`\n\n` +
        `▫️ *Generate an image:*\n` +
        `   Type \`.draw\` followed by your prompt\n` +
        `   _Example:_ \`.draw a cute futuristic robot pet\`\n\n` +
        `▫️ *Analyze an image:*\n` +
        `   Send or reply to an image with a \`.\` caption\n\n` +
        `▫️ *Play a game:*\n` +
        `   Type \`.ttt\` for Tic-Tac-Toe or \`.wcg\` for Word Chain\n\n` +
        `▫️ *Full Menu & Commands:*\n` +
        `   Type \`.help\` for the complete guide\n\n` +
        `══════════════════════════\n` +
        `🟢 *Status:* Online & Operational\n` +
        `⚡ *Prefix:* \`.\` (Dot)\n` +
        `══════════════════════════`
    );
}

// --- Terminal Colors ---
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m"
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let currentSocket = null;

// Track message IDs sent by the bot to avoid self-processing
const botSentIds = new Set();

function printHeader() {
    console.clear();
    console.log(`${C.cyan}${C.bold}=================================================`);
    console.log(`       NEO - AI WHATSAPP BOT (Personal & Groups)`);
    console.log(`       Developed by Gimantha Dilshan`);
    console.log(`=================================================${C.reset}\n`);
    console.log(`${C.yellow}[SYSTEM]${C.reset} Initializing Neo core engines...`);
}

/**
 * Normalizes JID by stripping multi-device identifiers (e.g. 12345:2@s.whatsapp.net -> 12345@s.whatsapp.net)
 */
function normalizeJid(jid) {
    if (!jid) return "";
    const [user, domain] = jid.split('@');
    if (!user || !domain) return jid;
    const cleanUser = user.split(':')[0];
    return `${cleanUser}@${domain}`;
}

/**
 * Extracts the real sender's individual JID.
 * In 1-on-1 chats: returns sender's JID.
 * In Group chats: returns the group participant's JID.
 * Normalizes device IDs and resolves LIDs to phone JIDs so that private and group
 * conversations for the same person share one continuous memory profile.
 */
function getSenderJid(msg) {
    const remoteJid = msg.key.remoteJid || "";
    const isGroup = remoteJid.endsWith('@g.us');

    let sender = isGroup
        ? (msg.key.participantAlt || msg.key.participant || msg.participant)
        : (msg.key.remoteJidAlt || remoteJid);

    // Prefer @s.whatsapp.net over @lid if available
    const alt = isGroup ? msg.key.participantAlt : msg.key.remoteJidAlt;
    if (sender && sender.endsWith('@lid') && alt && alt.endsWith('@s.whatsapp.net')) {
        sender = alt;
    }

    return normalizeJid(sender || remoteJid);
}

/**
 * Unwraps viewOnce, ephemeral, and documentWithCaption wrappers
 */
function unwrapMessage(msg) {
    if (!msg) return null;
    return (
        msg.ephemeralMessage?.message ||
        msg.viewOnceMessage?.message ||
        msg.viewOnceMessageV2?.message ||
        msg.documentWithCaptionMessage?.message ||
        msg
    );
}

/**
 * Extracts plain text from various message structures
 */
function getMessageText(m) {
    if (!m) return "";
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        ""
    );
}

/**
 * Downloads media stream into a Buffer
 */
async function downloadMedia(mediaMessage, type = 'image') {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function connectToWhatsApp() {
    printHeader();
    await initDB();
    await initWordChain();

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WhatsApp Web version: ${version.join('.')}, isLatest: ${isLatest}`);

    const socket = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Windows', 'Chrome', '120.0.0'],
        printQRInTerminal: false,
    });

    currentSocket = socket;

    // Wrap sendMessage to track bot-sent IDs
    const _originalSendMessage = socket.sendMessage.bind(socket);
    socket.sendMessage = async (...args) => {
        const sent = await _originalSendMessage(...args);
        if (sent?.key?.id) {
            botSentIds.add(sent.key.id);
            setTimeout(() => botSentIds.delete(sent.key.id), 60000);
        }
        return sent;
    };

    // Pairing code registration if not yet registered
    if (!socket.authState.creds.registered) {
        let phoneNumber = process.env.BOT_NUMBER;

        if (!phoneNumber) {
            phoneNumber = await question('Enter your WhatsApp number with country code (e.g. 94771234567): ');
        } else {
            console.log(`\n${C.yellow}[SYSTEM]${C.reset} Pairing with preset bot number: ${C.cyan}${phoneNumber}${C.reset}`);
        }

        console.log('Waiting for socket to be ready for pairing code...');
        setTimeout(async () => {
            try {
                const code = await socket.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
                console.log(`\n=================================================`);
                console.log(`   YOUR PAIRING CODE: ${C.green}${C.bold}${code}${C.reset}`);
                console.log(`=================================================\n`);
            } catch (err) {
                console.error('Failed to request pairing code:', err);
            }
        }, 6000);
    }

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.code);
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`Connection closed (Status code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 5000);
            } else {
                console.log('Logged out. Please delete the auth_info_baileys folder and scan the pairing code again.');
            }
        } else if (connection === 'open') {
            console.log(`\n${C.green}${C.bold}[SUCCESS] Connected to WhatsApp!${C.reset}`);
            console.log(`${C.green}[SYSTEM] Neo is active and listening for '.' commands in DMs and Groups! 🚀${C.reset}\n`);
        }
    });

    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        // Ignore messages sent by the bot itself
        if (msg.key.fromMe || botSentIds.has(msg.key.id)) {
            return;
        }

        const chatJid = msg.key.remoteJid;
        // Ignore WhatsApp status stories, broadcasts, and newsletter channels
        if (!chatJid || chatJid === 'status@broadcast' || chatJid.endsWith('@newsletter')) return;

        // Ignore messages older than 60 seconds
        const msgTimestamp = msg.messageTimestamp;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (currentTimestamp - msgTimestamp > 60) {
            return;
        }

        const isGroup = chatJid.endsWith('@g.us');
        // Unique user identity for unified memory across private & group chats
        const userJid = getSenderJid(msg);
        const pushName = msg.pushName || "User";

        // Record user's display name so Neo remembers who each phone number belongs to
        if (userJid && msg.pushName) {
            recordUser(userJid, msg.pushName);
        }

        // Unwrap outer wrapper (ephemeral, viewOnce, etc.)
        const content = unwrapMessage(msg.message);
        if (!content) return;

        // Record group message for context awareness
        const rawContentText = getMessageText(content);
        if (isGroup && rawContentText) {
            recordGroupMessage(chatJid, userJid, pushName, rawContentText);
        }

        // Context / Quoted message info
        const contextInfo =
            content.extendedTextMessage?.contextInfo ||
            content.imageMessage?.contextInfo ||
            content.videoMessage?.contextInfo ||
            content.documentMessage?.contextInfo;

        const quotedContent = unwrapMessage(contextInfo?.quotedMessage);

        try {
            let promptText = "";
            let mimes = [];
            let isTriggered = false;

            // ==========================================
            // CASE 1: Incoming Image
            // ==========================================
            if (content.imageMessage) {
                const caption = (content.imageMessage.caption || "").trim();

                // If image has no caption or caption doesn't start with '.', IGNORE IT!
                if (!caption || !caption.startsWith('.')) {
                    return;
                }

                // Caption starts with '.' -> Consider it!
                isTriggered = true;
                promptText = caption.slice(1).trim() || "Describe and analyze this image in detail.";

                console.log(`${C.cyan}[IMAGE]${C.reset} ${isGroup ? `[GROUP ${chatJid}]` : `[DM]`} User ${pushName} (${userJid}): .${promptText}`);

                const buffer = await downloadMedia(content.imageMessage, 'image');
                mimes.push({
                    mimeType: content.imageMessage.mimetype || 'image/jpeg',
                    data: buffer.toString('base64')
                });
            }

            // ==========================================
            // CASE 2: Incoming Text Message
            // ==========================================
            else {
                const text = (content.conversation || content.extendedTextMessage?.text || "").trim();

                // Check if user is in an active TicTacToe game and sending a move or surrender
                if (text) {
                    const isTttMove = await handleTicTacToeMove(socket, chatJid, userJid, text, msg, isGroup);
                    if (isTttMove) return;

                    // Check if message is a Word Chain word, lobby join, or surrender
                    const isWcgAction = await handleWordChainWord(socket, chatJid, userJid, pushName, text, msg, isGroup);
                    if (isWcgAction) return;
                }

                // If text does not start with '.', IGNORE IT!
                if (!text || !text.startsWith('.')) {
                    return;
                }

                isTriggered = true;
                promptText = text.slice(1).trim();

                // Check for built-in quick commands
                if (promptText.toLowerCase() === 'ping') {
                    await socket.sendMessage(chatJid, {
                        text: "🏓 *Pong!* Neo is online and running smoothly.",
                        mentions: isGroup ? [userJid] : []
                    }, { quoted: msg });
                    return;
                }

                // Check for TicTacToe game command (.ttt / .tictactoe)
                if (/^(ttt|tictactoe)(\s|$)/i.test(promptText)) {
                    await handleTicTacToeCommand(socket, chatJid, userJid, pushName, promptText, msg, isGroup);
                    return;
                }

                // Check for Word Chain game command (.wcg / .wordchain / .endwcg / .wcgstats)
                if (/^(wcg|wordchain|endwcg|wcgstats)(\s|$)/i.test(promptText)) {
                    await handleWordChainCommand(socket, chatJid, userJid, pushName, promptText, msg, isGroup);
                    return;
                }

                if (promptText.toLowerCase() === 'help' || promptText.toLowerCase() === 'menu') {
                    const greeting = isGroup ? `@${userJid.split('@')[0]}` : `*${pushName}*`;
                    const helpText = getHelpMenu(greeting);
                    await sendMenuCard(socket, chatJid, helpText, msg, isGroup ? [userJid] : []);
                    return;
                }

                // Check if the user is quoting/mentioning an already sent image
                const quotedImage = quotedContent?.imageMessage;
                if (quotedImage) {
                    console.log(`${C.cyan}[QUOTED IMAGE]${C.reset} ${isGroup ? `[GROUP]` : `[DM]`} User ${pushName} mentioned an image with prompt: .${promptText}`);
                    const buffer = await downloadMedia(quotedImage, 'image');
                    mimes.push({
                        mimeType: quotedImage.mimetype || 'image/jpeg',
                        data: buffer.toString('base64')
                    });

                    if (!promptText) {
                        promptText = "Describe and analyze this image in detail.";
                    }
                } else if (quotedContent) {
                    // Quoting another text message
                    const quotedText = getMessageText(quotedContent);
                    const quotedSenderJid = normalizeJid(contextInfo?.participant);
                    const quotedSenderName = getUserName(quotedSenderJid) || (quotedSenderJid ? `Member (+${quotedSenderJid.split('@')[0]})` : "a member");

                    if (quotedText) {
                        promptText = `[Quoted Message from ${quotedSenderName}]: "${quotedText}"\n\n${promptText || "Please explain or respond to this."}`;
                    }
                }

                // If user just sent '.' without any text and no media
                if (!promptText && mimes.length === 0) {
                    const greeting = isGroup ? `@${userJid.split('@')[0]}` : `*${pushName}*`;
                    const quickStartText = getQuickStartMenu(greeting);
                    await sendMenuCard(socket, chatJid, quickStartText, msg, isGroup ? [userJid] : []);
                    return;
                }
            }

            if (!isTriggered) return;

            // ==========================================
            // IMAGE GENERATION COMMAND (.draw / .generate / .imagine / .img)
            // ==========================================
            const imageGenMatch = promptText.match(/^(draw|generate|imagine|img)\s+(.+)/i);
            if (imageGenMatch) {
                const imgPrompt = imageGenMatch[2].trim();
                console.log(`${C.magenta}[IMAGE GEN]${C.reset} ${isGroup ? `[GROUP ${chatJid}]` : `[DM]`} ${pushName}: "${imgPrompt}"`);

                await socket.readMessages([msg.key]);
                await socket.sendPresenceUpdate('composing', chatJid);

                try {
                    const { buffer, engine } = await generateAIImage(imgPrompt);
                    await socket.sendPresenceUpdate('paused', chatJid);

                    await socket.sendMessage(chatJid, {
                        image: buffer,
                        caption: `🎨 *Generated by Neo* (${engine})\n*Prompt:* _${imgPrompt}_`,
                        mentions: isGroup ? [userJid] : []
                    }, { quoted: msg });

                    await saveMessage(userJid, 'user', promptText, 'text');
                    await saveMessage(userJid, 'model', `[Generated Image: ${imgPrompt}]`, 'image');
                    return;
                } catch (err) {
                    console.error('[IMAGE GEN ERROR]', err.message);
                    await socket.sendPresenceUpdate('paused', chatJid);
                    await socket.sendMessage(chatJid, {
                        text: `⚠️ *Image generation failed:* ${err.message || "Please try another prompt!"}`,
                        mentions: isGroup ? [userJid] : []
                    }, { quoted: msg });
                    return;
                }
            }

            // Collect all mentioned / tagged JIDs
            const rawMentions = contextInfo?.mentionedJid || [];
            const mentionedJids = new Set(rawMentions.map(normalizeJid));

            // Also detect any typed @<number> in the prompt text
            const textMentionMatches = (promptText.match(/@(\d{7,15})/g) || []);
            for (const match of textMentionMatches) {
                mentionedJids.add(`${match.slice(1)}@s.whatsapp.net`);
            }

            // Also check for quoted message sender
            if (contextInfo?.participant) {
                mentionedJids.add(normalizeJid(contextInfo.participant));
            }

            // Also match known member names mentioned in the prompt (e.g. "what did Kasun say?")
            const lowerPrompt = promptText.toLowerCase();
            for (const [kJid, kName] of knownUsers.entries()) {
                if (kName && kName.length >= 3) {
                    const regex = new RegExp(`\\b${kName.toLowerCase()}\\b`, 'i');
                    if (regex.test(lowerPrompt)) {
                        mentionedJids.add(kJid);
                    }
                }
            }

            // Build context for group: recent group conversation and referenced members
            let groupContext = "";
            let taggedContext = "";

            if (isGroup) {
                // Include recent group messages so Neo knows the current group discussion flow
                const recentGroup = getRecentGroupMessages(chatJid, 8);
                if (recentGroup.length > 0) {
                    groupContext = `\n\n[Recent Group Chat Messages]:\n` +
                        recentGroup.map(m => `- ${m.senderName} (@${m.senderJid.split('@')[0]}): "${m.text}"`).join('\n');
                }

                // Include specific details for any referenced / tagged members
                if (mentionedJids.size > 0) {
                    const details = [];
                    for (const mJid of mentionedJids) {
                        if (mJid === userJid) continue;
                        const phone = mJid.split('@')[0];
                        const name = getUserName(mJid) || `Group Member (+${phone})`;
                        const recentMsgs = await getRecentUserMessages(mJid, 4);
                        let info = `• Member: ${name} (@${phone})`;
                        if (recentMsgs && recentMsgs.length > 0) {
                            info += `\n  Recent messages from ${name}:\n  ${recentMsgs.map(m => `"${m}"`).join('\n  ')}`;
                        } else {
                            info += ` (No prior messages recorded from this member yet)`;
                        }
                        details.push(info);
                    }
                    if (details.length > 0) {
                        taggedContext = `\n\n[Tagged / Referenced Members Information]:\n${details.join('\n')}`;
                    }
                }
            }

            console.log(`${C.cyan}[PROCESSING]${C.reset} ${isGroup ? `[GROUP ${chatJid}]` : `[DM]`} User: ${pushName} (${userJid}): "${promptText.slice(0, 50)}..."`);

            // Mark as read and show composing in the specific chat (group or private)
            await socket.readMessages([msg.key]);
            await socket.sendPresenceUpdate('composing', chatJid);

            // Save user message under their unique userJid (combines DM and Group history for this person)
            await saveMessage(userJid, 'user', promptText, mimes.length > 0 ? 'image' : 'text');

            // Pass user context and tagged members info if in group chat
            const promptForAI = isGroup
                ? `[In a WhatsApp Group Chat]\n[Asking User: ${pushName} (@${userJid.split('@')[0]})]\nUser's Question: "${promptText}"${groupContext}${taggedContext}`
                : promptText;

            // Generate response from Gemini using user's unified chat history
            const aiResponse = await askGemini(userJid, promptForAI, mimes);

            await socket.sendPresenceUpdate('paused', chatJid);

            // Extract any @<number> mentions generated in the AI response so WhatsApp tags them natively
            const aiMentions = (aiResponse.match(/@(\d{7,15})/g) || []).map(m => `${m.slice(1)}@s.whatsapp.net`);
            const allMentions = [...new Set([userJid, ...mentionedJids, ...aiMentions])];

            // Send reply directly to the chat (group or DM), quoting the trigger message and mentioning relevant users
            await socket.sendMessage(chatJid, {
                text: aiResponse,
                mentions: isGroup ? allMentions : []
            }, { quoted: msg });

            // Save AI reply under the user's unified history
            await saveMessage(userJid, 'model', aiResponse, 'text');

        } catch (error) {
            console.error('[NEO ERROR] Failed to process message:', error);
            try {
                await socket.sendMessage(chatJid, {
                    text: "⚠️ *Neo encountered an error:* I couldn't process that request right now. Please try again in a moment!"
                }, { quoted: msg });
            } catch (err) {
                console.error('Failed to send error notification:', err);
            }
        }
    });
}

connectToWhatsApp();
