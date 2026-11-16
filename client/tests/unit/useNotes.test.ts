import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotes, filterNotes } from '../../src/hooks/useNotes.js';
import { notesApi, type Note } from '../../src/api/notesApi.js';

describe('useNotes and filterNotes (F-08, FR-03, FR-06, FR-08, FR-09)', () => {
  const sampleNotes: Note[] = [
    {
      id: 'n1',
      title: 'Grocery List',
      body: 'Buy milk and eggs',
      color: 'white',
      checklistItems: [],
      isPinned: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      continuedFromId: null,
      continuedInId: null,
    },
    {
      id: 'n2',
      title: 'Meeting Notes',
      body: 'Discuss roadmap project',
      color: 'teal',
      checklistItems: [],
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      continuedFromId: null,
      continuedInId: null,
    },
    {
      id: 'n3',
      title: 'Book Ideas',
      body: 'Science fiction novel',
      color: 'red',
      checklistItems: [],
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      continuedFromId: null,
      continuedInId: null,
    },
  ];

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('filterNotes helper logic', () => {
    it('applies no search when query is empty or whitespace-only (FR-08)', () => {
      const filteredEmpty = filterNotes(sampleNotes, '', []);
      expect(filteredEmpty.length).toBe(3);

      const filteredSpaces = filterNotes(sampleNotes, '   ', []);
      expect(filteredSpaces.length).toBe(3);
    });

    it('matches case-insensitive substring in title or body', () => {
      const matchTitle = filterNotes(sampleNotes, 'grocery', []);
      expect(matchTitle.map((n) => n.id)).toEqual(['n1']);

      const matchBody = filterNotes(sampleNotes, 'ROADMAP', []);
      expect(matchBody.map((n) => n.id)).toEqual(['n2']);
    });

    it('filters notes matching ANY of the selected colors (FR-09)', () => {
      const singleColor = filterNotes(sampleNotes, '', ['teal']);
      expect(singleColor.map((n) => n.id)).toEqual(['n2']);

      const multiColor = filterNotes(sampleNotes, '', ['white', 'red']);
      expect(multiColor.map((n) => n.id)).toEqual(['n1', 'n3']);
    });

    it('combines search and color filter (AND logic)', () => {
      const result = filterNotes(sampleNotes, 'science', ['red']);
      expect(result.map((n) => n.id)).toEqual(['n3']);

      const noMatch = filterNotes(sampleNotes, 'science', ['teal']);
      expect(noMatch.length).toBe(0);
    });
  });

  describe('useNotes hook state & sessionStorage persistence', () => {
    it('restores initial query and colors from sessionStorage', async () => {
      window.sessionStorage.setItem('keep_search_query', 'persisted query');
      window.sessionStorage.setItem('keep_selected_colors', JSON.stringify(['teal']));

      vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);

      const { result } = renderHook(() => useNotes());
      await act(async () => {});

      expect(result.current.searchQuery).toBe('persisted query');
      expect(result.current.selectedColors).toEqual(['teal']);
    });

    it('updates sessionStorage when query or colors change', async () => {
      vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);

      const { result } = renderHook(() => useNotes());
      await act(async () => {});

      act(() => {
        result.current.setSearchQuery('new query');
      });
      expect(window.sessionStorage.getItem('keep_search_query')).toBe('new query');

      act(() => {
        result.current.toggleColorFilter('green');
      });
      expect(window.sessionStorage.getItem('keep_selected_colors')).toBe(JSON.stringify(['green']));
    });

    it('clearFilters clears both search query and selected colors in state and sessionStorage', async () => {
      vi.spyOn(notesApi, 'listNotes').mockResolvedValue([]);

      const { result } = renderHook(() => useNotes());
      await act(async () => {});

      act(() => {
        result.current.setSearchQuery('search');
        result.current.toggleColorFilter('blue');
      });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.searchQuery).toBe('');
      expect(result.current.selectedColors).toEqual([]);
      expect(window.sessionStorage.getItem('keep_search_query')).toBe('');
      expect(window.sessionStorage.getItem('keep_selected_colors')).toBe('[]');
    });
  });
});