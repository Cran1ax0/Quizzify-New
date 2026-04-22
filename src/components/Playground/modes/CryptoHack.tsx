import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { doc, updateDoc, increment, onSnapshot, arrayUnion, getDoc } from 'firebase/firestore';
import { Session, Participant, Quiz, Question, GameEvent } from '../../../types';
import { 
  Terminal, Shield, Zap, Search, Coins, Skull, 
  Cpu, Heart, Brain, Smile, Flame, Play, Clock, Trophy,
  Package, ChevronRight, Activity, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import CryptoTask from './cryptohack/tasks/Tasks';

interface CryptoHackModeProps {
  session: Session;
  participants: Participant[];
  participant: Participant | null;
  quiz: Quiz;
  isHost: boolean;
  onExit: () => void;
}

const BOTS = [
  { id: 'lil', name: 'Lil Bot', reward: 10, icon: Cpu, color: 'bg-emerald-500' },
  { id: 'angry', name: 'Angry Bot', reward: 20, icon: Flame, color: 'bg-orange-500' },
  { id: 'happy', name: 'Happy Bot', reward: 30, icon: Smile, color: 'bg-yellow-400' },
  { id: 'lovely', name: 'Lovely Bot', reward: 50, icon: Heart, color: 'bg-pink-500' },
  { id: 'buddy', name: 'Buddy Bot', reward: '2x', icon: Zap, color: 'bg-blue-400' },
  { id: 'brainy', name: 'Brainy Bot', reward: '3x', icon: Brain, color: 'bg-purple-500' },
  { id: 'mega', name: 'Mega Bot', reward: 'HACK', icon: Skull, color: 'bg-slate-900' }
];

export default function CryptoHackMode({ session, participants, participant, quiz, isHost, onExit }: CryptoHackModeProps) {
  const [stage, setStage] = useState<'intro' | 'playing' | 'hacking' | 'task'>('intro');
  const [selectedPassword, setSelectedPassword] = useState<string | null>(null);
  const [showingRewards, setShowingRewards] = useState<boolean>(false);
  const [selectedRewardIdx, setSelectedRewardIdx] = useState<number | null>(null);
  const [revealReward, setRevealReward] = useState<any | null>(null);
  const [currentRewards, setCurrentRewards] = useState<any[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showIncorrectFeedback, setShowIncorrectFeedback] = useState(false);
  const [matrixActive] = useState(true);
  const [wrongAnswerAnim, setWrongAnswerAnim] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState('');
  
  const terminalRef = useRef<HTMLDivElement>(null);

  // Timer logic for incorrect feedback
  useEffect(() => {
    if (showIncorrectFeedback) {
      const timer = setTimeout(async () => {
        setShowIncorrectFeedback(false);
        if (participant) {
          await updateDoc(doc(db, 'sessions', session.id, 'participants', participant.id), {
            currentQuestionIndex: increment(1)
          });
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showIncorrectFeedback, participant, session.id]);

  // Timer logic
  useEffect(() => {
    if (session.timerEnd) {
      const end = new Date(session.timerEnd).getTime();
      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((end - now) / 1000));
        setTimeLeft(diff);
        if (diff === 0 && !isHost && session.status !== 'finished') {
          updateDoc(doc(db, 'sessions', session.id), { status: 'finished' });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [session.timerEnd, isHost, session.id, session.status]);

  // Handle stage changes
  useEffect(() => {
    if (participant?.password && stage === 'intro') {
      setStage('playing');
    }
    if (participant?.isHacked) {
      setStage('task');
    }
  }, [participant?.password, participant?.isHacked, stage]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [session.gameEvents]);

  const addEvent = async (type: GameEvent['type'], message: string) => {
    await updateDoc(doc(db, 'sessions', session.id), {
      gameEvents: arrayUnion({
        type,
        message,
        timestamp: new Date().toISOString()
      })
    });
  };

  const handleSelectPassword = async (pass: string) => {
    if (!participant) return;
    setSelectedPassword(pass);
    await updateDoc(doc(db, 'sessions', session.id, 'participants', participant.id), {
      password: pass
    });
  };

  const handleAnswer = async (isCorrect: boolean) => {
    if (!isCorrect) {
      setShowIncorrectFeedback(true);
      return;
    }
    
    const shuffled = [...BOTS].sort(() => Math.random() - 0.5);
    setCurrentRewards(shuffled.slice(0, 3));
    setShowingRewards(true);
    setSelectedRewardIdx(null);
    setRevealReward(null);
  };

  const handleWrittenSubmit = async () => {
    if (!participant || !currentQuestion) return;
    const isCorrect = writtenAnswer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
    if (isCorrect) {
      handleAnswer(true);
      setWrittenAnswer('');
    } else {
      setShowIncorrectFeedback(true);
      setWrittenAnswer('');
    }
  };

  const selectGift = async (index: number) => {
    if (selectedRewardIdx !== null) return;
    setSelectedRewardIdx(index);
    const reward = currentRewards[index];
    
    setTimeout(async () => {
      setRevealReward(reward);
      setTimeout(async () => {
        await applyReward(reward);
      }, 1500);
    }, 500);
  };

  const applyReward = async (reward: any) => {
    if (!participant) return;
    setShowingRewards(false);

    if (reward.reward === 'HACK') {
      setStage('hacking');
      return;
    }

    let updates: any = {};
    let eventMsg = '';
    
    if (typeof reward.reward === 'number') {
      updates.crypto = increment(reward.reward);
      updates.score = increment(reward.reward);
      eventMsg = `${participant.nickname} gained ${reward.reward} Crypto!`;
    } else if (reward.reward === '2x') {
      const bonus = participant.crypto || 0;
      updates.crypto = increment(bonus);
      updates.score = increment(bonus);
      eventMsg = `${participant.nickname} DOUBLED their assets!`;
    } else if (reward.reward === '3x') {
      const bonus = (participant.crypto || 0) * 2;
      updates.crypto = increment(bonus);
      updates.score = increment(bonus);
      eventMsg = `${participant.nickname} TRIPLED their assets!`;
    }

    await updateDoc(doc(db, 'sessions', session.id, 'participants', participant.id), {
      ...updates,
      currentQuestionIndex: increment(1)
    });

    if (eventMsg) {
      addEvent(reward.reward === 'number' ? 'reward' : 'multiplier', eventMsg);
    }
  };

  const handleHackAttempt = async (target: Participant, guessedPassword: string) => {
    if (!participant) return;

    if (guessedPassword === target.password) {
      const stolen = Math.floor((target.crypto || 0) * (Math.random() * 0.2 + 0.2));
      
      await updateDoc(doc(db, 'sessions', session.id, 'participants', target.id), {
        crypto: increment(-stolen),
        score: increment(-stolen),
        isHacked: true,
        pendingTask: 'system_override',
        hackerId: participant.id,
        hackMessage: `${participant.nickname} hacked you for ${stolen} Crypto!`
      });

      await updateDoc(doc(db, 'sessions', session.id, 'participants', participant.id), {
        crypto: increment(stolen),
        score: increment(stolen),
        currentQuestionIndex: increment(1)
      });

      addEvent('hack', `${participant.nickname} breached ${target.nickname}'s firewall and stole ${stolen} Crypto!`);
    } else {
      await updateDoc(doc(db, 'sessions', session.id, 'participants', participant.id), {
        currentQuestionIndex: increment(1)
      });
    }

    setStage('playing');
    setTargetId(null);
  };

  const abortHack = async () => {
    if (!participant) return;
    await updateDoc(doc(db, 'sessions', session.id, 'participants', participant.id), {
      currentQuestionIndex: increment(1)
    });
    setStage('playing');
    setTargetId(null);
  };

  const completeTask = async () => {
    if (!participant) return;
    await updateDoc(doc(db, 'sessions', session.id, 'participants', participant.id), {
      isHacked: false,
      pendingTask: null,
      hackMessage: null,
      currentQuestionIndex: increment(1) // Advance question after completing task
    });
    setStage('playing');
  };

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => (b.crypto || 0) - (a.crypto || 0));
  }, [participants]);

  // Robust question selection that loops through the large random pool
  const qIndex = useMemo(() => {
    if (!participant || !participant.shuffledQuestionIndices || participant.shuffledQuestionIndices.length === 0) {
      // Fallback: simple modulo of current index
      return (participant?.currentQuestionIndex || 0) % quiz.questions.length;
    }
    // Use the large pre-generated random pool
    return participant.shuffledQuestionIndices[(participant.currentQuestionIndex || 0) % participant.shuffledQuestionIndices.length];
  }, [participant?.currentQuestionIndex, participant?.shuffledQuestionIndices, quiz.questions.length]);

  const currentQuestion = quiz.questions[qIndex];

  if (isHost) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-emerald-500 font-mono flex overflow-hidden">
        <MatrixBackground active={matrixActive} />
        
        {/* Left: Leaderboard (Vertical) */}
        <div className="w-1/3 border-r border-emerald-500/20 bg-slate-900/40 backdrop-blur-md flex flex-col z-10">
          <div className="p-6 border-b border-emerald-500/20 bg-emerald-500/5">
            <h2 className="text-xl font-black tracking-widest flex items-center gap-2">
              <Trophy size={20} /> TOP_NODES
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
            {sortedParticipants.map((p, idx) => (
              <motion.div 
                key={p.id}
                layout
                className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                  p.isHacked ? 'border-red-500 bg-red-900/20 animate-pulse' : 'border-emerald-500/20 bg-slate-950/60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black opacity-30">#{idx + 1}</span>
                  <div>
                    <p className="font-bold text-white text-lg">{p.nickname}</p>
                    {p.isHacked && <p className="text-[10px] text-red-400 uppercase font-black">Firewall Breached</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-emerald-400 flex items-center gap-1">
                    <Coins size={16} /> {p.crypto || 0}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Main View & Terminal */}
        <div className="flex-1 flex flex-col z-10">
          {/* Header */}
          <div className="p-6 flex justify-between items-center border-b border-emerald-500/20 bg-slate-900/60 backdrop-blur-md">
            <div>
              <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 italic">
                <Terminal size={28} /> CRYPTO_HACK
              </h1>
              <p className="text-[10px] uppercase tracking-widest opacity-60">Session PIN: {session.pin} | Active Miners: {participants.length}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-3xl font-black tabular-nums bg-emerald-500/10 px-6 py-2 border border-emerald-500/50 rounded-lg">
                <Clock className="inline-block mr-2" size={24} />
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Activity Center */}
          <div className="flex-1 p-8 overflow-hidden flex flex-col gap-6">
             <div className="flex-1 bg-slate-900/50 rounded-3xl border-2 border-emerald-500/20 p-8 flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-emerald-500/50 mb-6 flex items-center gap-2">
                  <Activity size={14} /> System Console Output
                </h3>
                <div 
                  ref={terminalRef}
                  className="flex-1 overflow-y-auto space-y-4 custom-scrollbar font-mono text-sm"
                >
                  {session.gameEvents?.slice(-20).map((event, i) => (
                    <div key={i} className="flex gap-4 group">
                      <span className="opacity-20 text-[10px] whitespace-nowrap mt-1">[{new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                      <span className={`
                        ${event.type === 'hack' ? 'text-red-400' : 
                          event.type === 'multiplier' ? 'text-blue-400' : 'text-emerald-400'}
                        group-hover:translate-x-1 transition-transform
                      `}>
                        {'>'} {event.message}
                      </span>
                    </div>
                  ))}
                  {(!session.gameEvents || session.gameEvents.length === 0) && (
                    <div className="h-full flex items-center justify-center opacity-20 italic">
                      Waiting for network activity...
                    </div>
                  )}
                </div>
             </div>
          </div>

          {/* Footer Footer Controls */}
          <div className="p-6 bg-slate-950/80 border-t border-emerald-500/20 flex justify-center">
            <button
                onClick={async () => {
                  await updateDoc(doc(db, 'sessions', session.id), { status: 'finished' });
                }}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-xl transition-all uppercase tracking-widest text-sm flex items-center gap-2"
              >
                <AlertCircle size={18} /> Emergency Shutdown
              </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-emerald-500 font-mono flex flex-col relative overflow-hidden">
      <MatrixBackground active={matrixActive} />

      <div className="relative z-10 flex flex-col h-full">
        {/* HUD */}
        <div className="p-4 flex justify-between items-center border-b border-emerald-500/20 bg-slate-950/80 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] opacity-50 uppercase tracking-widest font-black">Asset Value</span>
            <span className="text-2xl font-black text-white flex items-center gap-2">
              <Coins size={20} className="text-emerald-400" />
              {participant?.crypto || 0}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] opacity-50 uppercase font-black">Mining Window</span>
            <p className="text-xl font-bold tabular-nums text-white">
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.div 
               key="intro"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.1 }}
               className="flex-1 flex flex-col items-center justify-center p-8 max-w-xl mx-auto"
            >
              <div className="mb-10 text-center">
                <div className="w-24 h-24 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_#10b981] rotate-3">
                  <Shield size={48} className="text-slate-950" />
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 italic">Security Initialization</h2>
                <p className="text-emerald-400/70 text-sm leading-relaxed">
                  Encryption required. Select a unique pass-phrase to protect your crypto assets from surrounding hostiles.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 w-full">
                {participant?.availablePasswords?.map((pass) => (
                  <button
                    key={pass}
                    onClick={() => handleSelectPassword(pass)}
                    className="p-5 bg-slate-900 border-2 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-400 font-bold rounded-2xl transition-all uppercase tracking-[0.2em] text-xs"
                  >
                    {pass}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {stage === 'playing' && (
            <motion.div 
              key="playing"
              className="flex-1 flex flex-col p-4 md:p-6 w-full relative h-[calc(100vh-80px)] overflow-hidden"
            >
              {showingRewards ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <Search className="animate-pulse" /> Decrypting Node...
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="relative"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                         <button
                          disabled={selectedRewardIdx !== null}
                          onClick={() => selectGift(i)}
                          className={`
                            w-full aspect-square sm:aspect-[4/5] rounded-[2rem] border-4 flex flex-col items-center justify-center gap-4 transition-all relative overflow-hidden
                            ${selectedRewardIdx === i ? 'scale-105 border-white bg-emerald-500 shadow-[0_0_40px_#10b981]' : 
                              selectedRewardIdx !== null ? 'opacity-20 border-slate-800 bg-slate-900 grayscale' :
                              'border-emerald-500/30 bg-slate-900 hover:border-emerald-500 hover:translate-y-[-4px] hover:shadow-[0_10px_30px_rgba(16,185,129,0.1)]'}
                          `}
                        >
                           <AnimatePresence mode="wait">
                            {revealReward && selectedRewardIdx === i ? (
                              <motion.div 
                                key="revealed"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-3"
                              >
                                <div className={`p-4 rounded-full bg-slate-950 text-white shadow-2xl`}>
                                  <revealReward.icon size={40} />
                                </div>
                                <div className="text-center px-2">
                                  <p className="text-2xl md:text-3xl font-black text-slate-950 break-words">
                                    {typeof revealReward.reward === 'number' ? `${revealReward.reward} pts` : revealReward.reward}
                                  </p>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div key="covered" className="flex flex-col items-center gap-3">
                                <Package size={48} className={selectedRewardIdx === i ? 'text-slate-950' : 'text-emerald-500'} />
                                <p className={`text-[10px] font-black uppercase tracking-widest ${selectedRewardIdx === i ? 'text-slate-950' : 'text-emerald-500/40'}`}>
                                  Mystery_Pkg
                                </p>
                              </motion.div>
                            )}
                           </AnimatePresence>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar pt-4 pb-12">
                   <div className="max-w-2xl mx-auto w-full flex flex-col">
                      <motion.div 
                        animate={wrongAnswerAnim ? { x: [-10, 10, -10, 10, 0] } : {}}
                        className="mb-8 text-center"
                      >
                        <p className="text-[10px] font-black uppercase text-emerald-500/50 mb-3 tracking-[0.4em]">Query_Stream_{participant?.currentQuestionIndex}</p>
                        <div className="text-2xl md:text-3xl font-black text-white leading-snug prose prose-invert max-w-none px-2">
                          <ReactMarkdown>{currentQuestion.question}</ReactMarkdown>
                        </div>
                      </motion.div>

                      {currentQuestion.options && currentQuestion.options.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:gap-4 px-2">
                          {currentQuestion.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => handleAnswer(opt === currentQuestion.correctAnswer)}
                              className={`
                                p-3 md:p-6 bg-slate-900 border-2 rounded-2xl md:rounded-3xl text-left transition-all group relative overflow-hidden flex items-center min-h-[3.5rem] md:min-h-[5rem]
                                ${wrongAnswerAnim && opt !== currentQuestion.correctAnswer ? 'opacity-30' : 'hover:border-emerald-500 hover:bg-emerald-500/5 hover:translate-y-[-2px]'}
                                border-emerald-500/20 text-white font-bold
                              `}
                            >
                               <div className="flex items-center gap-2 md:gap-4 relative z-10 w-full">
                                  <div className="shrink-0 w-6 h-6 md:w-10 md:h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-[10px] md:text-sm font-black group-hover:bg-emerald-500 group-hover:text-slate-950">
                                    {String.fromCharCode(65 + i)}
                                  </div>
                                  <span className="text-xs md:text-lg leading-tight break-words">{opt}</span>
                               </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 max-w-lg mx-auto w-full px-4">
                          <div className="relative group">
                            <input 
                              autoFocus
                              type="text"
                              value={writtenAnswer}
                              onChange={(e) => setWrittenAnswer(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleWrittenSubmit()}
                              placeholder="SYS_ENTRY_KEY..."
                              className="w-full p-4 md:p-6 bg-slate-950 border-2 border-emerald-500/20 rounded-2xl text-white font-mono text-center tracking-[0.3em] focus:border-emerald-500 focus:shadow-[0_0_30px_rgba(16,185,129,0.1)] outline-none transition-all uppercase placeholder:text-emerald-500/10"
                            />
                            <Terminal size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" />
                          </div>
                          <button
                            onClick={handleWrittenSubmit}
                            className="group w-full py-4 md:py-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl uppercase tracking-[0.2em] transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3"
                          >
                            <Zap size={20} className="group-hover:animate-pulse" />
                            Submit_Matrix_Key
                          </button>
                        </div>
                      )}
                   </div>
                </div>
              )}
            </motion.div>
          )}

          {stage === 'hacking' && (
             <motion.div 
              key="hacking"
              className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full"
            >
              {!targetId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                   <div className="mb-12">
                    <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                      <Search size={40} className="text-white" />
                    </div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Select Target Overlay</h3>
                    <p className="text-emerald-400/60 text-sm mt-2">Choose a node to intercept assets from.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full overflow-y-auto max-h-[50vh] p-2 custom-scrollbar">
                    {participants.filter(p => p.id !== participant?.id).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setTargetId(p.id)}
                        className="p-6 bg-slate-900 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-3xl flex justify-between items-center transition-all group"
                      >
                        <div className="text-left">
                          <p className="font-bold text-white group-hover:text-emerald-400">{p.nickname}</p>
                          <p className="text-[10px] opacity-40 uppercase font-black">Level_01_User</p>
                        </div>
                        <div className="flex items-center gap-1 text-lg font-black text-emerald-500">
                          <Coins size={16} />
                          {p.crypto || 0}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={abortHack}
                    className="mt-10 text-red-500/50 hover:text-red-500 font-bold uppercase tracking-[0.3em] text-[10px]"
                  >
                    [ Abort_Mission ]
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="mb-12 text-center">
                    <h3 className="text-3xl font-black text-white uppercase tracking-widest italic">Brute Force Initialization</h3>
                    <p className="text-red-400 font-black mt-2 uppercase text-xs">TARGETING: {participants.find(p => p.id === targetId)?.nickname}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 w-full max-w-md">
                    {participants.find(p => p.id === targetId)?.availablePasswords?.map((pass) => (
                      <button
                        key={pass}
                        onClick={() => handleHackAttempt(participants.find(p => p.id === targetId)!, pass)}
                        className="p-5 bg-slate-900 border-2 border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-400 font-bold rounded-2xl transition-all uppercase tracking-widest text-xs"
                      >
                        {pass}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => setTargetId(null)}
                    className="mt-8 text-white/30 hover:text-white font-bold uppercase text-[10px]"
                  >
                    Select Different Target
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {stage === 'task' && (
            <motion.div 
               key="task"
               className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="mb-12">
                <Skull size={100} className="mx-auto mb-6 text-red-500 animate-pulse drop-shadow-[0_0_20px_#ef4444]" />
                <h2 className="text-5xl font-black text-red-600 uppercase tracking-tighter italic">FATAL_ERROR_0xBF</h2>
                <p className="text-red-400 font-bold mt-4 text-xl">{participant?.hackMessage}</p>
                <div className="mt-10 px-8 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl">
                   <p className="text-xs uppercase tracking-[0.4em] text-red-500 font-black">Manual System Override Required</p>
                </div>
              </div>
              <CryptoTask onComplete={completeTask} />
            </motion.div>
          )}

          {showIncorrectFeedback && (
            <motion.div
              key="incorrect-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-red-600 text-white p-6 text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-xl"
              >
                <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-white/20 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                  <Skull size={64} className="text-white" />
                </div>
                <h2 className="text-5xl font-black uppercase tracking-tighter italic mb-4">INCORRECT_QUERY</h2>
                <div className="p-8 bg-black/20 rounded-3xl border-2 border-white/20 backdrop-blur-md">
                   <p className="text-sm font-black uppercase tracking-widest text-white/60 mb-2">Decrypting Correct Data...</p>
                   <p className="text-3xl font-black text-white px-4 py-2 bg-white/10 rounded-xl inline-block">{currentQuestion.correctAnswer}</p>
                </div>
                <p className="mt-8 text-white/60 font-mono text-sm">Resyncing_Network_Buffer in 5s...</p>
                <div className="mt-4 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: 0 }}
                    transition={{ duration: 5, ease: 'linear' }}
                    className="h-full bg-white"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MatrixBackground({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
      <div className="matrix-rain" />
      <style>{`
        .matrix-rain {
          width: 100%;
          height: 100%;
          background: linear-gradient(rgba(16, 185, 129, 0.1) 2px, transparent 2px),
                      linear-gradient(90deg, rgba(16, 185, 129, 0.1) 2px, transparent 2px);
          background-size: 40px 40px;
          animation: rain 30s linear infinite;
        }
        @keyframes rain {
          0% { background-position: 0 0; }
          100% { background-position: 0 1000px; }
        }
      `}</style>
    </div>
  );
}
