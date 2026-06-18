import { controlClass } from './fieldStyles';

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function DateInput({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  max?: string;
}) {
  const maxDate = max ?? todayISO();
  return (
    <input
      type="date"
      value={value}
      max={maxDate}
      onChange={(e) => {
        const v = e.target.value;
        if (!v || v <= maxDate) onChange(v);
      }}
      onClick={(e) => {
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* showPicker needs a user gesture */
        }
      }}
      className={`${controlClass} cursor-pointer hover:border-accent [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0`}
    />
  );
}
