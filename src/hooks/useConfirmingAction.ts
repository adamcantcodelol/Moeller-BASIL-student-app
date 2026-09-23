"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_SUCCESS_MS = 2500;

/**
 * Pending → success flash for Save / Mark-complete buttons.
 * Call `flashSuccess()` after a successful mutation; success clears after a few seconds
 * unless `holdSuccess` is true (e.g. module already marked complete).
 */
export function useConfirmingAction(options?: {
  successMs?: number;
  holdSuccess?: boolean;
}) {
  const successMs = options?.successMs ?? DEFAULT_SUCCESS_MS;
  const holdSuccess = options?.holdSuccess ?? false;
  const [pending, setPending] = useState(false);
  const [flashedSuccess, setFlashedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sticky green when parent says already complete — derived, no effect setState.
  const success = holdSuccess || flashedSuccess;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    clearTimer();
    setPending(true);
    setError(null);
    if (!holdSuccess) setFlashedSuccess(false);
  }, [clearTimer, holdSuccess]);

  const flashSuccess = useCallback(() => {
    setPending(false);
    setFlashedSuccess(true);
    clearTimer();
    if (!holdSuccess) {
      timerRef.current = setTimeout(() => setFlashedSuccess(false), successMs);
    }
  }, [clearTimer, holdSuccess, successMs]);

  const fail = useCallback(
    (message: string) => {
      setPending(false);
      setFlashedSuccess(false);
      setError(message);
      clearTimer();
    },
    [clearTimer],
  );

  const buttonClassName = [
    pending ? "btn-confirming" : "",
    success ? "btn-success" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    pending,
    success,
    error,
    setError,
    begin,
    flashSuccess,
    fail,
    buttonClassName,
  };
}
