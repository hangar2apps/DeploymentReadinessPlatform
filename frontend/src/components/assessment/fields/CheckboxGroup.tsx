export function CheckboxGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="space-y-2">
      {options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              checked
                ? 'border-accent bg-accent/10 text-ink'
                : 'border-border bg-surface hover:border-muted'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border font-mono text-[10px] ${
                checked ? 'border-accent bg-accent text-bg' : 'border-muted'
              }`}
            >
              {checked ? '✓' : ''}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
