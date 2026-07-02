import { Card } from '../types';

// Generate a full deck of 54 cards (52 standard cards + 2 Jokers)
// If there are more than 4 players, it creates a double deck of 108 cards.
export function createDeck(numPlayers: number = 4): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = [
    { name: 'A', points: 1 },
    { name: '2', points: 2 },
    { name: '3', points: 3 },
    { name: '4', points: 4 },
    { name: '5', points: 5 },
    { name: '6', points: 6 },
    { name: '7', points: 7 },
    { name: '8', points: 8 },
    { name: '9', points: 9 },
    { name: '10', points: 10 },
    { name: 'J', points: 11 },
    { name: 'Q', points: 12 },
    { name: 'K', points: 13 },
  ];

  const buildSingleDeck = (deckIndex: number): Card[] => {
    const deck: Card[] = [];
    suits.forEach((suit) => {
      values.forEach((val) => {
        deck.push({
          id: `${suit}_${val.name}_d${deckIndex}`,
          suit,
          value: val.name,
          points: val.points,
        });
      });
    });

    // Add 2 Jokers
    deck.push({
      id: `joker_1_d${deckIndex}`,
      suit: 'joker',
      value: 'joker',
      points: 0,
    });
    deck.push({
      id: `joker_2_d${deckIndex}`,
      suit: 'joker',
      value: 'joker',
      points: 0,
    });

    return deck;
  };

  const isDoubleDeck = numPlayers > 4;
  if (isDoubleDeck) {
    return [...buildSingleDeck(1), ...buildSingleDeck(2)];
  } else {
    return buildSingleDeck(1);
  }
}

// Shuffle a deck of cards using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Calculate the total points of a list of cards
export function calculateHandPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.points, 0);
}

// Validate if selected cards are legal to drop (must be same value/rank)
export function isValidDiscard(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;

  // For multiple cards, all must have the same value (rank)
  const firstValue = cards[0].value;
  return cards.every((card) => card.value === firstValue);
}

// AI decision-making logic
// Returns { shouldCall: boolean } or { discardCards: Card[], drawFromDeck: boolean }
export interface AIDecision {
  shouldCall: boolean;
  discardCards?: Card[];
  drawFromDeck?: boolean;
}

export function makeAIDecision(
  aiHand: Card[],
  openCard: Card,
  otherPlayersMinKnownPoints: number, // AI might guess or track, let's keep it simple
  scoreLimit: number,
  aiScore: number
): AIDecision {
  const currentPoints = calculateHandPoints(aiHand);

  // AI strategy for calling:
  // Usually, if hand points are very low (e.g., <= 6), consider calling.
  // If the score is close to the limit, we might be more desperate or more conservative.
  // If AI points are <= 5, it is highly likely to call. Let's make it smart:
  // If points are <= 5, AI calls 90% of the time.
  // If points are <= 7, AI calls 60% of the time.
  // If points are <= 3, AI calls 100% of the time.
  if (currentPoints <= 3) {
    return { shouldCall: true };
  } else if (currentPoints <= 5 && Math.random() < 0.9) {
    return { shouldCall: true };
  } else if (currentPoints <= 7 && Math.random() < 0.5) {
    return { shouldCall: true };
  }

  // Find the best discard combination
  // We want to discard cards with the same value to discard as many points as possible.
  // Group cards by value
  const groups: Record<string, Card[]> = {};
  aiHand.forEach((card) => {
    if (!groups[card.value]) {
      groups[card.value] = [];
    }
    groups[card.value].push(card);
  });

  // Calculate the total points we would drop for each value group
  let bestValue = '';
  let maxPointsDropped = -1;
  let bestGroup: Card[] = [];

  Object.entries(groups).forEach(([value, cards]) => {
    const points = calculateHandPoints(cards);
    // If we have duplicates, we prioritize dropping duplicates because we reduce cards count
    // and drop more points.
    // Let's weight multiple cards higher, or just use raw points dropped.
    // Discarding duplicates is always better because you get rid of multiple cards.
    // Let's prioritize group length, then points.
    if (cards.length > bestGroup.length || (cards.length === bestGroup.length && points > maxPointsDropped)) {
      bestValue = value;
      maxPointsDropped = points;
      bestGroup = cards;
    }
  });

  const discardCards = bestGroup;

  // Decide whether to draw from the deck or from the open card.
  // AI prefers to draw the open card if:
  // 1. The open card is low value (<= 3 points or a Joker).
  // 2. The open card matches another card in the AI's hand (helps form a pair for future turns).
  // 3. AND the open card is lower than the highest card in the AI's current hand (excluding the ones being discarded).
  
  const remainingHand = aiHand.filter(c => !discardCards.some(dc => dc.id === c.id));
  const maxRemainingPoints = remainingHand.length > 0 ? Math.max(...remainingHand.map(c => c.points)) : 0;
  
  const hasMatchingRankInRemaining = remainingHand.some(c => c.value === openCard.value);
  const isOpenCardVeryLow = openCard.points <= 3;
  const isBetterThanMaxRemaining = openCard.points < maxRemainingPoints;

  let drawFromDeck = true;
  if ((isOpenCardVeryLow || hasMatchingRankInRemaining) && isBetterThanMaxRemaining) {
    drawFromDeck = false; // Take open card
  }

  return {
    shouldCall: false,
    discardCards,
    drawFromDeck,
  };
}
