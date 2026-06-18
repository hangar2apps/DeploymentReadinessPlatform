// One-question-per-screen Likert picker, used for every PHQ-9 and PCL-5 item.
// One question per screen is a deliberate privacy/focus choice for the mental-
// health screens (frontend-derrick.md §1). Large tap targets — mobile-first.

import { useEffect } from 'react';
import type { ScaleOption } from '../../lib/questionnaire';

export function ScaleQuestion({
  prompt,
  question,
  options,
  value,
  onChange,
}: {
  prompt: string; // shared stem, e.g. "Over the last 2 weeks…"
  question: string; // the specific item text
  options: ScaleOption[];
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      let shortcut: number | null = null;
      if (/^[1-9]$/.test(event.key)) shortcut = Number(event.key);
      if (/^Numpad[1-9]$/.test(event.code)) shortcut = Number(event.code.slice(-1));

      if (!shortcut || shortcut > options.length) return;

      event.preventDefault();
      onChange(options[shortcut - 1].value);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onChange, options]);

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {prompt}
        </p>
        <h2 className="mt-2 text-lg font-medium leading-snug">{question}</h2>
        <p className="mt-2 text-xs text-muted">
          Use number keys{' '}
          <span className="font-mono text-ink">1-{options.length}</span> to answer.
        </p>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label={question}>
        {options.map((opt, index) => {
          const selected = value === opt.value;
          const shortcut = index + 1;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                selected
                  ? 'border-accent bg-accent/10 text-ink'
                  : 'border-border bg-surface hover:border-muted'
              }`}
            >
              <span>{opt.label}</span>
              <span
                className={`font-mono text-xs ${
                  selected ? 'text-accent' : 'text-muted'
                }`}
              >
                {shortcut}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
