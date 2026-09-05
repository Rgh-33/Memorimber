"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  tone?: "primary" | "secondary" | "danger";
  className?: string;
};

const toneClasses = {
  primary: "accent-gradient text-white",
  secondary: "border border-line bg-ivory text-ink hover:border-coral",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:border-red-300",
};

export function SharedGroupSubmitButton({
  children,
  pendingLabel = "処理中…",
  tone = "primary",
  className = "",
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-xl px-4 py-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClasses[tone]} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
