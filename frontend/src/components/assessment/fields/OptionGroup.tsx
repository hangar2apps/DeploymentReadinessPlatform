export function OptionGroup<T extends string | number | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md border px-4 py-2 text-sm transition-colors ${
            value === o.value
              ? 'border-accent bg-accent/10 text-ink'
              : 'border-border bg-surface hover:border-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
