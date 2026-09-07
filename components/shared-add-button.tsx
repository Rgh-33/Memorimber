"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Plus } from "lucide-react";

type SharedAddButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
};

/** Compact accent-colour add control shared by the group list and detail screen. */
export const SharedAddButton = forwardRef<HTMLButtonElement, SharedAddButtonProps>(function SharedAddButton(
  { label, className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-label={label}
      className={`group grid h-11 w-11 shrink-0 place-items-center rounded-full text-coral transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral active:scale-95 disabled:pointer-events-none disabled:opacity-45 ${className}`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-full border border-coral/25 bg-coral/5 transition group-hover:border-coral/45 group-hover:bg-coral/10">
        <Plus size={17} strokeWidth={1.8} aria-hidden="true" />
      </span>
    </button>
  );
});
