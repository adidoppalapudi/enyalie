/**
 * Small conveniences kept in the browser's web storage (not the database):
 *  - the quiz in progress, in sessionStorage, so a reload or a phone killing
 *    the tab in the background doesn't lose your place;
 *  - your preferred quiz length, shuffle options and timer, in localStorage.
 * Storage can be unavailable (private mode, blocked site data), so every call
 * is wrapped and failures are ignored.
 */
import {
  DEFAULT_SETTINGS,
  QUESTION_COUNT_OPTIONS,
  TIMER_OPTIONS,
  type QuestionCount,
  type QuizSession,
  type TimerOption,
} from './engine';
import { clearMigratedValue, readMigratedValue, writeMigratedValue } from '../lib/browserStorageMigration';

const SESSION_KEY = 'enyalie.quiz';
const LEGACY_SESSION_KEY = 'rekall.quiz';
const PREFERENCES_KEY = 'enyalie.quizPreferences';
const LEGACY_PREFERENCES_KEY = 'rekall.quizPreferences';

export function saveSession(session: QuizSession | null): void {
  try {
    if (session) writeMigratedValue(sessionStorage, SESSION_KEY, LEGACY_SESSION_KEY, JSON.stringify(session));
    else clearMigratedValue(sessionStorage, SESSION_KEY, LEGACY_SESSION_KEY);
  } catch {
    // The quiz just won't survive a reload.
  }
}

export function loadSession(): QuizSession | null {
  try {
    const raw = readMigratedValue(sessionStorage, SESSION_KEY, LEGACY_SESSION_KEY, isValidSessionJson);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    return looksLikeSession(data) ? data : null;
  } catch {
    return null;
  }
}

function isValidSessionJson(raw: string): boolean {
  try {
    return looksLikeSession(JSON.parse(raw));
  } catch {
    return false;
  }
}

function looksLikeSession(value: unknown): value is QuizSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<QuizSession>;
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.source === 'object' &&
    typeof session.settings === 'object' &&
    Array.isArray(session.items) &&
    session.items.length > 0 &&
    Array.isArray(session.answers) &&
    session.answers.length === session.items.length &&
    typeof session.current === 'number' &&
    session.current >= 0 &&
    session.current < session.items.length &&
    typeof session.score === 'number'
  );
}

export interface QuizPreferences {
  count: QuestionCount;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  timer: TimerOption;
}

export function loadPreferences(): QuizPreferences {
  const defaults: QuizPreferences = {
    count: DEFAULT_SETTINGS.count,
    shuffleQuestions: DEFAULT_SETTINGS.shuffleQuestions,
    shuffleChoices: DEFAULT_SETTINGS.shuffleChoices,
    timer: DEFAULT_SETTINGS.timer,
  };
  try {
    const raw = readMigratedValue(localStorage, PREFERENCES_KEY, LEGACY_PREFERENCES_KEY, isPreferencesJson);
    if (!raw) return defaults;
    const data = JSON.parse(raw) as Partial<QuizPreferences>;
    return {
      count: (QUESTION_COUNT_OPTIONS as readonly unknown[]).includes(data.count)
        ? (data.count as QuestionCount)
        : defaults.count,
      shuffleQuestions: typeof data.shuffleQuestions === 'boolean' ? data.shuffleQuestions : defaults.shuffleQuestions,
      shuffleChoices: typeof data.shuffleChoices === 'boolean' ? data.shuffleChoices : defaults.shuffleChoices,
      timer: (TIMER_OPTIONS as readonly unknown[]).includes(data.timer) ? (data.timer as TimerOption) : defaults.timer,
    };
  } catch {
    return defaults;
  }
}

/** Remembers length, shuffle options and timer (not the filters, which depend on the deck). */
export function savePreferences({ count, shuffleQuestions, shuffleChoices, timer }: QuizPreferences): void {
  try {
    writeMigratedValue(
      localStorage,
      PREFERENCES_KEY,
      LEGACY_PREFERENCES_KEY,
      JSON.stringify({ count, shuffleQuestions, shuffleChoices, timer }),
    );
  } catch {
    // Not important enough to report.
  }
}

function isPreferencesJson(raw: string): boolean {
  try {
    const data: unknown = JSON.parse(raw);
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  } catch {
    return false;
  }
}
