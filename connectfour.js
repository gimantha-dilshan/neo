/**
 * Connect Four (C4 / CGF) Module for Neo WhatsApp Bot
 * Classic 7-column x 6-row connection game.
 * Supports 2-Player Multiplayer in Groups and Solo Play vs Neo AI in DMs & Groups.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cgfImagePath = path.join(__dirname, 'assets', 'cgf-menu-image.jpg');

let cachedCgfImage = null;

function getCgfImage() {
    if (cachedCgfImage) return cachedCgfImage;
    try {
        if (fs.existsSync(cgfImagePath)) {
            cachedCgfImage = fs.readFileSync(cgfImagePath);
            return cachedCgfImage;
        }
    } catch (err) {
        console.error('[ASSETS] Error loading Connect Four menu image:', err.message);
    }
    return null;
}

export async function sendC4MenuCard(socket, chatJid, captionText, quotedMsg, mentions = []) {
    const imageBuffer = getCgfImage();
    if (imageBuffer) {
        try {
            return await socket.sendMessage(chatJid, {
                image: imageBuffer,
                caption: captionText,
                mentions: mentions
            }, { quoted: quotedMsg });
        } catch (imgErr) {
            console.error('[ASSETS] Failed to send Connect Four menu image, falling back to text:', imgErr.message);
        }
    }
    return await socket.sendMessage(chatJid, {
        text: captionText,
        mentions: mentions
    }, { quoted: quotedMsg });
}

export function getC4Menu(greeting, isGroup) {
    const modeTip = isGroup
        ? `👥 *Multiplayer:* Run *.c4 start* to open a 2-player lobby in this group, or tag someone with *.c4 @user*.\n` +
          `🤖 *Solo Mode:* Run *.c4 bot* to challenge Neo AI.`
        : `🤖 *Solo Mode:* Run *.c4 bot* to challenge Neo AI here in DMs!\n` +
          `👥 *Multiplayer:* Run *.c4 start* inside a WhatsApp group to challenge friends.`;

    return (
        `*NEO ARCADE*  •  _Connect Four (C4)_\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Welcome ${greeting}! Connect 4 of your colored disks in a line (horizontal, vertical, or diagonal) before your opponent does!\n\n` +
        `${modeTip}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*COMMANDS & CONTROLS*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `• \`.c4 start\`  — Create or join a 2-player match (or \`.c4 play\`)\n` +
        `• \`.c4 @user\`  — Challenge a specific friend directly\n` +
        `• \`.c4 bot\`    — Play solo against Neo AI (🔴 You vs 🟡 Neo)\n` +
        `• \`1\` to \`7\`    — Drop your disk into that column (1 to 7)\n` +
        `• \`stop\`         — Terminate the match (or \`.c4 end\`)\n` +
        `• \`surrender\`    — Forfeit the active match\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 *Universal Controls:* \`stop\` and \`surrender\` work anytime with or without a dot (\`.\`).\n` +
        `💡 *Aliases:* \`.cgf\`, \`.connectfour\`, \`.c4\`\n` +
        `💡 *Navigation:* Type \`.help\` to view the main assistant directory.`
    );
}

export class ConnectFour {
    constructor(playerR = 'r', playerY = 'y') {
        this.playerR = playerR; // 🔴 Red (starts first)
        this.playerY = playerY; // 🟡 Yellow (starts second)
        this.rows = 6;
        this.cols = 7;
        this.board = Array.from({ length: 6 }, () => Array(7).fill(null));
        this.currentTurn = this.playerR;
        this.turns = 0;
        this.winner = null;
    }

    getLandingRow(col) {
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.board[r][col] === null) return r;
        }
        return -1;
    }

    drop(col, player) {
        if (this.winner || col < 0 || col >= this.cols) return -1;
        if (player !== this.currentTurn) return -2;

        const targetRow = this.getLandingRow(col);
        if (targetRow === -1) return 0; // Column is full

        const piece = player === this.playerR ? 'R' : 'Y';
        this.board[targetRow][col] = piece;
        this.turns++;

        if (this.checkWin(targetRow, col, piece)) {
            this.winner = player;
            return 2; // Winner
        }

        if (this.turns === this.rows * this.cols) {
            return 3; // Draw
        }

        this.currentTurn = this.currentTurn === this.playerR ? this.playerY : this.playerR;
        return 1; // Successful move
    }

    countDir(r, c, dr, dc, p) {
        let count = 0;
        let currR = r + dr;
        let currC = c + dc;
        while (currR >= 0 && currR < this.rows && currC >= 0 && currC < this.cols && this.board[currR][currC] === p) {
            count++;
            currR += dr;
            currC += dc;
        }
        return count;
    }

    checkWin(r, c, p) {
        // Horizontal (—)
        if (1 + this.countDir(r, c, 0, 1, p) + this.countDir(r, c, 0, -1, p) >= 4) return true;
        // Vertical (|)
        if (1 + this.countDir(r, c, 1, 0, p) + this.countDir(r, c, -1, 0, p) >= 4) return true;
        // Diagonal (\)
        if (1 + this.countDir(r, c, 1, 1, p) + this.countDir(r, c, -1, -1, p) >= 4) return true;
        // Diagonal (/)
        if (1 + this.countDir(r, c, 1, -1, p) + this.countDir(r, c, -1, 1, p) >= 4) return true;
        return false;
    }
}

// Active games storage: roomId -> game room object
export const c4Games = new Map();

export const BOT_JID = 'bot@neo';

/**
 * Intelligent AI move selector for solo bot Connect Four games
 */
export function getBestC4BotMove(game) {
    const validCols = [];
    for (let c = 0; c < 7; c++) {
        if (game.getLandingRow(c) !== -1) validCols.push(c);
    }
    if (validCols.length === 0) return -1;

    // 1. Win: If Bot (Y) can win in 1 move, take it!
    for (const c of validCols) {
        const r = game.getLandingRow(c);
        game.board[r][c] = 'Y';
        const win = game.checkWin(r, c, 'Y');
        game.board[r][c] = null;
        if (win) return c;
    }

    // 2. Block: If Opponent (R) is about to win in 1 move, block them!
    for (const c of validCols) {
        const r = game.getLandingRow(c);
        game.board[r][c] = 'R';
        const block = game.checkWin(r, c, 'R');
        game.board[r][c] = null;
        if (block) return c;
    }

    // 3. Avoid Blunder: Don't drop where opponent can immediately drop on top and win
    const safeCols = [];
    for (const c of validCols) {
        const r = game.getLandingRow(c);
        game.board[r][c] = 'Y';
        let safe = true;
        if (r > 0) {
            game.board[r - 1][c] = 'R';
            if (game.checkWin(r - 1, c, 'R')) safe = false;
            game.board[r - 1][c] = null;
        }
        game.board[r][c] = null;
        if (safe) safeCols.push(c);
    }

    const candidateCols = safeCols.length > 0 ? safeCols : validCols;
    // 4. Strategic Center preference in Connect Four: 4 (idx 3) is best, then 3 & 5, 2 & 6, 1 & 7
    const centerOrder = [3, 2, 4, 1, 5, 0, 6];
    for (const c of centerOrder) {
        if (candidateCols.includes(c)) return c;
    }
    return candidateCols[0];
}

/**
 * Formats the 7x6 Connect Four board for WhatsApp with emojis
 */
function formatC4Board(game) {
    const symbols = {
        'R': '🔴',
        'Y': '🟡',
        null: '⚪'
    };

    const header = '1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣';
    const gridRows = game.board.map(row => row.map(cell => symbols[cell] || '⚪').join(' '));
    return [header, ...gridRows].join('\n');
}

/**
 * Checks if a user is currently in an active Connect Four game
 */
export function isPlayerInConnectFour(userJid, chatJid) {
    for (const room of c4Games.values()) {
        if (room.chatJid === chatJid &&
            room.state === 'PLAYING' &&
            (room.game.playerR === userJid || room.game.playerY === userJid)) {
            return true;
        }
    }
    return false;
}

/**
 * Handles .c4 / .cgf / .connectfour commands
 */
export async function handleConnectFourCommand(socket, chatJid, userJid, pushName, commandText, msg, isGroup) {
    const parts = commandText.trim().split(/\s+/);
    const subCommand = (parts[1] || "").toLowerCase();

    // 1. MENU & HELP COMMAND (.c4 / .c4 help / .c4 menu)
    if (!subCommand || subCommand === 'help' || subCommand === 'menu') {
        const greeting = isGroup ? `@${userJid.split('@')[0]}` : `*${pushName}*`;
        const menuText = getC4Menu(greeting, isGroup);
        await sendC4MenuCard(socket, chatJid, menuText, msg, isGroup ? [userJid] : []);
        return;
    }

    // 2. SURRENDER COMMAND (.c4 surrender / .c4 giveup)
    if (subCommand === 'surrender' || subCommand === 'giveup') {
        for (const [roomId, room] of c4Games.entries()) {
            if (room.chatJid === chatJid && (room.game.playerR === userJid || room.game.playerY === userJid)) {
                if (room.state === 'WAITING') {
                    clearTimeout(room.timeout);
                    c4Games.delete(roomId);
                    await socket.sendMessage(chatJid, { text: `🛑 *Game Cancelled:* Waiting room deleted.` }, { quoted: msg });
                    return;
                }

                clearTimeout(room.timeout);
                const winner = userJid === room.game.playerR ? room.game.playerY : room.game.playerR;
                const isWinnerBot = winner === BOT_JID;
                const winnerTag = isWinnerBot ? '🤖 Neo (AI)' : `@${winner.split('@')[0]}`;
                const loserTag = userJid.split('@')[0];

                await socket.sendMessage(chatJid, {
                    text: `🏳️ @${loserTag} has surrendered!\n\n🎉 ${winnerTag} wins the game! 🏆`,
                    mentions: isWinnerBot ? [userJid] : [userJid, winner]
                }, { quoted: msg });

                c4Games.delete(roomId);
                return;
            }
        }

        await socket.sendMessage(chatJid, { text: `❌ You are not in an active Connect Four game.` }, { quoted: msg });
        return;
    }

    // 3. CANCEL / STOP / END COMMAND (.c4 cancel / .c4 end / .c4 stop)
    if (subCommand === 'cancel' || subCommand === 'end' || subCommand === 'stop') {
        for (const [roomId, room] of c4Games.entries()) {
            if (room.chatJid === chatJid && (room.game.playerR === userJid || room.game.playerY === userJid)) {
                clearTimeout(room.timeout);
                c4Games.delete(roomId);
                const msgText = room.state === 'WAITING'
                    ? `🛑 *Connect Four room cancelled.*`
                    : `🛑 *Connect Four Game stopped by @${userJid.split('@')[0]}!*`;
                await socket.sendMessage(chatJid, { text: msgText, mentions: [userJid] }, { quoted: msg });
                return;
            }
        }

        await socket.sendMessage(chatJid, { text: `❌ You do not have an active Connect Four game to stop.` }, { quoted: msg });
        return;
    }

    // 4. CHECK IF USER IS ALREADY PLAYING
    for (const room of c4Games.values()) {
        if (room.chatJid === chatJid && room.state === 'PLAYING' && (room.game.playerR === userJid || room.game.playerY === userJid)) {
            await socket.sendMessage(chatJid, {
                text: `❌ You are already in an active game!\nType a column number (*1-7*) to drop a disk, or type *surrender* to forfeit.`,
                mentions: [userJid]
            }, { quoted: msg });
            return;
        }
    }

    // 5. BOT SOLO COMMAND (.c4 bot / .c4 ai)
    if (subCommand === 'bot' || subCommand === 'ai') {
        // Clean up any existing waiting room created by this user
        for (const [roomId, room] of c4Games.entries()) {
            if (room.chatJid === chatJid && room.game.playerR === userJid && room.state === 'WAITING') {
                clearTimeout(room.timeout);
                c4Games.delete(roomId);
                break;
            }
        }

        const roomId = `c4-bot-${Date.now()}`;
        const newRoom = {
            id: roomId,
            chatJid,
            game: new ConnectFour(userJid, BOT_JID),
            state: 'PLAYING',
            isBot: true,
            timeout: setTimeout(() => {
                if (c4Games.has(roomId)) {
                    c4Games.delete(roomId);
                    socket.sendMessage(chatJid, { text: `⏰ *Connect Four Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
                }
            }, 300000)
        };

        c4Games.set(roomId, newRoom);

        const userTag = userJid.split('@')[0];
        const startText =
            `🎮 *Connect Four Solo Game Started!*\n\n` +
            `🎲 Turn: @${userTag} (🔴 Red)\n\n` +
            `${formatC4Board(newRoom.game)}\n\n` +
            `▢ Player 🔴: @${userTag}\n` +
            `▢ Player 🟡: 🤖 Neo (AI)\n\n` +
            `• Type a column number (*1-7*) on your turn to drop your disk!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: startText,
            mentions: [userJid]
        }, { quoted: msg });
        return;
    }

    // 6. MULTIPLAYER START (.c4 start / .c4 play / .c4 @user)
    const isStartOrPlay = subCommand === 'start' || subCommand === 'play';
    const isChallenge = commandText.includes('@');

    // If no valid multiplayer start command given, display the C4 menu card
    if (!isStartOrPlay && !isChallenge) {
        const greeting = isGroup ? `@${userJid.split('@')[0]}` : `*${pushName}*`;
        const menuText = getC4Menu(greeting, isGroup);
        await sendC4MenuCard(socket, chatJid, menuText, msg, isGroup ? [userJid] : []);
        return;
    }

    // If user attempts multiplayer in a private chat (DM)
    if (!isGroup) {
        await socket.sendMessage(chatJid, {
            text: `🤖 *Connect Four in Private Chat:*\n\nTo play solo against Neo AI here in DMs, please send *.c4 bot*!\n\n_To challenge a human friend, run *.c4 start* inside a WhatsApp group chat._`,
            mentions: [userJid]
        }, { quoted: msg });
        return;
    }

    // 7. CHECK FOR EXISTING WAITING ROOM IN THIS CHAT
    let waitingRoom = null;
    let waitingRoomId = null;
    for (const [id, r] of c4Games.entries()) {
        if (r.chatJid === chatJid && r.state === 'WAITING') {
            waitingRoom = r;
            waitingRoomId = id;
            break;
        }
    }

    if (waitingRoom) {
        // Can't play against yourself in the same chat
        if (waitingRoom.game.playerR === userJid) {
            await socket.sendMessage(chatJid, {
                text: `⏳ *Still waiting for an opponent!*\nType *.c4 cancel* if you want to close this room.`,
                mentions: [userJid]
            }, { quoted: msg });
            return;
        }

        // Join existing room as Player Y (🟡)
        waitingRoom.game.playerY = userJid;
        waitingRoom.state = 'PLAYING';

        // Reset inactivity timer for 5 minutes
        clearTimeout(waitingRoom.timeout);
        waitingRoom.timeout = setTimeout(() => {
            if (c4Games.has(waitingRoomId)) {
                c4Games.delete(waitingRoomId);
                socket.sendMessage(chatJid, { text: `⏰ *Connect Four Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
            }
        }, 300000);

        const currentTurnTag = waitingRoom.game.currentTurn.split('@')[0];
        const playerRTag = waitingRoom.game.playerR.split('@')[0];
        const playerYTag = userJid.split('@')[0];

        const boardText =
            `🎮 *Connect Four Match Started!*\n\n` +
            `🎲 Turn: @${currentTurnTag} (🔴 Red)\n\n` +
            `${formatC4Board(waitingRoom.game)}\n\n` +
            `▢ Player 🔴: @${playerRTag}\n` +
            `▢ Player 🟡: @${playerYTag}\n\n` +
            `• Type a column number (*1-7*) on your turn to drop your disk!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: boardText,
            mentions: [waitingRoom.game.playerR, userJid, waitingRoom.game.currentTurn]
        }, { quoted: msg });

    } else {
        // Create new room waiting for opponent
        const roomId = `c4-${Date.now()}`;
        const newRoom = {
            id: roomId,
            chatJid,
            game: new ConnectFour(userJid, ''),
            state: 'WAITING',
            timeout: setTimeout(() => {
                if (c4Games.has(roomId)) {
                    c4Games.delete(roomId);
                    socket.sendMessage(chatJid, { text: `⏰ *Connect Four waiting room closed due to timeout.*` }).catch(() => {});
                }
            }, 180000) // 3 min waiting timeout
        };

        c4Games.set(roomId, newRoom);

        const userTag = userJid.split('@')[0];
        const waitText =
            `🎮 *Connect Four Room Created!*\n\n` +
            `👤 Challenged by: @${userTag}\n` +
            `⏳ Waiting for an opponent to join...\n\n` +
            `👉 Type *.c4 start* to accept the challenge and play!`;

        await socket.sendMessage(chatJid, {
            text: waitText,
            mentions: [userJid]
        }, { quoted: msg });
    }
}

/**
 * Handles in-game moves (1-7), stop/end, or surrender messages for Connect Four
 * Returns true if the message was handled as a Connect Four action, false otherwise.
 */
export async function handleConnectFourMove(socket, chatJid, userJid, rawText, msg, isGroup) {
    const textClean = (rawText || "").trim();
    if (!textClean) return false;

    // Find active (PLAYING or WAITING) game for this user in this chat
    let targetRoom = null;
    let targetRoomId = null;

    for (const [id, r] of c4Games.entries()) {
        if (r.chatJid === chatJid &&
            (r.game.playerR === userJid || r.game.playerY === userJid)) {
            targetRoom = r;
            targetRoomId = id;
            break;
        }
    }

    if (!targetRoom) return false;

    // 1. Check for STOP or END (with or without prefix)
    const isStop = /^(stop|end|cancel|\.stop|\.end|\.cancel|\.(c4|cgf)\s+(stop|end|cancel))$/i.test(textClean);
    if (isStop) {
        clearTimeout(targetRoom.timeout);
        c4Games.delete(targetRoomId);
        const statusText = targetRoom.state === 'WAITING'
            ? `🛑 *Connect Four waiting room cancelled.*`
            : `🛑 *Connect Four Game stopped by @${userJid.split('@')[0]}!*`;
        await socket.sendMessage(chatJid, {
            text: statusText,
            mentions: [userJid]
        }, { quoted: msg });
        return true;
    }

    // 2. Check for SURRENDER (with or without prefix)
    const isSurrender = /^(surrender|give\s*up|\.surrender|\.giveup|\.(c4|cgf)\s+(surrender|give\s*up))$/i.test(textClean);
    if (isSurrender) {
        clearTimeout(targetRoom.timeout);
        if (targetRoom.state === 'WAITING') {
            c4Games.delete(targetRoomId);
            await socket.sendMessage(chatJid, { text: `🛑 *Game Cancelled:* Waiting room deleted.` }, { quoted: msg });
            return true;
        }

        const winner = userJid === targetRoom.game.playerR ? targetRoom.game.playerY : targetRoom.game.playerR;
        const isWinnerBot = winner === BOT_JID;
        const winnerTag = isWinnerBot ? '🤖 Neo (AI)' : `@${winner.split('@')[0]}`;
        const loserTag = userJid.split('@')[0];

        await socket.sendMessage(chatJid, {
            text: `🏳️ @${loserTag} has surrendered!\n\n🎉 ${winnerTag} wins the game! 🏆`,
            mentions: isWinnerBot ? [userJid] : [userJid, winner]
        }, { quoted: msg });

        c4Games.delete(targetRoomId);
        return true;
    }

    // 3. Move handling (only valid when room state is PLAYING)
    if (targetRoom.state !== 'PLAYING') return false;

    // Check for column move: 1-7 or .1-.7
    const matchNumber = textClean.match(/^\.?([1-7])$/);
    if (!matchNumber) {
        return false;
    }

    const activeRoom = targetRoom;
    const activeRoomId = targetRoomId;

    // It's a move (columns 1-7 -> index 0-6)
    const colIndex = parseInt(matchNumber[1], 10) - 1;

    // Check if it's the sender's turn
    if (userJid !== activeRoom.game.currentTurn) {
        const turnTag = activeRoom.game.currentTurn.split('@')[0];
        await socket.sendMessage(chatJid, {
            text: `❌ *Not your turn!*\nWaiting for @${turnTag} to drop a disk.`,
            mentions: [activeRoom.game.currentTurn]
        }, { quoted: msg });
        return true;
    }

    // Execute the drop
    const dropResult = activeRoom.game.drop(colIndex, userJid);

    if (dropResult === 0) {
        await socket.sendMessage(chatJid, {
            text: `❌ *Column ${colIndex + 1} is completely full!* Please select another column (1-7).`,
            mentions: [userJid]
        }, { quoted: msg });
        return true;
    }

    if (dropResult < 0) {
        return true;
    }

    // Refresh inactivity timer
    clearTimeout(activeRoom.timeout);
    activeRoom.timeout = setTimeout(() => {
        if (c4Games.has(activeRoomId)) {
            c4Games.delete(activeRoomId);
            socket.sendMessage(chatJid, { text: `⏰ *Connect Four Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
        }
    }, 300000);

    const isBotGame = activeRoom.game.playerY === BOT_JID;
    const playerRTag = activeRoom.game.playerR.split('@')[0];
    const playerYTag = isBotGame ? '🤖 Neo (AI)' : `@${activeRoom.game.playerY.split('@')[0]}`;

    // Case 1: Player won
    if (dropResult === 2) {
        clearTimeout(activeRoom.timeout);
        const winnerTag = userJid.split('@')[0];
        const symbol = userJid === activeRoom.game.playerR ? '🔴 Red' : '🟡 Yellow';

        const winMessage =
            `🎮 *Connect Four — Game Over!*\n\n` +
            `🎉 @${winnerTag} (${symbol}) has connected 4 and WON the game! 🏆✨\n\n` +
            `${formatC4Board(activeRoom.game)}\n\n` +
            `▢ Player 🔴: @${playerRTag}\n` +
            `▢ Player 🟡: ${playerYTag}\n\n` +
            `_Type ${isBotGame ? '*.c4 bot*' : '*.c4 start*'} to play a rematch!_`;

        await socket.sendMessage(chatJid, {
            text: winMessage,
            mentions: isBotGame ? [userJid] : [activeRoom.game.playerR, activeRoom.game.playerY]
        }, { quoted: msg });

        c4Games.delete(activeRoomId);
        return true;
    }

    // Case 2: Draw
    if (dropResult === 3) {
        clearTimeout(activeRoom.timeout);
        const drawMessage =
            `🎮 *Connect Four — Game Over!*\n\n` +
            `🤝 The board is full! The match ended in a *DRAW!* ⚖️\n\n` +
            `${formatC4Board(activeRoom.game)}\n\n` +
            `▢ Player 🔴: @${playerRTag}\n` +
            `▢ Player 🟡: ${playerYTag}\n\n` +
            `_Type ${isBotGame ? '*.c4 bot*' : '*.c4 start*'} to play a rematch!_`;

        await socket.sendMessage(chatJid, {
            text: drawMessage,
            mentions: isBotGame ? [userJid] : [activeRoom.game.playerR, activeRoom.game.playerY]
        }, { quoted: msg });

        c4Games.delete(activeRoomId);
        return true;
    }

    // Case 3: Solo Bot Game AI Turn
    if (isBotGame) {
        const botCol = getBestC4BotMove(activeRoom.game);
        if (botCol >= 0) {
            const botResult = activeRoom.game.drop(botCol, BOT_JID);

            if (botResult === 2) {
                clearTimeout(activeRoom.timeout);
                const botWinMessage =
                    `🎮 *Connect Four — Game Over!*\n\n` +
                    `🤖 *Neo (AI)* (🟡 Yellow) connected 4 and WON the game! 🏆🤖\n\n` +
                    `${formatC4Board(activeRoom.game)}\n\n` +
                    `▢ Player 🔴: @${playerRTag}\n` +
                    `▢ Player 🟡: 🤖 Neo (AI)\n\n` +
                    `_Better luck next time! Type *.c4 bot* to retry._`;

                await socket.sendMessage(chatJid, {
                    text: botWinMessage,
                    mentions: [userJid]
                }, { quoted: msg });

                c4Games.delete(activeRoomId);
                return true;
            }

            if (botResult === 3) {
                clearTimeout(activeRoom.timeout);
                const botDrawMessage =
                    `🎮 *Connect Four — Game Over!*\n\n` +
                    `🤝 The board is full! The match ended in a *DRAW!* ⚖️\n\n` +
                    `${formatC4Board(activeRoom.game)}\n\n` +
                    `▢ Player 🔴: @${playerRTag}\n` +
                    `▢ Player 🟡: 🤖 Neo (AI)\n\n` +
                    `_Type *.c4 bot* to start a rematch!_`;

                await socket.sendMessage(chatJid, {
                    text: botDrawMessage,
                    mentions: [userJid]
                }, { quoted: msg });

                c4Games.delete(activeRoomId);
                return true;
            }

            // Normal next turn for human player
            const botPlayedCol = botCol + 1;
            const botTurnMessage =
                `🎮 *Connect Four Solo Game*\n\n` +
                `🤖 Neo dropped a disk into column *${botPlayedCol}*!\n` +
                `🎲 Your Turn: @${playerRTag} (🔴 Red)\n\n` +
                `${formatC4Board(activeRoom.game)}\n\n` +
                `▢ Player 🔴: @${playerRTag}\n` +
                `▢ Player 🟡: 🤖 Neo (AI)\n\n` +
                `• Type a column number (*1-7*) to drop your disk!\n` +
                `• Type *surrender* to give up.`;

            await socket.sendMessage(chatJid, {
                text: botTurnMessage,
                mentions: [userJid]
            }, { quoted: msg });

            return true;
        }
    }

    // Case 4: Human vs Human Next Turn
    const nextTurnTag = activeRoom.game.currentTurn.split('@')[0];
    const nextSymbol = activeRoom.game.currentTurn === activeRoom.game.playerR ? '🔴 Red' : '🟡 Yellow';

    const turnMessage =
        `🎮 *Connect Four Game*\n\n` +
        `🎲 Turn: @${nextTurnTag} (${nextSymbol})\n\n` +
        `${formatC4Board(activeRoom.game)}\n\n` +
        `▢ Player 🔴: @${playerRTag}\n` +
        `▢ Player 🟡: ${playerYTag}\n\n` +
        `• Type a column number (*1-7*) to drop your disk!\n` +
        `• Type *surrender* to give up.`;

    await socket.sendMessage(chatJid, {
        text: turnMessage,
        mentions: [activeRoom.game.currentTurn, activeRoom.game.playerR, activeRoom.game.playerY]
    }, { quoted: msg });

    return true;
}

