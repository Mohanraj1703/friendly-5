import React from 'react';
import { Card } from '../types';
import { Heart, Spade, Club, Diamond, HelpCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import PlayingCard from './PlayingCard';

interface PlayerHandProps {
  cards: Card[];
  selectedCards: Card[];
  onToggleSelectCard?: (card: Card) => void;
  isHuman: boolean;
  isCurrentTurn: boolean;
  isTurnPhaseDiscard?: boolean;
}


// Helper to get color and icon for suits
export function getSuitDetails(suit: Card['suit']) {
  switch (suit) {
    case 'hearts':
      return {
        color: 'text-red-500 bg-red-500/5 border-red-500/20',
        borderColor: 'border-red-500/20 group-hover:border-red-500/40',
        textColor: 'text-red-500',
        Icon: Heart,
        symbol: '♥',
      };
    case 'diamonds':
      return {
        color: 'text-rose-400 bg-rose-400/5 border-rose-400/20',
        borderColor: 'border-rose-400/20 group-hover:border-rose-400/40',
        textColor: 'text-rose-400',
        Icon: Diamond,
        symbol: '♦',
      };
    case 'clubs':
      return {
        color: 'text-slate-300 bg-slate-300/5 border-slate-300/20',
        borderColor: 'border-slate-300/20 group-hover:border-slate-300/40',
        textColor: 'text-slate-300',
        Icon: Club,
        symbol: '♣',
      };
    case 'spades':
      return {
        color: 'text-sky-400 bg-sky-400/5 border-sky-400/20',
        borderColor: 'border-sky-400/20 group-hover:border-sky-400/40',
        textColor: 'text-sky-400',
        Icon: Spade,
        symbol: '♠',
      };
    case 'joker':
    default:
      return {
        color: 'text-purple-400 bg-purple-400/5 border-purple-500/20',
        borderColor: 'border-purple-500/20 group-hover:border-purple-500/40',
        textColor: 'text-purple-400',
        Icon: Sparkles,
        symbol: '🃏',
      };
  }
}

export default function PlayerHand({
  cards,
  selectedCards,
  onToggleSelectCard,
  isHuman,
  isCurrentTurn,
  isTurnPhaseDiscard = true,
}: PlayerHandProps) {
  return (
    <div className="w-full flex justify-center items-end py-6 px-4">
      <div className="flex flex-wrap justify-center items-end gap-3 max-w-full">
        {cards.map((card, idx) => {
          const isSelected = selectedCards.some((c) => c.id === card.id);

          // If the player is a computer and this hand is being rendered, we show them as face-down cards
          if (!isHuman) {
            return (
              <motion.div
                key={card.id}
                initial={{ scale: 0.8, y: 50, rotate: (idx - cards.length / 2) * 5 }}
                animate={{ scale: 1, y: 0, rotate: (idx - cards.length / 2) * 3 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="flex-shrink-0"
              >
                <PlayingCard card={card} isFaceUp={false} size="md" />
              </motion.div>
            );
          }

          // Human player card with select capabilities
          const canSelect = isCurrentTurn && isTurnPhaseDiscard && onToggleSelectCard;

          return (
            <motion.div
              key={card.id}
              style={{ originY: 1 }}
              animate={{
                y: isSelected ? -24 : 0,
                scale: isSelected ? 1.05 : 1,
              }}
              whileHover={canSelect ? { y: isSelected ? -28 : -8, scale: 1.02 } : {}}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="flex-shrink-0"
            >
              <PlayingCard
                card={card}
                isFaceUp={true}
                size="lg"
                isSelected={isSelected}
                onClick={canSelect ? () => onToggleSelectCard(card) : undefined}
                disabled={!canSelect}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
