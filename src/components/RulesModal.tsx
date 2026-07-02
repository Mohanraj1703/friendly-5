import React from 'react';
import { X, Trophy, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">5 Cards Game Rules</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-sm leading-relaxed">
          {/* Objective */}
          <div>
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Objective
            </h3>
            <p>
              The goal of the game is to have the <span className="text-emerald-400 font-semibold">lowest sum of points</span> in your hand. When you believe your hand score is lower than everyone else's, you can <span className="text-amber-400 font-semibold">"Call"</span> to end the round and test your luck!
            </p>
          </div>

          {/* Turn sequence */}
          <div>
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-emerald-400" /> How a Turn Works
            </h3>
            <p className="mb-2 text-slate-400">On your turn, you must perform two main actions:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong className="text-white">Drop Card(s):</strong> Select and discard <span className="text-amber-400">one card</span>, or <span className="text-amber-400">multiple cards of the exact same number</span> (e.g. discard two 7s, three Jacks, or four Aces). The card suits do not matter for dropping!
              </li>
              <li>
                <strong className="text-white">Draw a Card:</strong> Take exactly <span className="text-emerald-400">one card</span> to replace what you dropped. You can either take the <strong className="text-white">"Open Card"</strong> (the top card of the discard pile) or draw a face-down card from the <strong className="text-white">Deck</strong>.
              </li>
            </ol>
            <div className="mt-2.5 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
              💡 <span className="text-slate-200 font-medium">Strategy:</span> Discarding multiple matching cards shrinks your hand size! If you discard three cards and draw one, you now only hold 3 cards instead of 5, making it much easier to achieve a low score.
            </div>
          </div>

          {/* Calling rules */}
          <div>
            <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Calling & Showdown Rules
            </h3>
            <p className="mb-3">
              At the start of your turn, if you think you have the absolute lowest points in the game, you can click <span className="text-yellow-400 font-semibold">"Call"</span>. Everyone reveals their hands:
            </p>
            <ul className="list-disc pl-5 space-y-2.5">
              <li>
                <strong className="text-emerald-400">Successful Call:</strong> If your hand points are <span className="font-semibold text-emerald-400">lower than or equal to</span> all other players:
                <br />
                <span className="text-slate-400">You get <span className="text-emerald-400 font-semibold">0 points</span>. If you are tied with any other player, <span className="text-emerald-400 font-semibold">you win</span> because you called first! All other players (including tied players) must add their current hand points to their cumulative scores.</span>
              </li>
              <li>
                <strong className="text-rose-400">Unsuccessful Call:</strong> If any other player has a hand score that is <span className="font-semibold text-rose-400">strictly lower</span> than yours:
                <br />
                <span className="text-slate-400">You get a <span className="text-rose-400 font-semibold">50 point penalty</span> added to your cumulative score. The player(s) who actually held the strictly lowest points gets <span className="text-emerald-400 font-semibold">0 points</span>, and all other remaining players must add their current hand points to their cumulative score.</span>
              </li>
            </ul>
          </div>

          {/* Card Points */}
          <div>
            <h3 className="text-base font-semibold text-white mb-2">Card Values & Points</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-850">
                <div className="font-bold text-emerald-400 text-sm">A</div>
                <div className="text-slate-400">1 Point</div>
              </div>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-850">
                <div className="font-bold text-white text-sm">2 - 10</div>
                <div className="text-slate-400">Face Value</div>
              </div>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-850">
                <div className="font-bold text-amber-500 text-sm">J</div>
                <div className="text-slate-400">11 Points</div>
              </div>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-850">
                <div className="font-bold text-amber-500 text-sm">Q</div>
                <div className="text-slate-400">12 Points</div>
              </div>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-850">
                <div className="font-bold text-amber-500 text-sm">K</div>
                <div className="text-slate-400">13 Points</div>
              </div>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-850 col-span-3 sm:col-span-5">
                <div className="font-bold text-purple-400 text-sm">🃏 Joker</div>
                <div className="text-slate-400">0 Points</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400 text-center">
              Deck Setup: <span className="text-slate-300 font-semibold">54 cards</span> (including 2 Jokers) are used for 4 or fewer players. For more than 4 players, a double deck of <span className="text-slate-300 font-semibold">108 cards</span> is used!
            </p>
          </div>

          {/* Elimination limit */}
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Score Limit & Elimination</h3>
            <p>
              When a player's cumulative score reaches or exceeds the <span className="text-rose-400 font-semibold">Score Limit</span> (configured in settings, e.g. 100), they are <span className="text-rose-400 font-semibold">eliminated</span> from the game. The last remaining player with points below the limit wins!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl transition-colors cursor-pointer shadow-lg shadow-emerald-900/20"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}
