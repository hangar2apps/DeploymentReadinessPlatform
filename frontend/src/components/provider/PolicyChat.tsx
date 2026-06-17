// Provider policy assistant — RAG over the ingested DoD deployment-health policy
// docs. Posts to POST /api/policy-chat and renders the answer with its source
// citations (document name + similarity). Mirrors CommanderChat's shape; the real
// endpoint returns answer + sources (non-streaming for now).

import { useState } from 'react';
import { policyChat } from '../../services/api';
import type { PolicyChatSource } from '../../types/drp';

interface Turn {
  q: string;
  a: string;
  sources: PolicyChatSource[];
}

const SUGGESTIONS = [
  'What dental class blocks deployment?',
  'What PCL-5 score indicates probable PTSD?',
  'How long is a PHA valid?',
];

export function PolicyChat() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);
    try {
      const { answer, sources } = await policyChat(q);
      setTurns((t) => [...t, { q, a: answer, sources: sources ?? [] }]);
    } catch {
      setTurns((t) => [
        ...t,
        { q, a: 'Unable to reach the policy assistant. Try again.', sources: [] },
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
            Ask about DoD deployment-health policy — answers are grounded in the
            ingested source documents and cited, so there's no PDF hunting.
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
              <div className="max-w-[90%] space-y-2 rounded-lg rounded-bl-sm border border-border bg-bg px-3 py-2">
                <p className="text-sm leading-snug text-ink">{t.a}</p>
                {t.sources.length > 0 && (
                  <div className="space-y-1 border-t border-border/60 pt-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      Sources
                    </p>
                    {t.sources.map((s, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="min-w-0 truncate text-muted">
                          {s.document_name}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums text-accent">
                          {(s.similarity_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            Searching policy documents…
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
          placeholder="Ask about deployment-health policy…"
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
