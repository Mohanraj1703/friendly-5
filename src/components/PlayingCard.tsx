import React from 'react';
import { Card } from '../types';
import { motion } from 'motion/react';

// Custom high-quality vector suit paths for ultimate realistic look
export const SpadePath = "M12 2C11.5 2.5 6 9 6 13c0 3.3 2.7 6 6 6s1.5-.5 1.5-.5.5 2-2 3.5h7c-2.5-1.5-2-3.5-2-3.5s1 .5 1.5.5c3.3 0 6-2.7 6-6 0-4-5.5-10.5-6-11z";
export const ClubPath = "M12 8.5a3.2 3.2 0 1 0-3.2-3.2A3.2 3.2 0 0 0 12 8.5zm-4.2 6.5a3.2 3.2 0 1 0 3.2-3.2 3.2 3.2 0 0 0-3.2 3.2zm8.4 0a3.2 3.2 0 1 0-3.2-3.2 3.2 3.2 0 0 0 3.2 3.2zM12 14c0 1.5.5 3 1.5 4h-3c1-1 1.5-2.5 1.5-4z";
export const HeartPath = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
export const DiamondPath = "M12 2L3 12l9 10 9-10L12 2z";

export function getSuitSvgPath(suit: Card['suit']): string {
  switch (suit) {
    case 'hearts': return HeartPath;
    case 'diamonds': return DiamondPath;
    case 'clubs': return ClubPath;
    case 'spades': return SpadePath;
    default: return "";
  }
}

export function getSuitColorClass(suit: Card['suit']): string {
  if (suit === 'hearts' || suit === 'diamonds') {
    return 'text-red-600 fill-red-600';
  }
  if (suit === 'joker') {
    return 'text-purple-600 fill-purple-600';
  }
  return 'text-neutral-950 fill-neutral-950';
}

export const SuitSvg = ({ suit, className = "w-4 h-4" }: { suit: Card['suit']; className?: string }) => {
  const path = getSuitSvgPath(suit);
  const color = getSuitColorClass(suit);
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="currentColor">
      <path d={path} />
    </svg>
  );
};

// Geometric pip positions inside a relative container
// Left: 18%, Center: 50%, Right: 18%
// Rows: 1 = top (12%), 2 = mid-top (31%), 3 = center (50%), 4 = mid-bottom (31%), 5 = bottom (12%)
const pipLayouts: Record<string, { col: 'left' | 'center' | 'right'; row: number; rotate?: boolean }[]> = {
  'A': [
    { col: 'center', row: 3 }
  ],
  '2': [
    { col: 'center', row: 1 },
    { col: 'center', row: 5, rotate: true }
  ],
  '3': [
    { col: 'center', row: 1 },
    { col: 'center', row: 3 },
    { col: 'center', row: 5, rotate: true }
  ],
  '4': [
    { col: 'left', row: 1 },
    { col: 'right', row: 1 },
    { col: 'left', row: 5, rotate: true },
    { col: 'right', row: 5, rotate: true }
  ],
  '5': [
    { col: 'left', row: 1 },
    { col: 'right', row: 1 },
    { col: 'center', row: 3 },
    { col: 'left', row: 5, rotate: true },
    { col: 'right', row: 5, rotate: true }
  ],
  '6': [
    { col: 'left', row: 1 },
    { col: 'right', row: 1 },
    { col: 'left', row: 3 },
    { col: 'right', row: 3 },
    { col: 'left', row: 5, rotate: true },
    { col: 'right', row: 5, rotate: true }
  ],
  '7': [
    { col: 'left', row: 1 },
    { col: 'right', row: 1 },
    { col: 'left', row: 3 },
    { col: 'right', row: 3 },
    { col: 'center', row: 2 },
    { col: 'left', row: 5, rotate: true },
    { col: 'right', row: 5, rotate: true }
  ],
  '8': [
    { col: 'left', row: 1 },
    { col: 'right', row: 1 },
    { col: 'left', row: 3 },
    { col: 'right', row: 3 },
    { col: 'center', row: 2 },
    { col: 'center', row: 4, rotate: true },
    { col: 'left', row: 5, rotate: true },
    { col: 'right', row: 5, rotate: true }
  ],
  '9': [
    { col: 'left', row: 1 },
    { col: 'right', row: 1 },
    { col: 'left', row: 2 },
    { col: 'right', row: 2 },
    { col: 'center', row: 3 },
    { col: 'left', row: 4, rotate: true },
    { col: 'right', row: 4, rotate: true },
    { col: 'left', row: 5, rotate: true },
    { col: 'right', row: 5, rotate: true }
  ],
  '10': [
    { col: 'left', row: 1 },
    { col: 'right', row: 1 },
    { col: 'left', row: 2 },
    { col: 'right', row: 2 },
    { col: 'center', row: 2 },
    { col: 'center', row: 4, rotate: true },
    { col: 'left', row: 4, rotate: true },
    { col: 'right', row: 4, rotate: true },
    { col: 'left', row: 5, rotate: true },
    { col: 'right', row: 5, rotate: true }
  ]
};

const CourtIllustration = ({ value, suit }: { value: string; suit: Card['suit'] }) => {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const colorTheme = isRed ? 'text-red-600' : 'text-slate-800';
  
  return (
    <div className="absolute inset-x-3.5 inset-y-5.5 border border-amber-600/30 rounded bg-amber-50/25 overflow-hidden flex flex-col justify-between p-0.5 select-none pointer-events-none">
      {/* Top Half */}
      <div className="h-1/2 flex flex-col items-center justify-start border-b border-dashed border-amber-600/20 relative pt-1">
        {value === 'K' && (
          <>
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-amber-600" fill="currentColor">
              <path d="M5 16h14l1-8-3 3-5-6-5 6-3-3 1 8z" />
            </svg>
            <span className="text-[7px] font-serif font-black text-amber-800 uppercase tracking-tighter leading-none">KING</span>
            <div className="absolute right-1 bottom-1 flex gap-0.5 opacity-80">
              {/* Sword */}
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-blue-900" fill="currentColor">
                <path d="M21 3s-1.5-.5-2.5.5L10 12h-3l-2 2v2h2l2-2v-3l8.5-8.5c1-1 .5-2.5.5-2.5z" />
              </svg>
            </div>
          </>
        )}
        {value === 'Q' && (
          <>
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-rose-500" fill="currentColor">
              <path d="M12 2c1.1 0 2 .9 2 2a2 2 0 01-1.1 1.8l2.6 4.2h-7l2.6-4.2A2 2 0 0110 4c0-1.1.9-2 2-2zm-6 10h12v2H6v-2zm1 4h10v2H7v-2z" />
            </svg>
            <span className="text-[7px] font-serif font-black text-amber-800 uppercase tracking-tighter leading-none">QUEEN</span>
            <div className="absolute right-1 bottom-1 opacity-80">
              {/* Flower */}
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-red-500" fill="currentColor">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14h-2v-2h2zm0-4h-2V7h2z" />
              </svg>
            </div>
          </>
        )}
        {value === 'J' && (
          <>
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-blue-600" fill="currentColor">
              <path d="M12 22s6-4.2 6-10V5l-6-3-6 3v7c0 5.8 6 10 6 10z" />
            </svg>
            <span className="text-[7px] font-serif font-black text-amber-800 uppercase tracking-tighter leading-none">JACK</span>
            <div className="absolute right-1 bottom-1 opacity-80">
              {/* Spear */}
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-slate-500" fill="currentColor">
                <path d="M12 2h2v16h-2V2z" />
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Bottom Half Inverted */}
      <div className="h-1/2 flex flex-col items-center justify-start rotate-180 relative pt-1">
        {value === 'K' && (
          <>
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-amber-600" fill="currentColor">
              <path d="M5 16h14l1-8-3 3-5-6-5 6-3-3 1 8z" />
            </svg>
            <span className="text-[7px] font-serif font-black text-amber-800 uppercase tracking-tighter leading-none">KING</span>
            <div className="absolute right-1 bottom-1 flex gap-0.5 opacity-80">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-blue-900" fill="currentColor">
                <path d="M21 3s-1.5-.5-2.5.5L10 12h-3l-2 2v2h2l2-2v-3l8.5-8.5c1-1 .5-2.5.5-2.5z" />
              </svg>
            </div>
          </>
        )}
        {value === 'Q' && (
          <>
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-rose-500" fill="currentColor">
              <path d="M12 2c1.1 0 2 .9 2 2a2 2 0 01-1.1 1.8l2.6 4.2h-7l2.6-4.2A2 2 0 0110 4c0-1.1.9-2 2-2zm-6 10h12v2H6v-2zm1 4h10v2H7v-2z" />
            </svg>
            <span className="text-[7px] font-serif font-black text-amber-800 uppercase tracking-tighter leading-none">QUEEN</span>
            <div className="absolute right-1 bottom-1 opacity-80">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-red-500" fill="currentColor">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14h-2v-2h2zm0-4h-2V7h2z" />
              </svg>
            </div>
          </>
        )}
        {value === 'J' && (
          <>
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-blue-600" fill="currentColor">
              <path d="M12 22s6-4.2 6-10V5l-6-3-6 3v7c0 5.8 6 10 6 10z" />
            </svg>
            <span className="text-[7px] font-serif font-black text-amber-800 uppercase tracking-tighter leading-none">JACK</span>
            <div className="absolute right-1 bottom-1 opacity-80">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-slate-500" fill="currentColor">
                <path d="M12 2h2v16h-2V2z" />
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const JokerIllustration = () => {
  return (
    <div className="absolute inset-x-3.5 inset-y-5.5 border border-purple-500/30 rounded bg-purple-50/20 overflow-hidden flex flex-col items-center justify-center p-2 select-none pointer-events-none">
      <svg viewBox="0 0 24 24" className="w-9 h-9 text-purple-600" fill="currentColor">
        <path d="M12 2c1.1 0 2 .9 2 2v2.1c1.8.4 3.3 1.6 4.1 3.2.7.2 1.4.6 1.9 1.2s.8 1.4.8 2.2c0 2.2-1.8 4-4 4H7.2c-2.2 0-4-1.8-4-4 0-.8.3-1.6.8-2.2s1.2-1 1.9-1.2C6.7 9.7 8.2 8.5 10 8.1V4c0-1.1.9-2 2-2zm0 13c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3z" />
      </svg>
      <div className="text-[7px] font-sans font-black text-purple-700 uppercase tracking-widest mt-1">Jester</div>
    </div>
  );
};

// Intricate decorative card back SVG pattern
export const CardBackPattern = () => {
  return (
    <div className="absolute inset-1 border-2 border-white/90 rounded-lg bg-red-700 relative overflow-hidden flex items-center justify-center">
      {/* Intricate Lattice Grid */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1.2px,transparent_1.2px)] [background-size:6px_6px]" />
      
      {/* Scrollwork & Centerpiece */}
      <div className="absolute inset-2 border border-white/20 rounded flex items-center justify-center">
        <div className="w-12 h-18 border-2 border-dashed border-white/20 rounded-full flex items-center justify-center relative rotate-45">
          <div className="w-8 h-8 border border-white/40 rounded-full flex items-center justify-center -rotate-45">
            {/* Elegant symmetrical star */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/80" fill="currentColor">
              <path d="M12 2l2.4 7.3h7.6l-6.2 4.5 2.4 7.2-6.2-4.5-6.2 4.5 2.4-7.2-6.2-4.5h7.6z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Corner Ornate Accents */}
      <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-white/40" />
      <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-white/40" />
      <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-white/40" />
      <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-white/40" />
    </div>
  );
};

interface PlayingCardProps {
  key?: string | number;
  card: Card;
  isFaceUp?: boolean;
  size?: 'sm' | 'md' | 'lg'; // sm = summary/stats, md = AI hands/deck pile, lg = active playable card
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export default function PlayingCard({
  card,
  isFaceUp = true,
  size = 'lg',
  isSelected = false,
  onClick,
  disabled = false,
}: PlayingCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? 'text-red-600' : 'text-neutral-900';
  const isJoker = card.suit === 'joker';

  // Render Card Back
  if (!isFaceUp) {
    const sizeClasses = {
      sm: 'w-10 h-14 rounded-lg',
      md: 'w-14 h-20 sm:w-16 sm:h-24 rounded-xl',
      lg: 'w-24 h-36 rounded-2xl',
    };
    return (
      <div className={`relative ${sizeClasses[size]} bg-red-600 border border-red-800 shadow-md p-1 select-none flex-shrink-0`}>
        <CardBackPattern />
      </div>
    );
  }

  // Large Interactive/Playable Card
  if (size === 'lg') {
    const pips = pipLayouts[card.value] || [];
    const isCourt = ['J', 'Q', 'K'].includes(card.value);

    return (
      <motion.button
        type="button"
        disabled={disabled || !onClick}
        onClick={onClick}
        id={`playing-card-${card.id}`}
        style={{ originY: 1 }}
        className={`relative w-24 h-36 sm:w-28 sm:h-40 bg-white border rounded-2xl flex flex-col justify-between p-2.5 select-none text-left transition-all ${
          isSelected
            ? 'border-emerald-500 shadow-[0_12px_24px_-4px_rgba(16,185,129,0.35),0_0_15px_1px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/20'
            : onClick && !disabled
            ? 'border-neutral-300 shadow-md hover:border-neutral-400 hover:shadow-lg hover:-translate-y-2'
            : 'border-neutral-200/80 shadow-sm opacity-95'
        }`}
      >
        {/* Subtle high-quality card surface glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-neutral-50/10 via-white/5 to-neutral-100/20 rounded-2xl pointer-events-none" />

        {/* Top-Left Rank/Suit Index */}
        <div className="flex flex-col items-center leading-none z-10">
          {isJoker ? (
            <div className="flex flex-col items-center text-[8px] font-sans font-black leading-none text-purple-600">
              <span>J</span><span>O</span><span>K</span><span>E</span><span>R</span>
            </div>
          ) : (
            <>
              <span className={`text-base font-serif font-black tracking-tight leading-none ${suitColor}`}>
                {card.value}
              </span>
              <SuitSvg suit={card.suit} className="w-3.5 h-3.5 mt-0.5" />
            </>
          )}
        </div>

        {/* Point Indicator Badge */}
        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-neutral-100 border border-neutral-200/80 text-[8px] font-mono font-bold text-neutral-500 rounded-full leading-none z-10">
          {card.points}p
        </div>

        {/* Central Card Art Section */}
        {isJoker ? (
          <JokerIllustration />
        ) : isCourt ? (
          <CourtIllustration value={card.value} suit={card.suit} />
        ) : (
          /* Classic Pips Layout */
          <div className="absolute inset-x-3.5 inset-y-6 pointer-events-none">
            {pips.map((pip, index) => {
              const colClass = {
                left: 'left-[16%]',
                center: 'left-[50%] -translate-x-1/2',
                right: 'right-[16%]',
              }[pip.col];

              const rowClass = {
                1: 'top-[10%]',
                2: 'top-[30%]',
                3: 'top-[50%] -translate-y-1/2',
                4: 'bottom-[30%]',
                5: 'bottom-[10%]',
              }[pip.row];

              // Make single center pip (Ace) extra large
              const pipSizeClass = card.value === 'A' ? 'w-8 h-8' : 'w-3.5 h-3.5';

              return (
                <div
                  key={index}
                  className={`absolute ${colClass} ${rowClass} ${pip.rotate ? 'rotate-180' : ''}`}
                >
                  <SuitSvg suit={card.suit} className={pipSizeClass} />
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom-Right Inverted Rank/Suit Index */}
        <div className="self-end flex flex-col items-center leading-none rotate-180 z-10">
          {isJoker ? (
            <div className="flex flex-col items-center text-[8px] font-sans font-black leading-none text-purple-600">
              <span>J</span><span>O</span><span>K</span><span>E</span><span>R</span>
            </div>
          ) : (
            <>
              <span className={`text-base font-serif font-black tracking-tight leading-none ${suitColor}`}>
                {card.value}
              </span>
              <SuitSvg suit={card.suit} className="w-3.5 h-3.5 mt-0.5" />
            </>
          )}
        </div>

        {/* Checkmark indicator for selected state */}
        {isSelected && (
          <div className="absolute -top-1.5 -left-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-md border border-emerald-400 z-20">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </motion.button>
    );
  }

  // Medium Card (AI cards, deck drawing)
  if (size === 'md') {
    return (
      <div className="relative w-14 h-20 sm:w-16 sm:h-24 bg-white border border-neutral-300 rounded-xl shadow flex flex-col justify-between p-1.5 select-none">
        <div className="flex flex-col items-start leading-none">
          <span className={`text-[10px] font-serif font-black ${suitColor}`}>
            {isJoker ? 'JK' : card.value}
          </span>
          {!isJoker && <SuitSvg suit={card.suit} className="w-2.5 h-2.5 mt-0.5" />}
        </div>
        
        {/* Large center suit icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-90">
          <SuitSvg suit={card.suit} className="w-6 h-6" />
        </div>

        {/* Small Point badge */}
        <div className="absolute top-1 right-1 text-[7px] font-mono font-bold text-neutral-400">
          {card.points}p
        </div>

        <div className="self-end flex flex-col items-start leading-none rotate-180">
          <span className={`text-[10px] font-serif font-black ${suitColor}`}>
            {isJoker ? 'JK' : card.value}
          </span>
          {!isJoker && <SuitSvg suit={card.suit} className="w-2.5 h-2.5 mt-0.5" />}
        </div>
      </div>
    );
  }

  // Small Card (Summary stats, log lists)
  return (
    <div className="relative w-10 h-14 bg-white border border-neutral-200 rounded-lg p-1 flex flex-col justify-between select-none">
      <div className="flex items-center justify-between leading-none">
        <span className={`text-[9px] font-serif font-black leading-none ${suitColor}`}>
          {isJoker ? 'JK' : card.value}
        </span>
        <div className="text-[7px] font-mono font-bold text-neutral-400">
          {card.points}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-95">
        <SuitSvg suit={card.suit} className="w-4 h-4 mt-2" />
      </div>
    </div>
  );
}
