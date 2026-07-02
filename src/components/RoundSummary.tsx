import React, { useEffect } from 'react';
import { Player, GameSettings } from '../types';
import { getSuitDetails } from './PlayerHand';
import PlayingCard from './PlayingCard';
import { Sparkles, AlertOctagon, Trophy, Trash2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface RoundSummaryProps {
  players: Player[];
  callerId: string;
  isSuccessful: boolean;
  scoreLimit: number;
  onNextRound: () => void;
  onRestartGame: () => void;
  isGameOver: boolean;
}

export default function RoundSummary({
  players,
  callerId,
  isSuccessful,
  scoreLimit,
  onNextRound,
  onRestartGame,
  isGameOver,
}: RoundSummaryProps) {
  const caller = players.find((p) => p.id === callerId);

  // Play a simple retro sound effect depending on win/loss using Web Audio API
  useEffect(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (isSuccessful) {
        // Success Sound (High pitch arcade chime)
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc1.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        osc1.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(261.63, audioCtx.currentTime); // C4
        osc2.frequency.setValueAtTime(329.63, audioCtx.currentTime + 0.1); // E4
        osc2.frequency.setValueAtTime(392.00, audioCtx.currentTime + 0.2); // G4
        osc2.frequency.setValueAtTime(523.25, audioCtx.currentTime + 0.3); // C5

        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.6);
        osc2.stop(audioCtx.currentTime + 0.6);
      } else {
        // Penalty Sound (Sad slide down)
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      }
    } catch (e) {
      console.warn('Audio context failed to initialize or was blocked by browser policy:', e);
    }
  }, [isSuccessful]);

  // Determine winner if game is over
  const winner = isGameOver
    ? players.filter((p) => !p.eliminated).sort((a, b) => a.score - b.score)[0]
    : null;

  // Determine if caller won on a tiebreaker
  const callerPoints = caller?.lastRoundPoints ?? 0;
  const otherActivePlayers = players.filter((p) => p.id !== callerId && !p.eliminated);
  const tiedPlayers = otherActivePlayers.filter((p) => p.lastRoundPoints === callerPoints);
  const isTiebreakerWin = isSuccessful && tiedPlayers.length > 0;
  const tiedNames = tiedPlayers.map((p) => p.name).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden my-8"
      >
        {/* Banner header */}
        <div className="text-center mb-8">
          {isGameOver ? (
            <div className="inline-flex flex-col items-center">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl mb-3">
                <Trophy className="w-12 h-12 text-yellow-400 animate-bounce" />
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Game Over!</h2>
              <p className="text-slate-400 text-sm mt-1">
                The final survivor has been crowned.
              </p>
            </div>
          ) : isSuccessful ? (
            <div className="inline-flex flex-col items-center">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-3">
                <Sparkles className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                {isTiebreakerWin ? 'Tiebreaker Win!' : 'Successful Call!'}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {isTiebreakerWin ? (
                  <>
                    <span className="font-semibold text-emerald-400">{caller?.name}</span> tied with <span className="font-semibold text-yellow-400">{tiedNames}</span> at <span className="text-white font-semibold">{callerPoints} pts</span>, but wins because they called first!
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-emerald-400">{caller?.name}</span> successfully had the lowest hand points of <span className="text-white font-semibold">{caller?.lastRoundPoints} pts</span>!
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="inline-flex flex-col items-center">
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-3">
                <AlertOctagon className="w-12 h-12 text-rose-400 animate-pulse" />
              </div>
              <h2 className="text-3xl font-extrabold text-rose-500 tracking-tight">Unsuccessful Call!</h2>
              <p className="text-slate-400 text-sm mt-1">
                <span className="font-semibold text-white">{caller?.name}</span> called with <span className="font-semibold text-white">{caller?.lastRoundPoints} pts</span> but someone had a strictly lower hand!
              </p>
              <div className="mt-2 bg-rose-950/40 border border-rose-900/30 rounded-xl px-4 py-1.5 text-xs text-rose-300 font-semibold uppercase tracking-wider">
                +50 pts penalty awarded to {caller?.name}
              </div>
            </div>
          )}
        </div>

        {/* Hands Comparison */}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Showdown: Hand Comparison
        </h3>

        <div className="space-y-4 mb-8">
          {players.map((player) => {
            const isCaller = player.id === callerId;
            const pointsThisRound = player.pointsAddedThisRound ?? 0;

            const nextScore = player.score;
            const reachedLimit = nextScore >= scoreLimit;

            return (
              <div
                key={player.id}
                className={`flex flex-col lg:flex-row lg:items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all ${
                  isCaller
                    ? isSuccessful
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-rose-950/20 border-rose-500/30'
                    : 'bg-slate-950/30 border-slate-800'
                }`}
              >
                {/* Player details */}
                <div className="flex items-center justify-between lg:justify-start lg:w-1/4 mb-3 lg:mb-0">
                  <div>
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      {player.name}
                      {isCaller && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          isSuccessful ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          Caller
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">
                      {player.isHuman ? 'Human Player' : 'AI Opponent'}
                    </span>
                  </div>
                  <div className="lg:hidden text-right">
                    <span className="text-xs font-mono text-slate-400 block">Round Score</span>
                    <span className={`text-base font-bold ${pointsThisRound === 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {pointsThisRound} pts
                    </span>
                  </div>
                </div>

                {/* Hand Cards */}
                <div className="flex flex-wrap items-center gap-2 lg:w-2/4 mb-3 lg:mb-0">
                  {player.hand.map((card) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      isFaceUp={true}
                      size="sm"
                    />
                  ))}
                  <div className="text-xs font-semibold text-slate-300 ml-2 px-2 py-1 bg-slate-900 border border-slate-800/80 rounded-lg">
                    Sum: {player.lastRoundPoints}p
                  </div>
                </div>

                {/* Points Added & Cumulative */}
                <div className="flex items-center justify-between lg:justify-end lg:w-1/4 gap-4 text-right">
                  <div className="hidden lg:block">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Added</span>
                    <span className={`text-lg font-bold ${pointsThisRound === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      +{pointsThisRound}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">New Cumulative</span>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={`text-xl font-black ${reachedLimit ? 'text-rose-400 line-through' : 'text-white'}`}>
                        {nextScore}
                      </span>
                      <span className="text-xs text-slate-500">/ {scoreLimit}</span>
                    </div>
                    {reachedLimit && (
                      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md font-bold uppercase tracking-wider mt-1">
                        <ShieldAlert className="w-2.5 h-2.5" /> ELIMINATED
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Big Game Winner Display */}
        {isGameOver && winner && (
          <div className="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-3xl flex flex-col items-center justify-center text-center">
            <Trophy className="w-14 h-14 text-yellow-400 mb-2 animate-pulse" />
            <span className="text-xs uppercase font-bold tracking-widest text-yellow-400">GRAND CHAMPION</span>
            <h3 className="text-2xl font-black text-white mt-1">{winner.name}</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-md">
              With a masterful final score of <span className="text-yellow-400 font-bold">{winner.score} points</span>, {winner.name} survived below the limit of {scoreLimit} pts and won the game!
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-3 border-t border-slate-800 pt-6">
          <button
            onClick={onRestartGame}
            className="w-full sm:w-auto px-5 py-3 text-sm font-semibold text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Abandon & Reset
          </button>
          
          {!isGameOver ? (
            <button
              onClick={onNextRound}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40"
            >
              Start Next Round
            </button>
          ) : (
            <button
              onClick={onRestartGame}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-950/40"
            >
              <Trophy className="w-4 h-4" />
              Play New Game
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
