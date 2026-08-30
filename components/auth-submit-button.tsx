"use client";

import { useFormStatus } from "react-dom";

export function AuthSubmitButton({ children, disabled = false }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="accent-gradient mt-5 w-full rounded-xl px-4 py-3.5 text-sm font-semibold tracking-[0.08em] text-white shadow-sm transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? "処理中…" : children}
    </button>
  );
}
