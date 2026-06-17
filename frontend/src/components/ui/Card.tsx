import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          {title && (
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
