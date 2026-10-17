/**
 * The status line at the bottom of the screen: short confirmations such as
 * "Exported …" or "Deleted …", which clear themselves after a few seconds.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type StatusTone = 'info' | 'ok' | 'error';

export interface StatusMessage {
  id: number;
  text: string;
  tone: StatusTone;
}

interface StatusApi {
  message: StatusMessage | null;
  notify: (text: string, tone?: StatusTone) => void;
  clear: () => void;
}

const StatusContext = createContext<StatusApi | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const nextId = useRef(1);

  const notify = useCallback((text: string, tone: StatusTone = 'info') => {
    setMessage({ id: nextId.current++, text, tone });
  }, []);
  const clear = useCallback(() => setMessage(null), []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(
      () => setMessage((current) => (current?.id === message.id ? null : current)),
      message.tone === 'error' ? 9000 : 4500,
    );
    return () => window.clearTimeout(timeout);
  }, [message]);

  const api = useMemo(() => ({ message, notify, clear }), [message, notify, clear]);
  return <StatusContext.Provider value={api}>{children}</StatusContext.Provider>;
}

export function useStatus(): StatusApi {
  const api = useContext(StatusContext);
  if (!api) throw new Error('useStatus() must be used inside <StatusProvider>.');
  return api;
}
