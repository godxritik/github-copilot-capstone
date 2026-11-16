import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../../src/components/ConfirmDialog.js';

describe('ConfirmDialog Component (F-10, FR-05, NFR-06)', () => {
  it('renders modal dialog when isOpen is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Delete Note')).toBeDefined();
    expect(screen.getByText('Are you sure you want to delete this note?')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Delete Note"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete"
        message="Confirm delete"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm only when Confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete"
        message="Confirm delete"
        confirmLabel="Confirm Delete"
        cancelLabel="Keep Note"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText('Keep Note'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Confirm Delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('traps keyboard focus between cancel and confirm buttons', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete"
        message="Confirm delete"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const cancelBtn = screen.getByText('Cancel');
    const confirmBtn = screen.getByText('Confirm');

    // Cancel is initially focused
    expect(document.activeElement).toBe(cancelBtn);

    // Tab from cancel moves to confirm
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);

    // Tab from confirm wraps back to cancel
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);

    // Shift-Tab from cancel wraps to confirm
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);
  });
});