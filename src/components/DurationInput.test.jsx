import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DurationInput from './DurationInput';

// fireEvent rather than user-event: user-event is not an approved dependency.
// Each fireEvent.change below is one keystroke's resulting field value, which
// is exactly the sequence that broke the old per-keystroke clamp.
function setup(props = {}) {
  const onCommit = vi.fn();
  render(
    <DurationInput
      label="Pomodoro Duration (minutes)"
      value={25}
      min={1}
      max={120}
      onCommit={onCommit}
      {...props}
    />
  );
  // getByRole rather than a label regex: the +/- steppers carry
  // "Decrease/Increase <label>" aria-labels, so a /Duration/ regex now
  // matches three controls. The number input is the only spinbutton.
  return { onCommit, input: screen.getByRole('spinbutton') };
}

/** Types a string one character at a time, as a real user would. */
function typeSequence(input, text) {
  let soFar = '';
  for (const char of text) {
    soFar += char;
    fireEvent.change(input, { target: { value: soFar } });
  }
}

describe('DurationInput', () => {
  it('shows the current value', () => {
    const { input } = setup();
    expect(input).toHaveValue(25);
  });

  it('does not commit while the user is still typing', () => {
    const { input, onCommit } = setup();

    typeSequence(input, '45');

    // The old inline version clamped and committed on every keystroke.
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('turns a negative entry into the minimum, not the maximum', () => {
    // The reported bug: typing -5 saved 120. The old controlled input rewrote
    // the intermediate "-" to "25", so the next keystroke produced "255",
    // which then clamped upward to the maximum.
    const { input, onCommit } = setup();

    typeSequence(input, '-5');
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(1);
    expect(onCommit).not.toHaveBeenCalledWith(120);
  });

  it('clamps an oversized entry down to the maximum', () => {
    const { input, onCommit } = setup();

    typeSequence(input, '99999');
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(120);
  });

  it('respects a different maximum', () => {
    const { input, onCommit } = setup({
      label: 'Short Break Duration (minutes)',
      value: 5,
      max: 60,
    });

    typeSequence(input, '99999');
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(60);
  });

  it('tells the user when it adjusted the value', () => {
    const { input } = setup();

    typeSequence(input, '500');
    fireEvent.blur(input);

    // Previously the value was silently rewritten with no feedback at all.
    expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and 120/i);
  });

  it('says nothing when the value was acceptable', () => {
    const { input, onCommit } = setup();

    typeSequence(input, '45');
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(45);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('restores the previous value when the field is left empty', () => {
    const { input, onCommit } = setup();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    // Must not invent a default the user never chose.
    expect(input).toHaveValue(25);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits on Enter as well as blur', () => {
    const { input, onCommit } = setup();

    typeSequence(input, '30');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith(30);
  });

  it('accepts the boundary values themselves', () => {
    const { input, onCommit } = setup();

    typeSequence(input, '1');
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(1);

    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(120);
  });

  it('follows an externally changed value', () => {
    const { input } = setup();
    expect(input).toHaveValue(25);

    // e.g. settings edited in another tab
    render(
      <DurationInput label="Other" value={50} min={1} max={120} onCommit={vi.fn()} />
    );
    // Exact string: "Decrease Other" / "Increase Other" (the steppers) must
    // not match, only the labelled input itself.
    expect(screen.getByLabelText('Other')).toHaveValue(50);
  });

  it('steps the value and commits immediately', () => {
    const { input, onCommit } = setup();

    fireEvent.click(screen.getByRole('button', { name: /Increase/i }));

    // A stepper click is already commit-shaped intent - no blur needed.
    expect(onCommit).toHaveBeenCalledWith(26);
    expect(input).toHaveValue(26);
  });

  it('steps from the draft the user is mid-way through typing', () => {
    const { input, onCommit } = setup();

    typeSequence(input, '40');
    fireEvent.click(screen.getByRole('button', { name: /Decrease/i }));

    expect(onCommit).toHaveBeenCalledWith(39);
  });

  it('disables the steppers at the bounds', () => {
    setup({ value: 1 });
    expect(screen.getByRole('button', { name: /Decrease/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Increase/i })).toBeEnabled();
  });

  it('flags an out-of-range draft for assistive tech while typing', () => {
    const { input } = setup();

    typeSequence(input, '500');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    fireEvent.blur(input);
    // Committed value is clamped into range, so the flag clears and the
    // notice explains the adjustment instead.
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input.getAttribute('aria-describedby')).toBe(
      screen.getByRole('alert').getAttribute('id')
    );
  });
});
