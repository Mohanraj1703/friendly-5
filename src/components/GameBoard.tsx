import React, { useState, useEffect, useRef } from 'react';
import { Card, Player, GamePhase, TurnPhase, GameSettings, RoundLog } from '../types';
import { createDeck, shuffleDeck, calculateHandPoints, isValidDiscard, makeAIDecision } from '../utils/deck';
import PlayerHand from './PlayerHand';
import RoundSummary from './RoundSummary';
import PlayingCard from './PlayingCard';
import { RotateCcw, Volume2, VolumeX, Eye, Info, Play, MessageSquare, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOrCreatePlayerId } from '../lib/multiplayer';
import { 
  connectSocket, 
  discardCards, 
  drawCard, 
  callShowdown, 
  startNextRoundInRoom, 
  restartMatchInRoom, 
  toggleGamePause,
  sendChatMessage 
} from '../services/socket';

interface GameBoardProps {
  settings: GameSettings;
  humanName: string;
  onExit: () => void;
  lobbyId?: string;
}

export default function GameBoard({ settings, humanName, onExit, lobbyId }: GameBoardProps) {
  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Core Game States
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [discardPile, setDiscardPile] = useState<Card[]>([]);
  const [availableDiscardCard, setAvailableDiscardCard] = useState<Card | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('discard');
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [callerId, setCallerId] = useState<string>('');
  const [isCallSuccessful, setIsCallSuccessful] = useState<boolean>(false);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [roundLogs, setRoundLogs] = useState<RoundLog[]>([]);

  // Multiplayer session variables
  const myPlayerId = lobbyId ? getOrCreatePlayerId() : 'human';
  const isHost = lobbyId ? (players.find(p => p.id === myPlayerId)?.isHost ?? false) : true;

  // Sync state helper that routes local changes in offline singleplayer
  const syncGameState = async (updates: {
    players?: Player[];
    deck?: Card[];
    discardPile?: Card[];
    availableDiscardCard?: Card | null;
    currentTurn?: number;
    turnPhase?: TurnPhase;
    gamePhase?: GamePhase;
    roundNumber?: number;
    callerId?: string;
    isCallSuccessful?: boolean;
    gameLogs?: string[];
    roundLogs?: RoundLog[];
  }) => {
    if (lobbyId) {
      // In Socket.IO multiplayer, the server authoritatively handles state updates and emits them!
      return;
    } else {
      if (updates.players !== undefined) setPlayers(updates.players);
      if (updates.deck !== undefined) setDeck(updates.deck);
      if (updates.discardPile !== undefined) setDiscardPile(updates.discardPile);
      if (updates.availableDiscardCard !== undefined) setAvailableDiscardCard(updates.availableDiscardCard);
      if (updates.currentTurn !== undefined) setCurrentTurn(updates.currentTurn);
      if (updates.turnPhase !== undefined) setTurnPhase(updates.turnPhase);
      if (updates.gamePhase !== undefined) setGamePhase(updates.gamePhase);
      if (updates.roundNumber !== undefined) setRoundNumber(updates.roundNumber);
      if (updates.callerId !== undefined) setCallerId(updates.callerId);
      if (updates.isCallSuccessful !== undefined) setIsCallSuccessful(updates.isCallSuccessful);
      if (updates.gameLogs !== undefined) setGameLogs(updates.gameLogs);
      if (updates.roundLogs !== undefined) setRoundLogs(updates.roundLogs);
    }
  };

  // AI thinking delay states
  const [aiIsThinking, setAiIsThinking] = useState<boolean>(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string>('');

  // Audio helper
  const playSound = (type: 'deal' | 'discard' | 'draw' | 'call') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === 'deal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      } else if (type === 'discard') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      } else if (type === 'draw') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(580, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
      } else if (type === 'call') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio play blocked:', e);
    }
  };

  // Add message to game action log
  const logAction = (msg: string) => {
    setGameLogs((prev) => [msg, ...prev.slice(0, 49)]);
  };

  // Initialize Game on Mount or reset
  const initGame = (isNewGame: boolean = true) => {
    let nextRoundNum = 1;
    // Generate Players
    let initialPlayers: Player[] = [];
    let nextRoundLogs = [...roundLogs];
    if (isNewGame) {
      initialPlayers.push({
        id: myPlayerId,
        name: humanName,
        isHuman: true,
        hand: [],
        score: 0,
        eliminated: false,
        lastRoundPoints: null,
        penaltyThisRound: false,
        pointsAddedThisRound: null,
      });

      const names = ['AI Alpha', 'AI Beta', 'AI Gamma', 'AI Delta', 'AI Epsilon'];
      for (let i = 1; i < settings.numPlayers; i++) {
        initialPlayers.push({
          id: `ai_${i}`,
          name: names[i - 1],
          isHuman: false,
          hand: [],
          score: 0,
          eliminated: false,
          lastRoundPoints: null,
          penaltyThisRound: false,
          pointsAddedThisRound: null,
        });
      }
      nextRoundNum = 1;
      nextRoundLogs = [];
    } else {
      // Continue next round, keep cumulative scores
      initialPlayers = players.map((p) => ({
        ...p,
        hand: [],
        lastRoundPoints: null,
        penaltyThisRound: false,
        pointsAddedThisRound: null,
      }));
      nextRoundNum = roundNumber + 1;
    }

    // Set up deck and deal
    const freshDeck = shuffleDeck(createDeck(settings.numPlayers));
    
    // Deal 5 cards to each non-eliminated player
    initialPlayers.forEach((player) => {
      if (!player.eliminated) {
        player.hand = freshDeck.splice(0, 5);
      }
    });

    // Top card is flipped to the discard pile (The initial Open Card)
    const initialOpenCard = freshDeck.shift()!;
    
    // Find first active player using rotation model (Round 1 -> Player 1, Round 2 -> Player 2, etc.)
    const preferredStartIdx = (nextRoundNum - 1) % initialPlayers.length;
    let firstTurn = preferredStartIdx;
    while (initialPlayers[firstTurn].eliminated) {
      firstTurn = (firstTurn + 1) % initialPlayers.length;
    }

    const startMsg = `Round ${isNewGame ? 1 : roundNumber + 1} started. Hands dealt. Open card: ${initialOpenCard.value} of ${initialOpenCard.suit}.`;
    const nextLogs = [startMsg, ...gameLogs.slice(0, 49)];

    playSound('deal');

    syncGameState({
      players: initialPlayers,
      deck: freshDeck,
      discardPile: [initialOpenCard],
      availableDiscardCard: initialOpenCard,
      currentTurn: firstTurn,
      turnPhase: 'discard',
      gamePhase: 'playing',
      roundNumber: nextRoundNum,
      callerId: '',
      isCallSuccessful: false,
      gameLogs: nextLogs,
      roundLogs: nextRoundLogs
    });

    setSelectedCards([]);
    setAiIsThinking(false);
    setAiStatusMessage('');
  };

  useEffect(() => {
    if (!lobbyId) {
      initGame(true);
    }
  }, [settings, humanName, lobbyId]);

  // Socket.IO subscription for real-time multiplayer updates
  useEffect(() => {
    if (!lobbyId) return;

    const handleStateUpdate = (roomState: any) => {
      setPlayers(roomState.players || []);
      // Render deck back face placeholder items based on count to keep aesthetics identical
      setDeck(Array(roomState.deckCount || 0).fill({ id: 'back', suit: 'joker', value: 'back', points: 0 }));
      setDiscardPile(roomState.discardPile || []);
      setAvailableDiscardCard(roomState.availableDiscardCard);
      setCurrentTurn(roomState.currentTurn ?? 0);
      setTurnPhase(roomState.turnPhase || 'discard');
      setRoundNumber(roomState.roundNumber ?? 1);
      setCallerId(roomState.callerId || '');
      setIsCallSuccessful(roomState.isCallSuccessful ?? false);
      setGameLogs(roomState.gameLogs || []);
      setRoundLogs(roomState.roundLogs || []);
      
      if (roomState.status === 'playing') {
        setGamePhase('playing');
      } else if (roomState.status === 'round_over') {
        setGamePhase('round_over');
      } else if (roomState.status === 'game_over') {
        setGamePhase('game_over');
      }
    };

    const handleError = (msg: string) => {
      alert(msg);
    };

    const handleKicked = () => {
      alert("You have been kicked from the lobby.");
      onExit();
    };

    const s = connectSocket(handleStateUpdate, handleError, handleKicked);

    return () => {
      // Clean up local listeners when unmounting the game view
      s.off("gameStateUpdate");
      s.off("errorMsg");
      s.off("kicked");
    };
  }, [lobbyId, onExit]);

  const activePlayer = players[currentTurn];

  // AI Turn effect
  useEffect(() => {
    if (gamePhase !== 'playing' || !activePlayer || activePlayer.isHuman || aiIsThinking) return;
    if (lobbyId) return; // Server authoritatively handles bot AI turns in multiplayer!

    // Trigger AI Actions
    setAiIsThinking(true);
    setAiStatusMessage(`${activePlayer.name} is planning...`);

    const speedMs = settings.gameSpeed === 'slow' ? 2000 : settings.gameSpeed === 'medium' ? 1200 : 400;

    const timer = setTimeout(() => {
      // Determine what the open card is
      const openCard = discardPile[discardPile.length - 1];
      
      // Calculate active player list points to assist in decisions
      const otherPlayers = players.filter((p) => p.id !== activePlayer.id && !p.eliminated);
      const minOtherScore = Math.min(...otherPlayers.map((p) => p.score));

      // Make AI Decision
      const decision = makeAIDecision(
        activePlayer.hand,
        openCard,
        minOtherScore,
        settings.scoreLimit,
        activePlayer.score
      );

      if (decision.shouldCall) {
        // AI CALLS!
        handleCall(activePlayer.id);
      } else if (decision.discardCards && decision.discardCards.length > 0) {
        // AI Discards
        const discardCount = decision.discardCards.length;
        const discardedNames = decision.discardCards.map((c) => `${c.value} of ${c.suit}`).join(', ');
        
        playSound('discard');
        const logMsg1 = `${activePlayer.name} discarded ${discardCount} card(s): [${discardedNames}]`;
        let updatedLogs = [logMsg1, ...gameLogs.slice(0, 48)];

        // Perform Discard
        const nextHand = activePlayer.hand.filter(
          (hCard) => !decision.discardCards!.some((dCard) => dCard.id === hCard.id)
        );
        
        // Push discarded cards to discard pile. The last one will be on top.
        const nextDiscardPile = [...discardPile, ...decision.discardCards];

        setAiStatusMessage(`${activePlayer.name} is drawing...`);

        // Wait another bit to animate the Draw phase
        setTimeout(() => {
          let drawnCard: Card;
          let newDeck = [...deck];
          let finalDiscardPile = [...nextDiscardPile];

          // If deck is running low, recycle discard pile (except top card)
          if (newDeck.length <= 1) {
            const topCard = finalDiscardPile.pop()!;
            newDeck = shuffleDeck([...newDeck, ...finalDiscardDiscardCycle(finalDiscardPile)]);
            finalDiscardPile = [topCard];
            updatedLogs = [`♻️ Deck running low. Recycled the discard pile!`, ...updatedLogs];
          }

          if (decision.drawFromDeck) {
            drawnCard = newDeck.shift()!;
            updatedLogs = [`${activePlayer.name} drew a card from the deck.`, ...updatedLogs];
          } else {
            drawnCard = availableDiscardCard || finalDiscardPile[0];
            finalDiscardPile = finalDiscardPile.filter((c) => c.id !== drawnCard.id);
            updatedLogs = [`${activePlayer.name} took the open card [${drawnCard.value} of ${drawnCard.suit}] from the pile.`, ...updatedLogs];
          }

          playSound('draw');

          // Put card in AI hand
          const finalHand = [...nextHand, drawnCard];
          const nextPlayers = players.map((p) => (p.id === activePlayer.id ? { ...p, hand: finalHand } : p));
          const nextIdx = getNextTurnPlayerIndex(nextPlayers, currentTurn);

          syncGameState({
            deck: newDeck,
            discardPile: finalDiscardPile,
            availableDiscardCard: finalDiscardPile.length > 0 ? finalDiscardPile[finalDiscardPile.length - 1] : null,
            players: nextPlayers,
            currentTurn: nextIdx,
            turnPhase: 'discard',
            gameLogs: updatedLogs.slice(0, 50)
          });

          setAiIsThinking(false);
        }, speedMs * 0.8);
      } else {
        // Fallback safety to avoid softlock
        setAiIsThinking(false);
        const nextIdx = getNextTurnPlayerIndex(players, currentTurn);
        syncGameState({
          currentTurn: nextIdx,
          turnPhase: 'discard'
        });
      }
    }, speedMs);

    return () => clearTimeout(timer);
  }, [currentTurn, gamePhase, players, deck, discardPile]);

  // Recycle discard helper
  const finalDiscardDiscardCycle = (pile: Card[]): Card[] => {
    return pile;
  };

  const getNextTurnPlayerIndex = (playersList: Player[], currentIdx: number): number => {
    let nextIdx = (currentIdx + 1) % playersList.length;
    let attempts = 0;
    while (playersList[nextIdx].eliminated && attempts < playersList.length) {
      nextIdx = (nextIdx + 1) % playersList.length;
      attempts++;
    }
    return nextIdx;
  };

  // Turn navigation
  const advanceTurn = (nextDiscardPile?: Card[], playersList: Player[] = players) => {
    setSelectedCards([]);
    
    const pileToUse = nextDiscardPile || discardPile;
    const nextAvailableCard = pileToUse.length > 0 ? pileToUse[pileToUse.length - 1] : null;
    const nextIdx = getNextTurnPlayerIndex(playersList, currentTurn);

    syncGameState({
      discardPile: pileToUse,
      availableDiscardCard: nextAvailableCard,
      currentTurn: nextIdx,
      turnPhase: 'discard'
    });
  };

  // Toggle card selection (Human)
  const handleToggleSelectCard = (card: Card) => {
    if (turnPhase !== 'discard') return;

    setSelectedCards((prev) => {
      // If already selected, remove
      if (prev.some((c) => c.id === card.id)) {
        return prev.filter((c) => c.id !== card.id);
      }

      // If nothing selected yet, select freely
      if (prev.length === 0) {
        return [card];
      }

      // If card has the same rank/value as already selected, allow addition
      if (card.value === prev[0].value) {
        return [...prev, card];
      }

      // Otherwise, swap selection to this new card
      return [card];
    });
  };

  // HUMAN: Discard Selected Cards
  const handleHumanDiscard = () => {
    if (selectedCards.length === 0 || !isValidDiscard(selectedCards)) return;

    playSound('discard');

    if (lobbyId) {
      discardCards(lobbyId, selectedCards.map((c) => c.id));
      setSelectedCards([]);
      return;
    }

    const cardsText = selectedCards.map((c) => `${c.value} of ${c.suit}`).join(', ');
    const logMsg = `${humanName} discarded: [${cardsText}]`;
    const updatedLogs = [logMsg, ...gameLogs.slice(0, 49)];

    // Remove from hand
    const nextHand = activePlayer.hand.filter(
      (hCard) => !selectedCards.some((sCard) => sCard.id === hCard.id)
    );

    // Push to discard pile
    const nextDiscardPile = [...discardPile, ...selectedCards];
    const nextPlayers = players.map((p) => (p.id === activePlayer.id ? { ...p, hand: nextHand } : p));

    syncGameState({
      discardPile: nextDiscardPile,
      players: nextPlayers,
      turnPhase: 'draw',
      gameLogs: updatedLogs
    });

    setSelectedCards([]);
  };

  // HUMAN: Draw Card
  const handleHumanDraw = (fromDeck: boolean) => {
    if (turnPhase !== 'draw') return;

    playSound('draw');

    if (lobbyId) {
      drawCard(lobbyId, fromDeck);
      return;
    }

    let drawnCard: Card;
    let newDeck = [...deck];
    let finalDiscardPile = [...discardPile];
    let updatedLogs = [...gameLogs];

    // Recycle if deck is empty
    if (newDeck.length <= 1) {
      const topCard = finalDiscardPile.pop()!;
      newDeck = shuffleDeck([...newDeck, ...finalDiscardDiscardCycle(finalDiscardPile)]);
      finalDiscardPile = [topCard];
      updatedLogs = [`♻️ Deck running low. Recycled the discard pile!`, ...updatedLogs];
    }

    if (fromDeck) {
      drawnCard = newDeck.shift()!;
      updatedLogs = [`${humanName} drew from the Deck.`, ...updatedLogs];
    } else {
      drawnCard = availableDiscardCard || finalDiscardPile[0];
      finalDiscardPile = finalDiscardPile.filter((c) => c.id !== drawnCard.id);
      updatedLogs = [`${humanName} drew the Open Card: [${drawnCard.value} of ${drawnCard.suit}]`, ...updatedLogs];
    }

    playSound('draw');

    const nextHand = [...activePlayer.hand, drawnCard];
    const nextPlayers = players.map((p) => (p.id === activePlayer.id ? { ...p, hand: nextHand } : p));
    const nextIdx = getNextTurnPlayerIndex(nextPlayers, currentTurn);

    syncGameState({
      deck: newDeck,
      discardPile: finalDiscardPile,
      availableDiscardCard: finalDiscardPile.length > 0 ? finalDiscardPile[finalDiscardPile.length - 1] : null,
      players: nextPlayers,
      currentTurn: nextIdx,
      turnPhase: 'discard',
      gameLogs: updatedLogs.slice(0, 50)
    });

    setSelectedCards([]);
  };

  // Handle Player CALLING (Showdown!)
  const handleCall = (callerId: string) => {
    playSound('call');

    if (lobbyId) {
      callShowdown(lobbyId);
      return;
    }

    const callingPlayer = players.find((p) => p.id === callerId)!;
    const callerPoints = calculateHandPoints(callingPlayer.hand);

    const logMsg1 = `🔔 ${callingPlayer.name} called! Showdown begins...`;
    let updatedLogs = [logMsg1, ...gameLogs.slice(0, 48)];

    // Calculate everyone's hand points
    const activePlayers = players.filter((p) => !p.eliminated);
    
    // Find the absolute minimum hand points in this round among ALL active players
    const minHandPointsInRound = Math.min(...activePlayers.map((p) => calculateHandPoints(p.hand)));

    // Check if the caller actually had the lowest points (caller wins ties because they called first)
    const otherPlayers = activePlayers.filter((p) => p.id !== callerId);
    const otherPointsList = otherPlayers.map((p) => calculateHandPoints(p.hand));
    
    // Caller is successful if their points are lower than or equal to EVERY other player's hand points (no one is strictly lower)
    const successful = otherPointsList.every((pts) => callerPoints <= pts);

    // Calculate new scores and updates
    const scoresAdded: Record<string, number> = {};
    const scoresCumulative: Record<string, number> = {};

    const updatedPlayers = players.map((p) => {
      // Record their current hand score for the summary screen
      const currentHandPoints = calculateHandPoints(p.hand);
      let scoreToAdd = 0;
      let penalize = false;

      if (!p.eliminated) {
        if (p.id === callerId) {
          if (successful) {
            scoreToAdd = 0; // Wins round! Gets 0 points.
          } else {
            scoreToAdd = 50; // Penalty!
            penalize = true;
          }
        } else {
          if (successful) {
            scoreToAdd = currentHandPoints; // Standard round points added
          } else {
            // Caller failed. The player(s) with the lowest points get 0.
            if (currentHandPoints === minHandPointsInRound) {
              scoreToAdd = 0; // Defeated the caller! Awarded 0 points.
            } else {
              scoreToAdd = currentHandPoints; // Remaining player hands are counted
            }
          }
        }
      }

      const nextScore = p.score + scoreToAdd;
      scoresAdded[p.id] = scoreToAdd;
      scoresCumulative[p.id] = nextScore;

      return {
        ...p,
        score: nextScore,
        lastRoundPoints: currentHandPoints,
        penaltyThisRound: penalize,
        pointsAddedThisRound: scoreToAdd,
        eliminated: p.eliminated || nextScore >= settings.scoreLimit,
      };
    });

    // Check newly eliminated players
    const eliminatedList = updatedPlayers
      .filter((p) => !p.eliminated && p.score >= settings.scoreLimit)
      .map((p) => p.name);

    // Find who defeated the caller if failed
    const defenders = updatedPlayers.filter(
      (p) => !p.eliminated && p.id !== callerId && p.lastRoundPoints === minHandPointsInRound
    );
    const defendersNames = defenders.map((d) => d.name).join(', ');

    // Check for tied players
    const tiedPlayers = otherPlayers.filter((p) => calculateHandPoints(p.hand) === callerPoints);
    const hasTie = tiedPlayers.length > 0;
    const tiedNames = tiedPlayers.map((tp) => tp.name).join(', ');

    const outcomeMsg = successful
      ? hasTie
        ? `🏆 Successful call (Tiebreaker)! ${callingPlayer.name} tied with ${tiedNames} at ${callerPoints} points but wins because they called first. Tied player points are counted!`
        : `🏆 Successful call! ${callingPlayer.name} has the lowest hand with ${callerPoints} points.`
      : `❌ Bad call! ${callingPlayer.name} called with ${callerPoints} points, but was defeated. ${callingPlayer.name} gets +50 penalty. ${defendersNames} get 0 points; others count their hands.`;

    updatedLogs = [outcomeMsg, ...updatedLogs];

    // Create RoundLog object
    const roundLog: RoundLog = {
      roundNumber,
      callerName: callingPlayer.name,
      callerPoints,
      isSuccessful: successful,
      scoresAdded,
      scoresCumulative,
      eliminatedPlayers: eliminatedList
    };

    const nextRoundLogs = [...roundLogs, roundLog];

    syncGameState({
      players: updatedPlayers,
      isCallSuccessful: successful,
      callerId,
      gamePhase: 'round_over',
      gameLogs: updatedLogs.slice(0, 50),
      roundLogs: nextRoundLogs
    });
  };

  // Determine if the game is completely over (1 player remains under score limit)
  const activeCount = players.filter((p) => !p.eliminated).length;
  const isGameOver = gamePhase === 'round_over' && (activeCount <= 1);

  // Restart Round
  const handleNextRound = () => {
    if (lobbyId) {
      startNextRoundInRoom(lobbyId);
      return;
    }
    initGame(false);
  };

  // Reset entirely
  const handleRestartGame = () => {
    if (lobbyId) {
      restartMatchInRoom(lobbyId);
      return;
    }
    initGame(true);
  };

  // Open card details
  const openCard = discardPile[discardPile.length - 1];
  const isHumanTurn = lobbyId 
    ? activePlayer?.id === myPlayerId && gamePhase === 'playing'
    : activePlayer?.isHuman && gamePhase === 'playing';
  const cardToDisplay = (isHumanTurn && turnPhase === 'draw') ? availableDiscardCard : openCard;

  // Helper for rendering player stats
  const getPositionClasses = (idx: number, total: number) => {
    // Places other players logically in an arc around the playing board
    if (total === 2) {
      return 'top-4 left-1/2 -translate-x-1/2';
    }
    
    // Divide the remaining spots nicely
    const angle = (idx / (total - 1)) * 180; // 0 to 180 degrees
    if (total === 3) {
      if (idx === 1) return 'top-6 left-1/4 -translate-x-1/2';
      if (idx === 2) return 'top-6 right-1/4 translate-x-1/2';
    }
    
    if (total === 4) {
      if (idx === 1) return 'top-20 left-12';
      if (idx === 2) return 'top-6 left-1/2 -translate-x-1/2';
      if (idx === 3) return 'top-20 right-12';
    }

    if (total === 5) {
      if (idx === 1) return 'top-32 left-8';
      if (idx === 2) return 'top-6 left-1/3 -translate-x-1/2';
      if (idx === 3) return 'top-6 right-1/3 translate-x-1/2';
      if (idx === 4) return 'top-32 right-8';
    }

    // 6 players layout
    if (idx === 1) return 'top-40 left-6';
    if (idx === 2) return 'top-14 left-1/4 -translate-x-1/2';
    if (idx === 3) return 'top-6 left-1/2 -translate-x-1/2';
    if (idx === 4) return 'top-14 right-1/4 translate-x-1/2';
    return 'top-40 right-6';
  };

  if (players.length === 0) {
    return (
      <div className="w-full min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-sans gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-medium animate-pulse">Initializing table state...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden relative font-sans">
      
      {/* Top Header Controls */}
      <header className="p-4 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            Round {roundNumber}
          </div>
          <div className="px-3 py-1 bg-slate-950/60 border border-slate-850 rounded-lg text-xs font-semibold text-slate-400">
            Score Limit: <span className="text-white font-bold">{settings.scoreLimit}</span>
          </div>
        </div>

        <h1 className="text-sm font-black tracking-widest text-slate-500 uppercase hidden sm:block">
          5 CARDS BOARD
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 bg-slate-950 border border-slate-850 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          <button
            onClick={onExit}
            className="px-4 py-2 bg-slate-950 border border-slate-850 rounded-xl hover:bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Quit Game
          </button>
        </div>
      </header>

      {/* Main Playing Table Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto relative flex flex-col justify-between p-4 overflow-hidden">
        
        {/* Table Canvas Felt background */}
        <div className="absolute inset-x-4 inset-y-12 sm:inset-y-16 bg-gradient-to-b from-slate-900 to-slate-950 border-4 border-slate-850 rounded-[40px] shadow-2xl overflow-hidden pointer-events-none opacity-40">
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-25"></div>
        </div>

        {/* Circular Opponent Placement */}
        <div className="relative w-full h-[320px] sm:h-[350px] mt-4 flex items-center justify-center">
          {players.map((player, idx) => {
            if (player.id === myPlayerId) return null; // "Me" stays at bottom outside circle

            const isCurrent = currentTurn === idx && gamePhase === 'playing';
            const posClass = getPositionClasses(idx, players.length);

            return (
              <div
                key={player.id}
                className={`absolute transition-all duration-500 z-10 flex flex-col items-center ${posClass}`}
              >
                {/* Avatar status bubble */}
                <div
                  className={`px-4 py-2.5 rounded-2xl border flex flex-col items-center shadow-lg transition-all ${
                    player.eliminated
                      ? 'bg-rose-950/20 border-rose-900/20 opacity-50'
                      : isCurrent
                      ? 'bg-emerald-600/20 border-emerald-500 shadow-emerald-950/50 scale-105 ring-4 ring-emerald-500/10'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Turn glow indicator */}
                    {isCurrent && !player.eliminated && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                    <span className="text-xs font-bold text-white tracking-tight">
                      {player.name}
                    </span>
                    {player.eliminated && (
                      <span className="text-[9px] px-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-semibold">
                        OUT
                      </span>
                    )}
                  </div>

                  {!player.eliminated && (
                    <div className="flex items-center gap-3 mt-1.5 text-slate-400 text-[10px] font-medium font-mono">
                      <span>Score: <strong className="text-slate-200">{player.score}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Cards: <strong className="text-slate-200">{player.hand.length}</strong></span>
                    </div>
                  )}
                </div>

                {/* Face-down cards fan */}
                {!player.eliminated && (
                  <div className="mt-2 h-14 relative flex justify-center items-center">
                    <PlayerHand
                      cards={player.hand}
                      selectedCards={[]}
                      isHuman={false}
                      isCurrentTurn={isCurrent}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Central Table: Deck and Discard Pile */}
          <div className="z-10 flex flex-row items-center gap-6 sm:gap-10 bg-slate-900/80 border border-slate-800/80 px-8 py-6 rounded-3xl shadow-xl backdrop-blur-md">
            
            {/* Draw Pile (Deck) */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">
                Deck
              </span>
              <motion.button
                disabled={!isHumanTurn || turnPhase !== 'draw'}
                onClick={() => handleHumanDraw(true)}
                id="draw-deck-button"
                whileHover={isHumanTurn && turnPhase === 'draw' ? { scale: 1.05 } : {}}
                whileTap={isHumanTurn && turnPhase === 'draw' ? { scale: 0.95 } : {}}
                className={`relative rounded-xl transition-all cursor-pointer ${
                  isHumanTurn && turnPhase === 'draw'
                    ? 'ring-4 ring-emerald-500/35 shadow-lg shadow-emerald-500/20'
                    : 'opacity-90'
                }`}
              >
                <PlayingCard card={{ id: 'deck', suit: 'hearts', value: '', points: 0 }} isFaceUp={false} size="md" />
                
                {/* Deck Card Counter Overlay Badge */}
                <div className="absolute -bottom-2 bg-slate-950 border border-slate-800 text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full text-slate-200 left-1/2 -translate-x-1/2 shadow">
                  {deck.length}
                </div>
              </motion.button>
            </div>

            {/* Discard Pile (Open Card) */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold">
                Open Card
              </span>
              {cardToDisplay ? (
                <motion.button
                  disabled={!isHumanTurn || turnPhase !== 'draw'}
                  onClick={() => handleHumanDraw(false)}
                  id="draw-open-button"
                  whileHover={isHumanTurn && turnPhase === 'draw' ? { scale: 1.05 } : {}}
                  whileTap={isHumanTurn && turnPhase === 'draw' ? { scale: 0.95 } : {}}
                  className={`relative rounded-xl transition-all cursor-pointer ${
                    isHumanTurn && turnPhase === 'draw'
                      ? 'ring-4 ring-emerald-500/35 shadow-lg shadow-emerald-500/20'
                      : ''
                  }`}
                >
                  <PlayingCard card={cardToDisplay} isFaceUp={true} size="md" />
                  
                  {/* Take card indicator */}
                  <div className="absolute -bottom-2 bg-slate-950 border border-slate-800 text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full text-slate-400 left-1/2 -translate-x-1/2 shadow whitespace-nowrap">
                    TAKE
                  </div>
                </motion.button>
              ) : (
                <div className="w-14 h-20 sm:w-16 sm:h-24 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-slate-700" />
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Dynamic Action log and status message */}
        <div className="w-full max-w-xl mx-auto flex flex-col items-center mt-2 px-4 z-10">
          <div className="w-full bg-slate-900/60 border border-slate-850 rounded-2xl p-4 flex items-center justify-between min-h-[64px] backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  {aiIsThinking ? aiStatusMessage : isHumanTurn ? (
                    turnPhase === 'discard' ? 'Your Turn: Select cards of same value to Discard' : 'Choose: Draw from Deck or the Open Card'
                  ) : 'Waiting for next turn...'}
                </p>
                {/* Small instructions */}
                {isHumanTurn && (
                  <p className="text-[10px] text-slate-400">
                    {turnPhase === 'discard'
                      ? 'You can call if you believe you have the lowest point sum.'
                      : `You can draw the previous player's card [${availableDiscardCard ? `${availableDiscardCard.value} of ${availableDiscardCard.suit}` : 'None'}] or draw from deck.`}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Show Action Logs Button */}
            <div className="text-xs text-slate-500 font-mono hidden sm:block">
              {gameLogs[0] || 'Game started.'}
            </div>
          </div>
        </div>

        {/* Human Seating Controls and Hand cards */}
        <div className="mt-4 w-full z-10 flex flex-col items-center">
          
          {/* Action controller bar (Human) */}
          <div className="w-full max-w-xl flex items-center justify-center gap-3 mb-2 px-4">
            
            {/* Call Button */}
            <button
              disabled={!isHumanTurn || turnPhase !== 'discard' || activePlayer?.eliminated}
              onClick={() => handleCall(myPlayerId)}
              id="call-button"
              className={`flex-1 py-3 px-4 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg ${
                isHumanTurn && turnPhase === 'discard'
                  ? 'bg-amber-600 text-white hover:bg-amber-500 active:bg-amber-700 border border-amber-400/40 shadow-amber-950/50'
                  : 'bg-slate-900/50 text-slate-600 border border-slate-850/40'
              }`}
            >
              🔔 Call Showdown
            </button>

            {/* Drop Card(s) Button */}
            <button
              disabled={
                !isHumanTurn ||
                turnPhase !== 'discard' ||
                selectedCards.length === 0 ||
                !isValidDiscard(selectedCards)
              }
              onClick={handleHumanDiscard}
              id="discard-button"
              className={`flex-1 py-3 px-4 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg ${
                isHumanTurn && turnPhase === 'discard' && selectedCards.length > 0 && isValidDiscard(selectedCards)
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 border border-emerald-400/40 shadow-emerald-950/50'
                  : 'bg-slate-900/50 text-slate-600 border border-slate-850/40'
              }`}
            >
              {selectedCards.length > 0
                ? `Discard Selected (${selectedCards.length})`
                : 'Discard Card(s)'}
            </button>
          </div>

          {/* Hand Cards container */}
          <div className="w-full flex flex-col items-center bg-slate-900/40 border-t border-slate-900/60 p-2 rounded-t-[32px] backdrop-blur-md">
            
            {/* Player details */}
            <div className="flex items-center gap-4 text-xs font-semibold px-4 mb-1 mt-1 text-slate-300">
              <span className="flex items-center gap-1.5">
                👤 <strong className="text-white">{humanName} (You)</strong>
              </span>
              <span className="text-slate-700">|</span>
              <span>
                Cumulative Score: <strong className="text-emerald-400 font-bold">{players.find((p) => p.id === myPlayerId)?.score ?? 0} pts</strong>
              </span>
              <span className="text-slate-700">|</span>
              <span>
                Current Hand Sum: <strong className="text-yellow-400 font-bold">{(activePlayer && activePlayer.id === myPlayerId) ? calculateHandPoints(activePlayer.hand) : (players.find((p) => p.id === myPlayerId)?.hand ? calculateHandPoints(players.find((p) => p.id === myPlayerId)!.hand) : 0)}p</strong>
              </span>
            </div>

            {/* Hand component */}
            {players.find((p) => p.id === myPlayerId) && (
              <PlayerHand
                cards={players.find((p) => p.id === myPlayerId)!.hand}
                selectedCards={selectedCards}
                onToggleSelectCard={handleToggleSelectCard}
                isHuman={true}
                isCurrentTurn={isHumanTurn}
                isTurnPhaseDiscard={turnPhase === 'discard'}
              />
            )}
          </div>

        </div>

      </main>

      {/* Round Showdown / Summary Overlay */}
      {gamePhase === 'round_over' && (
        <RoundSummary
          players={players}
          callerId={callerId}
          isSuccessful={isCallSuccessful}
          scoreLimit={settings.scoreLimit}
          onNextRound={handleNextRound}
          onRestartGame={handleRestartGame}
          isGameOver={isGameOver}
        />
      )}

    </div>
  );
}
