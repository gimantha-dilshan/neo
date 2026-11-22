/**
 * Word Chain Game (WCG) Module for Neo WhatsApp Bot
 * Features dynamic difficulty, turn timers, player elimination, and word validation.
 * Inspired by @souravkl11 Word Chain Game.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORD_LIST_URL = 'https://rawcdn.githack.com/dwyl/english-words/20f5cc9b3f0ccc8ce45d814c532b7c2031bba31c/words_alpha.txt';
const LOCAL_WORDLIST_PATH = path.join(__dirname, 'assets', 'words_alpha.txt');

let WORD_SET = new Set();
let isWordSetLoaded = false;

// Fallback common words list in case offline or download failure
const FALLBACK_WORDS = [
    'yes', 'you', 'your', 'year', 'young', 'yellow', 'yard', 'yell', 'yolk', 'yarn',
    'key', 'keep', 'kind', 'know', 'king', 'kick', 'kill', 'kiss', 'knee', 'knife',
    'apple', 'actor', 'adult', 'advice', 'anger', 'angle', 'animal', 'answer', 'attack',
    'baby', 'back', 'ball', 'banana', 'bank', 'battle', 'beach', 'bear', 'beat', 'beauty',
    'bird', 'black', 'blood', 'blue', 'boat', 'body', 'bone', 'book', 'border', 'boss',
    'cake', 'call', 'camera', 'camp', 'card', 'care', 'case', 'cat', 'catch', 'cause',
    'cell', 'chair', 'chance', 'change', 'charge', 'cheap', 'cheese', 'child', 'church',
    'city', 'claim', 'class', 'clean', 'clear', 'climb', 'clock', 'close', 'cloth', 'cloud',
    'dance', 'dark', 'date', 'daughter', 'dead', 'deal', 'death', 'debate', 'decision',
    'deep', 'degree', 'delay', 'deliver', 'demand', 'deny', 'depth', 'design', 'desire',
    'desk', 'detail', 'device', 'diamond', 'diet', 'dinner', 'direct', 'doctor', 'door',
    'eagle', 'early', 'earth', 'east', 'easy', 'edge', 'effect', 'effort', 'egg', 'eight',
    'elbow', 'election', 'element', 'elephant', 'empty', 'enemy', 'energy', 'engine',
    'enjoy', 'enough', 'enter', 'entire', 'equal', 'error', 'escape', 'event', 'exact',
    'face', 'fact', 'factor', 'fail', 'fall', 'family', 'famous', 'farm', 'fast', 'father',
    'fear', 'feather', 'feed', 'feel', 'female', 'fever', 'fight', 'figure', 'file',
    'game', 'garden', 'gate', 'gather', 'gear', 'general', 'giant', 'gift', 'girl', 'give',
    'glass', 'glove', 'goal', 'gold', 'good', 'government', 'grace', 'grain', 'grand',
    'hair', 'half', 'hall', 'hand', 'handle', 'hang', 'happen', 'happy', 'hard', 'hat',
    'head', 'health', 'heart', 'heat', 'heavy', 'help', 'hero', 'hide', 'high', 'hill',
    'ice', 'idea', 'identify', 'ignore', 'image', 'impact', 'important', 'income',
    'increase', 'indeed', 'index', 'industry', 'infant', 'inform', 'injury', 'inside',
    'jacket', 'jail', 'jeans', 'jelly', 'jewel', 'join', 'joint', 'joke', 'journey', 'joy',
    'judge', 'juice', 'jump', 'jungle', 'junior', 'jury', 'justice', 'justify',
    'labor', 'lack', 'lady', 'lake', 'land', 'language', 'large', 'laser', 'last', 'late',
    'laugh', 'lawyer', 'layer', 'lead', 'leader', 'leaf', 'learn', 'leave', 'left', 'lemon',
    'machine', 'magazine', 'magic', 'mail', 'main', 'major', 'maker', 'male', 'manage',
    'manner', 'many', 'map', 'march', 'mark', 'market', 'marry', 'mass', 'master', 'match',
    'name', 'narrow', 'nation', 'native', 'natural', 'nature', 'near', 'neat', 'neck',
    'need', 'needle', 'nerve', 'nest', 'network', 'news', 'next', 'nice', 'night', 'nine',
    'ocean', 'offer', 'office', 'officer', 'often', 'oil', 'okay', 'old', 'olive', 'once',
    'one', 'onion', 'online', 'open', 'operate', 'opinion', 'orange', 'order', 'organ',
    'pack', 'page', 'pain', 'paint', 'pair', 'pale', 'palm', 'pan', 'panel', 'panic',
    'paper', 'parent', 'park', 'part', 'party', 'pass', 'past', 'path', 'patient', 'pattern',
    'queen', 'quest', 'quick', 'quiet', 'quit', 'quite', 'quote',
    'race', 'radio', 'rail', 'rain', 'raise', 'range', 'rank', 'rapid', 'rare', 'rate',
    'rather', 'reach', 'react', 'read', 'ready', 'real', 'reason', 'receive', 'recent',
    'safe', 'sail', 'salad', 'salary', 'sale', 'salt', 'same', 'sample', 'sand', 'sauce',
    'save', 'scale', 'scene', 'school', 'science', 'scope', 'score', 'scream', 'screen',
    'table', 'tail', 'take', 'tale', 'talent', 'talk', 'tall', 'tank', 'tape', 'target',
    'task', 'taste', 'tax', 'tea', 'teach', 'team', 'tear', 'tell', 'term', 'test', 'text',
    'ugly', 'unable', 'uncle', 'under', 'unit', 'unite', 'unity', 'universe', 'unknown',
    'unless', 'until', 'unusual', 'upon', 'upper', 'urban', 'urge', 'urgent', 'user', 'usual',
    'vacation', 'valley', 'valuable', 'value', 'valve', 'van', 'vanish', 'variety', 'various',
    'vast', 'vegetable', 'vehicle', 'venture', 'version', 'vessel', 'veteran', 'victim', 'victory',
    'video', 'view', 'village', 'vintage', 'violence', 'virtual', 'virus', 'visible', 'vision',
    'visit', 'visitor', 'visual', 'vital', 'voice', 'volume', 'volunteer', 'vote', 'voyage',
    'wait', 'wake', 'walk', 'wall', 'wander', 'want', 'warm', 'warn', 'wash', 'waste',
    'watch', 'water', 'wave', 'way', 'weak', 'wealth', 'weapon', 'wear', 'weather', 'web',
    'xray', 'xenon', 'xylophone',
    'yard', 'yarn', 'year', 'yell', 'yellow', 'yield', 'yoga', 'yolk', 'young', 'youth',
    'zebra', 'zero', 'zone', 'zoom'
];

/**
 * Initializes and caches the English dictionary
 */
export async function initWordChain() {
    try {
        if (fs.existsSync(LOCAL_WORDLIST_PATH)) {
            const data = fs.readFileSync(LOCAL_WORDLIST_PATH, 'utf-8');
            const words = data.split(/\r?\n/)
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length >= 3);
            WORD_SET = new Set(words);
            isWordSetLoaded = true;
            console.log(`[WORD CHAIN] Loaded ${WORD_SET.size} words from local disk cache.`);
            return;
        }

        console.log('[WORD CHAIN] Downloading word list from repository...');
        const response = await fetch(WORD_LIST_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const words = text.split(/\r?\n/)
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length >= 3);

        WORD_SET = new Set(words);
        isWordSetLoaded = true;
        console.log(`[WORD CHAIN] Downloaded and loaded ${WORD_SET.size} words.`);

        try {
            const assetsDir = path.dirname(LOCAL_WORDLIST_PATH);
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }
            fs.writeFileSync(LOCAL_WORDLIST_PATH, text, 'utf-8');
            console.log(`[WORD CHAIN] Cached dictionary to ${LOCAL_WORDLIST_PATH}`);
        } catch (saveErr) {
            console.warn('[WORD CHAIN] Could not save local cache file:', saveErr.message);
        }
    } catch (err) {
        console.error('[WORD CHAIN] Failed to load word list, using fallback dictionary:', err.message);
        WORD_SET = new Set(FALLBACK_WORDS);
        isWordSetLoaded = true;
    }
}

/**
 * Calculates dynamic difficulty thresholds based on player count and total words
 */
export function getDynamicDifficulty(totalWords, activePlayerCount = 2) {
    let thresholds;

    if (activePlayerCount <= 2) {
        thresholds = {
            easy: 5,
            medium: 12,
            challenging: 24,
            hard: 40,
            expert: 60,
            master: 80
        };
    } else if (activePlayerCount === 3) {
        thresholds = {
            easy: 6,
            medium: 15,
            challenging: 30,
            hard: 50,
            expert: 75,
            master: 100
        };
    } else if (activePlayerCount === 4) {
        thresholds = {
            easy: 7,
            medium: 17,
            challenging: 35,
            hard: 55,
            expert: 80,
            master: 110
        };
    } else {
        thresholds = {
            easy: 8,
            medium: 20,
            challenging: 40,
            hard: 65,
            expert: 95,
            master: 130
        };
    }

    if (totalWords < thresholds.easy) {
        return { minLength: 3, timeLimit: 40000, level: 'Beginner' };
    } else if (totalWords < thresholds.medium) {
        return { minLength: 4, timeLimit: 35000, level: 'Easy' };
    } else if (totalWords < thresholds.challenging) {
        return { minLength: 4, timeLimit: 30000, level: 'Medium' };
    } else if (totalWords < thresholds.hard) {
        return { minLength: 5, timeLimit: 25000, level: 'Challenging' };
    } else if (totalWords < thresholds.expert) {
        return { minLength: 5, timeLimit: 20000, level: 'Hard' };
    } else if (totalWords < thresholds.master) {
        return { minLength: 6, timeLimit: 18000, level: 'Expert' };
    } else {
        return { minLength: 6, timeLimit: 15000, level: 'Master' };
    }
}

export class WordChainGame {
    constructor(jid) {
        this.jid = jid;
        this.players = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'waiting'; // 'waiting' | 'active'
        this.currentLetter = this.getRandomLetter();
        this.usedWords = new Set();
        this.totalWords = 0;
        this.longestWord = '';
        this.longestWordPlayerJid = '';
        this.longestWordPlayerName = '';
        this.startTime = null;
        this.joinTimer = null;
        this.turnTimer = null;
        this.currentDifficulty = getDynamicDifficulty(0, 2);
        this.processingWord = false;
        this.currentTurnStartTime = null;
        this.turnNumber = 0;
    }

    getRandomLetter() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return letters[Math.floor(Math.random() * letters.length)];
    }

    addPlayer(userId, username) {
        if (!this.players.find(p => p.id === userId)) {
            this.players.push({
                id: userId,
                username: username || userId.split('@')[0],
                words: 0,
                eliminated: false
            });
            return true;
        }
        return false;
    }

    getCurrentPlayer() {
        const active = this.getActivePlayers();
        if (active.length === 0) return null;
        return active[this.currentPlayerIndex % active.length];
    }

    getNextPlayer() {
        const active = this.getActivePlayers();
        if (active.length === 0) return null;
        const nextIndex = (this.currentPlayerIndex + 1) % active.length;
        return active[nextIndex];
    }

    nextTurn() {
        const active = this.getActivePlayers();
        if (active.length > 0) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % active.length;
        }
        this.turnNumber++;
        this.currentTurnStartTime = Date.now();
    }

    eliminatePlayer(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player && !player.eliminated) {
            player.eliminated = true;

            const active = this.getActivePlayers();
            if (active.length > 0) {
                const activeIndex = active.findIndex(p => p.id === playerId);
                if (activeIndex !== -1 && activeIndex <= this.currentPlayerIndex) {
                    this.currentPlayerIndex = Math.max(0, this.currentPlayerIndex - 1);
                }
                if (this.currentPlayerIndex >= active.length) {
                    this.currentPlayerIndex = 0;
                }
            }
            return true;
        }
        return false;
    }

    updateDifficulty() {
        const activePlayers = this.getActivePlayers();
        const oldLevel = this.currentDifficulty.level;
        this.currentDifficulty = getDynamicDifficulty(this.totalWords, Math.max(2, activePlayers.length));
        return oldLevel !== this.currentDifficulty.level;
    }

    isValidWord(word) {
        if (!isWordSetLoaded && WORD_SET.size === 0) {
            return word.length >= this.currentDifficulty.minLength;
        }
        return WORD_SET.has(word.toLowerCase());
    }

    getActivePlayers() {
        return this.players.filter(p => !p.eliminated);
    }

    getGameDuration() {
        if (!this.startTime) return '00:00:00';
        const duration = Date.now() - this.startTime;
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    getDifficultyEmoji() {
        switch (this.currentDifficulty.level) {
            case 'Beginner': return '🟢';
            case 'Easy': return '🟡';
            case 'Medium': return '🟠';
            case 'Challenging': return '🔴';
            case 'Hard': return '🟤';
            case 'Expert': return '🟣';
            case 'Master': return '⚫';
            default: return '🔵';
        }
    }

    getDifficultyProgressInfo() {
        const activeCount = this.getActivePlayers().length;
        let thresholds;

        if (activeCount <= 2) {
            thresholds = [5, 12, 24, 40, 60, 80];
        } else if (activeCount === 3) {
            thresholds = [6, 15, 30, 50, 75, 100];
        } else if (activeCount === 4) {
            thresholds = [7, 17, 35, 55, 80, 110];
        } else {
            thresholds = [8, 20, 40, 65, 95, 130];
        }

        const nextThreshold = thresholds.find(t => t > this.totalWords);
        return nextThreshold ? `${nextThreshold - this.totalWords} words to next level` : 'MAX LEVEL';
    }

    clearTimers() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
        if (this.joinTimer) {
            clearInterval(this.joinTimer);
            this.joinTimer = null;
        }
    }
}

// Active games storage: chatJid -> WordChainGame instance
export const activeGames = new Map();

/**
 * Checks if a user is currently in an active or waiting Word Chain game
 */
export function isPlayerInWordChain(userJid, chatJid) {
    const game = activeGames.get(chatJid);
    if (!game) return false;
    return game.players.some(p => p.id === userJid && !p.eliminated);
}

function mentionjid(jid) {
    return '@' + jid.split('@')[0];
}

async function reactToMessage(socket, chatJid, messageKey, emoji) {
    if (!socket || !messageKey) return;
    try {
        await socket.sendMessage(chatJid, {
            react: {
                text: emoji,
                key: messageKey
            }
        });
    } catch (err) {
        // Silently catch reaction errors
    }
}

export function getGameStatusMessage(game) {
    const activePlayers = game.getActivePlayers();

    if (activePlayers.length <= 1) {
        const winner = activePlayers[0];
        let message = `╭━━━〔 *WORD CHAIN GAME OVER* 〕━━━╮\n\n`;

        if (winner) {
            message += `🏆 *WINNER:* ${mentionjid(winner.id)}! Congratulations! 🎉✨\n\n`;
        } else {
            message += `😔 *Game Over!* No winner this time.\n\n`;
        }

        message += `📝 *Total Words Chained:* ${game.totalWords}\n`;
        message += `📊 *Final Level:* ${game.getDifficultyEmoji()} *${game.currentDifficulty.level}*\n`;

        if (game.longestWord) {
            message += `📚 *Longest Word:* *${game.longestWord.toUpperCase()}* (${game.longestWord.length} letters) by ${mentionjid(game.longestWordPlayerJid)}\n`;
        }

        message += `⏱️ *Game Duration:* ${game.getGameDuration()}\n`;
        message += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
        message += `_Type *.wcg* to start a new match!_`;

        const mentions = [];
        if (winner) mentions.push(winner.id);
        if (game.longestWordPlayerJid && !mentions.includes(game.longestWordPlayerJid)) {
            mentions.push(game.longestWordPlayerJid);
        }

        return { text: message, mentions };
    }

    const currentPlayer = game.getCurrentPlayer();
    const nextPlayer = game.getNextPlayer();

    if (!currentPlayer || !nextPlayer) {
        return { text: "❌ *Game error:* No active players found.", mentions: [] };
    }

    const statusMessage =
        `╭━━━〔 *WORD CHAIN GAME* 〕━━━╮\n` +
        `🎲 *Current Turn:* ${mentionjid(currentPlayer.id)}\n` +
        `🙌 *Up Next:* ${mentionjid(nextPlayer.id)}\n\n` +
        `🆎 *Starting Letter:* [ *${game.currentLetter}* ]\n` +
        `📏 *Min Letters:* ${game.currentDifficulty.minLength}+ characters\n` +
        `${game.getDifficultyEmoji()} *Level:* ${game.currentDifficulty.level} (${game.getDifficultyProgressInfo()})\n` +
        `👥 *Players Remaining:* ${activePlayers.length}/${game.players.length}\n` +
        `⏳ *Time to Answer:* *${game.currentDifficulty.timeLimit / 1000}s*\n` +
        `📝 *Words Chained:* ${game.totalWords}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
        `_Reply with an English word starting with *${game.currentLetter}*!_`;

    return {
        text: statusMessage,
        mentions: [currentPlayer.id, nextPlayer.id]
    };
}

/**
 * Starts or restarts the turn timer for the active player
 */
export function startTurnTimer(game, socket) {
    if (game.turnTimer) {
        clearTimeout(game.turnTimer);
        game.turnTimer = null;
    }

    const currentTurnNumber = game.turnNumber;
    const currentPlayer = game.getCurrentPlayer();

    if (!currentPlayer) return;

    game.turnTimer = setTimeout(async () => {
        if (game.turnNumber !== currentTurnNumber) return;

        if (game.processingWord) {
            setTimeout(() => {
                if (game.turnNumber === currentTurnNumber && !game.processingWord) {
                    handleTimeOut();
                }
            }, 150);
            return;
        }

        async function handleTimeOut() {
            const stillCurrentPlayer = game.getCurrentPlayer();
            if (!stillCurrentPlayer || stillCurrentPlayer.id !== currentPlayer.id) return;

            await socket.sendMessage(game.jid, {
                text: `⏰ ${mentionjid(currentPlayer.id)} ran out of time! They have been *eliminated*! 🚫`,
                mentions: [currentPlayer.id]
            });

            game.eliminatePlayer(currentPlayer.id);

            const activePlayers = game.getActivePlayers();
            if (activePlayers.length <= 1) {
                const statusMessage = getGameStatusMessage(game);
                await socket.sendMessage(game.jid, statusMessage);
                game.clearTimers();
                activeGames.delete(game.jid);
            } else {
                game.nextTurn();
                const statusMessage = getGameStatusMessage(game);
                await socket.sendMessage(game.jid, statusMessage);
                startTurnTimer(game, socket);
            }
        }

        await handleTimeOut();
    }, game.currentDifficulty.timeLimit);
}

/**
 * Handles .wcg and wordchain commands
 */
export async function handleWordChainCommand(socket, chatJid, userJid, pushName, commandText, msg, isGroup) {
    const parts = commandText.trim().split(/\s+/);
    const subCommand = (parts[1] || "").toLowerCase();

    // 1. HELP COMMAND (.wcg help)
    if (subCommand === 'help') {
        const helpText =
            `╭━━━〔 *WORD CHAIN GAME GUIDE* 〕━━━╮\n` +
            `┃ Chain English words letter by letter!\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `🎮 *Commands:*\n` +
            `• *.wcg* - Start a new game lobby (creator is auto-joined)\n` +
            `• *join* or *.wcg join* - Join the waiting room\n` +
            `• *.wcg start* - Force-start the game early (min 2 players)\n` +
            `• *.wcg stats* - View current match statistics\n` +
            `• *.wcg end* - Cancel / stop the current game\n` +
            `• *surrender* - Forfeit your active turn/game\n\n` +
            `📖 *Rules of Play:*\n` +
            `1. Neo gives you a starting letter (e.g. *B*).\n` +
            `2. Player whose turn it is must reply with a valid English word starting with that letter (e.g. *Banana*).\n` +
            `3. The next player must use the *last letter* of your word (e.g. *Apple* from *A*).\n` +
            `4. No repeated words allowed!\n` +
            `5. Difficulty increases automatically (longer words, faster timers!)\n` +
            `6. If your timer runs out, you get eliminated!`;

        await socket.sendMessage(chatJid, { text: helpText }, { quoted: msg });
        return;
    }

    // 2. END / CANCEL COMMAND (.wcg end / .wcg cancel / .endwcg)
    if (subCommand === 'end' || subCommand === 'cancel' || parts[0].toLowerCase() === 'endwcg') {
        const game = activeGames.get(chatJid);
        if (!game) {
            await socket.sendMessage(chatJid, { text: '❌ No active Word Chain game in this chat!' }, { quoted: msg });
            return;
        }

        game.clearTimers();
        activeGames.delete(chatJid);
        await socket.sendMessage(chatJid, { text: '🛑 *Word Chain Game stopped by user.*' }, { quoted: msg });
        return;
    }

    // 3. STATS COMMAND (.wcg stats / .wcgstats)
    if (subCommand === 'stats' || parts[0].toLowerCase() === 'wcgstats') {
        const game = activeGames.get(chatJid);
        if (!game) {
            await socket.sendMessage(chatJid, { text: '❌ No active Word Chain game in this chat!' }, { quoted: msg });
            return;
        }

        let statsMessage = `📊 *Word Chain Game Statistics*\n\n`;
        statsMessage += `🎮 *Status:* ${game.gameState.toUpperCase()}\n`;
        statsMessage += `${game.getDifficultyEmoji()} *Level:* ${game.currentDifficulty.level}\n`;
        statsMessage += `📏 *Min Length:* ${game.currentDifficulty.minLength} letters\n`;
        statsMessage += `⏱️ *Time Limit:* ${game.currentDifficulty.timeLimit / 1000}s\n`;
        statsMessage += `👥 *Total Joined:* ${game.players.length}\n`;
        statsMessage += `🏆 *Active Players:* ${game.getActivePlayers().length}\n`;
        statsMessage += `📝 *Total Words Chained:* ${game.totalWords}\n`;
        statsMessage += `🎯 *Progress:* ${game.getDifficultyProgressInfo()}\n`;

        if (game.longestWord) {
            statsMessage += `📚 *Longest Word:* *${game.longestWord.toUpperCase()}* (${game.longestWord.length} letters) by ${mentionjid(game.longestWordPlayerJid)}\n`;
        }

        if (game.gameState === 'active') {
            statsMessage += `🔤 *Current Target Letter:* *${game.currentLetter}*\n`;
            statsMessage += `⏱️ *Game Duration:* ${game.getGameDuration()}\n`;
            statsMessage += `🎯 *Current Turn #:* ${game.turnNumber}\n`;
        }

        const mentions = [];
        if (game.longestWordPlayerJid) mentions.push(game.longestWordPlayerJid);

        await socket.sendMessage(chatJid, { text: statsMessage, mentions }, { quoted: msg });
        return;
    }

    // 4. MANUAL JOIN COMMAND (.wcg join)
    if (subCommand === 'join') {
        const game = activeGames.get(chatJid);
        if (!game) {
            await socket.sendMessage(chatJid, { text: '❌ No game lobby to join! Type *.wcg* to start one.' }, { quoted: msg });
            return;
        }

        if (game.gameState !== 'waiting') {
            await socket.sendMessage(chatJid, { text: '❌ The game is already in progress!' }, { quoted: msg });
            return;
        }

        if (game.addPlayer(userJid, pushName)) {
            await socket.sendMessage(chatJid, {
                text: `🙋‍♂️ ${mentionjid(userJid)} joined the game! 👏 (Total: ${game.players.length})`,
                mentions: [userJid]
            }, { quoted: msg });
        } else {
            await socket.sendMessage(chatJid, {
                text: `⚠️ ${mentionjid(userJid)} You have already joined!`,
                mentions: [userJid]
            }, { quoted: msg });
        }
        return;
    }

    // 5. START COMMAND (.wcg start)
    if (subCommand === 'start') {
        const game = activeGames.get(chatJid);
        if (!game) {
            await socket.sendMessage(chatJid, { text: '❌ No game to start! Type *.wcg* to create a lobby first.' }, { quoted: msg });
            return;
        }

        if (game.gameState !== 'waiting') {
            await socket.sendMessage(chatJid, { text: '❌ Game is already running or completed!' }, { quoted: msg });
            return;
        }

        if (game.players.length < 2) {
            await socket.sendMessage(chatJid, {
                text: '❌ At least *2 players* are required to start! Ask friends to type *join*.'
            }, { quoted: msg });
            return;
        }

        game.clearTimers();
        game.gameState = 'active';
        game.startTime = Date.now();
        game.currentTurnStartTime = Date.now();
        game.turnNumber = 1;
        game.updateDifficulty();

        const statusMessage = getGameStatusMessage(game);
        await socket.sendMessage(chatJid, statusMessage);
        startTurnTimer(game, socket);
        return;
    }

    // 6. CREATE NEW GAME LOBBY (.wcg)
    if (activeGames.has(chatJid)) {
        const existing = activeGames.get(chatJid);
        if (existing.gameState === 'waiting') {
            await socket.sendMessage(chatJid, {
                text: `⏳ A Word Chain lobby is already open!\n👉 Type *join* to participate, or *.wcg start* to begin!`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(chatJid, {
                text: `🎮 A Word Chain game is already actively running in this chat!\nType *.wcg stats* for info or *.wcg end* to stop it.`
            }, { quoted: msg });
        }
        return;
    }

    // Create fresh game instance
    const game = new WordChainGame(chatJid);
    // Auto-add the creator
    game.addPlayer(userJid, pushName);
    activeGames.set(chatJid, game);

    const lobbyText =
        `╭━━━〔 *WORD CHAIN GAME* 〕━━━╮\n` +
        `🎮 *New Game Lobby Created!*\n` +
        `👤 *Host:* ${mentionjid(userJid)}\n\n` +
        `👉 Type *join* to enter the game!\n` +
        `⚡ Needs *2 or more players* to play.\n` +
        `⏳ Starting in *60 seconds* (or host types *.wcg start*)\n\n` +
        `🔄 *Dynamic Difficulty:*\n` +
        `🟢 *Beginner:* 3+ letters | 40s per turn\n` +
        `⚫ *Master:* 6+ letters | 15s per turn\n` +
        `⚡ Difficulty increases faster with fewer players!\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    await socket.sendMessage(chatJid, {
        text: lobbyText,
        mentions: [userJid]
    }, { quoted: msg });

    let countdown = 60;
    game.joinTimer = setInterval(async () => {
        countdown -= 15;
        if (countdown > 0) {
            let updateMessage =
                `⏳ *Word Chain starts in ${countdown}s!*\n` +
                `Type *join* to jump in! 🙋‍♂️🙋‍♀️\n` +
                `👥 *Current Players (${game.players.length}):* ` +
                game.players.map(p => mentionjid(p.id)).join(', ');

            await socket.sendMessage(chatJid, {
                text: updateMessage,
                mentions: game.players.map(p => p.id)
            });
        } else {
            clearInterval(game.joinTimer);
            game.joinTimer = null;

            if (game.players.length >= 2) {
                game.gameState = 'active';
                game.startTime = Date.now();
                game.currentTurnStartTime = Date.now();
                game.turnNumber = 1;
                game.updateDifficulty();

                const statusMessage = getGameStatusMessage(game);
                await socket.sendMessage(chatJid, statusMessage);
                startTurnTimer(game, socket);
            } else {
                await socket.sendMessage(chatJid, {
                    text: '❌ *Not enough players joined!* Word Chain Game cancelled. (Requires at least 2 players)'
                });
                activeGames.delete(chatJid);
            }
        }
    }, 15000);
}

/**
 * Handles incoming chat messages for Word Chain Game:
 * - 'join' during waiting lobby
 * - 'surrender' during active gameplay
 * - Word submissions during active gameplay
 * Returns true if handled, false otherwise.
 */
export async function handleWordChainWord(socket, chatJid, userJid, pushName, rawText, msg, isGroup) {
    const game = activeGames.get(chatJid);
    if (!game) return false;

    const text = (rawText || "").trim();
    if (!text) return false;
    const lower = text.toLowerCase();

    // 1. LOBBY JOIN DETECTION ('join' or '.join')
    if (game.gameState === 'waiting') {
        if (lower === 'join' || lower === '.join') {
            if (game.addPlayer(userJid, pushName)) {
                await reactToMessage(socket, chatJid, msg.key, '👋');
                await socket.sendMessage(chatJid, {
                    text: `🙋‍♂️ ${mentionjid(userJid)} Joined! 👏\n👥 Total players: *${game.players.length}*`,
                    mentions: [userJid]
                }, { quoted: msg });
            } else {
                await socket.sendMessage(chatJid, {
                    text: `⚠️ ${mentionjid(userJid)} You're already in the game!`,
                    mentions: [userJid]
                }, { quoted: msg });
            }
            return true;
        }
        return false;
    }

    // 2. ACTIVE GAMEPLAY
    if (game.gameState === 'active') {
        // Check for surrender by any player in this game
        const isSurrender = /^(surrender|give\s*up|\.surrender|\.wcg\s+surrender)$/i.test(lower);
        if (isSurrender) {
            const player = game.players.find(p => p.id === userJid && !p.eliminated);
            if (!player) return false;

            const isCurrentTurn = game.getCurrentPlayer()?.id === userJid;
            await reactToMessage(socket, chatJid, msg.key, '🏳️');
            await socket.sendMessage(chatJid, {
                text: `🏳️ ${mentionjid(userJid)} has surrendered! They are out of the game.`,
                mentions: [userJid]
            }, { quoted: msg });

            game.eliminatePlayer(userJid);

            const activePlayers = game.getActivePlayers();
            if (activePlayers.length <= 1) {
                const statusMessage = getGameStatusMessage(game);
                await socket.sendMessage(chatJid, statusMessage);
                game.clearTimers();
                activeGames.delete(chatJid);
            } else if (isCurrentTurn) {
                game.nextTurn();
                const statusMessage = getGameStatusMessage(game);
                await socket.sendMessage(chatJid, statusMessage);
                startTurnTimer(game, socket);
            }
            return true;
        }

        // Only process word submissions if it's the current player's turn
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== userJid) {
            return false;
        }

        // If message is not a single word containing alphabets, ignore it (allows regular conversation)
        if (!/^[a-zA-Z]+$/.test(text)) {
            return false;
        }

        if (game.processingWord) {
            return true;
        }

        game.processingWord = true;

        try {
            const word = text.toLowerCase();
            const firstLetter = word.charAt(0).toUpperCase();

            // Check starting letter
            if (firstLetter !== game.currentLetter) {
                await reactToMessage(socket, chatJid, msg.key, '❌');
                await socket.sendMessage(chatJid, {
                    text: `❌ Word must start with the letter *${game.currentLetter}*!`,
                    mentions: [userJid]
                }, { quoted: msg });
                return true;
            }

            // Check minimum length
            if (word.length < game.currentDifficulty.minLength) {
                await reactToMessage(socket, chatJid, msg.key, '❌');
                await socket.sendMessage(chatJid, {
                    text: `❌ Word must be at least *${game.currentDifficulty.minLength}* letters long! (${game.currentDifficulty.level} level requirement)`,
                    mentions: [userJid]
                }, { quoted: msg });
                return true;
            }

            // Check if already used
            if (game.usedWords.has(word)) {
                await reactToMessage(socket, chatJid, msg.key, '🔄');
                await socket.sendMessage(chatJid, {
                    text: `❌ Word *"${word.toUpperCase()}"* has already been used in this match!`,
                    mentions: [userJid]
                }, { quoted: msg });
                return true;
            }

            // Check dictionary validity
            if (!game.isValidWord(word)) {
                await reactToMessage(socket, chatJid, msg.key, '❓');
                await socket.sendMessage(chatJid, {
                    text: `❓ *"${word.toUpperCase()}"* was not found in my English dictionary!`,
                    mentions: [userJid]
                }, { quoted: msg });
                return true;
            }

            // Valid word! Clear turn timer
            if (game.turnTimer) {
                clearTimeout(game.turnTimer);
                game.turnTimer = null;
            }

            await reactToMessage(socket, chatJid, msg.key, '✅');

            game.usedWords.add(word);
            game.totalWords++;
            currentPlayer.words++;

            // Longest word track
            let isNewLongest = false;
            if (word.length > game.longestWord.length) {
                game.longestWord = word;
                game.longestWordPlayerJid = currentPlayer.id;
                game.longestWordPlayerName = currentPlayer.username;
                isNewLongest = true;
                await reactToMessage(socket, chatJid, msg.key, '🏆');
            }

            const levelChanged = game.updateDifficulty();
            game.currentLetter = word.charAt(word.length - 1).toUpperCase();
            game.nextTurn();

            if (levelChanged) {
                await socket.sendMessage(chatJid, {
                    text: `🆙 *LEVEL UP!* ${game.getDifficultyEmoji()}\n` +
                          `🏅 *New Level:* *${game.currentDifficulty.level}*\n` +
                          `📏 *Min Length:* *${game.currentDifficulty.minLength}* letters\n` +
                          `⏳ *Time Limit:* *${game.currentDifficulty.timeLimit / 1000}s* per turn\n` +
                          `🎯 *Target:* ${game.getDifficultyProgressInfo()}`
                });
            }

            const statusMessage = getGameStatusMessage(game);
            await socket.sendMessage(chatJid, statusMessage);
            startTurnTimer(game, socket);

            return true;
        } finally {
            game.processingWord = false;
        }
    }

    return false;
}

