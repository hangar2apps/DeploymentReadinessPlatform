// Provider policy assistant — RAG over the ingested DoD deployment-health policy
// docs. Posts to POST /api/policy-chat and renders the answer (markdown) with its
// source citations (document name + similarity). The real endpoint returns
// answer + sources (non-streaming for now).

import { useEffect, useRef, useState } from 'react';
import { policyChat } from '../../services/api';
import type { PolicyChatSource } from '../../types/drp';
import { Markdown } from '../ui/Markdown';

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

// Collapse retrieved chunks to one entry per document (keeping the best match)
// so the citation line stays compact — RAG often returns several chunks from the
// same PDF.
function dedupeSources(sources: PolicyChatSource[]): PolicyChatSource[] {
  const best = new Map<string, PolicyChatSource>();
  for (const s of sources) {
    const cur = best.get(s.document_name);
    if (!cur || s.similarity_score > cur.similarity_score) {
      best.set(s.document_name, s);
    }
  }
  return [...best.values()].sort(
    (a, b) => b.similarity_score - a.similarity_score,
  );
}

export function PolicyChat() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  // The question currently awaiting an answer — rendered immediately so it shows
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
      const { answer, sources } = await policyChat(q);
      setTurns((t) => [...t, { q, a: answer, sources: sources ?? [] }]);
    } catch {
      setTurns((t) => [
        ...t,
        { q, a: 'Unable to reach the policy assistant. Try again.', sources: [] },
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
              <div className="max-w-[90%] space-y-2 rounded-lg rounded-bl-sm border border-border bg-bg px-3 py-2 text-sm text-ink">
                <Markdown text={t.a} />
                {t.sources.length > 0 && (
                  <p className="border-t border-border/60 pt-1.5 text-[11px] leading-snug text-muted">
                    <span className="font-mono uppercase tracking-wider">
                      Sources:{' '}
                    </span>
                    {dedupeSources(t.sources).map((s, j) => (
                      <span key={j}>
                        {j > 0 && '; '}
                        {s.document_name}{' '}
                        <span className="font-mono tabular-nums text-accent">
                          {(s.similarity_score * 100).toFixed(0)}%
                        </span>
                      </span>
                    ))}
                  </p>
                )}
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
              Searching policy documents…
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
