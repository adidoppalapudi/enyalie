import { useId, useMemo, useState } from 'react';
import { Box } from '../../components/Box';
import { Link } from '../../components/Link';
import { QuestionMeta } from '../../components/QuestionMeta';
import type { Question } from '../../models/types';
import { correctAnswerText } from '../../quiz/describe';

interface QuestionListProps {
  deckId: string;
  questions: Question[];
  onDelete: (question: Question, number: number) => void;
}

function searchableText(question: Question): string {
  const parts = [question.prompt, question.explanation ?? '', ...question.tags.map((tag) => `#${tag}`)];
  if (question.type === 'multiple_choice') parts.push(...question.choices);
  if (question.type === 'flashcard') parts.push(question.answer);
  return parts.join('\n').toLowerCase();
}

/** Browse a deck's questions, with a text filter once the list gets long. */
export function QuestionList({ deckId, questions, onDelete }: QuestionListProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const numbered = useMemo(() => questions.map((question, i) => ({ question, number: i + 1 })), [questions]);
  const needle = query.trim().toLowerCase();
  const shown = needle ? numbered.filter(({ question }) => searchableText(question).includes(needle)) : numbered;

  return (
    <Box title={`questions (${questions.length})`} className="question-box">
      {questions.length > 6 && (
        <div className="list-filter">
          <label htmlFor={`${id}-filter`} className="field-label">
            filter
          </label>
          <input
            id={`${id}-filter`}
            type="search"
            value={query}
            placeholder="words or #tag"
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
      )}
      <ol className="question-list">
        {shown.map(({ question, number }) => (
          <li key={question.id} className="question-row">
            <span className="row-number" aria-hidden="true">
              {String(number).padStart(2, ' ')}
            </span>
            <Link to={{ name: 'editQuestion', deckId, questionId: question.id }} className="question-link">
              <span className="question-prompt">{question.prompt}</span>
              <span className="question-answer">answer: {correctAnswerText(question)}</span>
            </Link>
            <div className="row-tail">
              <QuestionMeta question={question} />
              <button
                type="button"
                className="btn btn-quiet btn-danger"
                onClick={() => onDelete(question, number)}
                aria-label={`Delete question ${number}`}
              >
                delete
              </button>
            </div>
          </li>
        ))}
      </ol>
      {shown.length === 0 && <p className="dim">No questions match "{query.trim()}".</p>}
    </Box>
  );
}
