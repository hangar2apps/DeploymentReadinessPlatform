export interface NavSection {
  key: string;
  title: string;
  count: number;
  startIndex: number;
  complete: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function SectionNav({
  sections,
  step,
  completed,
  total,
  onJump,
}: {
  sections: NavSection[];
  step: number;
  completed: number;
  total: number;
  onJump: (startIndex: number) => void;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <nav className="space-y-2">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted">
        <span>Assessment progress</span>
        <span>{pct}% Completed</span>
      </div>

      <div className="flex gap-1">
        {sections.map((s) => {
          const active = step >= s.startIndex && step < s.startIndex + s.count;
          const fill = clamp((step + 1 - s.startIndex) / s.count);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onJump(s.startIndex)}
              title={s.title}
              style={{ flexGrow: s.count }}
              className={`min-w-0 basis-0 rounded-full ${
                active ? 'ring-2 ring-accent/40' : ''
              }`}
            >
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${fill * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
