import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  signInWithPhoneNumber, 
  ConfirmationResult, 
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, orderBy, deleteDoc, addDoc, updateDoc, increment, arrayUnion, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserStats, Participant, Session, Quiz } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const getOrCreateUserStats = async (uid: string, displayName?: string | null, photoURL?: string | null): Promise<UserStats> => {
  const statsDoc = doc(db, 'userStats', uid);
  const snap = await getDoc(statsDoc);
  
  if (snap.exists()) {
    const existingStats = snap.data() as UserStats;
    // Update name/photo if they changed
    if (displayName !== existingStats.displayName || photoURL !== existingStats.photoURL) {
      await updateDoc(statsDoc, {
        displayName: displayName || existingStats.displayName || '',
        photoURL: photoURL || existingStats.photoURL || ''
      });
    }
    return { ...existingStats, displayName: displayName || existingStats.displayName, photoURL: photoURL || existingStats.photoURL };
  } else {
    const initialStats: UserStats = {
      uid,
      displayName: displayName || '',
      photoURL: photoURL || '',
      totalPointsV2: 0,
      xpV2: 0,
      levelV2: 1,
      badges: [],
      streak: 0,
      settings: {
        interfaceLanguage: 'en',
        examModeEnabled: false
      },
      wrongAnswerBank: []
    };
    await setDoc(statsDoc, initialStats);
    return initialStats;
  }
};

export const updateUserSettings = async (uid: string, settings: Partial<UserStats['settings']>) => {
  const statsDoc = doc(db, 'userStats', uid);
  const updates: any = {};
  if (settings.interfaceLanguage) updates['settings.interfaceLanguage'] = settings.interfaceLanguage;
  if (settings.examModeEnabled !== undefined) updates['settings.examModeEnabled'] = settings.examModeEnabled;
  
  await updateDoc(statsDoc, updates);
};

export const updateUserStats = async (uid: string, points: number, wrongAnswer?: UserStats['wrongAnswerBank'][0]) => {
  const statsDoc = doc(db, 'userStats', uid);
  
  try {
    const stats = await getOrCreateUserStats(uid);
    
    // Calculate new XP and Level
    let newXp = (stats.xpV2 || 0) + points; // XP = Points for solo play
    let newLevel = stats.levelV2 || 1;

    // Award XP based on points earned
    while (newXp >= getXpForLevel(newLevel)) {
      newXp -= getXpForLevel(newLevel);
      newLevel++;
    }

    const updates: any = {
      totalPointsV2: increment(points),
      xpV2: newXp,
      levelV2: newLevel,
      streak: increment(points > 0 ? 1 : 0) // Only increment streak on correct answer
    };

    if (wrongAnswer) {
      // If we provided a wrong answer, update the streak to 0 or decrement?
      // User said "streak", let's just use increment(1) for correct, and reset for wrong
      updates.streak = 0;
      updates.wrongAnswerBank = arrayUnion(wrongAnswer);
    }
    
    await updateDoc(statsDoc, updates);
  } catch (error) {
    console.error('Stats update failed:', error);
  }
};

export const createSession = async (
  hostId: string, 
  quizId: string, 
  mode: 'host-paced' | 'student-paced', 
  isTestMode: boolean = false, 
  showAnswers: boolean = true,
  gameMode: 'classic' | 'cryptohack' = 'classic',
  duration: number = 8
): Promise<string> => {
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const sessionData: Omit<Session, 'id'> = {
    pin,
    hostId,
    quizId,
    status: 'lobby',
    currentQuestionIndex: 0,
    mode,
    gameMode,
    duration,
    isTestMode,
    showAnswers,
    createdAt: new Date().toISOString()
  };
  const docRef = await addDoc(collection(db, 'sessions'), sessionData);
  return docRef.id;
};

export const joinSession = async (sessionId: string, nickname: string, uid?: string, questionCount: number = 0, isCryptoHack: boolean = false): Promise<string> => {
  // Create a shuffled array of indices [0, 1, 2, ..., questionCount - 1]
  const shuffledIndices = Array.from({ length: questionCount }, (_, i) => i);
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }

  const participantData: Omit<Participant, 'id'> = {
    sessionId,
    uid: uid || null,
    nickname,
    score: 0,
    lastAnsweredIndex: -1,
    currentQuestionIndex: 0,
    shuffledQuestionIndices: shuffledIndices,
    joinedAt: new Date().toISOString()
  };

  if (isCryptoHack) {
    participantData.crypto = 0;
    // Generate passwords
    const passwordOptions = [
      'X7kP9qZ!', 'Admin123', 'Secret_77', 'CyberPunk2077', 'HackerMan',
      'Dragon_99', 'GhostInShell', 'Matrix_Neo', 'Terminator', 'RoboCop',
      'HackThePlanet', 'ZeroCool', 'AcidBurn', 'CerealKiller', 'LordNikon',
      'PhantomPhreak', 'Joey_11', 'ThePlague', 'AgentSmith', 'Trinity_22'
    ];
    // Pick 5 random
    const shuffledPasswords = [...passwordOptions].sort(() => Math.random() - 0.5);
    participantData.availablePasswords = shuffledPasswords.slice(0, 5);
  }

  const docRef = await addDoc(collection(db, 'sessions', sessionId, 'participants'), participantData);
  return docRef.id;
};

export const getXpForLevel = (level: number) => level * 500; // Reduced from 1000 for faster progress feel

export const awardSessionXp = async (sessionId: string) => {
  try {
    const sessionDoc = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionDoc);
    if (!sessionSnap.exists()) return;
    const sessionData = sessionSnap.data() as Session;

    const quizDoc = doc(db, 'quizzes', sessionData.quizId);
    const quizSnap = await getDoc(quizDoc);
    if (!quizSnap.exists()) return;
    const quizData = quizSnap.data() as Quiz;

    const participantsRef = collection(db, 'sessions', sessionId, 'participants');
    const snap = await getDocs(participantsRef);
    const participants = snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
    
    if (participants.length === 0) return;

    // Calculate Class Accuracy
    const totalQuestions = quizData.questions.length;
    const totalCorrect = participants.reduce((sum, p) => sum + (p.correctAnswersCount || 0), 0);
    const classAccuracy = totalCorrect / (participants.length * totalQuestions);
    
    // XP depends on class accuracy: 100% accuracy = 1000 XP bonus, 50% = 500 XP
    const accuracyXp = Math.floor(classAccuracy * 1000);
    
    // Base XP from score
    const totalScore = participants.reduce((sum, p) => sum + p.score, 0);
    const avgScore = totalScore / participants.length;
    const scoreXp = Math.floor(avgScore / 5); // Increased from /10

    const xpToAward = accuracyXp + scoreXp;

    console.log(`Awarding XP: Accuracy ${Math.round(classAccuracy * 100)}%, XP: ${xpToAward}`);

    const promises = participants.map(async (p) => {
      if (!p.uid) return; // Skip guests for global ranking

      // Ensure stats exist
      const stats = await getOrCreateUserStats(p.uid);
      
      const statsDoc = doc(db, 'userStats', p.uid);
      let newXp = (stats.xpV2 || 0) + xpToAward;
      let newLevel = stats.levelV2 || 1;

      while (newXp >= getXpForLevel(newLevel)) {
        newXp -= getXpForLevel(newLevel);
        newLevel++;
      }

      await updateDoc(statsDoc, {
        xpV2: newXp,
        levelV2: newLevel
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error awarding session XP:', error);
  }
};

export const signInWithEmail = async (email: string, pass: string) => {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  await getOrCreateUserStats(result.user.uid, result.user.displayName, result.user.photoURL);
  return result.user;
};

export const signUpWithEmail = async (email: string, pass: string, name: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(result.user, { displayName: name });
  
  // Create/Update user profile
  const userDoc = doc(db, 'users', result.user.uid);
  await setDoc(userDoc, {
    uid: result.user.uid,
    email: result.user.email,
    displayName: name,
    photoURL: null,
    createdAt: new Date().toISOString()
  }, { merge: true });

  await getOrCreateUserStats(result.user.uid, name, null);
  return result.user;
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create/Update user profile
    const userDoc = doc(db, 'users', user.uid);
    await setDoc(userDoc, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: new Date().toISOString()
    }, { merge: true });
    
    await getOrCreateUserStats(user.uid, user.displayName, user.photoURL);
    
    return user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const logout = () => signOut(auth);
