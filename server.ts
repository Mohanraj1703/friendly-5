import express from "express";
import path from "path";
import http from "http";
import { Server, Socket } from "socket.io";
import { createServer as createViteServer } from "vite";
import { Card, Player as ClientPlayer, RoundLog, TurnPhase, GamePhase } from "./src/types";
import { createDeck, shuffleDeck, calculateHandPoints, isValidDiscard } from "./src/utils/deck";

// Type definitions for server-side rooms
interface ServerPlayer {
  id: string; // persistent player ID (e.g. user_abcdef)
  socketId: string | null; // socket ID, null if disconnected
  name: string;
  isHost: boolean;
  isHuman: boolean;
  isReady: boolean;
  hand: Card[];
  score: number;
  eliminated: boolean;
  lastRoundPoints: number | null;
  penaltyThisRound: boolean;
  pointsAddedThisRound: number | null;
  disconnectTimeout?: NodeJS.Timeout;
}

interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface GameRoom {
  id: string; // 5-letter Room Code
  status: 'setup' | 'playing' | 'round_over' | 'game_over';
  scoreLimit: number;
  maxPlayers: number;
  players: ServerPlayer[];
  deck: Card[];
  discardPile: Card[];
  availableDiscardCard: Card | null;
  currentTurn: number; // Index in players array
  turnPhase: TurnPhase;
  roundNumber: number;
  callerId: string | null;
  isCallSuccessful: boolean;
  gameLogs: string[];
  roundLogs: RoundLog[];
  chatMessages: ChatMessage[];
  paused: boolean;
  countdown: number | null;
  countdownInterval?: NodeJS.Timeout;
}

const rooms = new Map<string, GameRoom>();

// Generate a random 6-8 character uppercase alphanumeric code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 6 + Math.floor(Math.random() * 3); // 6, 7, or 8
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

// Clean up sensitive card data from other players before sending to client
function sanitizeRoomForPlayer(room: GameRoom, playerId: string) {
  return {
    id: room.id,
    status: room.status,
    scoreLimit: room.scoreLimit,
    maxPlayers: room.maxPlayers,
    currentTurn: room.currentTurn,
    turnPhase: room.turnPhase,
    roundNumber: room.roundNumber,
    callerId: room.callerId,
    isCallSuccessful: room.isCallSuccessful,
    gameLogs: room.gameLogs,
    roundLogs: room.roundLogs,
    chatMessages: room.chatMessages,
    paused: room.paused,
    countdown: room.countdown,
    discardPile: room.discardPile,
    availableDiscardCard: room.availableDiscardCard,
    deckCount: room.deck.length,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isHuman: p.isHuman,
      isReady: p.isReady,
      score: p.score,
      eliminated: p.eliminated,
      lastRoundPoints: p.lastRoundPoints,
      penaltyThisRound: p.penaltyThisRound,
      pointsAddedThisRound: p.pointsAddedThisRound,
      isConnected: p.socketId !== null,
      // Hide other players' hands unless round or game is over
      hand: (p.id === playerId || room.status === 'round_over' || room.status === 'game_over')
        ? p.hand
        : p.hand.map(c => ({ id: 'back', suit: 'joker', value: 'back', points: 0 })),
      handCount: p.hand.length
    }))
  };
}

// Broadcast sanitized states to all players in a room
function broadcastRoomUpdate(room: GameRoom, ioServer: Server) {
  room.players.forEach((p) => {
    if (p.socketId) {
      ioServer.to(p.socketId).emit("gameStateUpdate", sanitizeRoomForPlayer(room, p.id));
    }
  });
}

// Get the index of the next turn player who is not eliminated
function getNextTurnPlayerIndex(playersList: ServerPlayer[], currentIdx: number): number {
  let nextIdx = (currentIdx + 1) % playersList.length;
  let attempts = 0;
  while (playersList[nextIdx].eliminated && attempts < playersList.length) {
    nextIdx = (nextIdx + 1) % playersList.length;
    attempts++;
  }
  return nextIdx;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Basic API Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size });
  });

  // Socket.IO Connection Handler
  io.on("connection", (socket: Socket) => {
    console.log(`New socket connection: ${socket.id}`);

    // Create Room
    socket.on("createRoom", ({ playerName, scoreLimit, maxPlayers, playerId }, callback: any) => {
      try {
        const roomId = generateRoomCode();
        const limit = parseInt(scoreLimit, 10) || 100;
        const max = parseInt(maxPlayers, 10) || 6;

        const newRoom: GameRoom = {
          id: roomId,
          status: 'setup',
          scoreLimit: limit,
          maxPlayers: max,
          players: [
            {
              id: playerId,
              socketId: socket.id,
              name: playerName.slice(0, 16),
              isHost: true,
              isHuman: true,
              isReady: true, // Host is ready by default
              hand: [],
              score: 0,
              eliminated: false,
              lastRoundPoints: null,
              penaltyThisRound: false,
              pointsAddedThisRound: null
            }
          ],
          deck: [],
          discardPile: [],
          availableDiscardCard: null,
          currentTurn: 0,
          turnPhase: 'discard',
          roundNumber: 1,
          callerId: null,
          isCallSuccessful: false,
          gameLogs: [`Room ${roomId} created by ${playerName}.`],
          roundLogs: [],
          chatMessages: [
            {
              senderId: 'system',
              senderName: 'System',
              text: `Welcome! Share code [${roomId}] with friends.`,
              timestamp: Date.now()
            }
          ],
          paused: false,
          countdown: null
        };

        rooms.set(roomId, newRoom);
        socket.join(roomId);
        
        console.log(`Room created: ${roomId} by player ${playerName}`);
        const roomState = sanitizeRoomForPlayer(newRoom, playerId);
        socket.emit("roomCreated", { roomId, roomState });
        if (callback) {
          callback({ success: true, roomId, roomState });
        }
      } catch (err) {
        console.error('Create room failed:', err);
        socket.emit("errorMsg", "Failed to create room.");
        if (callback) {
          callback({ success: false, error: 'Failed to create room.' });
        }
      }
    });

    // Join Room
    socket.on("joinRoom", ({ roomId, playerName, playerId }, callback: any) => {
      try {
        const code = roomId.toUpperCase().trim();
        const room = rooms.get(code);

        if (!room) {
          console.log(`Join failed: room not found ${code} by ${playerName}`);
          socket.emit("errorMsg", "Room not found. Check the code.");
          if (callback) callback({ success: false, error: 'Room not found.' });
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          console.log(`Join failed: room full ${code} by ${playerName}`);
          socket.emit("errorMsg", "This room is full.");
          if (callback) callback({ success: false, error: 'This room is full.' });
          return;
        }

        // Check if player is already in this room (reconnection)
        const existingPlayer = room.players.find(p => p.id === playerId);
        
        if (existingPlayer) {
          // Cancel disconnection timeout if active
          if (existingPlayer.disconnectTimeout) {
            clearTimeout(existingPlayer.disconnectTimeout);
            existingPlayer.disconnectTimeout = undefined;
          }
          existingPlayer.socketId = socket.id;
          existingPlayer.name = playerName.slice(0, 16);
          socket.join(code);
          
          room.gameLogs.unshift(`⚡ ${playerName} reconnected.`);
          room.chatMessages.push({
            senderId: 'system',
            senderName: 'System',
            text: `${playerName} reconnected.`,
            timestamp: Date.now()
          });

          socket.emit("roomJoined", { roomId: code, roomState: sanitizeRoomForPlayer(room, playerId) });
          broadcastRoomUpdate(room, io);
          return;
        }

        if (room.status !== 'setup') {
          console.log(`Join failed: game already started ${code} by ${playerName}`);
          socket.emit("errorMsg", "This game has already started. You cannot join now.");
          if (callback) callback({ success: false, error: 'Game already started.' });
          return;
        }

        // Add brand new player
        const newPlayer: ServerPlayer = {
          id: playerId,
          socketId: socket.id,
          name: playerName.slice(0, 16),
          isHost: false,
          isHuman: true,
          isReady: false,
          hand: [],
          score: 0,
          eliminated: false,
          lastRoundPoints: null,
          penaltyThisRound: false,
          pointsAddedThisRound: null
        };

        room.players.push(newPlayer);
        socket.join(code);

        room.gameLogs.unshift(`👋 ${playerName} joined the room.`);
        room.chatMessages.push({
          senderId: 'system',
          senderName: 'System',
          text: `${playerName} joined the room.`,
          timestamp: Date.now()
        });

        socket.emit("roomJoined", { roomId: code, roomState: sanitizeRoomForPlayer(room, playerId) });
        if (callback) callback({ success: true, roomId: code, roomState: sanitizeRoomForPlayer(room, playerId) });
        console.log(`Player joined: ${playerName} into ${code}`);
        broadcastRoomUpdate(room, io);
      } catch (err) {
        console.error('Join room failed:', err);
        socket.emit("errorMsg", "Failed to join room.");
        if (callback) callback({ success: false, error: 'Failed to join room.' });
      }
    });

    // Toggle Ready Status
    socket.on("toggleReady", ({ roomId, playerId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.isReady = !player.isReady;
        broadcastRoomUpdate(room, io);
      }
    });

    // Send Chat Message
    socket.on("sendChatMessage", ({ roomId, playerId, senderName, text }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      room.chatMessages.push({
        senderId: playerId,
        senderName,
        text: text.slice(0, 150),
        timestamp: Date.now()
      });

      broadcastRoomUpdate(room, io);
    });

    // Kick Bot / Player (Host only)
    socket.on("kickPlayer", ({ roomId, targetId, requesterId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const requester = room.players.find(p => p.id === requesterId);
      if (!requester || !requester.isHost) return;

      const targetIdx = room.players.findIndex(p => p.id === targetId);
      if (targetIdx !== -1) {
        const target = room.players[targetIdx];
        
        // Notify target they were kicked
        if (target.socketId) {
          io.to(target.socketId).emit("kicked");
        }

        room.players.splice(targetIdx, 1);
        room.gameLogs.unshift(`❌ ${target.name} was removed from the lobby.`);
        
        broadcastRoomUpdate(room, io);
      }
    });

    // Add Bot Player (Host only)
    socket.on("addBot", ({ roomId, requesterId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const requester = room.players.find(p => p.id === requesterId);
      if (!requester || !requester.isHost) return;

      if (room.players.length >= room.maxPlayers) return;

      const botNames = ["Alpha Bot", "Beta Bot", "Gamma Bot", "Omega Bot", "Sigma Bot"];
      const existingNames = room.players.map(p => p.name);
      const botName = botNames.find(n => !existingNames.includes(n)) || `Bot ${room.players.length}`;
      const botId = `bot_${Math.random().toString(36).substring(2, 9)}`;

      room.players.push({
        id: botId,
        socketId: null, // Bots do not have a socket connection
        name: botName,
        isHost: false,
        isHuman: false,
        isReady: true, // Bots are always ready
        hand: [],
        score: 0,
        eliminated: false,
        lastRoundPoints: null,
        penaltyThisRound: false,
        pointsAddedThisRound: null
      });

      room.gameLogs.unshift(`🤖 Added bot player: ${botName}`);
      broadcastRoomUpdate(room, io);
    });

    // Start Game Countdown / Start Game (Host only)
    socket.on("startGame", ({ roomId, requesterId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const requester = room.players.find(p => p.id === requesterId);
      if (!requester || !requester.isHost) return;

      // Validate all players are ready
      const allReady = room.players.every(p => p.isReady);
      if (!allReady || room.players.length < 2) {
        socket.emit("errorMsg", "All players must be ready and you need at least 2 players!");
        return;
      }

      // Initialize the Game State
      room.status = 'playing';
      room.roundNumber = 1;
      room.roundLogs = [];
      room.gameLogs = ["🚀 Game started! Shuffling and dealing hands..."];

      // Start the Round
      startRound(room);
      console.log(`Game started in room ${roomId} with ${room.players.length} players.`);

      // Notify all clients that the game has started and send the initial state immediately
      room.players.forEach((p) => {
        if (p.socketId) {
          console.log(`Emitting gameStarted to player ${p.id} in room ${roomId}`);
          io.to(p.socketId).emit("gameStarted", { roomId: room.id, roomState: sanitizeRoomForPlayer(room, p.id) });
        }
      });

      broadcastRoomUpdate(room, io);
    });

    // Next Round (Host only)
    socket.on("startNextRound", ({ roomId, requesterId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const requester = room.players.find(p => p.id === requesterId);
      if (!requester || !requester.isHost) return;

      if (room.status !== 'round_over') return;

      room.status = 'playing';
      room.roundNumber += 1;
      
      startRound(room);
      broadcastRoomUpdate(room, io);
    });

    // Discard Move
    socket.on("playerDiscard", ({ roomId, playerId, discardedCardIds }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      // Anti-cheat & turn authorization
      const activePlayer = room.players[room.currentTurn];
      if (activePlayer.id !== playerId) return;
      if (room.turnPhase !== 'discard') return;

      // Fetch cards
      const discardedCards = activePlayer.hand.filter(c => discardedCardIds.includes(c.id));
      if (discardedCards.length === 0) return;

      // Verify the discard is valid
      if (!isValidDiscard(discardedCards)) return;

      // Perform Discard on server state
      activePlayer.hand = activePlayer.hand.filter(c => !discardedCardIds.includes(c.id));
      room.discardPile = [...room.discardPile, ...discardedCards];
      room.availableDiscardCard = discardedCards[discardedCards.length - 1];
      room.turnPhase = 'draw';

      const cardNames = discardedCards.map(c => `${c.value} of ${c.suit}`).join(", ");
      room.gameLogs.unshift(`🎴 ${activePlayer.name} discarded: [${cardNames}]`);

      broadcastRoomUpdate(room, io);
    });

    // Draw Move
    socket.on("playerDraw", ({ roomId, playerId, fromDeck }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const activePlayer = room.players[room.currentTurn];
      if (activePlayer.id !== playerId) return;
      if (room.turnPhase !== 'draw') return;

      let drawnCard: Card;
      let recycled = false;

      // If deck is low, recycle discard pile
      if (room.deck.length <= 1) {
        const topCard = room.discardPile.pop()!;
        // Shuffle everything except the top card back into deck
        const cardsToRecycle = room.discardPile;
        room.deck = shuffleDeck([...room.deck, ...cardsToRecycle]);
        room.discardPile = [topCard];
        recycled = true;
      }

      if (fromDeck) {
        drawnCard = room.deck.shift()!;
        room.gameLogs.unshift(`🃏 ${activePlayer.name} drew a card from the deck.`);
      } else {
        const openCard = room.availableDiscardCard || room.discardPile[room.discardPile.length - 1];
        if (!openCard) {
          drawnCard = room.deck.shift()!;
          room.gameLogs.unshift(`🃏 ${activePlayer.name} wanted the open card but none was available; drew from the deck.`);
        } else {
          drawnCard = openCard;
          room.discardPile = room.discardPile.filter(c => c.id !== drawnCard.id);
          room.availableDiscardCard = room.discardPile.length > 0 ? room.discardPile[room.discardPile.length - 1] : null;
          room.gameLogs.unshift(`📥 ${activePlayer.name} took the open card [${drawnCard.value} of ${drawnCard.suit}]`);
        }
      }

      if (recycled) {
        room.gameLogs.unshift(`♻️ Deck ran low. Recycled the discard pile!`);
      }

      // Add to player's hand
      activePlayer.hand.push(drawnCard);

      // Advance Turn
      room.currentTurn = getNextTurnPlayerIndex(room.players, room.currentTurn);
      room.turnPhase = 'discard';

      broadcastRoomUpdate(room, io);

      // If the next player is a Bot, trigger their AI turn loop
      triggerBotTurnIfNeeded(room, io);
    });

    // Call Showdown Move
    socket.on("playerCall", ({ roomId, playerId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const activePlayer = room.players[room.currentTurn];
      if (activePlayer.id !== playerId) return;
      if (room.turnPhase !== 'discard') return;

      // Execute Showdown calculations server-authoritatively!
      const callerPoints = calculateHandPoints(activePlayer.hand);
      room.callerId = playerId;

      room.gameLogs.unshift(`🔔 ${activePlayer.name} called Yaniv! Showdown begins...`);

      const activePlayers = room.players.filter(p => !p.eliminated);
      const minHandPointsInRound = Math.min(...activePlayers.map(p => calculateHandPoints(p.hand)));
      
      const otherPlayers = activePlayers.filter(p => p.id !== playerId);
      const otherPointsList = otherPlayers.map(p => calculateHandPoints(p.hand));

      // Successful if caller points are lower or equal to EVERY other player's hand points
      const successful = otherPointsList.every(pts => callerPoints <= pts);
      room.isCallSuccessful = successful;

      const scoresAdded: Record<string, number> = {};
      const scoresCumulative: Record<string, number> = {};

      room.players = room.players.map(p => {
        const currentHandPoints = calculateHandPoints(p.hand);
        let scoreToAdd = 0;
        let penalize = false;

        if (!p.eliminated) {
          if (p.id === playerId) {
            if (successful) {
              scoreToAdd = 0; // Caller gets 0 on successful call
            } else {
              scoreToAdd = 50; // Caller gets 50 penalty on bad call
              penalize = true;
            }
          } else {
            if (successful) {
              scoreToAdd = currentHandPoints; // Standard round points added
            } else {
              // Caller failed. Player with min points gets 0
              if (currentHandPoints === minHandPointsInRound) {
                scoreToAdd = 0;
              } else {
                scoreToAdd = currentHandPoints;
              }
            }
          }

          p.score += scoreToAdd;
          p.lastRoundPoints = currentHandPoints;
          p.penaltyThisRound = penalize;
          p.pointsAddedThisRound = scoreToAdd;

          // Check if eliminated
          if (p.score >= room.scoreLimit) {
            p.eliminated = true;
          }
        }

        scoresAdded[p.id] = scoreToAdd;
        scoresCumulative[p.id] = p.score;
        return p;
      });

      const eliminatedList = room.players
        .filter(p => !p.eliminated && p.score >= room.scoreLimit)
        .map(p => p.name);

      const defenders = room.players.filter(
        p => !p.eliminated && p.id !== playerId && p.lastRoundPoints === minHandPointsInRound
      );
      const defendersNames = defenders.map(d => d.name).join(", ");
      
      const tiedPlayers = room.players.filter(
        p => !p.eliminated && p.id !== playerId && calculateHandPoints(p.hand) === callerPoints
      );
      const hasTie = tiedPlayers.length > 0;
      const tiedNames = tiedPlayers.map(tp => tp.name).join(", ");

      const outcomeMsg = successful
        ? hasTie
          ? `🏆 Successful call (Tiebreaker)! ${activePlayer.name} tied with ${tiedNames} at ${callerPoints} points but wins because they called first. Tied player points are counted!`
          : `🏆 Successful call! ${activePlayer.name} has the lowest hand with ${callerPoints} points.`
        : `❌ Bad call! ${activePlayer.name} called with ${callerPoints} points, but was defeated. ${activePlayer.name} gets +50 penalty. ${defendersNames} get 0 points; others count their hands.`;

      room.gameLogs.unshift(outcomeMsg);

      // Create RoundLog object
      const roundLog: RoundLog = {
        roundNumber: room.roundNumber,
        callerName: activePlayer.name,
        callerPoints,
        isSuccessful: successful,
        scoresAdded,
        scoresCumulative,
        eliminatedPlayers: eliminatedList
      };
      room.roundLogs.push(roundLog);

      // Check if game is completely over (only 1 or 0 players remain under score limit)
      const survivors = room.players.filter(p => !p.eliminated);
      if (survivors.length <= 1) {
        room.status = 'game_over';
        const winner = survivors[0] || room.players.reduce((best, curr) => curr.score < best.score ? curr : best, room.players[0]);
        room.gameLogs.unshift(`👑 GAME OVER! ${winner.name} won the entire match!`);
      } else {
        room.status = 'round_over';
      }

      broadcastRoomUpdate(room, io);
    });

    // Pause / Resume (Host only)
    socket.on("togglePause", ({ roomId, requesterId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const requester = room.players.find(p => p.id === requesterId);
      if (!requester || !requester.isHost) return;

      room.paused = !room.paused;
      room.gameLogs.unshift(room.paused ? "⏸️ Game was paused by host." : "▶️ Game was resumed.");
      broadcastRoomUpdate(room, io);

      if (!room.paused) {
        triggerBotTurnIfNeeded(room, io);
      }
    });

    // Restart Match (Host only)
    socket.on("restartMatch", ({ roomId, requesterId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const requester = room.players.find(p => p.id === requesterId);
      if (!requester || !requester.isHost) return;

      room.status = 'playing';
      room.roundNumber = 1;
      room.roundLogs = [];
      room.gameLogs = ["♻️ Host restarted the match. All scores reset!"];

      // Reset scores and hands
      room.players = room.players.map(p => ({
        ...p,
        hand: [],
        score: 0,
        eliminated: false,
        lastRoundPoints: null,
        penaltyThisRound: false,
        pointsAddedThisRound: null
      }));

      startRound(room);
      broadcastRoomUpdate(room, io);
    });

    // Handle Socket Disconnect
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // Locate rooms containing this socket
      rooms.forEach((room, roomId) => {
        const player = room.players.find(p => p.socketId === socket.id);
        if (player) {
          player.socketId = null; // Mark disconnected
          room.gameLogs.unshift(`⚠️ ${player.name} disconnected. Waiting 60s to rejoin...`);
          broadcastRoomUpdate(room, io);

          // Grace period timeout to remove player or delete room if empty
          player.disconnectTimeout = setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (!currentRoom) return;

            const finalIdx = currentRoom.players.findIndex(p => p.id === player.id);
            if (finalIdx !== -1 && currentRoom.players[finalIdx].socketId === null) {
              const leavingPlayer = currentRoom.players[finalIdx];
              currentRoom.players.splice(finalIdx, 1);
              currentRoom.gameLogs.unshift(`🚪 ${leavingPlayer.name} timed out and left.`);
              
              // If empty, delete room
              if (currentRoom.players.length === 0 || currentRoom.players.every(p => !p.isHuman)) {
                rooms.delete(roomId);
                console.log(`Room ${roomId} deleted as it became empty.`);
                return;
              }

              // If host left, reassign host role to next human
              if (leavingPlayer.isHost) {
                const nextHost = currentRoom.players.find(p => p.isHuman);
                if (nextHost) {
                  nextHost.isHost = true;
                  nextHost.isReady = true;
                  currentRoom.gameLogs.unshift(`👑 ${nextHost.name} is now the host.`);
                }
              }

              // If it was their turn, advance turn
              if (currentRoom.status === 'playing' && currentRoom.currentTurn === finalIdx) {
                currentRoom.currentTurn = getNextTurnPlayerIndex(currentRoom.players, currentRoom.currentTurn);
                currentRoom.turnPhase = 'discard';
                triggerBotTurnIfNeeded(currentRoom, io);
              }

              broadcastRoomUpdate(currentRoom, io);
            }
          }, 60000); // 60 seconds grace period
        }
      });
    });
  });

  // Helper to start/deal a new round
  function startRound(room: GameRoom) {
    let freshDeck = createDeck(room.players.length);
    freshDeck = shuffleDeck(freshDeck);

    // Deal 5 cards to each active, non-eliminated player
    room.players = room.players.map(p => {
      if (!p.eliminated) {
        const hand: Card[] = [];
        for (let i = 0; i < 5; i++) {
          if (freshDeck.length > 0) {
            hand.push(freshDeck.shift()!);
          }
        }
        return {
          ...p,
          hand,
          lastRoundPoints: null,
          penaltyThisRound: false,
          pointsAddedThisRound: null
        };
      }
      return {
        ...p,
        hand: []
      };
    });

    const initialOpenCard = freshDeck.shift()!;
    room.deck = freshDeck;
    room.discardPile = [initialOpenCard];
    room.availableDiscardCard = initialOpenCard;
    room.turnPhase = 'discard';
    room.callerId = null;
    room.isCallSuccessful = false;

    // Find starting turn. Round 1 starts at first player, subsequent rounds rotate starting player index
    const preferredStartIdx = (room.roundNumber - 1) % room.players.length;
    let startIdx = preferredStartIdx;
    while (room.players[startIdx].eliminated) {
      startIdx = (startIdx + 1) % room.players.length;
    }

    room.currentTurn = startIdx;
    room.gameLogs.unshift(`🏁 Round ${room.roundNumber} started! Hands dealt. Open: [${initialOpenCard.value} of ${initialOpenCard.suit}]`);

    // If initial player is a bot, trigger their action
    setTimeout(() => {
      triggerBotTurnIfNeeded(room, io);
    }, 1500);
  }

  // Authoritative Bot Decision-making Loop inside Server
  function triggerBotTurnIfNeeded(room: GameRoom, ioServer: Server) {
    if (room.status !== 'playing' || room.paused) return;

    const activePlayer = room.players[room.currentTurn];
    if (!activePlayer || activePlayer.isHuman || activePlayer.eliminated) return;

    console.log(`Server executing bot turn for: ${activePlayer.name}`);

    // Wait a brief simulated speed delay for realism
    const delay = 1800; // 1.8 seconds turn delay

    setTimeout(() => {
      // Re-fetch room state to verify turn didn't change
      const currentRoom = rooms.get(room.id);
      if (!currentRoom || currentRoom.status !== 'playing' || currentRoom.paused) return;
      const currentActive = currentRoom.players[currentRoom.currentTurn];
      if (!currentActive || currentActive.id !== activePlayer.id) return;

      const handPoints = calculateHandPoints(activePlayer.hand);

      // Bot Calling logic
      // Yaniv threshold for bots: Call if hand is <= 5 points
      const otherSurvivors = currentRoom.players.filter(p => !p.eliminated && p.id !== activePlayer.id);
      const minKnownPoints = 100; // Simple bot heuristic

      // Call threshold decision
      if (handPoints <= 5) {
        // Execute Bot calling!
        executeBotCall(currentRoom, activePlayer, handPoints, ioServer);
        return;
      }

      // Group cards for best discard
      const groups: Record<string, Card[]> = {};
      activePlayer.hand.forEach((card) => {
        if (!groups[card.value]) groups[card.value] = [];
        groups[card.value].push(card);
      });

      let bestGroup: Card[] = [];
      let maxPoints = -1;

      Object.entries(groups).forEach(([val, cards]) => {
        const pts = calculateHandPoints(cards);
        if (cards.length > bestGroup.length || (cards.length === bestGroup.length && pts > maxPoints)) {
          bestGroup = cards;
          maxPoints = pts;
        }
      });

      const discardCards = bestGroup;
      const discardCardIds = discardCards.map(c => c.id);

      // Perform Discard
      activePlayer.hand = activePlayer.hand.filter(c => !discardCardIds.includes(c.id));
      currentRoom.discardPile = [...currentRoom.discardPile, ...discardCards];
      currentRoom.availableDiscardCard = discardCards[discardCards.length - 1];
      
      const cardNames = discardCards.map(c => `${c.value} of ${c.suit}`).join(", ");
      currentRoom.gameLogs.unshift(`🎴 ${activePlayer.name} (AI) discarded: [${cardNames}]`);
      currentRoom.turnPhase = 'draw';

      broadcastRoomUpdate(currentRoom, ioServer);

      // Bot Drawing phase
      setTimeout(() => {
        const reFetched = rooms.get(room.id);
        if (!reFetched || reFetched.status !== 'playing' || reFetched.paused) return;

        // Decide whether to draw from deck or top open discard card
        const openCard = reFetched.availableDiscardCard || reFetched.discardPile[reFetched.discardPile.length - 1];
        const remainingHand = activePlayer.hand;
        const maxRemainingPoints = remainingHand.length > 0 ? Math.max(...remainingHand.map(c => c.points)) : 0;
        
        const openCardAvailable = !!openCard;
        const hasMatchingRank = openCardAvailable && remainingHand.some(c => c.value === openCard.value);
        const isOpenLow = openCardAvailable && openCard.points <= 3;
        const isBetter = openCardAvailable && openCard.points < maxRemainingPoints;

        let drawFromDeck = true;
        if ((isOpenLow || hasMatchingRank) && isBetter) {
          drawFromDeck = false; // Take open discard card
        }

        let drawnCard: Card;
        if (drawFromDeck || !openCard) {
          drawnCard = reFetched.deck.shift()!;
          reFetched.gameLogs.unshift(`🃏 ${activePlayer.name} (AI) drew a card from the deck.`);
        } else {
          drawnCard = openCard;
          reFetched.discardPile = reFetched.discardPile.filter(c => c.id !== drawnCard.id);
          reFetched.availableDiscardCard = reFetched.discardPile.length > 0 ? reFetched.discardPile[reFetched.discardPile.length - 1] : null;
          reFetched.gameLogs.unshift(`📥 ${activePlayer.name} (AI) took the open card [${drawnCard.value} of ${drawnCard.suit}]`);
        }

        activePlayer.hand.push(drawnCard);
        
        // Advance Turn
        reFetched.currentTurn = getNextTurnPlayerIndex(reFetched.players, reFetched.currentTurn);
        reFetched.turnPhase = 'discard';

        broadcastRoomUpdate(reFetched, ioServer);

        // Chain bot turn if next is bot
        triggerBotTurnIfNeeded(reFetched, ioServer);

      }, 1000); // 1-second delay for draw phase

    }, delay);
  }

  // Handle server-side executing bot call showdown
  function executeBotCall(room: GameRoom, activePlayer: ServerPlayer, callerPoints: number, ioServer: Server) {
    room.callerId = activePlayer.id;
    room.gameLogs.unshift(`🔔 ${activePlayer.name} (AI) called Yaniv! Showdown begins...`);

    const activePlayers = room.players.filter(p => !p.eliminated);
    const minHandPointsInRound = Math.min(...activePlayers.map(p => calculateHandPoints(p.hand)));
    
    const otherPlayers = activePlayers.filter(p => p.id !== activePlayer.id);
    const otherPointsList = otherPlayers.map(p => calculateHandPoints(p.hand));

    const successful = otherPointsList.every(pts => callerPoints <= pts);
    room.isCallSuccessful = successful;

    const scoresAdded: Record<string, number> = {};
    const scoresCumulative: Record<string, number> = {};

    room.players = room.players.map(p => {
      const currentHandPoints = calculateHandPoints(p.hand);
      let scoreToAdd = 0;
      let penalize = false;

      if (!p.eliminated) {
        if (p.id === activePlayer.id) {
          if (successful) {
            scoreToAdd = 0;
          } else {
            scoreToAdd = 50;
            penalize = true;
          }
        } else {
          if (successful) {
            scoreToAdd = currentHandPoints;
          } else {
            if (currentHandPoints === minHandPointsInRound) {
              scoreToAdd = 0;
            } else {
              scoreToAdd = currentHandPoints;
            }
          }
        }

        p.score += scoreToAdd;
        p.lastRoundPoints = currentHandPoints;
        p.penaltyThisRound = penalize;
        p.pointsAddedThisRound = scoreToAdd;

        if (p.score >= room.scoreLimit) {
          p.eliminated = true;
        }
      }

      scoresAdded[p.id] = scoreToAdd;
      scoresCumulative[p.id] = p.score;
      return p;
    });

    const eliminatedList = room.players
      .filter(p => !p.eliminated && p.score >= room.scoreLimit)
      .map(p => p.name);

    const defenders = room.players.filter(
      p => !p.eliminated && p.id !== activePlayer.id && p.lastRoundPoints === minHandPointsInRound
    );
    const defendersNames = defenders.map(d => d.name).join(", ");

    const tiedPlayers = room.players.filter(
      p => !p.eliminated && p.id !== activePlayer.id && calculateHandPoints(p.hand) === callerPoints
    );
    const hasTie = tiedPlayers.length > 0;
    const tiedNames = tiedPlayers.map(tp => tp.name).join(", ");

    const outcomeMsg = successful
      ? hasTie
        ? `🏆 Successful call (Tiebreaker)! ${activePlayer.name} (AI) tied with ${tiedNames} at ${callerPoints} points but wins because they called first. Tied player points are counted!`
        : `🏆 Successful call! ${activePlayer.name} (AI) has the lowest hand with ${callerPoints} points.`
      : `❌ Bad call! ${activePlayer.name} (AI) called with ${callerPoints} points, but was defeated. ${activePlayer.name} gets +50 penalty. ${defendersNames} get 0 points; others count their hands.`;

    room.gameLogs.unshift(outcomeMsg);

    const roundLog: RoundLog = {
      roundNumber: room.roundNumber,
      callerName: activePlayer.name,
      callerPoints,
      isSuccessful: successful,
      scoresAdded,
      scoresCumulative,
      eliminatedPlayers: eliminatedList
    };
    room.roundLogs.push(roundLog);

    const survivors = room.players.filter(p => !p.eliminated);
    if (survivors.length <= 1) {
      room.status = 'game_over';
      const winner = survivors[0] || room.players.reduce((best, curr) => curr.score < best.score ? curr : best, room.players[0]);
      room.gameLogs.unshift(`👑 GAME OVER! ${winner.name} won the entire match!`);
    } else {
      room.status = 'round_over';
    }

    broadcastRoomUpdate(room, ioServer);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
