"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ProcessingContextValue = {
  isProcessing: boolean;
  startProcessing: () => void;
  stopProcessing: () => void;
};

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopProcessing = useCallback(() => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = null;
    setIsProcessing(false);
  }, []);

  const startProcessing = useCallback(() => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    setIsProcessing(true);
    safetyTimerRef.current = setTimeout(() => {
      safetyTimerRef.current = null;
      setIsProcessing(false);
    }, 8000);
  }, []);

  useEffect(() => () => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
  }, []);

  const value = useMemo(
    () => ({ isProcessing, startProcessing, stopProcessing }),
    [isProcessing, startProcessing, stopProcessing],
  );

  return <ProcessingContext.Provider value={value}>{children}</ProcessingContext.Provider>;
}

export function useProcessing() {
  const value = useContext(ProcessingContext);
  if (!value) throw new Error("useProcessing must be used within ProcessingProvider");
  return value;
}
