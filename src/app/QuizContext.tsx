/**
 * Holds the quiz in progress, shared by the quiz and results screens.
 * The session is saved to sessionStorage, so a reload resumes where you were.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { advance, answerCurrent, revealCurrent, type QuizResponse, type QuizSession } from '../quiz/engine';
import { loadSession, saveSession } from '../quiz/persistence';
import type { Route } from './router';

/** Where "quit" and "done" lead: the deck a quiz came from, or the library for quick play. */
export function sourceRoute(session: QuizSession): Route {
  return session.source.kind === 'deck' ? { name: 'deck', deckId: session.source.deckId } : { name: 'library' };
}

interface QuizApi {
  session: QuizSession | null;
  /** Replaces any current quiz with a new one. */
  start: (session: QuizSession) => void;
  answer: (response: QuizResponse) => void;
  /** Turns over the current flashcard. */
  reveal: () => void;
  /** Goes to the next question, or finishes the quiz after the last one. */
  next: () => void;
  /** Answers and moves on in one step (used by flashcards). */
  answerAndNext: (response: QuizResponse) => void;
  /** Forgets the current quiz. */
  end: () => void;
}

const QuizContext = createContext<QuizApi | null>(null);

export function QuizProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<QuizSession | null>(() => loadSession());

  useEffect(() => saveSession(session), [session]);

  const start = useCallback((next: QuizSession) => setSession(next), []);
  const answer = useCallback((response: QuizResponse) => {
    setSession((current) => (current ? answerCurrent(current, response) : current));
  }, []);
  const reveal = useCallback(() => {
    setSession((current) => (current ? revealCurrent(current) : current));
  }, []);
  const next = useCallback(() => {
    setSession((current) => (current ? advance(current) : current));
  }, []);
  const answerAndNext = useCallback((response: QuizResponse) => {
    setSession((current) => {
      if (!current) return current;
      const answered = answerCurrent(current, response);
      // If this question was already answered (a double tap), don't skip ahead.
      return answered === current ? current : advance(answered);
    });
  }, []);
  const end = useCallback(() => setSession(null), []);

  const api = useMemo(
    () => ({ session, start, answer, reveal, next, answerAndNext, end }),
    [session, start, answer, reveal, next, answerAndNext, end],
  );
  return <QuizContext.Provider value={api}>{children}</QuizContext.Provider>;
}

export function useQuiz(): QuizApi {
  const api = useContext(QuizContext);
  if (!api) throw new Error('useQuiz() must be used inside <QuizProvider>.');
  return api;
}
