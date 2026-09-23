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
  const [success, setSuccess] = useState(holdSuccess);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (holdSuccess) {
      setSuccess(true);
      return;
    }
    // When parent says no longer complete, drop sticky success.
    setSuccess(false);
  }, [holdSuccess]);

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
    if (!holdSuccess) setSuccess(false);
  }, [clearTimer, holdSuccess]);

  const flashSuccess = useCallback(() => {
    setPending(false);
    setSuccess(true);
    clearTimer();
    if (!holdSuccess) {
      timerRef.current = setTimeout(() => setSuccess(false), successMs);
    }
  }, [clearTimer, holdSuccess, successMs]);

  const fail = useCallback(
    (message: string) => {
      setPending(false);
      setSuccess(false);
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
