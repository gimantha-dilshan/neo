/**
 * TicTacToe Module for Neo WhatsApp Bot
 * Inspired by Knightbot-MD TicTacToe engine
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tttImagePath = path.join(__dirname, 'assets', 'ttt-menu-image.jpg');

let cachedTttImage = null;

function getTttImage() {
    if (cachedTttImage) return cachedTttImage;
    try {
        if (fs.existsSync(tttImagePath)) {
            cachedTttImage = fs.readFileSync(tttImagePath);
            return cachedTttImage;
        }
    } catch (err) {
        console.error('[ASSETS] Error loading TTT menu image:', err.message);
    }
    return null;
}

export async function sendTttMenuCard(socket, chatJid, captionText, quotedMsg, mentions = []) {
    const imageBuffer = getTttImage();
    if (imageBuffer) {
        try {
            return await socket.sendMessage(chatJid, {
                image: imageBuffer,
                caption: captionText,
                mentions: mentions
            }, { quoted: quotedMsg });
        } catch (imgErr) {
            console.error('[ASSETS] Failed to send TTT menu image, falling back to text:', imgErr.message);
        }
    }
    return await socket.sendMessage(chatJid, {
        text: captionText,
        mentions: mentions
    }, { quoted: quotedMsg });
}

export function getTttMenu(greeting, isGroup) {
    const modeTip = isGroup
        ? `👥 *Multiplayer:* Run *.ttt start* to open an open 2-player challenge in this group, or challenge a friend with *.ttt @user*.\n` +
          `🤖 *Solo Mode:* Run *.ttt bot* to challenge Neo AI.`
        : `🤖 *Solo Mode:* Run *.ttt bot* to challenge Neo AI here in DMs!\n` +
          `👥 *Multiplayer:* Run *.ttt start* inside a WhatsApp group to challenge friends.`;

    return (
        `*NEO ARCADE*  •  _Tic-Tac-Toe (X/O)_\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Welcome ${greeting}! Play the classic 3x3 strategy game against friends or test your skills solo against Neo AI.\n\n` +
        `${modeTip}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*COMMANDS & CONTROLS*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `• \`.ttt start\`  — Create or join a 2-player match (or \`.ttt play\`)\n` +
        `• \`.ttt @user\`  — Challenge a specific friend directly\n` +
        `• \`.ttt bot\`    — Play solo against Neo AI\n` +
        `• \`1\` to \`9\`    — Place your symbol (❎ or ⭕) on your turn\n` +
        `• \`stop\`         — Cancel or terminate the match (or \`.ttt end\`)\n` +
        `• \`surrender\`    — Forfeit an active match\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 *Universal Controls:* \`stop\` and \`surrender\` work anytime with or without a dot (\`.\`).\n` +
        `💡 *Navigation:* Type \`.help\` to view the main bot directory.`
    );
}

export class TicTacToe {
    constructor(playerX = 'x', playerO = 'o') {
        this.playerX = playerX;
        this.playerO = playerO;
        this._currentTurn = false; // false = playerX, true = playerO
        this._x = 0;
        this._o = 0;
        this.turns = 0;
    }

    get board() {
        return this._x | this._o;
    }

    get currentTurn() {
        return this._currentTurn ? this.playerO : this.playerX;
    }

    get winner() {
        const winningPatterns = [
            0b111000000, // Row 3 (6, 7, 8)
            0b000111000, // Row 2 (3, 4, 5)
            0b000000111, // Row 1 (0, 1, 2)
            0b100100100, // Col 3 (2, 5, 8)
            0b010010010, // Col 2 (1, 4, 7)
            0b001001001, // Col 1 (0, 3, 6)
            0b100010001, // Diagonal (0, 4, 8)
            0b001010100  // Diagonal (2, 4, 6)
        ];

        // Check X's moves
        for (const pattern of winningPatterns) {
            if ((this._x & pattern) === pattern) {
                return this.playerX;
            }
        }

        // Check O's moves
        for (const pattern of winningPatterns) {
            if ((this._o & pattern) === pattern) {
                return this.playerO;
            }
        }

        return null;
    }

    turn(isPlayerO, pos) {
        // If game is over or invalid position
        if (this.winner || pos < 0 || pos > 8) return -1;

        // If position is already taken
        if ((this._x | this._o) & (1 << pos)) return 0;

        // Place the piece
        const value = 1 << pos;
        if (this._currentTurn) {
            this._o |= value;
        } else {
            this._x |= value;
        }

        this._currentTurn = !this._currentTurn;
        this.turns++;
        return 1;
    }

    render() {
        return [...Array(9)].map((_, i) => {
            const bit = 1 << i;
            return this._x & bit ? 'X' : this._o & bit ? 'O' : (i + 1).toString();
        });
    }
}

// Active games storage: roomId -> game room object
export const games = new Map();

export const BOT_JID = 'bot@neo';

/**
 * Intelligent AI move selector for solo bot games
 */
function getBestBotMove(game) {
    const winningPatterns = [
        0b111000000, // Row 3 (6, 7, 8)
        0b000111000, // Row 2 (3, 4, 5)
        0b000000111, // Row 1 (0, 1, 2)
        0b100100100, // Col 3 (2, 5, 8)
        0b010010010, // Col 2 (1, 4, 7)
        0b001001001, // Col 1 (0, 3, 6)
        0b100010001, // Diagonal (0, 4, 8)
        0b001010100  // Diagonal (2, 4, 6)
    ];

    const available = [];
    for (let i = 0; i < 9; i++) {
        if (!((game._x | game._o) & (1 << i))) {
            available.push(i);
        }
    }

    if (available.length === 0) return -1;

    // 1. Win: If Bot (O) can win in one move, take it!
    for (const pos of available) {
        const nextO = game._o | (1 << pos);
        for (const pattern of winningPatterns) {
            if ((nextO & pattern) === pattern) {
                return pos;
            }
        }
    }

    // 2. Block: If Player (X) is about to win, block them!
    for (const pos of available) {
        const nextX = game._x | (1 << pos);
        for (const pattern of winningPatterns) {
            if ((nextX & pattern) === pattern) {
                return pos;
            }
        }
    }

    // 3. Center: Take center (position 5 / index 4) if available
    if (available.includes(4)) {
        return 4;
    }

    // 4. Corners: Take available corners (0, 2, 6, 8)
    const corners = [0, 2, 6, 8].filter(c => available.includes(c));
    if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
    }

    // 5. Sides: Take available sides (1, 3, 5, 7)
    const sides = [1, 3, 5, 7].filter(s => available.includes(s));
    if (sides.length > 0) {
        return sides[Math.floor(Math.random() * sides.length)];
    }

    return available[0];
}

/**
 * Formats the 3x3 board for WhatsApp with emojis
 */
function formatBoard(game) {
    const symbols = {
        'X': '❎',
        'O': '⭕',
        '1': '1️⃣',
        '2': '2️⃣',
        '3': '3️⃣',
        '4': '4️⃣',
        '5': '5️⃣',
        '6': '6️⃣',
        '7': '7️⃣',
        '8': '8️⃣',
        '9': '9️⃣',
    };

    const arr = game.render().map(v => symbols[v] || v);

    return `${arr[0]} ${arr[1]} ${arr[2]}\n` +
           `${arr[3]} ${arr[4]} ${arr[5]}\n` +
           `${arr[6]} ${arr[7]} ${arr[8]}`;
}

/**
 * Checks if a user is currently in an active TicTacToe game
 */
export function isPlayerInGame(userJid, chatJid) {
    for (const room of games.values()) {
        if (room.chatJid === chatJid &&
            room.state === 'PLAYING' &&
            (room.game.playerX === userJid || room.game.playerO === userJid)) {
            return true;
        }
    }
    return false;
}

/**
 * Handles .ttt / .tictactoe commands
 */
export async function handleTicTacToeCommand(socket, chatJid, userJid, pushName, commandText, msg, isGroup) {
    const parts = commandText.trim().split(/\s+/);
    const subCommand = (parts[1] || "").toLowerCase();

    // 1. MENU & HELP COMMAND (.ttt / .ttt help / .ttt menu)
    if (!subCommand || subCommand === 'help' || subCommand === 'menu') {
        const greeting = isGroup ? `@${userJid.split('@')[0]}` : `*${pushName}*`;
        const menuText = getTttMenu(greeting, isGroup);
        await sendTttMenuCard(socket, chatJid, menuText, msg, isGroup ? [userJid] : []);
        return;
    }

    // 2. SURRENDER COMMAND (.ttt surrender / .surrender)
    if (subCommand === 'surrender' || subCommand === 'giveup') {
        for (const [roomId, room] of games.entries()) {
            if (room.chatJid === chatJid && (room.game.playerX === userJid || room.game.playerO === userJid)) {
                if (room.state === 'WAITING') {
                    clearTimeout(room.timeout);
                    games.delete(roomId);
                    await socket.sendMessage(chatJid, { text: `🛑 *Game Cancelled:* Waiting room deleted.` }, { quoted: msg });
                    return;
                }

                clearTimeout(room.timeout);
                const winner = userJid === room.game.playerX ? room.game.playerO : room.game.playerX;
                const isWinnerBot = winner === BOT_JID;
                const winnerTag = isWinnerBot ? '🤖 Neo (AI)' : `@${winner.split('@')[0]}`;
                const loserTag = userJid.split('@')[0];

                await socket.sendMessage(chatJid, {
                    text: `🏳️ @${loserTag} has surrendered!\n\n🎉 ${winnerTag} wins the game! 🏆`,
                    mentions: isWinnerBot ? [userJid] : [userJid, winner]
                }, { quoted: msg });

                games.delete(roomId);
                return;
            }
        }

        await socket.sendMessage(chatJid, { text: `❌ You are not in an active TicTacToe game.` }, { quoted: msg });
        return;
    }

    // 3. CANCEL / STOP / END COMMAND (.ttt cancel / .ttt end / .ttt stop)
    if (subCommand === 'cancel' || subCommand === 'end' || subCommand === 'stop') {
        for (const [roomId, room] of games.entries()) {
            if (room.chatJid === chatJid && (room.game.playerX === userJid || room.game.playerO === userJid)) {
                clearTimeout(room.timeout);
                games.delete(roomId);
                const msgText = room.state === 'WAITING'
                    ? `🛑 *TicTacToe room cancelled.*`
                    : `🛑 *TicTacToe Game stopped by @${userJid.split('@')[0]}!*`;
                await socket.sendMessage(chatJid, { text: msgText, mentions: [userJid] }, { quoted: msg });
                return;
            }
        }

        await socket.sendMessage(chatJid, { text: `❌ You do not have an active TicTacToe game to stop.` }, { quoted: msg });
        return;
    }

    // 4. CHECK IF USER IS ALREADY PLAYING
    for (const room of games.values()) {
        if (room.chatJid === chatJid && room.state === 'PLAYING' && (room.game.playerX === userJid || room.game.playerO === userJid)) {
            await socket.sendMessage(chatJid, {
                text: `❌ You are already in an active game!\nType a number (*1-9*) to play, or type *.ttt surrender* to forfeit.`,
                mentions: [userJid]
            }, { quoted: msg });
            return;
        }
    }

    // 5. BOT SOLO COMMAND (.ttt bot / .ttt ai)
    if (subCommand === 'bot' || subCommand === 'ai') {
        // Clean up any existing waiting room created by this user
        for (const [roomId, room] of games.entries()) {
            if (room.chatJid === chatJid && room.game.playerX === userJid && room.state === 'WAITING') {
                clearTimeout(room.timeout);
                games.delete(roomId);
                break;
            }
        }

        const roomId = `ttt-bot-${Date.now()}`;
        const newRoom = {
            id: roomId,
            chatJid,
            game: new TicTacToe(userJid, BOT_JID),
            state: 'PLAYING',
            isBot: true,
            timeout: setTimeout(() => {
                if (games.has(roomId)) {
                    games.delete(roomId);
                    socket.sendMessage(chatJid, { text: `⏰ *TicTacToe Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
                }
            }, 300000)
        };

        games.set(roomId, newRoom);

        const userTag = userJid.split('@')[0];
        const startText =
            `🎮 *TicTacToe Solo Game Started!*\n\n` +
            `🎲 Turn: @${userTag} (❎)\n\n` +
            `${formatBoard(newRoom.game)}\n\n` +
            `▢ Player ❎: @${userTag}\n` +
            `▢ Player ⭕: 🤖 Neo (AI)\n\n` +
            `• Type a number (*1-9*) on your turn to place your symbol!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: startText,
            mentions: [userJid]
        }, { quoted: msg });
        return;
    }

    // 6. MULTIPLAYER START (.ttt start / .ttt play / .ttt @user)
    const isStartOrPlay = subCommand === 'start' || subCommand === 'play';
    const isChallenge = commandText.includes('@');

    // If no valid multiplayer start command given, display the TTT menu card
    if (!isStartOrPlay && !isChallenge) {
        const greeting = isGroup ? `@${userJid.split('@')[0]}` : `*${pushName}*`;
        const menuText = getTttMenu(greeting, isGroup);
        await sendTttMenuCard(socket, chatJid, menuText, msg, isGroup ? [userJid] : []);
        return;
    }

    // If user attempts multiplayer in a private chat (DM)
    if (!isGroup) {
        await socket.sendMessage(chatJid, {
            text: `🤖 *Tic-Tac-Toe in Private Chat:*\n\nTo play solo against Neo AI here in DMs, please send *.ttt bot*!\n\n_To challenge a human friend, run *.ttt start* inside a WhatsApp group chat._`,
            mentions: [userJid]
        }, { quoted: msg });
        return;
    }

    // 7. CHECK FOR EXISTING WAITING ROOM IN THIS CHAT
    let waitingRoom = null;
    let waitingRoomId = null;
    for (const [id, r] of games.entries()) {
        if (r.chatJid === chatJid && r.state === 'WAITING') {
            waitingRoom = r;
            waitingRoomId = id;
            break;
        }
    }

    if (waitingRoom) {
        // Can't play against yourself in the same chat
        if (waitingRoom.game.playerX === userJid) {
            await socket.sendMessage(chatJid, {
                text: `⏳ *Still waiting for an opponent!*\nType *.ttt cancel* if you want to close this room.`,
                mentions: [userJid]
            }, { quoted: msg });
            return;
        }

        // Join existing room as Player O
        waitingRoom.game.playerO = userJid;
        waitingRoom.state = 'PLAYING';

        // Reset inactivity timer for 5 minutes
        clearTimeout(waitingRoom.timeout);
        waitingRoom.timeout = setTimeout(() => {
            if (games.has(waitingRoomId)) {
                games.delete(waitingRoomId);
                socket.sendMessage(chatJid, { text: `⏰ *TicTacToe Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
            }
        }, 300000);

        const currentTurnTag = waitingRoom.game.currentTurn.split('@')[0];
        const playerXTag = waitingRoom.game.playerX.split('@')[0];
        const playerOTag = userJid.split('@')[0];

        const boardText =
            `🎮 *TicTacToe Game Started!*\n\n` +
            `🎲 Turn: @${currentTurnTag} (❎)\n\n` +
            `${formatBoard(waitingRoom.game)}\n\n` +
            `▢ Player ❎: @${playerXTag}\n` +
            `▢ Player ⭕: @${playerOTag}\n\n` +
            `• Type a number (*1-9*) on your turn to place your symbol!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: boardText,
            mentions: [waitingRoom.game.playerX, userJid, waitingRoom.game.currentTurn]
        }, { quoted: msg });

    } else {
        // Create new room waiting for opponent
        const roomId = `ttt-${Date.now()}`;
        const newRoom = {
            id: roomId,
            chatJid,
            game: new TicTacToe(userJid, ''),
            state: 'WAITING',
            timeout: setTimeout(() => {
                if (games.has(roomId)) {
                    games.delete(roomId);
                    socket.sendMessage(chatJid, { text: `⏰ *TicTacToe waiting room closed due to timeout.*` }).catch(() => {});
                }
            }, 180000) // 3 min waiting timeout
        };

        games.set(roomId, newRoom);

        const userTag = userJid.split('@')[0];
        const waitText =
            `🎮 *TicTacToe Room Created!*\n\n` +
            `👤 Challenged by: @${userTag}\n` +
            `⏳ Waiting for an opponent to join...\n\n` +
            `👉 Type *.ttt* to accept the challenge and play!`;

        await socket.sendMessage(chatJid, {
            text: waitText,
            mentions: [userJid]
        }, { quoted: msg });
    }
}

/**
 * Handles in-game moves (1-9), stop/end, or surrender messages
 * Returns true if the message was handled as a TicTacToe action, false otherwise.
 */
export async function handleTicTacToeMove(socket, chatJid, userJid, rawText, msg, isGroup) {
    const textClean = (rawText || "").trim();
    if (!textClean) return false;

    // Find active (PLAYING or WAITING) game for this user in this chat
    let targetRoom = null;
    let targetRoomId = null;

    for (const [id, r] of games.entries()) {
        if (r.chatJid === chatJid &&
            (r.game.playerX === userJid || r.game.playerO === userJid)) {
            targetRoom = r;
            targetRoomId = id;
            break;
        }
    }

    if (!targetRoom) return false;

    // 1. Check for STOP or END (with or without prefix)
    const isStop = /^(stop|end|cancel|\.stop|\.end|\.cancel|\.ttt\s+(stop|end|cancel))$/i.test(textClean);
    if (isStop) {
        clearTimeout(targetRoom.timeout);
        games.delete(targetRoomId);
        const statusText = targetRoom.state === 'WAITING'
            ? `🛑 *TicTacToe waiting room cancelled.*`
            : `🛑 *TicTacToe Game stopped by @${userJid.split('@')[0]}!*`;
        await socket.sendMessage(chatJid, {
            text: statusText,
            mentions: [userJid]
        }, { quoted: msg });
        return true;
    }

    // 2. Check for SURRENDER (with or without prefix)
    const isSurrender = /^(surrender|give\s*up|\.surrender|\.giveup|\.ttt\s+(surrender|give\s*up))$/i.test(textClean);
    if (isSurrender) {
        clearTimeout(targetRoom.timeout);
        if (targetRoom.state === 'WAITING') {
            games.delete(targetRoomId);
            await socket.sendMessage(chatJid, { text: `🛑 *Game Cancelled:* Waiting room deleted.` }, { quoted: msg });
            return true;
        }

        const winner = userJid === targetRoom.game.playerX ? targetRoom.game.playerO : targetRoom.game.playerX;
        const isWinnerBot = winner === BOT_JID;
        const winnerTag = isWinnerBot ? '🤖 Neo (AI)' : `@${winner.split('@')[0]}`;
        const loserTag = userJid.split('@')[0];

        await socket.sendMessage(chatJid, {
            text: `🏳️ @${loserTag} has surrendered!\n\n🎉 ${winnerTag} wins the game! 🏆`,
            mentions: isWinnerBot ? [userJid] : [userJid, winner]
        }, { quoted: msg });

        games.delete(targetRoomId);
        return true;
    }

    // 3. Move handling (only valid when room state is PLAYING)
    if (targetRoom.state !== 'PLAYING') return false;

    // Check for number move: 1-9 or .1-.9
    const matchNumber = textClean.match(/^\.?([1-9])$/);
    if (!matchNumber) {
        return false;
    }

    const activeRoom = targetRoom;
    const activeRoomId = targetRoomId;

    // It's a move (1-9)
    const position = parseInt(matchNumber[1], 10) - 1;

    // Check if it's the sender's turn
    if (userJid !== activeRoom.game.currentTurn) {
        const turnTag = activeRoom.game.currentTurn.split('@')[0];
        await socket.sendMessage(chatJid, {
            text: `❌ *Not your turn!*\nWaiting for @${turnTag} to make a move.`,
            mentions: [activeRoom.game.currentTurn]
        }, { quoted: msg });
        return true;
    }

    // Execute the move
    const isPlayerO = userJid === activeRoom.game.playerO;
    const moveResult = activeRoom.game.turn(isPlayerO, position);

    if (moveResult <= 0) {
        await socket.sendMessage(chatJid, {
            text: `❌ *Invalid move!* That position is already taken. Pick an available number!`,
            mentions: [userJid]
        }, { quoted: msg });
        return true;
    }

    // Refresh inactivity timer
    clearTimeout(activeRoom.timeout);
    activeRoom.timeout = setTimeout(() => {
        if (games.has(activeRoomId)) {
            games.delete(activeRoomId);
            socket.sendMessage(chatJid, { text: `⏰ *TicTacToe Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
        }
    }, 300000);

    const winner = activeRoom.game.winner;
    const isTie = !winner && activeRoom.game.turns === 9;

    const isBotGame = activeRoom.isBot || activeRoom.game.playerO === BOT_JID;
    const playerXTag = activeRoom.game.playerX.split('@')[0];
    const playerOTag = isBotGame ? '🤖 Neo (AI)' : `@${activeRoom.game.playerO.split('@')[0]}`;

    // Case 1: Winner
    if (winner) {
        clearTimeout(activeRoom.timeout);
        const winnerTag = winner === BOT_JID ? '🤖 Neo (AI)' : `@${winner.split('@')[0]}`;
        const symbol = winner === activeRoom.game.playerX ? '❎' : '⭕';

        const winMessage =
            `🎮 *TicTacToe Game Over!*\n\n` +
            `🎉 ${winnerTag} (${symbol}) has WON the game! 🏆✨\n\n` +
            `${formatBoard(activeRoom.game)}\n\n` +
            `▢ Player ❎: @${playerXTag}\n` +
            `▢ Player ⭕: ${playerOTag}\n\n` +
            `_Type ${isBotGame ? '*.ttt bot*' : '*.ttt*'} to start a new rematch!_`;

        await socket.sendMessage(chatJid, {
            text: winMessage,
            mentions: isBotGame ? [userJid] : [activeRoom.game.playerX, activeRoom.game.playerO]
        }, { quoted: msg });

        games.delete(activeRoomId);
        return true;
    }

    // Case 2: Draw
    if (isTie) {
        clearTimeout(activeRoom.timeout);
        const drawMessage =
            `🎮 *TicTacToe Game Over!*\n\n` +
            `🤝 The game ended in a *DRAW!* ⚖️\n\n` +
            `${formatBoard(activeRoom.game)}\n\n` +
            `▢ Player ❎: @${playerXTag}\n` +
            `▢ Player ⭕: ${playerOTag}\n\n` +
            `_Type ${isBotGame ? '*.ttt bot*' : '*.ttt*'} to start a rematch!_`;

        await socket.sendMessage(chatJid, {
            text: drawMessage,
            mentions: isBotGame ? [userJid] : [activeRoom.game.playerX, activeRoom.game.playerO]
        }, { quoted: msg });

        games.delete(activeRoomId);
        return true;
    }

    // Solo Bot Game Turn Execution
    if (isBotGame) {
        const botPos = getBestBotMove(activeRoom.game);
        if (botPos >= 0) {
            activeRoom.game.turn(true, botPos);

            const botWinner = activeRoom.game.winner;
            const botTie = !botWinner && activeRoom.game.turns === 9;

            if (botWinner) {
                clearTimeout(activeRoom.timeout);
                const botWinMessage =
                    `🎮 *TicTacToe Game Over!*\n\n` +
                    `🤖 *Neo (AI)* (⭕) has WON the game! 🏆🤖\n\n` +
                    `${formatBoard(activeRoom.game)}\n\n` +
                    `▢ Player ❎: @${playerXTag}\n` +
                    `▢ Player ⭕: 🤖 Neo (AI)\n\n` +
                    `_Better luck next time! Type *.ttt bot* to retry._`;

                await socket.sendMessage(chatJid, {
                    text: botWinMessage,
                    mentions: [userJid]
                }, { quoted: msg });

                games.delete(activeRoomId);
                return true;
            }

            if (botTie) {
                clearTimeout(activeRoom.timeout);
                const botDrawMessage =
                    `🎮 *TicTacToe Game Over!*\n\n` +
                    `🤝 The game ended in a *DRAW!* ⚖️\n\n` +
                    `${formatBoard(activeRoom.game)}\n\n` +
                    `▢ Player ❎: @${playerXTag}\n` +
                    `▢ Player ⭕: 🤖 Neo (AI)\n\n` +
                    `_Type *.ttt bot* to start a rematch!_`;

                await socket.sendMessage(chatJid, {
                    text: botDrawMessage,
                    mentions: [userJid]
                }, { quoted: msg });

                games.delete(activeRoomId);
                return true;
            }

            // Normal next turn for human
            const botPlayedNum = botPos + 1;
            const botTurnMessage =
                `🎮 *TicTacToe Solo Game*\n\n` +
                `🤖 Neo picked *${botPlayedNum}*!\n` +
                `🎲 Your Turn: @${playerXTag} (❎)\n\n` +
                `${formatBoard(activeRoom.game)}\n\n` +
                `▢ Player ❎: @${playerXTag}\n` +
                `▢ Player ⭕: 🤖 Neo (AI)\n\n` +
                `• Type a number (*1-9*) to place your move!\n` +
                `• Type *surrender* to give up.`;

            await socket.sendMessage(chatJid, {
                text: botTurnMessage,
                mentions: [userJid]
            }, { quoted: msg });

            return true;
        }
    }

    // Case 3: Next Turn (Human vs Human)
    const nextTurnTag = activeRoom.game.currentTurn.split('@')[0];
    const nextSymbol = activeRoom.game.currentTurn === activeRoom.game.playerX ? '❎' : '⭕';

    const turnMessage =
        `🎮 *TicTacToe Game*\n\n` +
        `🎲 Turn: @${nextTurnTag} (${nextSymbol})\n\n` +
        `${formatBoard(activeRoom.game)}\n\n` +
        `▢ Player ❎: @${playerXTag}\n` +
        `▢ Player ⭕: ${playerOTag}\n\n` +
        `• Type a number (*1-9*) to place your move!\n` +
        `• Type *surrender* to give up.`;

    await socket.sendMessage(chatJid, {
        text: turnMessage,
        mentions: [activeRoom.game.currentTurn, activeRoom.game.playerX, activeRoom.game.playerO]
    }, { quoted: msg });

    return true;
}

