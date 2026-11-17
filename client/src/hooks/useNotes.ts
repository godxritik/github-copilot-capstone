import { useState, useEffect, useMemo, useCallback } from 'react';
import { notesApi, type Note } from '../api/notesApi.js';
import type { PaletteColor } from '../lib/palette.js';

const SESSION_SEARCH_KEY = 'keep_search_query';
const SESSION_COLORS_KEY = 'keep_selected_colors';

function getSessionItem(key: string, defaultValue: string): string {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key) ?? defaultValue;
    }
  } catch {
    // ignore
  }
  return defaultValue;
}

function setSessionItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

export function filterNotes(
  notes: Note[],
  searchQuery: string,
  selectedColors: PaletteColor[]
): Note[] {
  const trimmed = searchQuery.trim().toLowerCase();
  const hasSearch = trimmed.length > 0;
  const hasColorFilter = selectedColors.length > 0;

  return notes.filter((note) => {
    // Color filter: matches if note has ANY of the selected colors (FR-09)
    if (hasColorFilter && !selectedColors.includes(note.color as PaletteColor)) {
      return false;
    }

    // Search filter: case-insensitive substring in title or body (FR-08)
    if (hasSearch) {
      const titleMatch = note.title.toLowerCase().includes(trimmed);
      const bodyMatch = note.body.toLowerCase().includes(trimmed);
      if (!titleMatch && !bodyMatch) {
        return false;
      }
    }

    return true;
  });
}

export function useNotes() {
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [activeNotes, setActiveNotes] = useState<Note[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [searchQuery, setSearchQueryState] = useState<string>(() =>
    getSessionItem(SESSION_SEARCH_KEY, '')
  );

  const [selectedColors, setSelectedColorsState] = useState<PaletteColor[]>(() => {
    const saved = getSessionItem(SESSION_COLORS_KEY, '[]');
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setSessionItem(SESSION_SEARCH_KEY, query);
  }, []);

  const setSelectedColors = useCallback((colors: PaletteColor[]) => {
    setSelectedColorsState(colors);
    setSessionItem(SESSION_COLORS_KEY, JSON.stringify(colors));
  }, []);

  const toggleColorFilter = useCallback((color: PaletteColor) => {
    setSelectedColorsState((prev) => {
      const next = prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color];
      setSessionItem(SESSION_COLORS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQueryState('');
    setSelectedColorsState([]);
    setSessionItem(SESSION_SEARCH_KEY, '');
    setSessionItem(SESSION_COLORS_KEY, '[]');
  }, []);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [active, archived] = await Promise.all([
        notesApi.listNotes(false),
        notesApi.listNotes(true),
      ]);
      setActiveNotes(active);
      setArchivedNotes(archived);
      setHasLoaded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const currentTabNotes = activeTab === 'active' ? activeNotes : archivedNotes;

  const filteredNotes = useMemo(() => {
    return filterNotes(currentTabNotes, searchQuery, selectedColors);
  }, [currentTabNotes, searchQuery, selectedColors]);

  const removeNoteLocally = useCallback((noteId: string) => {
    setActiveNotes((prev) => prev.filter((n) => n.id !== noteId));
    setArchivedNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const updateNoteLocally = useCallback((updatedNote: Note) => {
    if (updatedNote.isArchived) {
      setActiveNotes((prev) => prev.filter((n) => n.id !== updatedNote.id));
      setArchivedNotes((prev) => {
        const index = prev.findIndex((n) => n.id === updatedNote.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedNote;
          return next;
        }
        return [updatedNote, ...prev];
      });
    } else {
      setArchivedNotes((prev) => prev.filter((n) => n.id !== updatedNote.id));
      setActiveNotes((prev) => {
        const index = prev.findIndex((n) => n.id === updatedNote.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedNote;
          return next;
        }
        return [updatedNote, ...prev];
      });
    }
  }, []);

  return {
    activeTab,
    setActiveTab,
    activeNotes,
    archivedNotes,
    filteredNotes,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedColors,
    setSelectedColors,
    toggleColorFilter,
    clearFilters,
    refreshNotes: fetchNotes,
    hasLoaded,
    removeNoteLocally,
    updateNoteLocally,
  };
}