import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast, TOAST_MESSAGES } from '../../src/components/Toast.js';

describe('Toast and Shared Messages Component (F-09, R3-03, N-03)', () => {
  it('defines exact shared messages from requirements and architecture', () => {
    expect(TOAST_MESSAGES.SAVE_FAILED).toBe(
      'Could not save. Your changes are still shown here; try again.'
    );
    expect(TOAST_MESSAGES.CHECKLIST_TRUNCATED).toBe('Checklist item cut to 80 characters.');
  });

  it('renders message with aria-live="polite"', () => {
    render(<Toast message={TOAST_MESSAGES.SAVE_FAILED} />);
    const toast = screen.getByRole('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText(TOAST_MESSAGES.SAVE_FAILED)).toBeDefined();
  });

  it('invokes action and secondaryAction callbacks when clicked', () => {
    const onAction = vi.fn();
    const onSecondary = vi.fn();

    render(
      <Toast
        message={TOAST_MESSAGES.REJECTED_SAVE}
        actionText="Discard"
        onAction={onAction}
        secondaryActionText="Copy"
        onSecondaryAction={onSecondary}
      />
    );

    fireEvent.click(screen.getByText('Discard'));
    expect(onAction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Copy'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});