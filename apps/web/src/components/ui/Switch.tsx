'use client';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What the switch controls, for screen readers. */
  label: string;
  disabled?: boolean;
};

/** An on/off switch. It is a button, so it works with the keyboard like one. */
export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="switch"
    />
  );
}
