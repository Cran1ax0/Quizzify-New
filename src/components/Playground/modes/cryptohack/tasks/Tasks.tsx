import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Thermometer, Hash, Grid, RefreshCw, Layers, Layout, MousePointerClick } from 'lucide-react';

interface TaskProps {
  onComplete: () => void;
}

const UploadTask = ({ onComplete }: TaskProps) => {
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started && progress < 100) {
      const timer = setTimeout(() => setProgress(p => Math.min(100, p + 2)), 50);
      return () => clearTimeout(timer);
    } else if (progress === 100) {
      setTimeout(onComplete, 500);
    }
  }, [started, progress, onComplete]);

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-emerald-400 mb-4 animate-bounce">
        <Upload size={48} />
      </div>
      <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
        <motion.div 
          className="h-full bg-emerald-500" 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>
      <p className="font-mono text-emerald-400">{progress}% COMPLETE</p>
      {!started && (
        <button 
          onClick={() => setStarted(true)}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all uppercase tracking-widest"
        >
          Start Upload
        </button>
      )}
    </div>
  );
};

const PatternTask = ({ onComplete }: TaskProps) => {
  const [pattern, setPattern] = useState<number[]>([]);
  const [userPattern, setUserPattern] = useState<number[]>([]);
  const [status, setStatus] = useState<'showing' | 'input' | 'error'>('showing');

  const generatePattern = () => {
    const newPattern = Array.from({ length: 4 }, () => Math.floor(Math.random() * 9));
    setPattern(newPattern);
    setUserPattern([]);
    setStatus('showing');
  };

  useEffect(() => {
    generatePattern();
  }, []);

  useEffect(() => {
    if (status === 'showing') {
      const timer = setTimeout(() => setStatus('input'), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleBoxClick = (idx: number) => {
    if (status !== 'input') return;
    const newUserPattern = [...userPattern, idx];
    setUserPattern(newUserPattern);

    if (newUserPattern[newUserPattern.length - 1] !== pattern[newUserPattern.length - 1]) {
      setStatus('error');
      setTimeout(generatePattern, 1000);
    } else if (newUserPattern.length === pattern.length) {
      setTimeout(onComplete, 500);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <p className="font-mono text-emerald-400 mb-2 uppercase tracking-widest">
        {status === 'showing' ? 'Memorize Pattern' : status === 'error' ? 'ACCESS DENIED' : 'Repeat Pattern'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => {
          const isHighlighted = status === 'showing' && pattern.includes(i);
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleBoxClick(i)}
              className={`w-16 h-16 rounded-lg border-2 transition-all ${
                isHighlighted ? 'bg-emerald-400 border-white shadow-[0_0_15px_#10b981]' : 
                status === 'error' ? 'bg-red-900/50 border-red-500' :
                'bg-slate-800 border-slate-700'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

const TempTask = ({ onComplete }: TaskProps) => {
  const [current, setCurrent] = useState(50);
  const [target] = useState(() => Math.floor(Math.random() * 80) + 10);

  useEffect(() => {
    if (current === target) {
      setTimeout(onComplete, 500);
    }
  }, [current, target, onComplete]);

  return (
    <div className="flex flex-col items-center gap-8 p-8">
      <div className="text-emerald-400">
        <Thermometer size={48} />
      </div>
      <div className="flex items-center gap-8">
        <button 
          onClick={() => setCurrent(c => c - 1)}
          className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-2xl font-bold"
        >
          -
        </button>
        <div className="text-center min-w-[120px]">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Target: {target}°</p>
          <p className="text-5xl font-black font-mono text-white">{current}°</p>
        </div>
        <button 
          onClick={() => setCurrent(c => c + 1)}
          className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-2xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
};

const NumbersTask = ({ onComplete }: TaskProps) => {
  const [nextNumber, setNextNumber] = useState(1);
  const [numbers] = useState(() => Array.from({ length: 10 }, (_, i) => i + 1).sort(() => Math.random() - 0.5));

  const handleClick = (num: number) => {
    if (num === nextNumber) {
      if (num === 10) {
        onComplete();
      } else {
        setNextNumber(n => n + 1);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <p className="font-mono text-emerald-400 uppercase tracking-widest">Tap Numbers 1-10</p>
      <div className="grid grid-cols-5 gap-2">
        {numbers.map((num) => (
          <motion.button
            key={num}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleClick(num)}
            className={`w-12 h-12 rounded-lg border-2 font-bold transition-all ${
              num < nextNumber ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 opacity-50' :
              'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
            }`}
          >
            {num}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

const MatchIconsTask = ({ onComplete }: TaskProps) => {
  const icons = [RefreshCw, Layers, Layout, MousePointerClick];
  const [states, setStates] = useState(() => [0, 1, 2].map(() => Math.floor(Math.random() * icons.length)));
  const [target] = useState(() => Math.floor(Math.random() * icons.length));

  const cycle = (idx: number) => {
    const nextStates = [...states];
    nextStates[idx] = (nextStates[idx] + 1) % icons.length;
    setStates(nextStates);

    if (nextStates.every(s => s === target)) {
      onComplete();
    }
  };

  const TargetIcon = icons[target];

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 mb-2">
        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Match All To:</p>
        <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/50 text-emerald-400">
          <TargetIcon size={32} />
        </div>
      </div>
      <div className="flex gap-4">
        {states.map((s, i) => {
          const Icon = icons[s];
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.9 }}
              onClick={() => cycle(i)}
              className={`w-20 h-20 flex items-center justify-center rounded-2xl border-2 transition-all ${
                s === target ? 'bg-emerald-500 border-white shadow-[0_0_15px_#10b981]' : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
              }`}
            >
              <Icon size={32} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

const Buttons12Task = ({ onComplete }: TaskProps) => {
  const [count, setCount] = useState(0);
  const [activeBtn, setActiveBtn] = useState(() => Math.floor(Math.random() * 12));

  const handleNext = () => {
    if (count === 11) {
      onComplete();
    } else {
      setCount(c => c + 1);
      setActiveBtn(Math.floor(Math.random() * 12));
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <p className="font-mono text-emerald-400 uppercase tracking-widest">Clear the Array: {count}/12</p>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={i === activeBtn ? handleNext : undefined}
            className={`w-14 h-14 rounded-full border-2 transition-all ${
              i === activeBtn ? 'bg-emerald-500 border-white shadow-[0_0_15px_#10b981]' : 'bg-slate-900 border-slate-800 opacity-20'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

const MemoryTask = ({ onComplete }: TaskProps) => {
  const [cards, setCards] = useState(() => {
    const symbols = ['🤖', '🔥', '💎', '🔒', '🔑', '⚡'];
    return [...symbols, ...symbols].sort(() => Math.random() - 0.5);
  });
  const [flipped, setFlipped] = useState<number[]>([]);
  const [solved, setSolved] = useState<number[]>([]);

  const handleFlip = (idx: number) => {
    if (flipped.length === 2 || flipped.includes(idx) || solved.includes(idx)) return;
    const newFlipped = [...flipped, idx];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      if (cards[newFlipped[0]] === cards[newFlipped[1]]) {
        setSolved([...solved, ...newFlipped]);
        setFlipped([]);
        if (solved.length + 2 === cards.length) {
          onComplete();
        }
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <p className="font-mono text-emerald-400 uppercase tracking-widest text-center">Memory Trace Override</p>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((symbol, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleFlip(i)}
            className={`w-12 h-16 flex items-center justify-center rounded-lg border-2 text-2xl transition-all ${
              flipped.includes(i) || solved.includes(i) ? 'bg-emerald-500 border-white text-white' : 'bg-slate-800 border-slate-700'
            }`}
          >
            {(flipped.includes(i) || solved.includes(i)) ? symbol : '?'}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

const ColorOrderTask = ({ onComplete }: TaskProps) => {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
  const [current, setCurrent] = useState(() => [...colors].sort(() => Math.random() - 0.5));
  const [target] = useState(() => [...colors].sort(() => Math.random() - 0.5));

  const move = (idx: number, dir: 'up' | 'down') => {
    const newOrder = [...current];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= colors.length) return;
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    setCurrent(newOrder);

    if (newOrder.every((c, i) => c === target[i])) {
      onComplete();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <p className="font-mono text-emerald-400 uppercase tracking-widest">Reorder Database Records</p>
      <div className="flex gap-4">
        {/* Target */}
        <div className="flex flex-col gap-2 opacity-30">
          <p className="text-[10px] text-center font-bold">TARGET</p>
          {target.map((c, i) => <div key={i} className={`w-8 h-8 rounded ${c}`} />)}
        </div>
        {/* Current */}
        <div className="flex flex-col gap-2">
          {current.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-12 h-12 rounded-xl border-2 border-white/20 ${c}`} />
              <div className="flex flex-col gap-1">
                <button onClick={() => move(i, 'up')} className="text-xs hover:bg-white/10 px-1 rounded">▲</button>
                <button onClick={() => move(i, 'down')} className="text-xs hover:bg-white/10 px-1 rounded">▼</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function CryptoTask({ onComplete }: TaskProps) {
  const [taskType] = useState(() => Math.floor(Math.random() * 8));

  const tasks = [
    UploadTask,
    PatternTask,
    TempTask,
    MatchIconsTask,
    NumbersTask,
    Buttons12Task,
    MemoryTask,
    ColorOrderTask
  ];

  const SelectedTask = tasks[taskType];

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-900 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)] rounded-2xl overflow-hidden">
      <div className="bg-emerald-500 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
          System Intrustion Detected
        </span>
        <span className="text-[10px] font-bold text-slate-900">TASK_ID: 0x{taskType}</span>
      </div>
      <SelectedTask onComplete={onComplete} />
    </div>
  );
}
