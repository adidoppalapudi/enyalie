/** Small text-formatting helpers shared by the views. */

/** plural(1, 'question') → "1 question"; plural(3, 'question') → "3 questions" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const thisYearFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const otherYearFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "Oct 17" this year, "Oct 17, 2025" otherwise. */
export function formatDate(time: number, now = Date.now()): string {
  const sameYear = new Date(time).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? thisYearFormat : otherYearFormat).format(time);
}

/** 1030 → "1,030" (always comma-grouped, to match the block digits on the results screen). */
export function formatScore(score: number): string {
  return Math.round(score).toLocaleString('en-US');
}

/** "PostgreSQL Fundamentals" → "postgresql-fundamentals" */
export function slugify(text: string, maxLength = 60): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
