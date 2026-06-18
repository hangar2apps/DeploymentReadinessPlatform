import { Fragment, type ReactNode } from 'react';

// Minimal Markdown renderer for chat answers. The model only emits a small
// subset — **bold** and '- '/'* ' bullet lists (occasionally nested) — so we
// render just that rather than pulling in a full markdown library. Anything we
// don't special-case falls through as plain text.

// Split a line on **bold** spans. String.split with a capturing group keeps the
// captures in the result, so odd indices are the bolded segments.
function renderInline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((segment, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-ink">
        {segment}
      </strong>
    ) : (
      <Fragment key={i}>{segment}</Fragment>
    ),
  );
}

// Leading whitespace + a '-' or '*' marker + at least one space.
const BULLET = /^(\s*)[-*]\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: { depth: number; content: string }[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-0.5">
        {items.map((b, i) => (
          <li
            key={i}
            className="flex gap-2"
            style={{ paddingLeft: `${b.depth * 0.85}rem` }}
          >
            <span className="select-none text-muted">•</span>
            <span className="min-w-0 flex-1">{renderInline(b.content)}</span>
          </li>
        ))}
      </ul>,
    );
  };

  lines.forEach((line) => {
    const match = line.match(BULLET);
    if (match) {
      // Two spaces (or a tab) of indent = one nesting level.
      const indent = match[1].replace(/\t/g, '  ').length;
      bullets.push({ depth: Math.floor(indent / 2), content: match[2] });
      return;
    }
    flushBullets();
    if (line.trim() === '') {
      blocks.push(<div key={`sp-${blocks.length}`} className="h-2" />);
    } else {
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
    }
  });
  flushBullets();

  return <div className="space-y-1">{blocks}</div>;
}
