import type { ReactNode } from 'react';

interface BoxProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A section framed with a double line, its title set into the top border. */
export function Box({ title, children, className }: BoxProps) {
  return (
    <section className={className ? `box ${className}` : 'box'}>
      <h2 className="box-title">{title}</h2>
      {children}
    </section>
  );
}
