import React, { useState } from 'react';
import { Play, Settings, Users, ShieldAlert, Award } from 'lucide-react';
import { GameSettings as SettingsType } from '../types';

interface GameSettingsProps {
  onStartGame: (settings: SettingsType, playerName: string) => void;
  initialPlayerName?: string;
}

export default function GameSettings({ onStartGame, initialPlayerName = 'Player 1' }: GameSettingsProps) {
  const [numPlayers, setNumPlayers] = useState<number>(4);
  const [scoreLimit, setScoreLimit] = useState<number>(100);
  const [customLimit, setCustomLimit] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>(initialPlayerName);
  const [gameSpeed, setGameSpeed] = useState<SettingsType['gameSpeed']>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLimit = customLimit ? parseInt(customLimit, 10) : scoreLimit;
    if (isNaN(finalLimit) || finalLimit <= 0) {
      alert('Please enter a valid positive score limit.');
      return;
    }
    onStartGame(
      {
        numPlayers,
        scoreLimit: finalLimit,
        gameSpeed,
      },
      playerName.trim() || 'Player 1'
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4">
          <Award className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">5 Cards Game</h1>
        <p className="text-slate-400 text-sm mt-2 max-w-sm">
          A traditional strategic hand-minimizing card game of tactical discards, risky calls, and sudden-death limits.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Player Name */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
            placeholder="Enter your name"
            className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
            required
          />
        </div>

        {/* Number of Players */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" /> Number of Players (2 - 6)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setNumPlayers(num)}
                className={`py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
                  numPlayers === num
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            You will play against {numPlayers - 1} skilled AI opponents.
          </p>
        </div>

        {/* Score Limit */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-slate-400" /> Score Elimination Limit
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[50, 100, 150].map((limit) => (
              <button
                key={limit}
                type="button"
                onClick={() => {
                  setScoreLimit(limit);
                  setCustomLimit('');
                }}
                className={`py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
                  scoreLimit === limit && !customLimit
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {limit} pts
              </button>
            ))}
            <input
              type="number"
              placeholder="Custom"
              value={customLimit}
              onChange={(e) => {
                setCustomLimit(e.target.value);
                setScoreLimit(0);
              }}
              className={`text-center py-2 px-1 rounded-xl text-sm font-semibold border focus:outline-none transition-all ${
                customLimit
                  ? 'bg-emerald-600/20 text-white border-emerald-500 focus:border-emerald-400'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 focus:border-slate-500'
              }`}
              min="10"
              max="1000"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Players who reach this sum of cumulative points are immediately eliminated.
          </p>
        </div>

        {/* AI Thinking Speed */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-slate-400" /> Game Pace (AI turn speed)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['slow', 'medium', 'fast'] as const).map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setGameSpeed(speed)}
                className={`py-2 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer border ${
                  gameSpeed === speed
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/30'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {speed === 'slow' ? 'Relaxed' : speed === 'medium' ? 'Standard' : 'Lightning'}
              </button>
            ))}
          </div>
        </div>

        {/* Play Button */}
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-4 px-6 rounded-2xl transition-all cursor-pointer shadow-lg shadow-emerald-950/40 group mt-8"
        >
          <Play className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
          Start Game
        </button>
      </form>
    </div>
  );
}
