import { useCallback, useEffect, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * Runs an async loader when the component mounts and whenever `deps` change.
 * `reload()` runs it again (after saving something, say). While reloading,
 * the previous data stays on screen so lists don't flicker.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true }));
    load().then(
      (data) => {
        if (active) setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        if (active) setState((previous) => ({ ...previous, error, loading: false }));
      },
    );
    return () => {
      active = false;
    };
    // `load` is usually an inline function, so it is deliberately not a
    // dependency: `deps` decide when it runs again.
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
