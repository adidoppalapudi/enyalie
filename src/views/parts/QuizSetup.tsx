import { useId } from 'react';
import { Box } from '../../components/Box';
import { plural } from '../../lib/format';
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type Question } from '../../models/types';
import {
  DIFFICULTY_FILTERS,
  QUESTION_COUNT_OPTIONS,
  TIMER_OPTIONS,
  difficultyOf,
  filterQuestions,
  resolveCount,
  type QuizSettings,
} from '../../quiz/engine';

interface QuizSetupProps {
  questions: Question[];
  settings: QuizSettings;
  onChange: (settings: QuizSettings) => void;
}

function countBy<K extends string>(items: readonly Question[], key: (question: Question) => K) {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Quiz options for one deck: length, timer, filters and shuffling. */
export function QuizSetup({ questions, settings, onChange }: QuizSetupProps) {
  const id = useId();
  const typeCounts = countBy(questions, (question) => question.type);
  const difficultyCounts = countBy(questions, difficultyOf);
  const types = QUESTION_TYPES.filter((type) => typeCounts[type]);
  const difficulties = DIFFICULTY_FILTERS.filter((difficulty) => difficultyCounts[difficulty]);

  const matching = filterQuestions(questions, settings).length;
  const count = resolveCount(settings.count, matching);
  const filtered = matching < questions.length;

  let summary: string;
  if (matching === 0) summary = 'No questions match these filters. Tick at least one type and difficulty.';
  else if (count === matching)
    summary = `The quiz will use all ${plural(matching, filtered ? 'matching question' : 'question')}.`;
  else summary = `The quiz will use ${count} of ${plural(matching, filtered ? 'matching question' : 'question')}.`;

  return (
    <Box title="start a quiz" className="quiz-setup">
      <fieldset className="option-row">
        <legend>length</legend>
        <div className="options">
          {QUESTION_COUNT_OPTIONS.map((option) => (
            <label key={option} className="toggle toggle-radio">
              <input
                type="radio"
                name={`${id}-count`}
                checked={settings.count === option}
                onChange={() => onChange({ ...settings, count: option })}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="option-row">
        <legend>timer</legend>
        <div className="options">
          {TIMER_OPTIONS.map((option) => (
            <label key={option} className="toggle toggle-radio">
              <input
                type="radio"
                name={`${id}-timer`}
                checked={settings.timer === option}
                onChange={() => onChange({ ...settings, timer: option })}
              />
              <span>{option === 'off' ? option : `${option}s`}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {types.length > 1 && (
        <fieldset className="option-row">
          <legend>types</legend>
          <div className="options">
            {types.map((type) => (
              <label key={type} className="toggle toggle-check">
                <input
                  type="checkbox"
                  checked={settings.types.includes(type)}
                  onChange={() => onChange({ ...settings, types: toggle(settings.types, type) })}
                />
                <span>
                  {QUESTION_TYPE_LABELS[type]} <span className="count">{typeCounts[type]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {difficulties.length > 1 && (
        <fieldset className="option-row">
          <legend>difficulty</legend>
          <div className="options">
            {difficulties.map((difficulty) => (
              <label key={difficulty} className="toggle toggle-check">
                <input
                  type="checkbox"
                  checked={settings.difficulties.includes(difficulty)}
                  onChange={() => onChange({ ...settings, difficulties: toggle(settings.difficulties, difficulty) })}
                />
                <span>
                  {difficulty} <span className="count">{difficultyCounts[difficulty]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="option-row">
        <legend>order</legend>
        <div className="options">
          <label className="toggle toggle-check">
            <input
              type="checkbox"
              checked={settings.shuffleQuestions}
              onChange={() => onChange({ ...settings, shuffleQuestions: !settings.shuffleQuestions })}
            />
            <span>shuffle questions</span>
          </label>
          <label className="toggle toggle-check">
            <input
              type="checkbox"
              checked={settings.shuffleChoices}
              onChange={() => onChange({ ...settings, shuffleChoices: !settings.shuffleChoices })}
            />
            <span>shuffle answers</span>
          </label>
        </div>
      </fieldset>

      <p className={matching === 0 ? 'setup-summary is-empty' : 'setup-summary'}>{summary}</p>
    </Box>
  );
}
