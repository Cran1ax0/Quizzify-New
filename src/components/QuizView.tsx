import React, { useState, useEffect } from 'react';
import { Quiz, Question, Flashcard } from '../types';
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, RotateCcw, Trophy, Info, Sparkles, BookOpen, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface QuizViewProps {
  quiz: Quiz;
  onClose: () => void;
}

export default function QuizView({ quiz, onClose }: QuizViewProps) {
  const [viewMode, setViewMode] = useState<'quiz' | 'flashcards'>('quiz');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>(new Array(quiz.questions.length).fill(null));
  const [writingAnswer, setWritingAnswer] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const fetchFlashcards = async () => {
      const q = query(collection(db, 'flashcards'), where('quizId', '==', quiz.id));
      const snap = await getDocs(q);
      setFlashcards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard)));
    };
    fetchFlashcards();
  }, [quiz.id]);

  const currentQuestion = quiz.questions[currentQuestionIdx];

  const handleOptionSelect = (option: string) => {
    if (showExplanation) return;
    setSelectedOption(option);
    setShowExplanation(true);

    const newAnswers = [...answers];
    newAnswers[currentQuestionIdx] = option;
    setAnswers(newAnswers);

    const isCorrect = currentQuestion.type === 'writing' 
      ? option.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
      : option === currentQuestion.correctAnswer;

    if (isCorrect) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIdx < quiz.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      const nextAnswer = answers[currentQuestionIdx + 1];
      setSelectedOption(nextAnswer);
      setShowExplanation(nextAnswer !== null);
      setWritingAnswer(nextAnswer || '');
    } else {
      setIsFinished(true);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
      const prevAnswer = answers[currentQuestionIdx - 1];
      setSelectedOption(prevAnswer);
      setShowExplanation(true);
      setWritingAnswer(prevAnswer || '');
    }
  };

  const restartQuiz = () => {
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setScore(0);
    setIsFinished(false);
    setAnswers(new Array(quiz.questions.length).fill(null));
    setWritingAnswer('');
  };

  const downloadQuiz = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `quiz_${quiz.topic.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (isFinished) {
    const percentage = Math.round((score / quiz.questions.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl sm:p-12"
      >
        <div className="mb-6 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Trophy size={48} />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-slate-900">Quiz Completed!</h2>
        <p className="mt-2 text-slate-600">Great job on finishing the {quiz.topic} assessment.</p>
        
        <div className="my-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-slate-50 p-6">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Score</p>
            <p className="mt-1 text-4xl font-bold text-indigo-600">{score} / {quiz.questions.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-6">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Accuracy</p>
            <p className="mt-1 text-4xl font-bold text-indigo-600">{percentage}%</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={restartQuiz}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <RotateCcw size={18} />
            Try Again
          </button>
          <button
            onClick={downloadQuiz}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-3.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-all"
          >
            Export JSON
          </button>
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Exit
        </button>
        
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setViewMode('quiz')}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold transition-all ${
              viewMode === 'quiz' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen size={16} />
            Quiz
          </button>
          <button
            onClick={() => setViewMode('flashcards')}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold transition-all ${
              viewMode === 'flashcards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers size={16} />
            Flashcards
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">{quiz.level}</span>
        </div>
      </div>

      {viewMode === 'quiz' ? (
        <>
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestionIdx + 1) / quiz.questions.length) * 100}%` }}
              className="h-full bg-indigo-600"
            />
          </div>

          <div className="mb-4 flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Question {currentQuestionIdx + 1} of {quiz.questions.length}</span>
            <span>Score: {score}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 leading-relaxed">
                {currentQuestion.question}
              </h3>

              <div className="mt-8 space-y-3">
                {currentQuestion.type === 'multiple_choice' ? (
                  currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedOption === option;
                    const isCorrect = option === currentQuestion.correctAnswer;
                    const showResult = showExplanation;

                    let buttonClass = "w-full flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all ";
                    if (!showResult) {
                      buttonClass += "border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50/50";
                    } else {
                      if (isCorrect) {
                        buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-900";
                      } else if (isSelected) {
                        buttonClass += "border-red-500 bg-red-50 text-red-900";
                      } else {
                        buttonClass += "border-slate-100 bg-slate-50 opacity-50";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={showResult}
                        onClick={() => handleOptionSelect(option)}
                        className={buttonClass}
                      >
                        <span className="text-sm font-medium pr-4">{option}</span>
                        {showResult && isCorrect && <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />}
                        {showResult && isSelected && !isCorrect && <XCircle className="text-red-500 shrink-0" size={20} />}
                      </button>
                    );
                  })
                ) : (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={writingAnswer}
                      onChange={(e) => setWritingAnswer(e.target.value)}
                      disabled={showExplanation}
                      placeholder="Type your answer here..."
                      className="w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && writingAnswer.trim() && !showExplanation) {
                          handleOptionSelect(writingAnswer.trim());
                        }
                      }}
                    />
                    {!showExplanation && (
                      <button
                        onClick={() => handleOptionSelect(writingAnswer.trim())}
                        disabled={!writingAnswer.trim()}
                        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Submit Answer
                      </button>
                    )}
                    {showExplanation && (
                      <div className={`rounded-xl border-2 p-4 ${
                        writingAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-red-500 bg-red-50 text-red-900'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">Your answer: {writingAnswer}</span>
                          {writingAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.toLowerCase() ? (
                            <CheckCircle2 className="text-emerald-500" size={20} />
                          ) : (
                            <XCircle className="text-red-500" size={20} />
                          )}
                        </div>
                        <p className="mt-1 text-xs font-medium">Correct answer: {currentQuestion.correctAnswer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-8 rounded-xl bg-indigo-50/50 p-6 border border-indigo-100"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 rounded-full bg-indigo-100 p-1 text-indigo-600">
                        <Info size={16} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Explanation</h4>
                        <div className="mt-2 text-sm leading-relaxed text-indigo-800 prose prose-indigo max-w-none">
                          <ReactMarkdown>{currentQuestion.explanation}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-100">
                <button
                  onClick={prevQuestion}
                  disabled={currentQuestionIdx === 0}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <button
                  onClick={nextQuestion}
                  disabled={!showExplanation}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-700 disabled:opacity-50"
                >
                  {currentQuestionIdx === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                  <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center justify-between text-sm font-medium text-slate-500">
            <span>Card {currentCardIdx + 1} of {flashcards.length}</span>
            <button 
              onClick={() => {
                setCurrentCardIdx(0);
                setIsFlipped(false);
              }}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <div className="perspective-1000 relative h-96 w-full cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
            <motion.div
              initial={false}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
              className="preserve-3d relative h-full w-full"
            >
              {/* Front */}
              <div className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-slate-100 bg-white p-12 text-center shadow-xl">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">Question / Term</p>
                <h3 className="text-2xl font-bold text-slate-900 leading-relaxed">{flashcards[currentCardIdx]?.front}</h3>
                <p className="mt-8 text-sm text-slate-400 italic">Click to flip</p>
              </div>

              {/* Back */}
              <div className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-indigo-100 bg-indigo-50 p-12 text-center shadow-xl [transform:rotateY(180deg)]">
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">Answer / Definition</p>
                <div className="text-xl font-medium text-indigo-900 leading-relaxed prose prose-indigo max-w-none">
                  <ReactMarkdown>{flashcards[currentCardIdx]?.back}</ReactMarkdown>
                </div>
                <p className="mt-8 text-sm text-indigo-400 italic">Click to flip back</p>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (currentCardIdx > 0) {
                  setCurrentCardIdx(prev => prev - 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentCardIdx === 0}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-30"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (currentCardIdx < flashcards.length - 1) {
                  setCurrentCardIdx(prev => prev + 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentCardIdx === flashcards.length - 1}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 disabled:opacity-30"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
