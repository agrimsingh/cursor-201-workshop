"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Modal built on the native <dialog> element. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-full max-w-md rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </p>
  );
}
