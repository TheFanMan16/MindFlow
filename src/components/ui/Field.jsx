import React, { useId } from 'react';

/**
 * Text inputs. Inset wells (--bg-inset, darker than canvas) so fields read
 * ground), soft border, visible focus: border sharpens to strong plus a 2px
 * accent ring at 40% opacity. Error state swaps the ring for danger.
 */
const fieldClasses = (error) =>
  [
    'w-full rounded-sm border bg-inset px-3 py-2 text-body text-primary',
    'placeholder:text-tertiary',
    'transition-colors duration-150',
    'focus:outline-none focus-visible:outline-none focus:ring-2',
    error
      ? 'border-danger-line focus:border-danger focus:ring-danger-wash'
      : 'border-line hover:border-strong focus:border-strong focus:ring-accent-ring',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' ');

export const Label = ({ children, htmlFor, className = '' }) => (
  <label
    htmlFor={htmlFor}
    className={`text-label-sm text-secondary ${className}`}
  >
    {children}
  </label>
);

export const Input = ({ error = false, className = '', ...rest }) => (
  <input className={`${fieldClasses(error)} h-9 ${className}`} {...rest} />
);

export const Textarea = ({ error = false, className = '', rows = 4, ...rest }) => (
  <textarea rows={rows} className={`${fieldClasses(error)} resize-y ${className}`} {...rest} />
);

/** Label + control + error line, wired together for screen readers. */
export const Field = ({ label, error, hint, children, className = '' }) => {
  const id = useId();
  const control = React.Children.only(children);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {React.cloneElement(control, {
        id,
        error: Boolean(error),
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-body-sm text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default Field;
