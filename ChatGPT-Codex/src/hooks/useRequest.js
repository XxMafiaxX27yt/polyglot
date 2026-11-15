import { useCallback, useState } from 'react';

/**
 * Loading / error / success state for one server request.
 * `ok` is only ever set from a resolved request — a failure (including "no
 * server connected") always lands in `error`.
 */
export function useRequest() {
  const [state, setState] = useState({ status: 'idle', message: '', data: null });

  const run = useCallback(async (fn, successMessage) => {
    setState({ status: 'busy', message: '', data: null });
    try {
      const data = await fn();
      setState({ status: 'ok', message: typeof successMessage === 'function' ? successMessage(data) : successMessage, data });
      return true;
    } catch (err) {
      setState({ status: 'error', message: err.message || 'Something went wrong. Nothing was changed.', data: null });
      return false;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle', message: '', data: null }), []);
  return { ...state, busy: state.status === 'busy', run, reset };
}
