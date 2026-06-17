const OPTIONS = [
  { v: true, t: 'Yes' },
  { v: false, t: 'No' },
] as const;

export function YesNo({
  value,
  onChange,
}: {
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ v, t }) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 rounded-md border px-4 py-2 text-sm transition-colors ${
            value === v
              ? 'border-accent bg-accent/10 text-ink'
              : 'border-border bg-surface hover:border-muted'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
