import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  Badge,
  StatTile,
  Progress,
  ProgressRing,
  Tabs,
  EmptyState,
  SkeletonText,
  Staleness,
  stalenessRowClass,
} from './index';

describe('Button', () => {
  it('renders every variant and stays a real button', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
      const { unmount } = render(<Button variant={variant}>Go {variant}</Button>);
      const btn = screen.getByRole('button', { name: `Go ${variant}` });
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe('BUTTON');
      unmount();
    }
  });

  it('fires onClick, including when magnetic', () => {
    const onClick = vi.fn();
    render(
      <Button magnetic onClick={onClick}>
        Start
      </Button>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Nope' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('danger is the wash-fill destructive spec, never a solid red', () => {
    render(<Button variant="danger">Delete deck</Button>);
    const cls = screen.getByRole('button', { name: 'Delete deck' }).classList;
    expect(cls.contains('bg-negative-wash')).toBe(true);
    expect(cls.contains('text-negative')).toBe(true);
    expect(cls.contains('border-line')).toBe(true);
  });

  it('pressed uses accent-press on primary, bg-active everywhere else', () => {
    const { unmount } = render(<Button>Go</Button>);
    expect(
      screen.getByRole('button', { name: 'Go' }).classList.contains('active:bg-accent-press')
    ).toBe(true);
    unmount();
    for (const variant of ['secondary', 'ghost', 'danger']) {
      const { unmount: um } = render(<Button variant={variant}>Go</Button>);
      expect(
        screen.getByRole('button', { name: 'Go' }).classList.contains('active:bg-active')
      ).toBe(true);
      um();
    }
  });

  it('every size resolves to a 40px hit target', () => {
    // md and lg are natively tall enough.
    const { unmount } = render(<Button size="md">M</Button>);
    expect(screen.getByRole('button', { name: 'M' }).classList.contains('h-10')).toBe(true);
    unmount();
    // sm stays 32px visually and extends the hit area with a pseudo-element,
    // not extra height.
    render(<Button size="sm">S</Button>);
    const sm = screen.getByRole('button', { name: 'S' }).classList;
    expect(sm.contains('h-8')).toBe(true);
    expect(sm.contains('after:-inset-1')).toBe(true);
    expect(sm.contains('relative')).toBe(true); // anchors the extender
  });

  it('declares no local focus ring - the global :focus-visible rule owns focus', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
      const { unmount } = render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole('button', { name: 'Go' }).className).not.toMatch(/focus/);
      unmount();
    }
  });

  it('loading swaps to the in-progress verb, sets aria-busy and blocks activation', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button loading loadingLabel="Saving..." onClick={onClick}>
        Save
      </Button>
    );
    // The accessible name is the verb; the idle label is aria-hidden.
    const btn = screen.getByRole('button', { name: 'Saving...' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn.classList.contains('pointer-events-none')).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    // Stays focusable so keyboard users keep their place through the request.
    expect(btn).not.toBeDisabled();
    // No spinner glyph, nothing loops.
    expect(container.querySelector('svg')).toBeNull();
    expect(btn.className).not.toMatch(/animate-/);
  });

  it('loading holds width: both labels stay mounted in one grid cell', () => {
    const { rerender } = render(
      <Button loading loadingLabel="Saving..." >
        Save
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Saving...' });
    // The hidden sibling still sizes the button, so width never jitters.
    expect(btn.textContent).toContain('Save');
    expect(btn.textContent).toContain('Saving...');
    // Back at rest the verb goes aria-hidden and the real label names the button.
    rerender(<Button loadingLabel="Saving...">Save</Button>);
    const idle = screen.getByRole('button', { name: 'Save' });
    expect(idle).not.toHaveAttribute('aria-busy');
    expect(idle.classList.contains('pointer-events-none')).toBe(false);
  });
});

describe('Field', () => {
  it('wires label, control and error for screen readers', () => {
    render(
      <Field label="Deck name" error="Required">
        <Input placeholder="name" />
      </Field>
    );
    const input = screen.getByLabelText('Deck name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(input.getAttribute('aria-describedby')).toBe(
      screen.getByText('Required').getAttribute('id')
    );
    // Error also swaps the border to the negative token, so the state is
    // announced AND visible - never color alone, never aria alone.
    expect(input.classList.contains('border-negative')).toBe(true);
  });

  it('carries no aria-invalid at rest and describes by the hint instead', () => {
    const { rerender } = render(
      <Field label="Minutes" hint="1 to 180">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText('Minutes');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input.getAttribute('aria-describedby')).toBe(
      screen.getByText('1 to 180').getAttribute('id')
    );
    // The error line replaces the hint - one description at a time.
    rerender(
      <Field label="Minutes" hint="1 to 180" error="Must be 1 to 180">
        <Input />
      </Field>
    );
    expect(screen.queryByText('1 to 180')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Minutes').getAttribute('aria-describedby')).toBe(
      screen.getByText('Must be 1 to 180').getAttribute('id')
    );
  });

  it('a disabled control pulls its label and hint into the disabled tier', () => {
    render(
      <Field label="Volume" hint="0 to 100">
        <Input disabled />
      </Field>
    );
    expect(screen.getByText('Volume').classList.contains('text-disabled')).toBe(true);
    expect(screen.getByText('0 to 100').classList.contains('text-disabled')).toBe(true);
  });
});

describe('Staleness', () => {
  // Injected clock so tier boundaries are deterministic.
  const NOW = new Date('2026-08-11T12:00:00Z');
  const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  it.each([
    // [days, label, textClass, hasDot]
    [1, 'yesterday', 'text-tertiary', false], // fresh: under 2 days
    [4, '4 days', 'text-secondary', false], // recent: 2-7 days
    [14, '2 weeks', 'text-secondary', true], // aging: 7-30 days + accent dot
    [45, '1 month', 'text-accent', true], // stale: 30-90 days, accent text
    [173, '6 months', 'text-accent', true], // dormant: over 90 days
  ])('renders the %s-day tier as "%s"', (days, label, textClass, hasDot) => {
    const { container } = render(<Staleness at={daysAgo(days)} now={NOW} prefix="reviewed" />);
    const span = container.firstChild;
    expect(span.textContent).toBe(`reviewed ${label}`);
    expect(span.classList.contains(textClass)).toBe(true);
    // The dot appears from aging up, so escalation never rides on color alone.
    expect(container.querySelector('.bg-accent') !== null).toBe(hasDot);
    // The absolute date lives in the title for anyone who needs the exact day.
    expect(span.getAttribute('title')).toMatch(/^Last touched /);
  });

  it('never prints a raw day count past a week', () => {
    for (const days of [8, 42, 173]) {
      const { container, unmount } = render(<Staleness at={daysAgo(days)} now={NOW} />);
      expect(container.textContent).not.toMatch(/\d+\s*d(ays)?\b/);
      expect(container.textContent).not.toMatch(/ago/);
      unmount();
    }
  });

  it('renders the caller-owned never-copy when there is no timestamp', () => {
    render(<Staleness at={null} never="never opened" />);
    expect(screen.getByText('never opened')).toBeInTheDocument();
  });

  it('stalenessRowClass washes only dormant rows', () => {
    expect(stalenessRowClass('dormant')).toBe('bg-accent-wash');
    for (const tier of ['fresh', 'recent', 'aging', 'stale', null]) {
      expect(stalenessRowClass(tier)).toBe('');
    }
  });
});

describe('Progress', () => {
  it('renders the two-segment deck-row spec on a bg-inset track', () => {
    render(<Progress value={0.5} secondaryValue={0.3} label="Deck mastery" />);
    const bar = screen.getByRole('progressbar', { name: 'Deck mastery' });
    expect(bar.classList.contains('bg-inset')).toBe(true);
    expect(bar.classList.contains('h-0.5')).toBe(true); // the 2px spec
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    // Both figures spelled out, so the split never lives in color alone.
    expect(bar).toHaveAttribute('aria-valuetext', '50% complete, 30% in progress');
    const [mastered, inProgress] = bar.children;
    expect(mastered.style.transform).toBe('scaleX(0.5)');
    expect(inProgress).toHaveAttribute('aria-hidden', 'true');
    // The in-progress segment starts exactly where the mastered fill ends.
    expect(inProgress.style.transform).toBe('translateX(50%) scaleX(0.3)');
  });

  it('omits the second segment and valuetext in single-fraction mode', () => {
    render(<Progress value={0.4} label="Session" />);
    const bar = screen.getByRole('progressbar', { name: 'Session' });
    expect(bar).not.toHaveAttribute('aria-valuetext');
    expect(bar.children).toHaveLength(1);
  });

  it('clamps the in-progress segment to the space the mastered fill leaves', () => {
    render(<Progress value={0.8} secondaryValue={0.5} label="Clamp" />);
    expect(screen.getByRole('progressbar', { name: 'Clamp' })).toHaveAttribute(
      'aria-valuetext',
      '80% complete, 20% in progress'
    );
  });
});

describe('Modal', () => {
  const TrapFixture = ({ open, onClose = () => {} }) => (
    <>
      <button>opener</button>
      <Modal open={open} onClose={onClose} title="Delete this deck?">
        <button>Delete</button>
        <button data-initial-focus>Cancel</button>
      </Modal>
    </>
  );

  it('opens, closes on Escape, and portals out of transformed ancestors', () => {
    const onClose = vi.fn();
    const { container } = render(
      <div style={{ transform: 'translateY(4px)' }}>
        <Modal open onClose={onClose} title="Delete this deck?">
          content
        </Modal>
      </div>
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete this deck?' });
    // Portaled to document.body: fixed positioning must escape the
    // PageTransition transform context or modals pin to the page, not the
    // viewport.
    expect(container.contains(dialog)).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        x
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('focuses [data-initial-focus], traps Tab at both ends, restores on close', async () => {
    const { rerender } = render(<TrapFixture open={false} />);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();

    rerender(<TrapFixture open />);
    // Initial focus lands on the LEAST destructive control, not the first.
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());

    // Tab from the last focusable wraps to the first...
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    // ...and Shift+Tab from the first wraps back to the last.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(cancel).toHaveFocus();

    // Closing hands focus back to whatever opened the dialog.
    rerender(<TrapFixture open={false} />);
    expect(opener).toHaveFocus();
  });

  it('does not yank focus back when the parent re-renders while open', async () => {
    const { rerender } = render(<TrapFixture open />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    const del = screen.getByRole('button', { name: 'Delete' });
    del.focus();
    // A confirm flow flipping into its loading state re-renders with a new
    // onClose; the focus effect must not re-run and snap back to Cancel.
    rerender(<TrapFixture open onClose={vi.fn()} />);
    expect(del).toHaveFocus();
  });
});

describe('Tabs', () => {
  it('is a controlled tablist and reports selection', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { value: 'a', label: 'Pomodoro' },
          { value: 'b', label: 'Break' },
        ]}
        value="a"
        onChange={onChange}
      />
    );
    expect(screen.getByRole('tab', { name: 'Pomodoro' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Break' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('EmptyState', () => {
  it('is one sentence naming the gap plus the one action that resolves it', () => {
    render(
      <EmptyState
        title="You have no decks yet."
        action={<Button variant="secondary">Create a deck</Button>}
      />
    );
    expect(screen.getByText('You have no decks yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a deck' })).toBeInTheDocument();
  });

  it('refuses more than one resolving action', () => {
    // A row of choices is a menu, not an empty state - React.Children.only
    // enforces the single-action contract at render time. React dev mode
    // reports the render throw through console.error AND a window error
    // event (which jsdom prints); silence both so the intentional throw
    // does not read as a failure in the run output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e) => e.preventDefault();
    window.addEventListener('error', swallow);
    try {
      expect(() =>
        render(
          <EmptyState
            title="No cards due."
            action={[<button key="a">Study anyway</button>, <button key="b">Browse</button>]}
          />
        )
      ).toThrow();
    } finally {
      window.removeEventListener('error', swallow);
      spy.mockRestore();
    }
  });
});

describe('data display', () => {
  it('StatTile renders label, mono value and delta', () => {
    render(<StatTile label="Focus minutes" value={240} unit="min" delta={12} />);
    expect(screen.getByText('Focus minutes')).toBeInTheDocument();
    expect(screen.getByText('240')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('ProgressRing exposes its value to assistive tech', () => {
    render(<ProgressRing value={0.6} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
  });

  it('Badge renders status and feature tints', () => {
    render(
      <>
        <Badge variant="success">On track</Badge>
        <Badge feature="focus">Focus</Badge>
      </>
    );
    expect(screen.getByText('On track')).toBeInTheDocument();
    expect(screen.getByText('Focus')).toBeInTheDocument();
  });

  it('Card, EmptyState and SkeletonText render', () => {
    render(
      <Card>
        <EmptyState title="No cards due" description="All scheduled." />
        <SkeletonText lines={2} />
      </Card>
    );
    expect(screen.getByText('No cards due')).toBeInTheDocument();
  });
});
