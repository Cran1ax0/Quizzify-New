export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}

export interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  type: 'multiple_choice' | 'writing' | 'true_false';
  marks?: number;
  diagram?: string; // SVG code
}

export interface Quiz {
  id: string;
  userId: string;
  topic: string;
  level: string;
  language: string;
  questions: Question[];
  createdAt: string;
  sourceMaterials?: string[];
  type: 'quiz' | 'exam';
}

export type QuizLevel = 'IGCSE' | 'A-Levels' | 'SAT' | 'University' | 'General';

export interface QuizConfig {
  topic: string;
  level: QuizLevel;
  language: string;
  questionCount: number;
  additionalMaterials?: string;
  images?: string[]; // base64
  documents?: { data: string; mimeType: string }[]; // base64 and mimeType
  type: 'quiz' | 'exam';
}

export interface Session {
  id: string;
  pin: string;
  hostId: string;
  quizId: string;
  status: 'lobby' | 'playing' | 'finished';
  currentQuestionIndex: number; // For host-paced
  mode: 'host-paced' | 'student-paced';
  isTestMode?: boolean;
  freezeActiveUntil?: string; // ISO string
  freezeSenderId?: string;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  quizId: string;
  userId: string;
  front: string;
  back: string;
  createdAt: string;
}

export interface CheatingAlert {
  type: 'fullscreen_exit' | 'tab_switch' | 'resize' | 'right_click';
  timestamp: string;
}

export interface Participant {
  id: string;
  sessionId: string;
  uid?: string;
  nickname: string;
  score: number;
  lastAnsweredIndex: number;
  currentQuestionIndex: number; // For student-paced
  shuffledQuestionIndices?: number[]; // To keep track of their unique order
  cheatingAlerts?: CheatingAlert[];
  correctAnswersCount?: number;
  isFinished?: boolean;
  joinedAt: string;
}

export interface UserSettings {
  interfaceLanguage: 'en' | 'uz' | 'ru';
  examModeEnabled: boolean;
}

export interface UserStats {
  uid: string;
  displayName?: string;
  photoURL?: string;
  totalPoints: number;
  xp: number;
  level: number;
  badges: string[];
  streak: number;
  settings?: UserSettings;
  wrongAnswerBank: {
    question: string;
    correctAnswer: string;
    userAnswer: string;
    topic: string;
  }[];
}
