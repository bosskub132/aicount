"use client";

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  onChange: (value: string) => void;
  name: string;
}

export function RadioGroup({ options, value, onChange, name }: RadioGroupProps) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {options.map((option) => (
        <label key={option.value} className="inline-flex items-center gap-2 cursor-pointer">
          <span
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-100 ${
              value === option.value
                ? "border-[var(--primary)] bg-[var(--primary)]"
                : "border-[var(--border)] bg-white"
            }`}
          >
            {value === option.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span className="text-sm text-[var(--foreground)]">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
