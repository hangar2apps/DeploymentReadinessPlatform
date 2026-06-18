// Commander data-chat panel — natural-language questions over readiness data.
// Posts to POST /api/commander/chat (mocked until backend lands). HIPAA: the
// backend returns categories + counts only, never names/clinical detail.

import { useEffect, useRef, useState } from 'react';
import { commanderChat } from '../../services/api';
import { Markdown } from '../ui/Markdown';

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
  // The question currently awaiting an answer. Rendered immediately so it shows
  // the moment "Ask" is clicked, not when the response lands.
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest question/answer in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns, pending]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    setPending(q);
    setLoading(true);
    try {
      // `turns` here is the conversation so far (before this question) — send it
      // as history so the backend can resolve references to earlier turns.
      const { answer } = await commanderChat(q, unitId, turns);
      setTurns((t) => [...t, { q, a: answer }]);
    } catch {
      setTurns((t) => [
        ...t,
        { q, a: 'Unable to reach the readiness assistant. Try again.' },
      ]);
    } finally {
      setLoading(false);
      setPending(null);
    }
  }

  function clear() {
    setTurns([]);
    setPending(null);
    setInput('');
  }

  const hasConversation = turns.length > 0 || pending !== null;

  return (
    <div className="flex h-full flex-col">
      {hasConversation && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={clear}
            disabled={loading}
            className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-danger disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {!hasConversation && (
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
              <div className="max-w-[90%] rounded-lg rounded-bl-sm border border-border bg-bg px-3 py-2 text-sm text-ink">
                <Markdown text={t.a} />
              </div>
            </div>
          </div>
        ))}
        {pending && (
          <div className="space-y-1.5">
            <div className="flex justify-end">
              <span className="max-w-[85%] rounded-lg rounded-br-sm bg-surface-2 px-3 py-1.5 text-sm text-ink">
                {pending}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              Analyzing readiness data…
            </div>
          </div>
        )}
      </div>

      {!hasConversation && (
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
