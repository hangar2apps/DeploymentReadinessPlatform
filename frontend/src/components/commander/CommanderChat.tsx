// Commander data-chat panel — natural-language questions over readiness data.
// Posts to POST /api/commander/chat (mocked until backend lands). HIPAA: the
// backend returns categories + counts only, never names/clinical detail.

import { useState } from 'react';
import { commanderChat } from '../../services/api';

interface Turn {
  q: string;
  a: string;
}

const SUGGESTIONS = [
  'Why did Bravo drop?',
  'How many soldiers are non-deployable for dental?',
  'Give me a CUB readiness summary',
];

export function CommanderChat({ unitId }: { unitId: string }) {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);
    try {
      const { answer } = await commanderChat(q, unitId);
      setTurns((t) => [...t, { q, a: answer }]);
    } catch {
      setTurns((t) => [
        ...t,
        { q, a: 'Unable to reach the readiness assistant. Try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {turns.length === 0 && !loading && (
          <p className="text-sm text-muted">
            Ask about readiness in plain language. Answers are grounded in current
            unit data — categories and counts only, no PHI.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-end">
              <span className="max-w-[85%] rounded-lg rounded-br-sm bg-surface-2 px-3 py-1.5 text-sm text-ink">
                {t.q}
              </span>
            </div>
            <div className="flex justify-start">
              <span className="max-w-[90%] rounded-lg rounded-bl-sm border border-border bg-bg px-3 py-2 text-sm text-ink">
                {t.a}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            Analyzing readiness data…
          </div>
        )}
      </div>

      {turns.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about unit readiness…"
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
