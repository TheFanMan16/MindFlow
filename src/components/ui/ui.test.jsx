import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  Badge,
  StatTile,
  ProgressRing,
  Tabs,
  EmptyState,
  SkeletonText,
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
    expect(screen.getByRole('button', { name: 'Nope' })).toBeDisabled();
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
  });
});

describe('Modal', () => {
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
