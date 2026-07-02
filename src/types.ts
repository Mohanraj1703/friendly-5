export interface Card {
  id: string;
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
  value: string; // 'A', '2', '3', ..., '10', 'J', 'Q', 'K', 'joker'
  points: number; // A=1, 2=2, ..., J=11, Q=12, K=13, Joker=0
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  hand: Card[];
  score: number; // cumulative score
  eliminated: boolean;
  lastRoundPoints: number | null;
  penaltyThisRound: boolean;
  pointsAddedThisRound: number | null;
}

export interface RoundLog {
  roundNumber: number;
  callerName: string;
  callerPoints: number;
  isSuccessful: boolean;
  scoresAdded: Record<string, number>; // player id -> points added
  scoresCumulative: Record<string, number>; // player id -> total score
  eliminatedPlayers: string[]; // player names eliminated in this round
}

export type GamePhase = 'setup' | 'playing' | 'round_over' | 'game_over';
export type TurnPhase = 'discard' | 'draw';

export interface GameSettings {
  numPlayers: number;
  scoreLimit: number;
  gameSpeed: 'slow' | 'medium' | 'fast'; // milliseconds per AI action
}
