import { sourceRoute, useQuiz } from '../app/QuizContext';
import { goBack, navigate } from '../app/router';
import { BlockNumber } from '../components/BlockNumber';
import { Box } from '../components/Box';
import type { KeyAction } from '../components/KeyBar';
import { Link } from '../components/Link';
import { Meter } from '../components/Meter';
import { Notice } from '../components/Notice';
import { QuestionMeta } from '../components/QuestionMeta';
import { Screen } from '../components/Screen';
import { formatScore, plural, slugify } from '../lib/format';
import { correctAnswerText, responseText, verdict } from '../quiz/describe';
import { isFinished, mistakesSession, replaySession, summarize } from '../quiz/engine';

export function ResultsView() {
  const quiz = useQuiz();
  const { session } = quiz;

  if (!session || !isFinished(session)) {
    return (
      <Screen path={['quiz', 'results']} title="Results">
        <Notice title="No results to show.">
          <p>
            Finish a quiz to see your score here. <Link to={{ name: 'library' }}>Go to the library</Link>
          </p>
        </Notice>
      </Screen>
    );
  }

  const summary = summarize(session);
  const source = sourceRoute(session);
  const mistakeCount = summary.mistakes.length;

  const replay = () => {
    quiz.start(replaySession(session));
    navigate({ name: 'quiz' }, { replace: true });
  };
  const retryMistakes = () => {
    const retry = mistakesSession(session);
    if (!retry) return;
    quiz.start(retry);
    navigate({ name: 'quiz' }, { replace: true });
  };

  const actions: KeyAction[] = [
    ...(mistakeCount > 0
      ? [{ label: `retry ${plural(mistakeCount, 'mistake')}`, hotkey: 'm', onAction: retryMistakes, primary: true }]
      : []),
    { label: 'replay', hotkey: 'r', onAction: replay, primary: mistakeCount === 0 },
    {
      label: source.name === 'deck' ? 'back to deck' : 'library',
      hotkey: 'escape',
      keyLabel: 'Esc',
      onAction: () => goBack(source),
    },
  ];

  const score = formatScore(summary.score);

  return (
    <Screen
      path={['quiz', slugify(session.title) || 'quiz', 'results']}
      title={`Results – ${session.title}`}
      actions={actions}
    >
      <div className="view-head">
        <h1>results</h1>
        <p className="dim">
          {session.title}
          {session.retry ? ' (mistakes round)' : ''}
        </p>
      </div>

      <section className="scoreboard" aria-label="Score">
        <BlockNumber text={score} label={`${score} points`} />
        <p className="score-caption">points</p>
      </section>

      <dl className="stats">
        <dt>correct</dt>
        <dd>
          {summary.correct} of {summary.total}
        </dd>
        <dt>incorrect</dt>
        <dd>{summary.incorrect}</dd>
        <dt>accuracy</dt>
        <dd>
          {summary.accuracy}%{' '}
          <Meter
            value={summary.correct}
            max={summary.total}
            tone="accuracy"
            label={`${summary.accuracy} percent correct`}
          />
        </dd>
        <dt>best streak</dt>
        <dd>{summary.bestStreak}</dd>
      </dl>

      <p className="verdict-line">{verdict(summary.accuracy)}</p>

      {mistakeCount === 0 ? (
        <p className="dim">No mistakes to review.</p>
      ) : (
        <Box title={`review mistakes (${mistakeCount})`} className="mistakes">
          <ol className="mistake-list">
            {summary.mistakes.map(({ item, answer }) => {
              const { question } = item;
              return (
                <li key={question.id} className="mistake">
                  <p className="mistake-prompt">{question.prompt}</p>
                  <dl className="mistake-answers">
                    <dt>you said</dt>
                    <dd className="is-wrong">{responseText(question, answer.response)}</dd>
                    <dt>answer</dt>
                    <dd className="is-correct">{correctAnswerText(question)}</dd>
                  </dl>
                  {question.explanation && <p className="explanation">{question.explanation}</p>}
                  <div className="mistake-foot">
                    <QuestionMeta
                      question={question}
                      deckName={session.source.kind === 'quick' ? session.deckNames[question.deckId] : undefined}
                    />
                    <Link
                      to={{ name: 'editQuestion', deckId: question.deckId, questionId: question.id }}
                      className="edit-link"
                    >
                      edit question
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </Box>
      )}
    </Screen>
  );
}
