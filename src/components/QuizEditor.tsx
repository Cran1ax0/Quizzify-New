import React, { useState, useEffect } from 'react';
import { Quiz, Question, QuizLevel, UserStats } from '../types';
import { Plus, Trash2, Save, X, ChevronDown, ChevronUp, GripVertical, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { translations } from '../lib/translations';

interface QuizEditorProps {
  quiz?: Quiz; // If provided, we are editing. If not, we are creating.
  onSave: (quiz: Partial<Quiz>) => void;
  onCancel: () => void;
}

export default function QuizEditor({ quiz, onSave, onCancel }: QuizEditorProps) {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'userStats', user.uid), (snap) => {
        if (snap.exists()) {
          setUserStats(snap.data() as UserStats);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const t = translations[userStats?.settings?.interfaceLanguage || 'en'] || translations.en;

  const [topic, setTopic] = useState(quiz?.topic || '');
  const [level, setLevel] = useState<QuizLevel>(quiz?.level as QuizLevel || 'General');
  const [language, setLanguage] = useState(quiz?.language || 'English');
  const [type, setType] = useState<'quiz' | 'exam'>(quiz?.type || 'quiz');
  const [questions, setQuestions] = useState<Question[]>(quiz?.questions || [
    {
      question: '',
      options: ['', ''],
      correctAnswer: '',
      explanation: '',
      type: 'multiple_choice',
      marks: 2
    }
  ]);

  const addQuestion = () => {
    setQuestions([...questions, {
      question: '',
      options: ['', ''],
      correctAnswer: '',
      explanation: '',
      type: 'multiple_choice',
      marks: 2
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  const handleSave = () => {
    if (!topic.trim()) {
      alert(t.topic + ' is required');
      return;
    }
    if (questions.length === 0) {
      alert(t.addQuestion);
      return;
    }
    
    // Basic validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        alert(`${t.addQuestion} ${i + 1} is empty`);
        return;
      }
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        if (q.options.some(opt => !opt.trim())) {
          alert(`${t.addQuestion} ${i + 1} has empty options`);
          return;
        }
        if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) {
          alert(`${t.addQuestion} ${i + 1} has no valid correct answer selected`);
          return;
        }
      } else if (q.type === 'writing') {
        if (!q.correctAnswer.trim()) {
          alert(`${t.addQuestion} ${i + 1} has no correct answer`);
          return;
        }
      }
    }

    onSave({
      topic,
      level,
      language,
      type,
      questions
    });
  };

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900">
            {quiz ? t.editQuiz : t.createManualQuiz}
          </h2>
          <p className="mt-1 text-slate-500">{t.craftPerfect}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <X size={18} />
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <Save size={18} />
            {t.saveQuiz}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Quiz Metadata */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">{t.quizTopic}</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t.topicPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">{t.level}</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as QuizLevel)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              >
                <option value="General">{t.levelGeneral}</option>
                <option value="IGCSE">IGCSE</option>
                <option value="A-Levels">A-Levels</option>
                <option value="SAT">SAT</option>
                <option value="University">{t.levelUniversity}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">{t.language}</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">{t.type}</label>
              <div className="flex gap-2">
                {(['quiz', 'exam'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setType(mode)}
                    className={`flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                      type === mode ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {mode === 'quiz' ? t.quizMode : t.examMode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{t.quizzes} ({questions.length})</h3>
            <button
              onClick={addQuestion}
              className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-all"
            >
              <Plus size={16} />
              {t.addQuestion}
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {questions.map((q, idx) => (
              <motion.div
                key={idx}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-200"
              >
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white">
                      {idx + 1}
                    </span>
                    <div className="flex gap-2">
                      {(['multiple_choice', 'true_false', 'writing'] as const).map((questionType) => (
                        <button
                          key={questionType}
                          onClick={() => {
                            const updates: Partial<Question> = { type: questionType };
                            if (questionType === 'true_false') {
                              updates.options = [t.true, t.false];
                              updates.correctAnswer = t.true;
                            } else if (questionType === 'multiple_choice' && q.type !== 'multiple_choice') {
                              updates.options = ['', '', '', ''];
                              updates.correctAnswer = '';
                            }
                            updateQuestion(idx, updates);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                            q.type === questionType ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {questionType === 'multiple_choice' ? t.multipleChoice : questionType === 'true_false' ? t.trueFalse : t.writing}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => removeQuestion(idx)}
                    className="rounded-full p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.questionText}</label>
                    <textarea
                      value={q.question}
                      onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                      placeholder={t.enterQuestion}
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
                    />
                  </div>

                  {q.type === 'multiple_choice' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.options}</label>
                        <button
                          onClick={() => updateQuestion(idx, { options: [...q.options, ''] })}
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          {t.addOption}
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuestion(idx, { correctAnswer: opt })}
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                q.correctAnswer === opt && opt !== '' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 hover:border-indigo-300'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...q.options];
                                newOpts[optIdx] = e.target.value;
                                updateQuestion(idx, { options: newOpts });
                              }}
                              placeholder={`${t.optionPlaceholder} ${optIdx + 1}`}
                              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-indigo-500 transition-all"
                            />
                            {q.options.length > 2 && (
                              <button
                                onClick={() => {
                                  const newOpts = q.options.filter((_, i) => i !== optIdx);
                                  updateQuestion(idx, { options: newOpts });
                                }}
                                className="text-slate-300 hover:text-red-500"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'true_false' && (
                    <div className="flex gap-4">
                      {[t.true, t.false].map((val) => (
                        <button
                          key={val}
                          onClick={() => updateQuestion(idx, { correctAnswer: val })}
                          className={`flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                            q.correctAnswer === val ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'writing' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.correctAnswer}</label>
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                        placeholder={t.enterCorrectAnswer}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-indigo-500 transition-all"
                      />
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.explanationOptional}</label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                        placeholder={t.whyCorrect}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.marks}</label>
                      <input
                        type="number"
                        value={q.marks}
                        onChange={(e) => updateQuestion(idx, { marks: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            onClick={addQuestion}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-8 text-sm font-bold text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all"
          >
            <Plus size={20} />
            {t.addAnotherQuestion}
          </button>
        </div>
      </div>
    </div>
  );
}
