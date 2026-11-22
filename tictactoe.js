/**
 * TicTacToe Module for Neo WhatsApp Bot
 * Includes 2-Player Multiplayer and Solo Play vs Neo AI
 */

export const BOT_JID = 'neo@bot';

export const WINNING_PATTERNS = [
    0b111000000, // Row 3 (6, 7, 8)
    0b000111000, // Row 2 (3, 4, 5)
    0b000000111, // Row 1 (0, 1, 2)
    0b100100100, // Col 3 (2, 5, 8)
    0b010010010, // Col 2 (1, 4, 7)
    0b001001001, // Col 1 (0, 3, 6)
    0b100010001, // Diagonal (0, 4, 8)
    0b001010100  // Diagonal (2, 4, 6)
];

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
        // Check X's moves
        for (const pattern of WINNING_PATTERNS) {
            if ((this._x & pattern) === pattern) {
                return this.playerX;
            }
        }

        // Check O's moves
        for (const pattern of WINNING_PATTERNS) {
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
 * Calculates the best move for the bot (O)
 * Priority:
 * 1. Win if possible (complete 3-in-a-row)
 * 2. Block opponent (X) winning move
 * 3. Take center (position 4 / spot 5)
 * 4. Take available corner (0, 2, 6, 8)
 * 5. Take any remaining available cell
 */
export function getBestBotMove(game) {
    const occupied = game._x | game._o;
    const available = [];
    for (let i = 0; i < 9; i++) {
        if (!((occupied >> i) & 1)) {
            available.push(i);
        }
    }

    if (available.length === 0) return -1;

    // 1. Check if bot (O) can win in 1 move
    for (const pos of available) {
        const simulatedO = game._o | (1 << pos);
        for (const pattern of WINNING_PATTERNS) {
            if ((simulatedO & pattern) === pattern) {
                return pos;
            }
        }
    }

    // 2. Check if player (X) can win in 1 move, and block them
    for (const pos of available) {
        const simulatedX = game._x | (1 << pos);
        for (const pattern of WINNING_PATTERNS) {
            if ((simulatedX & pattern) === pattern) {
                return pos;
            }
        }
    }

    // 3. Take center if available
    if (available.includes(4)) {
        return 4;
    }

    // 4. Take a corner if available
    const corners = [0, 2, 6, 8].filter(c => available.includes(c));
    if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
    }

    // 5. Take any remaining spot
    return available[Math.floor(Math.random() * available.length)];
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

    // 1. HELP COMMAND
    if (subCommand === 'help') {
        const helpText =
            `🎮 *TicTacToe (TTT) Commands:*\n\n` +
            `• *.ttt bot* - Play solo against Neo AI 🤖\n` +
            `• *.ttt* - Start a new multiplayer game or join a waiting game\n` +
            `• *.ttt @friend* - Challenge a specific friend in the group\n` +
            `• *.ttt cancel* - Cancel a game room you created\n` +
            `• *.ttt surrender* - Surrender the current game\n` +
            `• *1-9* - Type any number (1 to 9) on your turn to place your mark!`;
        await socket.sendMessage(chatJid, { text: helpText }, { quoted: msg });
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
                const userTag = userJid.split('@')[0];

                if (room.isBotGame) {
                    await socket.sendMessage(chatJid, {
                        text: `🏳️ @${userTag} has surrendered!\n\n🤖 *Neo wins the game!* 🏆\n\n_Type *.ttt bot* to play again!_`,
                        mentions: [userJid]
                    }, { quoted: msg });
                } else {
                    const winner = userJid === room.game.playerX ? room.game.playerO : room.game.playerX;
                    const winnerTag = winner.split('@')[0];
                    await socket.sendMessage(chatJid, {
                        text: `🏳️ @${userTag} has surrendered!\n\n🎉 @${winnerTag} wins the game! 🏆`,
                        mentions: [userJid, winner]
                    }, { quoted: msg });
                }

                games.delete(roomId);
                return;
            }
        }

        await socket.sendMessage(chatJid, { text: `❌ You are not in an active TicTacToe game.` }, { quoted: msg });
        return;
    }

    // 3. CANCEL WAITING ROOM (.ttt cancel)
    if (subCommand === 'cancel' || subCommand === 'end') {
        for (const [roomId, room] of games.entries()) {
            if (room.chatJid === chatJid && room.game.playerX === userJid && room.state === 'WAITING') {
                clearTimeout(room.timeout);
                games.delete(roomId);
                await socket.sendMessage(chatJid, { text: `🛑 *TicTacToe room cancelled.*` }, { quoted: msg });
                return;
            }
        }

        await socket.sendMessage(chatJid, { text: `❌ You do not have a waiting TicTacToe room to cancel.` }, { quoted: msg });
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

    // 5. SOLO GAME AGAINST BOT (.ttt bot / .ttt ai / .ttt solo or in DM .ttt)
    const isBotCommand = subCommand === 'bot' || subCommand === 'ai' || subCommand === 'solo' || (!isGroup && !subCommand);
    if (isBotCommand) {
        // Clear any old waiting room created by this user
        for (const [roomId, room] of games.entries()) {
            if (room.chatJid === chatJid && room.game.playerX === userJid && room.state === 'WAITING') {
                clearTimeout(room.timeout);
                games.delete(roomId);
            }
        }

        const roomId = `ttt-bot-${userJid.split('@')[0]}-${Date.now()}`;
        const newRoom = {
            id: roomId,
            chatJid,
            game: new TicTacToe(userJid, BOT_JID),
            state: 'PLAYING',
            isBotGame: true,
            timeout: setTimeout(() => {
                if (games.has(roomId)) {
                    games.delete(roomId);
                    socket.sendMessage(chatJid, { text: `⏰ *TicTacToe Game with Neo Expired due to 5 minutes of inactivity.*` }).catch(() => {});
                }
            }, 300000) // 5 min inactivity
        };

        games.set(roomId, newRoom);

        const userTag = userJid.split('@')[0];
        const startText =
            `🎮 *TicTacToe vs Neo AI!* 🤖\n\n` +
            `🎲 Turn: @${userTag} (❎)\n\n` +
            `${formatBoard(newRoom.game)}\n\n` +
            `▢ Player ❎: @${userTag} (You)\n` +
            `▢ Player ⭕: Neo 🤖\n\n` +
            `• Type a number (*1-9*) on your turn to place your mark!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: startText,
            mentions: [userJid]
        }, { quoted: msg });
        return;
    }

    // 6. CHECK FOR CHALLENGED USER (@user)
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let challengedJid = null;
    if (mentionedJids.length > 0) {
        challengedJid = mentionedJids[0];
    } else {
        const mentionMatch = commandText.match(/@(\d{7,15})/);
        if (mentionMatch) {
            challengedJid = `${mentionMatch[1]}@s.whatsapp.net`;
        }
    }

    if (challengedJid && challengedJid === userJid) {
        await socket.sendMessage(chatJid, { text: `❌ You cannot challenge yourself!` }, { quoted: msg });
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

        // Check if room was challenged to a specific person
        if (waitingRoom.challengedJid && waitingRoom.challengedJid !== userJid) {
            const targetTag = waitingRoom.challengedJid.split('@')[0];
            await socket.sendMessage(chatJid, {
                text: `❌ This game room is reserved for @${targetTag}!\nType *.ttt* once their game is finished to create a new room.`,
                mentions: [waitingRoom.challengedJid]
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
            challengedJid: challengedJid || null,
            timeout: setTimeout(() => {
                if (games.has(roomId)) {
                    games.delete(roomId);
                    socket.sendMessage(chatJid, { text: `⏰ *TicTacToe waiting room closed due to timeout.*` }).catch(() => {});
                }
            }, 180000) // 3 min waiting timeout
        };

        games.set(roomId, newRoom);

        const userTag = userJid.split('@')[0];
        let waitText = '';
        const mentions = [userJid];

        if (challengedJid) {
            const targetTag = challengedJid.split('@')[0];
            mentions.push(challengedJid);
            waitText =
                `🎮 *TicTacToe Direct Challenge!*\n\n` +
                `👤 Challenger: @${userTag}\n` +
                `🎯 Challenged: @${targetTag}\n\n` +
                `👉 @${targetTag}, type *.ttt* to accept the challenge!`;
        } else {
            waitText =
                `🎮 *TicTacToe Room Created!*\n\n` +
                `👤 Challenged by: @${userTag}\n` +
                `⏳ Waiting for an opponent to join...\n\n` +
                `👉 Type *.ttt* to accept the challenge and play!`;
        }

        await socket.sendMessage(chatJid, {
            text: waitText,
            mentions
        }, { quoted: msg });
    }
}

/**
 * Handles in-game moves (1-9) or surrender messages
 * Returns true if the message was handled as a TicTacToe action, false otherwise.
 */
export async function handleTicTacToeMove(socket, chatJid, userJid, rawText, msg, isGroup) {
    // Find active playing game for this user in this chat
    let activeRoom = null;
    let activeRoomId = null;

    for (const [id, r] of games.entries()) {
        if (r.chatJid === chatJid &&
            r.state === 'PLAYING' &&
            (r.game.playerX === userJid || r.game.playerO === userJid)) {
            activeRoom = r;
            activeRoomId = id;
            break;
        }
    }

    if (!activeRoom) return false;

    // Check for surrender
    const isSurrender = /^(surrender|give\s*up|\.surrender|\.giveup|\.ttt\s+surrender)$/i.test(rawText.trim());

    // Check for number move: 1-9 or .1-.9
    const matchNumber = rawText.trim().match(/^\.?([1-9])$/);

    if (!isSurrender && !matchNumber) {
        return false;
    }

    // Handle Surrender
    if (isSurrender) {
        clearTimeout(activeRoom.timeout);
        const userTag = userJid.split('@')[0];

        if (activeRoom.isBotGame) {
            await socket.sendMessage(chatJid, {
                text: `🏳️ @${userTag} has surrendered!\n\n🤖 *Neo wins the game!* 🏆\n\n_Type *.ttt bot* to play again!_`,
                mentions: [userJid]
            }, { quoted: msg });
        } else {
            const winner = userJid === activeRoom.game.playerX ? activeRoom.game.playerO : activeRoom.game.playerX;
            const winnerTag = winner.split('@')[0];
            await socket.sendMessage(chatJid, {
                text: `🏳️ @${userTag} has surrendered!\n\n🎉 @${winnerTag} wins the game! 🏆`,
                mentions: [userJid, winner]
            }, { quoted: msg });
        }

        games.delete(activeRoomId);
        return true;
    }

    // It's a move (1-9)
    const position = parseInt(matchNumber[1], 10) - 1;

    // Check if it's the sender's turn
    if (userJid !== activeRoom.game.currentTurn) {
        const turnTag = activeRoom.game.currentTurn === BOT_JID ? 'Neo 🤖' : `@${activeRoom.game.currentTurn.split('@')[0]}`;
        await socket.sendMessage(chatJid, {
            text: `❌ *Not your turn!*\nWaiting for ${turnTag} to make a move.`,
            mentions: activeRoom.game.currentTurn === BOT_JID ? [] : [activeRoom.game.currentTurn]
        }, { quoted: msg });
        return true;
    }

    // Execute the user move (User is playerX)
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

    // ==========================================
    // CASE A: SOLO GAME VS NEO AI
    // ==========================================
    if (activeRoom.isBotGame) {
        const userTag = userJid.split('@')[0];

        // 1. Check if user won
        if (activeRoom.game.winner === userJid) {
            clearTimeout(activeRoom.timeout);
            const winMessage =
                `🎮 *TicTacToe Game Over!*\n\n` +
                `🎉 @${userTag} (❎) has *DEFEATED* Neo! 🏆✨\n\n` +
                `${formatBoard(activeRoom.game)}\n\n` +
                `▢ Player ❎: @${userTag} (Winner!)\n` +
                `▢ Player ⭕: Neo 🤖\n\n` +
                `_Type *.ttt bot* to start a rematch!_`;

            await socket.sendMessage(chatJid, {
                text: winMessage,
                mentions: [userJid]
            }, { quoted: msg });

            games.delete(activeRoomId);
            return true;
        }

        // 2. Check if draw after user's move
        if (activeRoom.game.turns === 9 && !activeRoom.game.winner) {
            clearTimeout(activeRoom.timeout);
            const drawMessage =
                `🎮 *TicTacToe Game Over!*\n\n` +
                `🤝 The game ended in a *DRAW!* ⚖️\n\n` +
                `${formatBoard(activeRoom.game)}\n\n` +
                `▢ Player ❎: @${userTag}\n` +
                `▢ Player ⭕: Neo 🤖\n\n` +
                `_Type *.ttt bot* to play again!_`;

            await socket.sendMessage(chatJid, {
                text: drawMessage,
                mentions: [userJid]
            }, { quoted: msg });

            games.delete(activeRoomId);
            return true;
        }

        // 3. Bot calculates and makes its move
        const botPos = getBestBotMove(activeRoom.game);
        if (botPos !== -1) {
            activeRoom.game.turn(true, botPos);
        }

        // 4. Check if bot won
        if (activeRoom.game.winner === BOT_JID) {
            clearTimeout(activeRoom.timeout);
            const botWinMessage =
                `🎮 *TicTacToe Game Over!*\n\n` +
                `🤖 *Neo placed ⭕ at position ${botPos + 1} and WON!* 🏆🦾\n` +
                `Better luck next time, @${userTag}!\n\n` +
                `${formatBoard(activeRoom.game)}\n\n` +
                `▢ Player ❎: @${userTag}\n` +
                `▢ Player ⭕: Neo 🤖 (Winner!)\n\n` +
                `_Type *.ttt bot* to challenge me again!_`;

            await socket.sendMessage(chatJid, {
                text: botWinMessage,
                mentions: [userJid]
            }, { quoted: msg });

            games.delete(activeRoomId);
            return true;
        }

        // 5. Check if draw after bot's move
        if (activeRoom.game.turns === 9 && !activeRoom.game.winner) {
            clearTimeout(activeRoom.timeout);
            const drawMessage =
                `🎮 *TicTacToe Game Over!*\n\n` +
                `🤖 *Neo placed ⭕ at position ${botPos + 1}.*\n` +
                `🤝 The game ended in a *DRAW!* ⚖️\n\n` +
                `${formatBoard(activeRoom.game)}\n\n` +
                `▢ Player ❎: @${userTag}\n` +
                `▢ Player ⭕: Neo 🤖\n\n` +
                `_Type *.ttt bot* to play again!_`;

            await socket.sendMessage(chatJid, {
                text: drawMessage,
                mentions: [userJid]
            }, { quoted: msg });

            games.delete(activeRoomId);
            return true;
        }

        // 6. Bot moved, now it's user's turn
        const nextTurnMessage =
            `🎮 *TicTacToe vs Neo AI* 🤖\n\n` +
            `🤖 *Neo placed ⭕ at position ${botPos + 1}!* Now it's your turn:\n\n` +
            `🎲 Turn: @${userTag} (❎)\n\n` +
            `${formatBoard(activeRoom.game)}\n\n` +
            `▢ Player ❎: @${userTag} (You)\n` +
            `▢ Player ⭕: Neo 🤖\n\n` +
            `• Type a number (*1-9*) to place your move!\n` +
            `• Type *surrender* to give up.`;

        await socket.sendMessage(chatJid, {
            text: nextTurnMessage,
            mentions: [userJid]
        }, { quoted: msg });

        return true;
    }

    // ==========================================
    // CASE B: 2-PLAYER MULTIPLAYER GAME
    // ==========================================
    const winner = activeRoom.game.winner;
    const isTie = !winner && activeRoom.game.turns === 9;

    const playerXTag = activeRoom.game.playerX.split('@')[0];
    const playerOTag = activeRoom.game.playerO.split('@')[0];

    // Winner
    if (winner) {
        clearTimeout(activeRoom.timeout);
        const winnerTag = winner.split('@')[0];
        const symbol = winner === activeRoom.game.playerX ? '❎' : '⭕';

        const winMessage =
            `🎮 *TicTacToe Game Over!*\n\n` +
            `🎉 @${winnerTag} (${symbol}) has WON the game! 🏆✨\n\n` +
            `${formatBoard(activeRoom.game)}\n\n` +
            `▢ Player ❎: @${playerXTag}\n` +
            `▢ Player ⭕: @${playerOTag}\n\n` +
            `_Type *.ttt* to start a new rematch!_`;

        await socket.sendMessage(chatJid, {
            text: winMessage,
            mentions: [activeRoom.game.playerX, activeRoom.game.playerO]
        }, { quoted: msg });

        games.delete(activeRoomId);
        return true;
    }

    // Draw
    if (isTie) {
        clearTimeout(activeRoom.timeout);
        const drawMessage =
            `🎮 *TicTacToe Game Over!*\n\n` +
            `🤝 The game ended in a *DRAW!* ⚖️\n\n` +
            `${formatBoard(activeRoom.game)}\n\n` +
            `▢ Player ❎: @${playerXTag}\n` +
            `▢ Player ⭕: @${playerOTag}\n\n` +
            `_Type *.ttt* to start a rematch!_`;

        await socket.sendMessage(chatJid, {
            text: drawMessage,
            mentions: [activeRoom.game.playerX, activeRoom.game.playerO]
        }, { quoted: msg });

        games.delete(activeRoomId);
        return true;
    }

    // Next Turn
    const nextTurnTag = activeRoom.game.currentTurn.split('@')[0];
    const nextSymbol = activeRoom.game.currentTurn === activeRoom.game.playerX ? '❎' : '⭕';

    const turnMessage =
        `🎮 *TicTacToe Game*\n\n` +
        `🎲 Turn: @${nextTurnTag} (${nextSymbol})\n\n` +
        `${formatBoard(activeRoom.game)}\n\n` +
        `▢ Player ❎: @${playerXTag}\n` +
        `▢ Player ⭕: @${playerOTag}\n\n` +
        `• Type a number (*1-9*) to place your move!\n` +
        `• Type *surrender* to give up.`;

    await socket.sendMessage(chatJid, {
        text: turnMessage,
        mentions: [activeRoom.game.currentTurn, activeRoom.game.playerX, activeRoom.game.playerO]
    }, { quoted: msg });

    return true;
}
