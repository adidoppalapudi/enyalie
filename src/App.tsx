import { useEffect } from 'react';
import { QuizProvider } from './app/QuizContext';
import { useRoute } from './app/router';
import { StatusProvider } from './app/StatusContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Link } from './components/Link';
import { Notice } from './components/Notice';
import { Screen } from './components/Screen';
import { DeckView } from './views/DeckView';
import { LibraryView } from './views/LibraryView';
import { QuestionEditorView } from './views/QuestionEditorView';
import { QuizView } from './views/QuizView';
import { ResultsView } from './views/ResultsView';

export function App() {
  return (
    <ErrorBoundary>
      <StatusProvider>
        <QuizProvider>
          <CurrentScreen />
        </QuizProvider>
      </StatusProvider>
    </ErrorBoundary>
  );
}

/** Picks the view for the current URL (see app/router.ts). */
function CurrentScreen() {
  const route = useRoute();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  switch (route.name) {
    case 'library':
      return <LibraryView />;
    case 'deck':
      return <DeckView key={route.deckId} deckId={route.deckId} />;
    case 'newQuestion':
      return <QuestionEditorView key={`new-${route.deckId}`} deckId={route.deckId} questionId={null} />;
    case 'editQuestion':
      return <QuestionEditorView key={route.questionId} deckId={route.deckId} questionId={route.questionId} />;
    case 'quiz':
      return <QuizView />;
    case 'results':
      return <ResultsView />;
    case 'notFound':
      return (
        <Screen path={['not-found']} title="Not found">
          <Notice title="There's nothing at this address.">
            <Link to={{ name: 'library' }}>go to the library</Link>
          </Notice>
        </Screen>
      );
  }
}
