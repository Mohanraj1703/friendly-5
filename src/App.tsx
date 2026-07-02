import React, { useState, useEffect } from 'react';
import GameSettings from './components/GameSettings';
import GameBoard from './components/GameBoard';
import RulesModal from './components/RulesModal';
import MultiplayerLobby from './components/MultiplayerLobby';
import { GameSettings as SettingsType } from './types';
import { HelpCircle, Sparkles, Trophy, Award, Heart, Shield, Users, Radio, Cpu, Plus, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOrCreatePlayerId } from './lib/multiplayer';
import { createRoom, joinRoom, getSocket } from './services/socket';

export default function App() {
  const [gameState, setGameState] = useState<'settings' | 'lobby' | 'playing'>('settings');
  const [activeTab, setActiveTab] = useState<'offline' | 'online'>('offline');
  const [settings, setSettings] = useState<SettingsType>({
    numPlayers: 4,
    scoreLimit: 100,
    gameSpeed: 'medium',
  });
  
  // Persistent name identity saving
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('5cards_player_name') || `Player_${Math.floor(100 + Math.random() * 900)}`;
  });

  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [initialLobbyState, setInitialLobbyState] = useState<any | null>(null);
  const [initialGameState, setInitialGameState] = useState<any | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [onlineScoreLimit, setOnlineScoreLimit] = useState<number>(100);
  const [onlineMaxPlayers, setOnlineMaxPlayers] = useState<number>(6);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState<boolean>(false);

  // Save player name to local storage whenever changed
  useEffect(() => {
    localStorage.setItem('5cards_player_name', playerName);
  }, [playerName]);

  // Socket setup on initial mount for direct redirects
  useEffect(() => {
    const socket = getSocket();

    const onRoomCreated = ({ roomId, roomState }: { roomId: string; roomState: any }) => {
      setLobbyId(roomId);
      setInitialLobbyState(roomState);
      setGameState('lobby');
      setStatusMessage('Room created. Share this room code with your friends to join.');
      setErrorMessage('');
      setIsCreatingRoom(false);
    };

    const onRoomJoined = ({ roomId, roomState }: { roomId: string; roomState: any }) => {
      setLobbyId(roomId);
      setInitialLobbyState(roomState);
      setGameState('lobby');
      setStatusMessage('Joined room successfully.');
      setErrorMessage('');
      setIsJoiningRoom(false);
    };

    const onSocketError = (message: string) => {
      setErrorMessage(message);
      setStatusMessage('');
      setIsCreatingRoom(false);
      setIsJoiningRoom(false);
    };

    socket.on("roomCreated", onRoomCreated);
    socket.on("roomJoined", onRoomJoined);
    socket.on("errorMsg", onSocketError);

    return () => {
      socket.off("roomCreated", onRoomCreated);
      socket.off("roomJoined", onRoomJoined);
      socket.off("errorMsg", onSocketError);
    };
  }, []);

  const handleStartOfflineGame = (newSettings: SettingsType, name: string) => {
    setSettings(newSettings);
    setPlayerName(name);
    setLobbyId(null);
    setGameState('playing');
  };

  const handleCreateOnlineRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setErrorMessage("Please enter your name first!");
      return;
    }
    
    let scoreLimit = onlineScoreLimit;
    if (!scoreLimit || scoreLimit < 10) {
      scoreLimit = 100;
    } else if (scoreLimit > 1000) {
      scoreLimit = 1000;
    }

    let maxPlayers = onlineMaxPlayers;
    if (!maxPlayers || maxPlayers < 2) {
      maxPlayers = 6;
    } else if (maxPlayers > 20) {
      maxPlayers = 20;
    }

    setErrorMessage('');
    setStatusMessage('Creating room...');
    setIsCreatingRoom(true);

    const response = await createRoom(playerName.trim(), scoreLimit, maxPlayers);
    if (!response.success) {
      setErrorMessage(response.error || 'Failed to create room.');
      setStatusMessage('');
      setIsCreatingRoom(false);
      return;
    }

    setLobbyId(response.roomId || null);
    setInitialLobbyState(response.roomState || null);
    setGameState('lobby');
    setStatusMessage('Room created. Share this room code with your friends to join.');
    setErrorMessage('');
    setIsCreatingRoom(false);
  };

  const handleJoinOnlineRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setErrorMessage("Please enter your name first!");
      return;
    }
    if (!joinCodeInput.trim() || joinCodeInput.trim().length < 6 || joinCodeInput.trim().length > 8) {
      setErrorMessage("Please enter a valid room code (6-8 characters). ");
      return;
    }

    setErrorMessage('');
    setStatusMessage('Joining room...');
    setIsJoiningRoom(true);

    const response = await joinRoom(joinCodeInput.trim().toUpperCase(), playerName.trim());
    if (!response.success) {
      setErrorMessage(response.error || 'Failed to join room.');
      setStatusMessage('');
      setIsJoiningRoom(false);
      return;
    }

    setLobbyId(response.roomId || null);
    setInitialLobbyState(response.roomState || null);
    setGameState('lobby');
    setStatusMessage('Joined room successfully.');
    setErrorMessage('');
    setIsJoiningRoom(false);
  };

  const handleExitGame = () => {
    setLobbyId(null);
    setInitialLobbyState(null);
    setInitialGameState(null);
    setGameState('settings');
  };

  const handleGameStartedMultiplayer = (startedLobbyId: string, roomState: any) => {
    setLobbyId(startedLobbyId);
    setInitialGameState(roomState);
    setGameState('playing');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200 relative">
      
      {/* Settings View / Home Screen */}
      {gameState === 'settings' ? (
        <div className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
          
          {/* Subtle background gradients */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-[250px] sm:sm:w-[350px] h-[250px] sm:h-[350px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none"></div>

          {/* Quick Rules floating help */}
          <button
            onClick={() => setIsRulesOpen(true)}
            id="floating-rules-btn"
            className="absolute top-4 right-4 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-slate-950/40 z-10"
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            How to Play
          </button>

          {/* Main Dashboard Container */}
          <div className="relative z-10 w-full max-w-lg mx-auto">
            
            {/* Custom Mode Toggle Header */}
            <div className="flex bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 mb-6 shadow-lg backdrop-blur-md">
              <button
                onClick={() => setActiveTab('offline')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'offline'
                    ? 'bg-slate-800 text-emerald-400 border border-slate-750 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-4 h-4" />
                Play Offline (vs AI)
              </button>
              <button
                onClick={() => setActiveTab('online')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'online'
                    ? 'bg-slate-800 text-emerald-400 border border-slate-750 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-4 h-4" />
                Play Online (Multiplayer)
              </button>
            </div>

            {/* Offline Tab */}
            {activeTab === 'offline' ? (
              <GameSettings 
                onStartGame={handleStartOfflineGame} 
                initialPlayerName={playerName}
              />
            ) : (
              /* Online Tab */
              <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md space-y-6">
                
                {/* Visual Header */}
                <div className="flex flex-col items-center text-center">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4">
                    <Radio className="w-10 h-10 text-indigo-400 animate-pulse" />
                  </div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">Online Multiplayer</h1>
                  <p className="text-slate-400 text-xs mt-2 max-w-sm">
                    Host a room for up to 8 players, or join a room with a 6-8 character code to play in real time!
                  </p>
                </div>

                {/* Nickname Row */}
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                    placeholder="Enter your nickname"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                    required
                  />
                </div>

                {/* Grid for Actions: Create or Join */}
                <div className="grid grid-cols-1 gap-6 pt-1">
                  
                  {/* Create Room Form Section */}
                  <form onSubmit={handleCreateOnlineRoom} className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Host a New Room
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono font-bold mb-1">
                          Score Limit
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="1000"
                          value={onlineScoreLimit || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOnlineScoreLimit(0);
                            } else {
                              const parsed = parseInt(val, 10);
                              setOnlineScoreLimit(isNaN(parsed) ? 100 : parsed);
                            }
                          }}
                          placeholder="e.g. 100"
                          className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono font-bold mb-1">
                          Max Players
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="20"
                          value={onlineMaxPlayers || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setOnlineMaxPlayers(0);
                            } else {
                              const parsed = parseInt(val, 10);
                              setOnlineMaxPlayers(isNaN(parsed) ? 6 : parsed);
                            }
                          }}
                          placeholder="e.g. 6"
                          className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {statusMessage && (
                        <div className="text-sm text-emerald-300 font-medium">{statusMessage}</div>
                      )}
                      {errorMessage && (
                        <div className="text-sm text-rose-400 font-medium">{errorMessage}</div>
                      )}
                      <button
                        type="submit"
                        disabled={isCreatingRoom}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-950/40"
                      >
                        <Plus className="w-4 h-4" />
                        {isCreatingRoom ? 'Creating Room...' : 'Create Room'}
                      </button>
                    </div>
                  </form>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-4 text-xs font-mono text-slate-600 uppercase font-bold">or</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  {/* Join Room Form Section */}
                  <form onSubmit={handleJoinOnlineRoom} className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <LogIn className="w-4 h-4" /> Join Existing Room
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                        placeholder="ENTER ROOM CODE"
                        className="flex-1 bg-slate-950/60 border border-slate-800 focus:border-emerald-500 text-white rounded-xl px-4 py-3 text-xs tracking-widest font-mono text-center focus:outline-none uppercase"
                      />
                      <button
                        type="submit"
                        disabled={isJoiningRoom}
                        className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold px-6 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-950/25"
                      >
                        <LogIn className="w-4 h-4" />
                        {isJoiningRoom ? 'Joining...' : 'Join Room'}
                      </button>
                    </div>
                  </form>

                </div>

              </div>
            )}

          </div>

          {/* Minimal Aesthetic Stats Footer */}
          <div className="mt-8 text-center text-xs text-slate-500 font-mono flex items-center gap-2">
            <span>A Game of Tactical Hand-Minimizing</span>
            <span>•</span>
            <span>5 Cards Max Hand</span>
          </div>
        </div>
      ) : gameState === 'lobby' && lobbyId ? (
        /* Lobby Screen */
        <div className="flex-1 flex flex-col justify-center p-4">
          <MultiplayerLobby
            lobbyId={lobbyId}
            playerName={playerName}
            initialLobbyState={initialLobbyState}
            onExit={handleExitGame}
            onGameStarted={handleGameStartedMultiplayer}
          />
        </div>
      ) : (
        /* Playing View */
        <div className="flex-1 flex flex-col">
          {/* Floating Rules within Game */}
          <button
            onClick={() => setIsRulesOpen(true)}
            id="ingame-rules-btn"
            className="fixed bottom-32 left-4 px-3 py-1.5 bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg z-20 hover:scale-105"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            Rules
          </button>

          <GameBoard
            settings={settings}
            humanName={playerName}
            onExit={handleExitGame}
            lobbyId={lobbyId || undefined}
            initialGameState={initialGameState}
          />
        </div>
      )}

      {/* Persistent Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

    </div>
  );
}
