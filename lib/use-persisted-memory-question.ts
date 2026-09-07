"use client";
import { useEffect, useRef, useState } from "react";
import { createMemoryQuizQuestion } from "@/lib/quiz";
import { answerPersonalQuiz, startPersonalQuiz, type SavedQuestion } from "@/lib/personal-quiz";
import type { Memory } from "@/lib/types";
export function usePersistedMemoryQuestion(mode: "fruit" | "recall", memory: Memory, memories: Memory[]) {
  const [question, setQuestion] = useState(() => createMemoryQuizQuestion(memory, memories, "photo-to-caption"));
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const request = useRef<Promise<SavedQuestion[]> | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    request.current ??= startPersonalQuiz(mode, 1, memories, memory.id);
    void request.current.then((questions) => { if (active && questions[0]) { setQuestion(questions[0]); setReady(true); } }).catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [memory.id, memories, mode]);
  const answer = async (choice: string) => {
    if (!ready || busy.current) return false;
    busy.current = true;
    try { setQuestion(await answerPersonalQuiz(question.id, choice, memories)); setError(null); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "回答を保存できませんでした。"); return false; }
    finally { busy.current = false; }
  };
  return { question, error, ready, answer, setError };
}
