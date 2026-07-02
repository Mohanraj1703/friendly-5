import { io, Socket } from "socket.io-client";
import { getOrCreatePlayerId } from "../lib/multiplayer";

let socket: Socket | null = null;

// Get the socket server URL.
// If VITE_SOCKET_URL is specified, use it. Otherwise, connect to the current host (same origin).
const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || window.location.origin;

function ensureSocketConnected(s: Socket) {
  if (!s.connected) {
    s.connect();
  }
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(
  onStateUpdate: (state: any) => void,
  onError: (msg: string) => void,
  onKicked: () => void
) {
  const s = getSocket();
  
  if (!s.connected) {
    s.connect();
  }

  // Remove any stale listeners to avoid duplicate trigger bugs
  s.off("gameStateUpdate");
  s.off("errorMsg");
  s.off("kicked");
  s.off("roomCreated");
  s.off("roomJoined");

  // Register listeners
  s.on("gameStateUpdate", (roomState) => {
    onStateUpdate(roomState);
  });

  s.on("errorMsg", (message) => {
    onError(message);
  });

  s.on("kicked", () => {
    onKicked();
  });

  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Emits API matching user spec
export function createRoom(playerName: string, scoreLimit: number, maxPlayers: number) {
  const s = getSocket();
  ensureSocketConnected(s);
  const playerId = getOrCreatePlayerId();
  s.emit("createRoom", { playerName, scoreLimit, maxPlayers, playerId });
}

export function joinRoom(roomId: string, playerName: string) {
  const s = getSocket();
  ensureSocketConnected(s);
  const playerId = getOrCreatePlayerId();
  s.emit("joinRoom", { roomId: roomId.toUpperCase().trim(), playerName, playerId });
}

export function toggleReadyStatus(roomId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("toggleReady", { roomId, playerId });
}

export function sendChatMessage(roomId: string, playerName: string, text: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("sendChatMessage", { roomId, playerId, senderName: playerName, text });
}

export function addBotToRoom(roomId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("addBot", { roomId, requesterId: playerId });
}

export function kickPlayerFromRoom(roomId: string, targetId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("kickPlayer", { roomId, targetId, requesterId: playerId });
}

export function startGameInRoom(roomId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("startGame", { roomId, requesterId: playerId });
}

export function startNextRoundInRoom(roomId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("startNextRound", { roomId, requesterId: playerId });
}

export function discardCards(roomId: string, discardedCardIds: string[]) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("playerDiscard", { roomId, playerId, discardedCardIds });
}

export function drawCard(roomId: string, fromDeck: boolean) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("playerDraw", { roomId, playerId, fromDeck });
}

export function callShowdown(roomId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("playerCall", { roomId, playerId });
}

export function toggleGamePause(roomId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("togglePause", { roomId, requesterId: playerId });
}

export function restartMatchInRoom(roomId: string) {
  const s = getSocket();
  const playerId = getOrCreatePlayerId();
  s.emit("restartMatch", { roomId, requesterId: playerId });
}
