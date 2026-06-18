import type { ReactNode } from 'react';

export function QuestionScreen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium leading-snug">{title}</h2>
      {children}
    </div>
  );
}
