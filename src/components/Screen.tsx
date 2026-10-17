import { useEffect, type ReactNode } from 'react';
import { useQuiz } from '../app/QuizContext';
import { useRoute } from '../app/router';
import { useStatus } from '../app/StatusContext';
import { isFinished } from '../quiz/engine';
import { KeyBar, type KeyAction } from './KeyBar';
import { Link } from './Link';

interface ScreenProps {
  /** Shown as a path in the title bar, e.g. ["decks", "postgresql-basics"]. */
  path: string[];
  /** Browser tab title. */
  title: string;
  actions?: KeyAction[];
  children: ReactNode;
}

/** The frame around every view: title bar, content, status line and key bar. */
export function Screen({ path, title, actions = [], children }: ScreenProps) {
  const { session } = useQuiz();
  const route = useRoute();
  const { message } = useStatus();
  const canResume = session !== null && !isFinished(session) && route.name !== 'quiz';

  useEffect(() => {
    document.title = title ? `${title} – Rekall` : 'Rekall';
  }, [title]);

  return (
    <div className="screen">
      <header className="titlebar">
        <div className="bar-inner">
          <Link to={{ name: 'library' }} className="brand" title="Library">
            rekall
            <span className="cursor" aria-hidden="true" />
          </Link>
          <span className="path">~/{path.join('/')}</span>
          {canResume && (
            <Link to={{ name: 'quiz' }} className="resume">
              resume quiz
            </Link>
          )}
        </div>
      </header>

      <main className="content">{children}</main>

      <footer className="bottombar">
        <p className={`statusline${message ? ` tone-${message.tone}` : ''}`} role="status" aria-live="polite">
          {message?.text}
        </p>
        <KeyBar actions={actions} />
      </footer>
    </div>
  );
}
