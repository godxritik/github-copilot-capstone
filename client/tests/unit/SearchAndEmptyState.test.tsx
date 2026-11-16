import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../../src/components/SearchBar.js';
import { ColorFilter } from '../../src/components/ColorFilter.js';
import { EmptyState } from '../../src/components/EmptyState.js';

describe('SearchBar, ColorFilter, and EmptyState (F-14, F-15, FR-08, FR-09, FR-22)', () => {
  describe('SearchBar (FR-08, NFR-06, NFR-07)', () => {
    it('renders input with accessible aria-label and triggers onChange', () => {
      const onChange = vi.fn();
      render(<SearchBar value="hello" onChange={onChange} onClear={vi.fn()} />);

      const input = screen.getByLabelText('Search notes');
      expect(input).toBeDefined();

      fireEvent.change(input, { target: { value: 'search' } });
      expect(onChange).toHaveBeenCalledWith('search');
    });

    it('renders clear button when value is present and calls onClear', () => {
      const onClear = vi.fn();
      render(<SearchBar value="something" onChange={vi.fn()} onClear={onClear} />);

      const clearBtn = screen.getByLabelText('Clear search');
      fireEvent.click(clearBtn);
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('ColorFilter (FR-09, NFR-06, NFR-07)', () => {
    it('renders 8 color buttons with aria-pressed state', () => {
      const onToggle = vi.fn();
      render(<ColorFilter selectedColors={['teal']} onToggleColor={onToggle} onClearColors={vi.fn()} />);

      const tealBtn = screen.getByLabelText('Filter by Teal');
      expect(tealBtn.getAttribute('aria-pressed')).toBe('true');

      const whiteBtn = screen.getByLabelText('Filter by White');
      expect(whiteBtn.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(whiteBtn);
      expect(onToggle).toHaveBeenCalledWith('white');
    });

    it('shows Clear button when at least one color is selected', () => {
      const onClear = vi.fn();
      render(<ColorFilter selectedColors={['red']} onToggleColor={vi.fn()} onClearColors={onClear} />);

      const clearBtn = screen.getByLabelText('Clear color filter');
      fireEvent.click(clearBtn);
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('EmptyState (FR-22)', () => {
    it('displays active empty message when no notes exist and no filters are active', () => {
      render(<EmptyState isFiltered={false} activeTab="active" onClearFilters={vi.fn()} />);
      expect(screen.getByText('No notes yet. Add one above!')).toBeDefined();
    });

    it('displays archived empty message when viewing empty archive', () => {
      render(<EmptyState isFiltered={false} activeTab="archived" onClearFilters={vi.fn()} />);
      expect(screen.getByText('No archived notes.')).toBeDefined();
    });

    it('displays no-match message and clear button when search/filter has no match (FR-22)', () => {
      const onClear = vi.fn();
      render(<EmptyState isFiltered={true} activeTab="active" onClearFilters={onClear} />);

      expect(screen.getByText('No notes match your search or filter.')).toBeDefined();

      const clearBtn = screen.getByText('Clear search and filters');
      fireEvent.click(clearBtn);
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });
});