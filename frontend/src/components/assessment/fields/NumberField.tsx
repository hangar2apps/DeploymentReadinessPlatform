import { controlClass } from './fieldStyles';

export function NumberField({
  value,
  onChange,
  min = 0,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === '' ? undefined : Math.max(min, Number(raw)));
      }}
      className={controlClass}
    />
  );
}
