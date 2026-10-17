import { QUESTION_TYPE_BADGES, QUESTION_TYPE_LABELS, type Question } from '../models/types';

interface QuestionMetaProps {
  question: Question;
  /** Shown in mixed quizzes, so you know which deck a question is from. */
  deckName?: string;
}

/** The small line above or below a question: type, difficulty, tags. */
export function QuestionMeta({ question, deckName }: QuestionMetaProps) {
  return (
    <p className="question-meta">
      <abbr className="type-badge" title={QUESTION_TYPE_LABELS[question.type]}>
        {QUESTION_TYPE_BADGES[question.type]}
      </abbr>
      {question.difficulty && (
        <span className={`difficulty difficulty-${question.difficulty}`}>{question.difficulty}</span>
      )}
      {question.tags.map((tag) => (
        <span key={tag} className="tag">
          #{tag}
        </span>
      ))}
      {deckName && <span className="from-deck">from {deckName}</span>}
    </p>
  );
}
