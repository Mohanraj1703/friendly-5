import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import { Card, Player, TurnPhase, GamePhase, RoundLog } from '../types';
import { createDeck, shuffleDeck, calculateHandPoints } from '../utils/deck';

// Generate a random 5-letter uppercase code
export function generateLobbyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get or create a persistent player ID for this browser
export function getOrCreatePlayerId(): string {
  let pid = localStorage.getItem('5cards_player_id');
  if (!pid) {
    pid = 'user_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('5cards_player_id', pid);
  }
  return pid;
}

export interface LobbyMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface OnlineLobby {
  id: string; // 5-letter game code
  createdAt: number;
  hostId: string;
  status: 'waiting' | 'playing' | 'round_over' | 'game_over';
  scoreLimit: number;
  players: OnlinePlayer[];
  deck: Card[];
  discardPile: Card[];
  availableDiscardCard: Card | null;
  currentTurn: number; // index of player whose turn it is
  turnPhase: TurnPhase;
  roundNumber: number;
  callerId: string;
  isCallSuccessful: boolean;
  gameLogs: string[];
  roundLogs: RoundLog[];
  chatMessages: LobbyMessage[];
}

export interface OnlinePlayer {
  id: string;
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
}

// Create a new lobby
export async function createLobby(
  lobbyId: string, 
  hostName: string, 
  scoreLimit: number
): Promise<OnlineLobby> {
  const hostId = getOrCreatePlayerId();
  const newLobby: OnlineLobby = {
    id: lobbyId,
    createdAt: Date.now(),
    hostId,
    status: 'waiting',
    scoreLimit,
    players: [
      {
        id: hostId,
        name: hostName,
        isHost: true,
        isHuman: true,
        isReady: true,
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
    callerId: '',
    isCallSuccessful: false,
    gameLogs: [`Lobby ${lobbyId} created by ${hostName}.`],
    roundLogs: [],
    chatMessages: [
      {
        senderId: 'system',
        senderName: 'System',
        text: `Welcome to the lobby! Share the code [${lobbyId}] with friends to join.`,
        timestamp: Date.now()
      }
    ]
  };

  await setDoc(doc(db, 'lobbies', lobbyId), newLobby);
  return newLobby;
}

// Join an existing lobby
export async function joinLobby(
  lobbyId: string, 
  playerName: string
): Promise<OnlineLobby> {
  const docRef = doc(db, 'lobbies', lobbyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Lobby not found. Please check the code.');
  }

  const lobby = docSnap.data() as OnlineLobby;
  if (lobby.status !== 'waiting') {
    throw new Error('This game has already started.');
  }

  const playerId = getOrCreatePlayerId();
  const existingPlayerIdx = lobby.players.findIndex(p => p.id === playerId);

  if (existingPlayerIdx !== -1) {
    // Player rejoining, update name
    lobby.players[existingPlayerIdx].name = playerName;
  } else {
    if (lobby.players.length >= 6) {
      throw new Error('This lobby is full (max 6 players).');
    }
    // Add new player
    lobby.players.push({
      id: playerId,
      name: playerName,
      isHost: false,
      isHuman: true,
      isReady: false,
      hand: [],
      score: 0,
      eliminated: false,
      lastRoundPoints: null,
      penaltyThisRound: false,
      pointsAddedThisRound: null
    });
  }

  lobby.gameLogs.unshift(`${playerName} joined the lobby.`);
  lobby.chatMessages.push({
    senderId: 'system',
    senderName: 'System',
    text: `${playerName} joined the lobby.`,
    timestamp: Date.now()
  });

  await setDoc(docRef, lobby);
  return lobby;
}

// Add an AI player to lobby (host only)
export async function addAIToLobby(lobbyId: string): Promise<void> {
  const docRef = doc(db, 'lobbies', lobbyId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const lobby = docSnap.data() as OnlineLobby;
  if (lobby.players.length >= 6) return;

  const aiNames = ['AI Alpha', 'AI Beta', 'AI Gamma', 'AI Delta', 'AI Epsilon'];
  // Find name not already used
  const usedNames = lobby.players.map(p => p.name);
  const availableName = aiNames.find(n => !usedNames.includes(n)) || `AI Bot ${lobby.players.length}`;

  const aiId = 'ai_' + Math.random().toString(36).substring(2, 9);
  lobby.players.push({
    id: aiId,
    name: availableName,
    isHost: false,
    isHuman: false,
    isReady: true,
    hand: [],
    score: 0,
    eliminated: false,
    lastRoundPoints: null,
    penaltyThisRound: false,
    pointsAddedThisRound: null
  });

  lobby.gameLogs.unshift(`${availableName} (AI) added to lobby.`);
  await setDoc(docRef, lobby);
}

// Remove player from lobby
export async function leaveLobby(lobbyId: string, playerId: string): Promise<void> {
  const docRef = doc(db, 'lobbies', lobbyId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const lobby = docSnap.data() as OnlineLobby;
  const leavingPlayer = lobby.players.find(p => p.id === playerId);
  if (!leavingPlayer) return;

  const nextPlayers = lobby.players.filter(p => p.id !== playerId);

  if (nextPlayers.length === 0) {
    // Delete lobby if empty
    // (Or let it expire, but we can write a clean empty state)
    await setDoc(docRef, { ...lobby, players: [] });
    return;
  }

  // If host leaves, assign next player as host
  let hostId = lobby.hostId;
  if (playerId === lobby.hostId) {
    const nextHost = nextPlayers.find(p => p.isHuman);
    if (nextHost) {
      nextHost.isHost = true;
      hostId = nextHost.id;
    }
  }

  lobby.players = nextPlayers;
  lobby.hostId = hostId;
  lobby.gameLogs.unshift(`${leavingPlayer.name} left the lobby.`);
  lobby.chatMessages.push({
    senderId: 'system',
    senderName: 'System',
    text: `${leavingPlayer.name} left the lobby.`,
    timestamp: Date.now()
  });

  await setDoc(docRef, lobby);
}

// Toggle ready status
export async function toggleReady(lobbyId: string, playerId: string): Promise<void> {
  const docRef = doc(db, 'lobbies', lobbyId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;

  const lobby = docSnap.data() as OnlineLobby;
  const player = lobby.players.find(p => p.id === playerId);
  if (player) {
    player.isReady = !player.isReady;
    await setDoc(docRef, lobby);
  }
}

// Send Chat Message
export async function sendChatMessage(
  lobbyId: string, 
  senderId: string, 
  senderName: string, 
  text: string
): Promise<void> {
  const docRef = doc(db, 'lobbies', lobbyId);
  await updateDoc(docRef, {
    chatMessages: arrayUnion({
      senderId,
      senderName,
      text,
      timestamp: Date.now()
    })
  });
}
