import { controlClass } from './fieldStyles';

export function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
