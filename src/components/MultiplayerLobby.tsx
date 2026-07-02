import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Copy, 
  Check, 
  Send, 
  Play, 
  ArrowLeft, 
  Shield, 
  User, 
  Plus, 
  Trash2, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getOrCreatePlayerId } from '../lib/multiplayer';
import { 
  connectSocket, 
  toggleReadyStatus, 
  sendChatMessage as emitChatMessage, 
  addBotToRoom, 
  kickPlayerFromRoom, 
  startGameInRoom 
} from '../services/socket';

interface MultiplayerLobbyProps {
  lobbyId: string;
  playerName: string;
  initialLobbyState?: any;
  onExit: () => void;
  onGameStarted: (lobbyId: string, roomState: any) => void;
}

export default function MultiplayerLobby({ 
  lobbyId, 
  playerName,
  initialLobbyState,
  onExit, 
  onGameStarted 
}: MultiplayerLobbyProps) {
  const [lobby, setLobby] = useState<any | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [hasStarted, setHasStarted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const myPlayerId = getOrCreatePlayerId();
  
  // Subscribe to Socket.IO lobby room updates
  useEffect(() => {
    const handleStateUpdate = (roomState: any) => {
      setLobby(roomState);
      
      // If the game status transitions to playing, trigger game start callback
      if (roomState.status === 'playing' && !hasStarted) {
        setHasStarted(true);
        onGameStarted(lobbyId, roomState);
      }
    };

    const handleGameStarted = (payload: any) => {
      if (!hasStarted) {
        setHasStarted(true);
        setLobby(payload.roomState || payload);
        onGameStarted(lobbyId, payload.roomState || payload);
      }
    };

    const handleError = (msg: string) => {
      alert(msg);
    };

    const handleKicked = () => {
      alert("You have been kicked from the lobby.");
      onExit();
    };

    // Establishes/reconnects socket & registers listeners
    const s = connectSocket(handleStateUpdate, handleError, handleKicked, handleGameStarted);

    if (initialLobbyState) {
      setLobby(initialLobbyState);
    }

    return () => {
      // Do not close socket entirely, just remove specific lobby handlers
      s.off("gameStateUpdate", handleStateUpdate);
      s.off("gameStarted", handleGameStarted);
      s.off("errorMsg", handleError);
      s.off("kicked", handleKicked);
    };
  }, [lobbyId, playerName, myPlayerId, onExit, onGameStarted, hasStarted]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lobby?.chatMessages]);

  if (!lobby) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Connecting to lobby session...</p>
      </div>
    );
  }

  const me = lobby.players.find((p: any) => p.id === myPlayerId);
  const isHost = me?.isHost ?? false;
  const allReady = lobby.players.every((p: any) => p.isReady);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobbyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReady = () => {
    toggleReadyStatus(lobbyId);
  };

  const handleLeave = () => {
    onExit();
  };

  const handleAddAI = () => {
    if (lobby.players.length >= lobby.maxPlayers) return;
    addBotToRoom(lobbyId);
  };

  const handleKickPlayer = (targetId: string) => {
    if (!isHost) return;
    kickPlayerFromRoom(lobbyId, targetId);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !me) return;
    emitChatMessage(lobbyId, me.name, chatInput.trim());
    setChatInput('');
  };

  const handleStartGame = () => {
    if (!isHost || !allReady) return;
    startGameInRoom(lobbyId);
  };

  return (
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 p-1">
      {/* Left panel: Lobby Details & Players list */}
      <div className="md:col-span-2 space-y-6">
        
        {/* Lobby Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden">
          {/* Decorative glows */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold font-mono uppercase tracking-widest rounded-full border border-emerald-500/10">
                  Online Lobby
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400 font-mono">Limit: {lobby.scoreLimit} pts</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Game Room</h2>
            </div>

            {/* Code Copying component */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 max-w-xs shadow-inner">
              <div>
                <p className="text-[9px] uppercase tracking-wider font-mono text-slate-500 font-bold">Room Code</p>
                <p className="text-2xl font-black tracking-widest text-emerald-400 font-mono select-all leading-none mt-1">{lobbyId}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-850 active:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shadow flex items-center justify-center gap-2"
                  title="Copy Room Code"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>
              <p className="text-xs text-slate-400 font-mono leading-5">
                Share this room code with your friends to join.
              </p>
            </div>
          </div>

          {/* Players List */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono uppercase tracking-wider px-2">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" /> 
                Players ({lobby.players.length}/{lobby.maxPlayers})
              </span>
              <span>Status</span>
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {lobby.players.map((player: any) => {
                  const isMe = player.id === myPlayerId;
                  const isPlayerHost = player.isHost;
                  
                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        isMe 
                          ? 'bg-emerald-500/5 border-emerald-500/20 shadow-sm shadow-emerald-900/5' 
                          : 'bg-slate-950/40 border-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative ${
                          player.isHuman 
                            ? isMe 
                              ? 'bg-emerald-600 text-white border border-emerald-500/30' 
                              : 'bg-slate-850 text-slate-300'
                            : 'bg-purple-950/40 text-purple-400 border border-purple-900/30'
                        }`}>
                          {player.isHuman ? <User className="w-5 h-5" /> : <Sparkles className="w-4 h-4 animate-pulse" />}
                          
                          {/* Host Icon Badge */}
                          {isPlayerHost && (
                            <div className="absolute -top-1.5 -left-1.5 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow-md border border-amber-400" title="Room Host">
                              <Shield className="w-2.5 h-2.5 fill-slate-950" />
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                            {player.name}
                            {isMe && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">You</span>}
                            {!player.isConnected && player.isHuman && (
                              <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-mono animate-pulse">Offline</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {player.isHuman ? 'Human Player' : 'Computer Bot'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status label / Button */}
                        {player.isHuman ? (
                          isMe ? (
                            <button
                              onClick={handleToggleReady}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                player.isReady
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-900/30'
                                  : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {player.isReady ? 'Ready ✓' : 'Not Ready'}
                            </button>
                          ) : (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl border ${
                              player.isReady
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-slate-900/60 border-slate-850 text-slate-500'
                            }`}>
                              {player.isReady ? 'Ready' : 'Waiting'}
                            </span>
                          )
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                            Ready Bot
                          </span>
                        )}

                        {/* Kick Bot/Player (Host Only) */}
                        {isHost && !isMe && (
                          <button
                            onClick={() => handleKickPlayer(player.id)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                            title="Remove from lobby"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Empty seat / Add Bot row */}
            {lobby.players.length < lobby.maxPlayers && isHost && (
              <button
                onClick={handleAddAI}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-900/20 rounded-2xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Add Computer Bot Player
              </button>
            )}
          </div>

          {/* Action Footer buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-slate-800/60">
            <button
              onClick={handleLeave}
              className="px-5 py-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit Lobby
            </button>

            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={!allReady || lobby.players.length < 2}
                className={`flex-1 flex items-center justify-center gap-2 font-black py-3.5 px-6 rounded-2xl transition-all cursor-pointer shadow-lg ${
                  allReady && lobby.players.length >= 2
                    ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-950/40'
                    : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                {!allReady 
                  ? 'Waiting for Players...' 
                  : lobby.players.length < 2 
                    ? 'Add more players' 
                    : 'Launch Multiplayer Game'}
              </button>
            ) : (
              <div className="flex-1 bg-slate-950 border border-slate-850 text-slate-400 text-xs px-4 py-3.5 rounded-2xl flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                Waiting for host to launch game...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right panel: Real-time chat messages */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md flex flex-col h-[500px]">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-sm text-slate-200">Lobby Chat</h3>
        </div>

        {/* Chat Message Scroll List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {lobby.chatMessages?.map((msg: any, idx: number) => {
            const isSystem = msg.senderId === 'system';
            const isMe = msg.senderId === myPlayerId;
            
            if (isSystem) {
              return (
                <div key={idx} className="text-[11px] text-slate-500 bg-slate-950/40 py-1.5 px-3 rounded-xl border border-slate-900/50 text-center font-mono italic">
                  {msg.text}
                </div>
              );
            }

            return (
              <div 
                key={idx} 
                className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <span className="text-[10px] text-slate-500 font-mono mb-0.5 px-1">
                  {msg.senderName}
                </span>
                <div className={`p-2.5 rounded-2xl text-xs leading-relaxed ${
                  isMe 
                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                    : 'bg-slate-950 text-slate-300 border border-slate-800/80 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendChat} className="mt-4 flex gap-2 pt-4 border-t border-slate-800/60">
          <input
            type="text"
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value.slice(0, 100))}
            className="flex-1 bg-slate-950 border border-slate-850 focus:border-emerald-500 text-slate-200 placeholder-slate-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors cursor-pointer shadow-md shadow-emerald-950/20 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
