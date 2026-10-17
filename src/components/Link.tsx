import type { MouseEvent, ReactNode } from 'react';
import { navigate, routeToHash, type Route } from '../app/router';

interface LinkProps {
  to: Route;
  className?: string;
  title?: string;
  children: ReactNode;
}

/** An in-app link. Ctrl/Cmd/middle-click still open it in a new tab. */
export function Link({ to, className, title, children }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  }
  return (
    <a href={routeToHash(to)} className={className} title={title} onClick={handleClick}>
      {children}
    </a>
  );
}
