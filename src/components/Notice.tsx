import type { ReactNode } from 'react';

interface NoticeProps {
  title: string;
  children?: ReactNode;
  tone?: 'info' | 'error';
}

/** A message in place of a screen's content: empty, missing, or failed to load. */
export function Notice({ title, children, tone = 'info' }: NoticeProps) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <p className="notice-title">{title}</p>
      {children}
    </div>
  );
}
