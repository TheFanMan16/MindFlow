import React, { useId } from 'react';

/**
 * Text inputs. Inset wells (--bg-inset, darker than canvas) so fields read
 * as ground; soft border that sharpens to --line-strong on hover and on
 * keyboard focus. THE focus ring itself is the global :focus-visible rule
 * in index.css - fields only ADD the border sharpen on top, and never
 * declare or suppress an outline of their own. Error swaps the border to
 * --negative and is announced through aria-invalid + aria-describedby
 * (wired by Field below), so the state never lives in color alone.
 * Disabled drops text, placeholder and border to the disabled tier - the
 * token is the treatment, not an opacity fade.
 */
const fieldClasses = (error) =>
  [
    'w-full rounded-sm border bg-inset px-3 py-2 text-body text-primary',
    'placeholder:text-tertiary',
    'transition-colors duration-micro',
    error
      ? 'border-negative'
      : 'border-line hover:border-strong focus-visible:border-strong',
    'disabled:pointer-events-none disabled:border-faint disabled:text-disabled disabled:placeholder:text-disabled',
  ].join(' ');

export const Label = ({ children, htmlFor, disabled = false, className = '' }) => (
  <label
    htmlFor={htmlFor}
    className={`text-label-sm ${disabled ? 'text-disabled' : 'text-secondary'} ${className}`}
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

/**
 * Label + control + error line, wired together for screen readers. When the
 * wrapped control is disabled the label and hint follow it into the
 * disabled tier, so the whole field reads inert - not just the well.
 */
export const Field = ({ label, error, hint, children, className = '' }) => {
  const id = useId();
  const control = React.Children.only(children);
  const disabled = Boolean(control.props.disabled);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <Label htmlFor={id} disabled={disabled}>
          {label}
        </Label>
      ) : null}
      {React.cloneElement(control, {
        id,
        error: Boolean(error),
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-negative">
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className={`text-body-sm ${disabled ? 'text-disabled' : 'text-secondary'}`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default Field;
