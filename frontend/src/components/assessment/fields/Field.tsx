import type { ReactNode } from 'react';

// A plain <div>, NOT a <label>: these fields often hold a group of buttons
// (Yes/No, option pickers), and a <label> forwards clicks anywhere in its area
// to the FIRST control inside it — so clicking near one option would activate a
// different one.
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}
