import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChecklistEditor } from '../../src/components/ChecklistEditor.js';

describe('ChecklistEditor Component (F-12, FR-11, P-02)', () => {
  it('adds and checks checklist items preserving position', () => {
    const onChange = vi.fn();
    render(
      <ChecklistEditor
        items={[{ text: 'First item', isChecked: false }]}
        color="white"
        onChange={onChange}
      />
    );

    const checkbox = screen.getByLabelText('Mark item "First item" as checked');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith([{ text: 'First item', isChecked: true }]);
  });

  it('triggers overflow callback when attempting to add 51st item (FR-11, P-02)', () => {
    const items50 = Array.from({ length: 50 }, (_, i) => ({
      text: `Item ${i + 1}`,
      isChecked: false,
    }));
    const onOverflow = vi.fn();

    render(
      <ChecklistEditor
        items={items50}
        color="white"
        onChange={vi.fn()}
        onOverflow={onOverflow}
      />
    );

    const input = screen.getByLabelText('New checklist item');
    fireEvent.change(input, { target: { value: 'Item 51 overflow' } });
    fireEvent.submit(input);

    expect(onOverflow).toHaveBeenCalledWith('Item 51 overflow');
  });

  it('replaces add control with "Continue in new note" link when continuedInId is set (FR-11)', () => {
    const onOpenContinuation = vi.fn();

    render(
      <ChecklistEditor
        items={[{ text: 'Item 1', isChecked: false }]}
        color="white"
        continuedInId="next-note-id"
        onChange={vi.fn()}
        onOpenContinuation={onOpenContinuation}
      />
    );

    expect(screen.queryByLabelText('New checklist item')).toBeNull();
    const link = screen.getByText(/Continue in new note/);
    expect(link).toBeDefined();

    fireEvent.click(link);
    expect(onOpenContinuation).toHaveBeenCalledWith('next-note-id');
  });

  it('triggers onTruncated when item text exceeds 80 code points (FR-11)', () => {
    const onTruncated = vi.fn();
    const onChange = vi.fn();

    render(
      <ChecklistEditor
        items={[{ text: 'Item', isChecked: false }]}
        color="white"
        onChange={onChange}
        onTruncated={onTruncated}
      />
    );

    const input = screen.getByLabelText('Checklist item 1');
    fireEvent.change(input, { target: { value: 'a'.repeat(85) } });

    expect(onTruncated).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith([{ text: 'a'.repeat(80), isChecked: false }]);
  });
});