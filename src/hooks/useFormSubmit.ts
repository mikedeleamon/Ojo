import { useState, useCallback } from 'react';
import { hapticSuccess, hapticError } from '../lib/haptics';

export type SubmitStatus = { type: 'success' | 'error'; msg: string } | null;

interface UseFormSubmitResult {
  status:   SubmitStatus;
  loading:  boolean;
  submit:   (fn: () => Promise<void>) => Promise<void>;
  clearStatus: () => void;
}

/**
 * Handles the loading flag, success/error status, and try/catch boilerplate
 * shared across every AccountPage form tab.
 *
 * Usage:
 *   const { status, loading, submit } = useFormSubmit();
 *   await submit(async () => { await axios.put(...) });
 */
export const useFormSubmit = (successMsg: string, autoResetMs = 0): UseFormSubmitResult => {
  const [status,  setStatus]  = useState<SubmitStatus>(null);
  const [loading, setLoading] = useState(false);

  const clearStatus = useCallback(() => setStatus(null), []);

  const submit = useCallback(async (fn: () => Promise<void>) => {
    setStatus(null);
    setLoading(true);
    try {
      await fn();
      setStatus({ type: 'success', msg: successMsg });
      hapticSuccess();
      if (autoResetMs > 0) {
        setTimeout(() => setStatus(null), autoResetMs);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Something went wrong. Please try again.';
      setStatus({ type: 'error', msg });
      hapticError();
    } finally {
      setLoading(false);
    }
  }, [successMsg, autoResetMs]);

  return { status, loading, submit, clearStatus };
};
