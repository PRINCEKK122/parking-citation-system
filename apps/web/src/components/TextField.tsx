import { useId, type InputHTMLAttributes, type Ref } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  /** Error message; when set, the input is marked invalid and points at it. */
  error?: string;
  optional?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** A labelled input with hint and error wired up through aria-describedby. */
export function TextField({
  label,
  hint,
  error,
  optional,
  className,
  ref,
  ...input
}: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-err` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional ? <span className="field__optional"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        ref={ref}
        className={["input", className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...input}
      />
      {error ? (
        <p id={errorId} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
