/**
 * Game Manager Module for Neo WhatsApp Bot
 * Coordinates all games (Tic-Tac-Toe, Connect Four, Word Chain Game).
 * Enforces single-game-at-a-time rule per chat and unified 'join' handling across all games.
 */

import { games as tttGames, formatBoard as formatTttBoard, handleTicTacToeMove } from './tictactoe.js';
import { c4Games, formatC4Board, handleConnectFourMove } from './connectfour.js';
import { activeGames as wcgGames, mentionjid, handleWordChainWord } from './wordchain.js';

/**
 * Returns info about any active game (either WAITING or PLAYING) in this chat
 */
export function getActiveGameInChat(chatJid) {
    // 1. Check Word Chain Game
    if (wcgGames.has(chatJid)) {
        const wcg = wcgGames.get(chatJid);
        if (wcg && wcg.gameState !== 'ended') {
            return {
                type: 'wcg',
                name: 'Word Chain Game',
                state: wcg.gameState === 'waiting' ? 'WAITING' : 'PLAYING',
                raw: wcg
            };
        }
    }

    // 2. Check Tic-Tac-Toe
    for (const [id, room] of tttGames.entries()) {
        if (room.chatJid === chatJid) {
            return {
                type: 'ttt',
                name: 'Tic-Tac-Toe',
                state: room.state, // 'WAITING' or 'PLAYING'
                roomId: id,
                raw: room
            };
        }
    }

    // 3. Check Connect Four
    for (const [id, room] of c4Games.entries()) {
        if (room.chatJid === chatJid) {
            return {
                type: 'c4',
                name: 'Connect Four',
                state: room.state, // 'WAITING' or 'PLAYING'
                roomId: id,
                raw: room
            };
        }
    }

    return null;
}

/**
 * Validates whether a new game of the given type can be started in this chat.
 * Enforces: Only ONE game can run in a chat at a time across all game types.
 */
export async function canStartNewGame(socket, chatJid, userJid, requestedGameType, msg) {
    const active = getActiveGameInChat(chatJid);
    if (!active) return true;

    const gameNames = {
        'ttt': 'Tic-Tac-Toe',
        'c4': 'Connect Four',
        'wcg': 'Word Chain Game'
    };
    const targetName = gameNames[requestedGameType] || requestedGameType;

    // Case 1: Another game of a DIFFERENT type is currently active or waiting
    if (active.type !== requestedGameType) {
        const activeStatus = active.state === 'WAITING' ? 'Lobby Waiting for Players' : 'In Progress';
        const errorText =
            `❌ *Another game is already active in this chat!*\n\n` +
            `🎮 *Active Game:* ${active.name} (${activeStatus})\n` +
            `⚠️ *Rule:* Only one game can run in a chat at the same time.\n\n` +
            `_Please finish the active match or type *stop* to end it before starting ${targetName}!_`;

        await socket.sendMessage(chatJid, {
            text: errorText,
            mentions: [userJid]
        }, { quoted: msg });
        return false;
    }

    // Case 2: The SAME game type is already in progress (PLAYING)
    if (active.state === 'PLAYING') {
        const errorText =
            `❌ A *${active.name}* match is already in progress in this chat!\n\n` +
            `_Please wait for the current match to finish, or type *stop* to terminate it._`;

        await socket.sendMessage(chatJid, {
            text: errorText,
            mentions: [userJid]
        }, { quoted: msg });
        return false;
    }

    // Case 3: The same game type is WAITING (e.g. user is joining or managing the lobby)
    return true;
}

/**
 * Unified handler for group members sending 'join' to enter any active game lobby.
 */
export async function joinGameInChat(socket, chatJid, userJid, pushName, msg, isGroup, isExplicit = false) {
    if (!isGroup) {
        if (isExplicit) {
            await socket.sendMessage(chatJid, {
                text: `👥 *Multiplayer lobbies are for Group Chats!*\n\nTo play solo against Neo AI here in DMs, send *.ttt bot* or *.c4 bot*.`,
                mentions: [userJid]
            }, { quoted: msg });
            return true;
        }
        return false;
    }

    const active = getActiveGameInChat(chatJid);
    if (!active) {
        if (isExplicit) {
            await socket.sendMessage(chatJid, {
                text: `❌ *No open game lobby in this chat!*\n\nStart a new game lobby using:\n• *.c4 start* — Connect Four\n• *.ttt start* — Tic-Tac-Toe\n• *.wcg start* — Word Chain Game`,
                mentions: [userJid]
            }, { quoted: msg });
            return true;
        }
        return false;
    }

    // If game is already in progress
    if (active.state === 'PLAYING') {
        if (isExplicit) {
            await socket.sendMessage(chatJid, {
                text: `❌ *${active.name} is already in progress!*\nYou cannot join mid-game. Please wait for this match to end.`,
                mentions: [userJid]
            }, { quoted: msg });
            return true;
        }
        return false;
    }

    // Game is WAITING -> Join whichever game is waiting!
    // 1. Join Word Chain Game
    if (active.type === 'wcg') {
        const game = active.raw;
        if (game.addPlayer(userJid, pushName)) {
            await socket.sendMessage(chatJid, {
                text: `🙋‍♂️ ${mentionjid(userJid)} joined the game! 👏 (Total: ${game.players.length})\n_Other players can type *join* to enter!_`,
                mentions: [userJid]
            }, { quoted: msg });
        } else {
            await socket.sendMessage(chatJid, {
                text: `⚠️ ${mentionjid(userJid)} You have already joined!`,
                mentions: [userJid]
            }, { quoted: msg });
        }
        return true;
    }

    // 2. Join Tic-Tac-Toe
    if (active.type === 'ttt') {
        const room = active.raw;
        if (room.game.playerX === userJid) {
            await socket.sendMessage(chatJid, {
                text: `⚠️ You are already Player ❎ in this match! Waiting for an opponent to type *join*.`,
                mentions: [userJid]
            }, { quoted: msg });
            return true;
        }

        // Join as Player O
        room.game.playerO = userJid;
        room.state = 'PLAYING';

        clearTimeout(room.timeout);
        room.timeout = setTimeout(() => {
            if (tttGames.has(active.roomId)) {
                tttGames.delete(active.roomId);
                socket.sendMessage(chatJid, { text: `⏰ *TicTacToe Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
            }
        }, 300000);

        const currentTurnTag = room.game.currentTurn.split('@')[0];
        const playerXTag = room.game.playerX.split('@')[0];
        const playerOTag = userJid.split('@')[0];

        const boardText =
            `🎮 *Tic-Tac-Toe Match Started!*\n\n` +
            `🎲 Turn: @${currentTurnTag} (❎)\n\n` +
            `${formatTttBoard(room.game)}\n\n` +
            `▢ Player ❎: @${playerXTag}\n` +
            `▢ Player ⭕: @${playerOTag}\n\n` +
            `• Type a number (*1-9*) on your turn to place your symbol!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: boardText,
            mentions: [room.game.playerX, userJid, room.game.currentTurn]
        }, { quoted: msg });
        return true;
    }

    // 3. Join Connect Four
    if (active.type === 'c4') {
        const room = active.raw;
        if (room.game.playerR === userJid) {
            await socket.sendMessage(chatJid, {
                text: `⚠️ You are already Player 🔴 in this match! Waiting for an opponent to type *join*.`,
                mentions: [userJid]
            }, { quoted: msg });
            return true;
        }

        // Join as Player Y
        room.game.playerY = userJid;
        room.state = 'PLAYING';

        clearTimeout(room.timeout);
        room.timeout = setTimeout(() => {
            if (c4Games.has(active.roomId)) {
                c4Games.delete(active.roomId);
                socket.sendMessage(chatJid, { text: `⏰ *Connect Four Game Expired due to 5 minutes of inactivity.*` }).catch(() => {});
            }
        }, 300000);

        const currentTurnTag = room.game.currentTurn.split('@')[0];
        const playerRTag = room.game.playerR.split('@')[0];
        const playerYTag = userJid.split('@')[0];

        const boardText =
            `🎮 *Connect Four Match Started!*\n\n` +
            `🎲 Turn: @${currentTurnTag} (🔴 Red)\n\n` +
            `${formatC4Board(room.game)}\n\n` +
            `▢ Player 🔴: @${playerRTag}\n` +
            `▢ Player 🟡: @${playerYTag}\n\n` +
            `• Type a column number (*1-7*) on your turn to drop your disk!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: boardText,
            mentions: [room.game.playerR, userJid, room.game.currentTurn]
        }, { quoted: msg });
        return true;
    }

    return false;
}

/**
 * Universal handler to terminate any active game or waiting lobby in a chat
 */
export async function stopGameInChat(socket, chatJid, userJid, msg, isGroup, isExplicit = false) {
    const active = getActiveGameInChat(chatJid);
    if (!active) {
        if (isExplicit) {
            await socket.sendMessage(chatJid, {
                text: `❌ *No active game to stop in this chat.*`,
                mentions: [userJid]
            }, { quoted: msg });
            return true;
        }
        return false;
    }

    const userTag = userJid.split('@')[0];

    // 1. Stop Word Chain
    if (active.type === 'wcg') {
        const game = active.raw;
        game.clearTimers();
        wcgGames.delete(chatJid);
        await socket.sendMessage(chatJid, {
            text: `🛑 *Word Chain Game stopped by @${userTag}!*`,
            mentions: [userJid]
        }, { quoted: msg });
        return true;
    }

    // 2. Stop Tic-Tac-Toe
    if (active.type === 'ttt') {
        const room = active.raw;
        clearTimeout(room.timeout);
        tttGames.delete(active.roomId);
        const text = room.state === 'WAITING'
            ? `🛑 *Tic-Tac-Toe lobby cancelled by @${userTag}.*`
            : `🛑 *Tic-Tac-Toe match stopped by @${userTag}!*`;
        await socket.sendMessage(chatJid, { text, mentions: [userJid] }, { quoted: msg });
        return true;
    }

    // 3. Stop Connect Four
    if (active.type === 'c4') {
        const room = active.raw;
        clearTimeout(room.timeout);
        c4Games.delete(active.roomId);
        const text = room.state === 'WAITING'
            ? `🛑 *Connect Four lobby cancelled by @${userTag}.*`
            : `🛑 *Connect Four match stopped by @${userTag}!*`;
        await socket.sendMessage(chatJid, { text, mentions: [userJid] }, { quoted: msg });
        return true;
    }

    return false;
}

/**
 * Main game message interceptor.
 * Checks for:
 * 1. 'stop' or 'end'
 * 2. 'join'
 * 3. Active game moves (1-9 for TTT, 1-7 for C4, words for WCG, surrender)
 */
export async function handleGameMessage(socket, chatJid, userJid, pushName, rawText, msg, isGroup) {
    const text = (rawText || "").trim();
    if (!text) return false;
    const lower = text.toLowerCase();

    // 1. Check for universal STOP or END (with or without dot)
    if (/^(stop|end|cancel|\.stop|\.end|\.cancel)$/i.test(lower)) {
        const stopped = await stopGameInChat(socket, chatJid, userJid, msg, isGroup, lower.startsWith('.'));
        if (stopped) return true;
    }

    // 2. Check for universal JOIN (with or without dot)
    if (/^(join|\.join|join\s+game|\.join\s+game)$/i.test(lower)) {
        const joined = await joinGameInChat(socket, chatJid, userJid, pushName, msg, isGroup, lower.startsWith('.'));
        if (joined) return true;
    }

    // 3. Dispatch to the currently active game in this chat
    const active = getActiveGameInChat(chatJid);
    if (!active) return false;

    if (active.type === 'ttt') {
        return await handleTicTacToeMove(socket, chatJid, userJid, text, msg, isGroup);
    }
    if (active.type === 'c4') {
        return await handleConnectFourMove(socket, chatJid, userJid, text, msg, isGroup);
    }
    if (active.type === 'wcg') {
        return await handleWordChainWord(socket, chatJid, userJid, pushName, text, msg, isGroup);
    }

    return false;
}

