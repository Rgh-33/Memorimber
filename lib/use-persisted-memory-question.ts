"use client";
import { useEffect, useRef, useState } from "react";
import { createMemoryQuizQuestion } from "@/lib/quiz";
import { answerPersonalQuiz, startPersonalQuiz, type SavedQuestion } from "@/lib/personal-quiz";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isUuid } from "@/lib/supabase/shared-albums";
import type { Memory } from "@/lib/types";
export function usePersistedMemoryQuestion(mode: "fruit" | "recall", memory: Memory, memories: Memory[]) {
  const persistQuestion = isSupabaseConfigured() && isUuid(memory.id);
  const [question, setQuestion] = useState(() => createMemoryQuizQuestion(memory, memories, "photo-to-caption"));
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const request = useRef<Promise<SavedQuestion[]> | null>(null);
  const requestKey = useRef<string | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    const nextRequestKey = `${mode}:${memory.id}`;
    if (requestKey.current !== nextRequestKey) {
      requestKey.current = nextRequestKey;
      request.current = null;
      setQuestion(createMemoryQuizQuestion(memory, memories, "photo-to-caption"));
    }
    if (!persistQuestion) {
      setError(null);
      setReady(true);
      return () => { active = false; };
    }
    setReady(false);
    request.current ??= startPersonalQuiz(mode, 1, memories, memory.id);
    void request.current.then((questions) => { if (active && questions[0]) { setQuestion(questions[0]); setReady(true); } }).catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [memory, memory.id, memories, mode, persistQuestion]);
  const answer = async (choice: string) => {
    if (!ready || busy.current) return false;
    if (!persistQuestion) {
      setError(null);
      return true;
    }
    busy.current = true;
    try { setQuestion(await answerPersonalQuiz(question.id, choice, memories)); setError(null); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "回答を保存できませんでした。"); return false; }
    finally { busy.current = false; }
  };
  return { question, error, ready, answer, setError };
}
