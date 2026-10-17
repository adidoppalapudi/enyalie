import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { goBack } from '../app/router';
import { useStatus } from '../app/StatusContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { errorsByField, Field } from '../components/Field';
import type { KeyAction } from '../components/KeyBar';
import { Link } from '../components/Link';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { store } from '../db';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../lib/errors';
import { slugify } from '../lib/format';
import {
  DIFFICULTIES,
  MAX_CHOICES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Deck,
  type Difficulty,
  type Question,
  type QuestionType,
} from '../models/types';
import { LIMITS, parseTagInput, validateQuestionContent, type FieldError } from '../models/validation';

async function loadEditorData(deckId: string, questionId: string | null) {
  const [deck, question] = await Promise.all([
    store.getDeck(deckId),
    questionId ? store.getQuestion(questionId) : Promise.resolve(undefined),
  ]);
  return { deck, question };
}

interface QuestionEditorViewProps {
  deckId: string;
  /** null when adding a new question. */
  questionId: string | null;
}

export function QuestionEditorView({ deckId, questionId }: QuestionEditorViewProps) {
  const { data, error, reload } = useAsync(() => loadEditorData(deckId, questionId), [deckId, questionId]);
  const path = ['decks', '…', questionId ? 'edit' : 'new'];

  if (!data) {
    return (
      <Screen path={path} title="Question">
        {error ? (
          <Notice title="Couldn't load this question." tone="error">
            <p>{errorMessage(error)}</p>
            <button type="button" className="btn" onClick={reload}>
              try again
            </button>
          </Notice>
        ) : (
          <p className="dim">loading…</p>
        )}
      </Screen>
    );
  }

  const { deck, question } = data;
  if (!deck || (questionId && (!question || question.deckId !== deckId))) {
    return (
      <Screen path={path} title="Not found">
        <Notice title={deck ? "This question doesn't exist." : "This deck doesn't exist."}>
          <p>It may have been deleted.</p>
          <Link to={deck ? { name: 'deck', deckId } : { name: 'library' }}>
            {deck ? 'back to the deck' : 'go to the library'}
          </Link>
        </Notice>
      </Screen>
    );
  }

  return <QuestionForm deck={deck} question={question} />;
}

// ---------------------------------------------------------------------------

/** What the form holds. Every type's fields are kept, so switching type back and forth loses nothing. */
interface FormState {
  type: QuestionType;
  prompt: string;
  /** Always MAX_CHOICES slots; empty slots are dropped when saving. */
  choices: string[];
  correctSlot: number | null;
  trueFalse: boolean | null;
  answer: string;
  explanation: string;
  difficulty: Difficulty | '';
  tags: string;
}

/** The type picked last, so adding several questions of one type is quicker. */
let lastNewType: QuestionType = 'multiple_choice';

function emptyForm(type: QuestionType, keep?: Pick<FormState, 'difficulty' | 'tags'>): FormState {
  return {
    type,
    prompt: '',
    choices: Array.from({ length: MAX_CHOICES }, () => ''),
    correctSlot: null,
    trueFalse: null,
    answer: '',
    explanation: '',
    difficulty: keep?.difficulty ?? '',
    tags: keep?.tags ?? '',
  };
}

function formFromQuestion(question: Question): FormState {
  const form = emptyForm(question.type);
  form.prompt = question.prompt;
  form.explanation = question.explanation ?? '';
  form.difficulty = question.difficulty ?? '';
  form.tags = question.tags.join(', ');
  if (question.type === 'multiple_choice') {
    question.choices.slice(0, MAX_CHOICES).forEach((choice, i) => {
      form.choices[i] = choice;
    });
    form.correctSlot = question.correctIndex;
  } else if (question.type === 'true_false') {
    form.trueFalse = question.answer;
  } else {
    form.answer = question.answer;
  }
  return form;
}

/**
 * Turns the form into a raw question for validation. Empty choice slots are
 * dropped; `slots[i]` remembers which slot choice i came from, so errors can
 * be shown next to the right input.
 */
function draftFromForm(form: FormState): { draft: Record<string, unknown>; slots: number[] } {
  const common = {
    type: form.type,
    prompt: form.prompt,
    explanation: form.explanation,
    difficulty: form.difficulty,
    tags: parseTagInput(form.tags),
  };
  if (form.type === 'multiple_choice') {
    const slots = form.choices
      .map((text, slot) => ({ text, slot }))
      .filter(({ text, slot }) => text.trim() !== '' || slot === form.correctSlot)
      .map(({ slot }) => slot);
    const correctIndex = form.correctSlot === null ? undefined : slots.indexOf(form.correctSlot);
    return { draft: { ...common, choices: slots.map((slot) => form.choices[slot]), correctIndex }, slots };
  }
  if (form.type === 'true_false') return { draft: { ...common, answer: form.trueFalse ?? undefined }, slots: [] };
  return { draft: { ...common, answer: form.answer }, slots: [] };
}

/** Points choice errors at form slots instead of positions among the filled-in choices. */
function errorsForForm(errors: FieldError[], slots: number[]): Record<string, string> {
  const renumber = (text: string) =>
    text.replace(/\b([Cc]hoice) (\d+)/g, (_, word: string, n: string) => `${word} ${(slots[Number(n) - 1] ?? 0) + 1}`);
  return errorsByField(
    errors.map((error) => {
      const match = /^choices\.(\d+)$/.exec(error.field);
      const field = match ? `choices.${slots[Number(match[1])]}` : error.field;
      return { field, message: renumber(error.message) };
    }),
  );
}

const PROMPT_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'question',
  true_false: 'statement',
  flashcard: 'front of the card',
};

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

function QuestionForm({ deck, question }: { deck: Deck; question: Question | undefined }) {
  const { notify, clear } = useStatus();
  const id = useId();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<FormState>(() => (question ? formFromQuestion(question) : emptyForm(lastNewType)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const isNew = !question;
  const backToDeck = () => goBack({ name: 'deck', deckId: deck.id });

  function update(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function setChoice(slot: number, text: string) {
    setForm((current) => ({ ...current, choices: current.choices.map((choice, i) => (i === slot ? text : choice)) }));
  }

  async function save(addAnother: boolean) {
    if (saving) return;
    const { draft, slots } = draftFromForm(form);
    const result = validateQuestionContent(draft);
    if (!result.ok) {
      setErrors(errorsForForm(result.errors, slots));
      notify('Fix the highlighted fields to save.', 'error');
      // After the errors render, bring the first problem into view.
      requestAnimationFrame(() => {
        const invalid = document.querySelector<HTMLElement>('form.editor [aria-invalid="true"]');
        if (invalid) invalid.focus();
        else document.querySelector('form.editor .field-error')?.scrollIntoView({ block: 'center' });
      });
      return;
    }
    setSaving(true);
    try {
      if (question) await store.updateQuestion(question.id, result.value);
      else await store.addQuestion(deck.id, result.value);
      if (isNew) lastNewType = form.type;

      if (addAnother) {
        const added = addedCount + 1;
        setAddedCount(added);
        setForm(emptyForm(form.type, { difficulty: form.difficulty, tags: form.tags }));
        setErrors({});
        setSaving(false);
        notify(`Question added (${added} so far). Ready for the next one.`, 'ok');
        promptRef.current?.focus();
      } else {
        notify(question ? 'Saved the question.' : 'Question added.', 'ok');
        backToDeck();
      }
    } catch (failure) {
      setErrors({ form: errorMessage(failure) });
      setSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save(false);
    }
  }

  const actions: KeyAction[] = [
    { label: 'save', keyLabel: 'Ctrl+Enter', onAction: () => void save(false), primary: true, disabled: saving },
    ...(isNew ? [{ label: 'save + add another', onAction: () => void save(true), disabled: saving }] : []),
    {
      label: 'cancel',
      onAction: () => {
        clear();
        backToDeck();
      },
    },
  ];

  const fieldId = (name: string) => `${id}-${name}`;

  return (
    <Screen
      path={['decks', slugify(deck.name) || 'deck', isNew ? 'new' : 'edit']}
      title={isNew ? `New question – ${deck.name}` : `Edit question – ${deck.name}`}
      actions={actions}
    >
      <div className="view-head">
        <h1>{isNew ? 'new question' : 'edit question'}</h1>
        <p className="dim">
          in <Link to={{ name: 'deck', deckId: deck.id }}>{deck.name}</Link>
        </p>
      </div>

      <form
        className="editor"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
        onKeyDown={handleKeyDown}
      >
        <fieldset className="option-row">
          <legend>type</legend>
          <div className="options">
            {QUESTION_TYPES.map((type) => (
              <label key={type} className="toggle toggle-radio">
                <input
                  type="radio"
                  name={fieldId('type')}
                  checked={form.type === type}
                  onChange={() => update({ type })}
                />
                <span>{QUESTION_TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={PROMPT_LABELS[form.type]} htmlFor={fieldId('prompt')} error={errors.prompt}>
          <textarea
            id={fieldId('prompt')}
            ref={promptRef}
            value={form.prompt}
            rows={3}
            maxLength={LIMITS.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            aria-invalid={errors.prompt ? true : undefined}
            autoFocus={isNew}
          />
        </Field>

        {form.type === 'multiple_choice' && (
          <fieldset className={errors.choices || errors.correctIndex ? 'choice-editor has-error' : 'choice-editor'}>
            <legend>choices: fill in 2 to 4 and select the correct one</legend>
            {form.choices.map((choice, slot) => (
              <div key={slot} className="choice-slot">
                <div className={errors[`choices.${slot}`] ? 'choice-line has-error' : 'choice-line'}>
                  <label className="toggle toggle-radio correct-pick">
                    <input
                      type="radio"
                      name={fieldId('correct')}
                      checked={form.correctSlot === slot}
                      onChange={() => update({ correctSlot: slot })}
                      aria-label={`Choice ${CHOICE_LETTERS[slot]} is correct`}
                    />
                    <span>{CHOICE_LETTERS[slot]}</span>
                  </label>
                  <input
                    type="text"
                    value={choice}
                    maxLength={LIMITS.choice}
                    onChange={(event) => setChoice(slot, event.target.value)}
                    aria-label={`Choice ${CHOICE_LETTERS[slot]}`}
                    aria-invalid={errors[`choices.${slot}`] ? true : undefined}
                    placeholder={slot < 2 ? 'required' : 'optional'}
                    autoComplete="off"
                  />
                </div>
                {errors[`choices.${slot}`] && <p className="field-error">{errors[`choices.${slot}`]}</p>}
              </div>
            ))}
            {(errors.choices || errors.correctIndex) && (
              <p className="field-error" role="alert">
                {errors.choices ?? errors.correctIndex}
              </p>
            )}
          </fieldset>
        )}

        {form.type === 'true_false' && (
          <fieldset className={errors.answer ? 'option-row has-error' : 'option-row'}>
            <legend>the statement is</legend>
            <div className="options">
              {[true, false].map((value) => (
                <label key={String(value)} className="toggle toggle-radio">
                  <input
                    type="radio"
                    name={fieldId('truefalse')}
                    checked={form.trueFalse === value}
                    onChange={() => update({ trueFalse: value })}
                  />
                  <span>{value ? 'true' : 'false'}</span>
                </label>
              ))}
            </div>
            {errors.answer && (
              <p className="field-error" role="alert">
                {errors.answer}
              </p>
            )}
          </fieldset>
        )}

        {form.type === 'flashcard' && (
          <Field label="back of the card (answer)" htmlFor={fieldId('answer')} error={errors.answer}>
            <textarea
              id={fieldId('answer')}
              value={form.answer}
              rows={3}
              maxLength={LIMITS.answer}
              onChange={(event) => update({ answer: event.target.value })}
              aria-invalid={errors.answer ? true : undefined}
            />
          </Field>
        )}

        <Field
          label="explanation (optional)"
          htmlFor={fieldId('explanation')}
          error={errors.explanation}
          hint="Shown after answering. Good for the why behind the answer."
        >
          <textarea
            id={fieldId('explanation')}
            value={form.explanation}
            rows={3}
            maxLength={LIMITS.explanation}
            onChange={(event) => update({ explanation: event.target.value })}
          />
        </Field>

        <fieldset className="option-row">
          <legend>difficulty (optional)</legend>
          <div className="options">
            {(['', ...DIFFICULTIES] as const).map((difficulty) => (
              <label key={difficulty || 'none'} className="toggle toggle-radio">
                <input
                  type="radio"
                  name={fieldId('difficulty')}
                  checked={form.difficulty === difficulty}
                  onChange={() => update({ difficulty })}
                />
                <span>{difficulty || 'none'}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label="tags (optional)"
          htmlFor={fieldId('tags')}
          error={errors.tags}
          hint="Separate with commas or spaces, e.g. indexes, performance"
        >
          <input
            id={fieldId('tags')}
            type="text"
            value={form.tags}
            onChange={(event) => update({ tags: event.target.value })}
            autoComplete="off"
            autoCapitalize="none"
          />
        </Field>

        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}

        {!isNew && (
          <p className="button-row danger-zone">
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              delete question
            </button>
          </p>
        )}
      </form>

      {confirmDelete && question && (
        <ConfirmDialog
          title="delete question"
          confirmLabel="delete question"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await store.deleteQuestion(question.id);
            notify('Deleted the question.', 'ok');
            backToDeck();
          }}
        >
          <p>Delete this question? This can't be undone.</p>
        </ConfirmDialog>
      )}
    </Screen>
  );
}
