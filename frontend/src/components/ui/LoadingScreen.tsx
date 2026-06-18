const TURN_IS_LEFT_HOME_GIF =
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWs0ZjFvdmxjcTI4Mzl5aW00a3FyeWE5cGRmdDQ4dW5wajV3aHN0ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/plhCkYO7XqwkE/giphy.gif';

type LoadingScreenProps = {
  detail?: string;
  message?: string;
  variant?: 'page' | 'panel';
};

export function LoadingScreen({
  detail = 'Syncing the latest records.',
  message = 'Loading the dashboard...',
  variant = 'page',
}: LoadingScreenProps) {
  const compact = variant === 'panel';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center rounded-2xl border border-border bg-surface/80 text-center ${
        compact ? 'min-h-56 gap-4 px-6 py-8' : 'min-h-[60vh] gap-5 px-6 py-10'
      }`}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/15 blur-3xl" />
        <img
          src={TURN_IS_LEFT_HOME_GIF}
          alt="Animated loading indicator"
          className={`relative rounded-2xl border border-border object-cover shadow-2xl ${
            compact ? 'h-28 w-28' : 'h-40 w-40'
          }`}
        />
      </div>
      <div className="space-y-1.5">
        <p className={`${compact ? 'text-base' : 'text-xl'} font-semibold text-ink`}>
          {message}
        </p>
        <p className="max-w-md text-sm text-muted">{detail}</p>
      </div>
    </div>
  );
}
