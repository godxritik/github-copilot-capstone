export interface ChecklistItem {
  text: string;
  isChecked: boolean;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  color: string;
  checklistItems: ChecklistItem[];
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  continuedFromId: string | null;
  continuedInId: string | null;
}

export interface CreateNotePayload {
  id: string;
  title?: string;
  body?: string;
  color?: string;
  checklistItems?: ChecklistItem[];
}

export interface UpdateNotePayload {
  title?: string;
  body?: string;
  color?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  checklistItems?: ChecklistItem[];
}

export interface OverflowPayload {
  id: string;
  text: string;
  isChecked: boolean;
}

export interface OverflowResponse {
  note: Note;
  original: Note;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }

  get isValidationError(): boolean {
    return this.status === 400 && this.code === 'VALIDATION_ERROR';
  }

  get isNoteArchived(): boolean {
    return this.status === 400 && this.code === 'NOTE_ARCHIVED';
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (err: unknown) {
    throw new ApiError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : 'Network connection failure');
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const errorObj = data && typeof data === 'object' && 'error' in data ? data.error : null;
    const code = errorObj?.code || (response.status === 404 ? 'NOT_FOUND' : 'API_ERROR');
    const message = errorObj?.message || response.statusText || 'An error occurred';
    throw new ApiError(response.status, code, message);
  }

  return data as T;
}

export const notesApi = {
  listNotes(archived: boolean): Promise<Note[]> {
    return request<Note[]>(`/notes?archived=${archived}`);
  },

  getNote(id: string): Promise<Note> {
    return request<Note>(`/notes/${id}`);
  },

  createNote(payload: CreateNotePayload): Promise<Note> {
    return request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateNote(id: string, payload: UpdateNotePayload): Promise<Note> {
    return request<Note>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteNote(id: string): Promise<void> {
    return request<void>(`/notes/${id}`, {
      method: 'DELETE',
    });
  },

  createOverflow(id: string, payload: OverflowPayload): Promise<OverflowResponse> {
    return request<OverflowResponse>(`/notes/${id}/overflow`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};