# Requirements — Keep Notes (Web)

## 1. Document Info
- **Project name:** Keep Notes (Web)
- **Version:** 0.8
- **Date:** 2026-11-13
- **Author:** Not specified
- **Status:** Draft

## 2. Overview
Keep Notes (Web) is a single-user web application for quickly creating, editing, organizing, searching, and managing personal notes. The MVP provides notes with titles, text bodies, checklists, preset colors, pinning, archiving, and persistent storage through a REST API backed by SQLite.

## 3. User Story
**Source user story:** “As a user, I want a web-based notes application similar to Google Keep, so that I can quickly create, organize, search, and manage my personal notes.”

**Acceptance criteria summary:** A user can create, view, edit, delete, pin, color, search, and archive notes; manage checklist items; and have changes persist between visits. Active notes are ordered with pinned notes first and then by most recently updated. The detailed Given/When/Then criteria are in Section 9.

## 4. Functional Requirements (FR)

| ID | Requirement | Priority (MVP/Future) |
|---|---|---|
| FR-01 | The application shall allow the user to create a note with a title, body, and zero or more checklist items. | MVP |
| FR-02 | The application shall allow the user to read a note's title, body, checklist, color, pin state, archive state, and timestamps in an in-place expanded view within the notes list. | MVP |
| FR-03 | The application shall list active (not archived) notes and provide a separate view of archived notes. | MVP |
| FR-04 | The application shall allow the user to edit a note's title and body inline. Edits shall save automatically when the field loses focus or after a pause of 2 seconds in typing; no save button is provided and no cancel option is provided. | MVP |
| FR-05 | The application shall allow the user to permanently delete a note after confirming a confirmation prompt; a deleted note shall no longer appear in either note view. | MVP |
| FR-06 | The application shall allow the user to pin and unpin a note. In each note view, pinned notes shall appear before unpinned notes, with each group ordered by most recently updated first. | MVP |
| FR-07 | The application shall allow the user to set a note's color from a preset palette that includes white; a new note shall default to white. | MVP |
| FR-08 | The application shall search notes by case-insensitive substring matches in the title or body and display matching notes in the currently selected active or archived view. Leading and trailing spaces are removed from the query; a query that is empty after trimming applies no search. | MVP |
| FR-09 | The application shall allow the user to filter the currently selected note view by one or more preset colors, showing notes that have any selected color, and to clear the filter to restore the unfiltered view. | MVP |
| FR-10 | The application shall allow the user to archive and unarchive a note. Archiving moves the note out of the active view and into the archived view without deleting it, and clears the note's pin state. Unarchiving returns the note to the active view unpinned. Archived notes are read-only: their title, body, checklist, color, and pin state cannot be changed until the note is unarchived. | MVP |
| FR-11 | The application shall allow the user to add, edit, remove, and check or uncheck checklist items on a note. A checked item stays in its current position and is displayed muted, with a line through its text, at a text contrast ratio of at least 4.5:1 against the background. Checklist item text is limited to 80 characters; text beyond 80 characters is cut to 80 characters on save and a subtle message is shown. A note holds at most 50 checklist items. Adding a 51st item creates an overflow note containing that item, titled "Continued from [original title]"; the original note shows a link below its checklist labeled "Continue in new note" that opens the overflow note, and the overflow note shows a link back to the original note. | MVP |
| FR-12 | The application shall persist notes in a server-side SQLite database accessed through a REST API, and shall retain saved changes after the user reloads the application. If a save fails because the server returns an error or cannot be reached, the edited text is kept in the browser's local storage as a temporary draft, the save is sent again, and the draft is cleared once the server confirms the save. If a save returns 404 because the note no longer exists, the note is removed from the view, its local draft is discarded, and a subtle message is shown. | MVP |
| FR-13 | The application shall update a note's `updatedAt` timestamp whenever any of its stored fields change. | MVP |
| FR-14 | The application may support labels or tags for organizing notes. | Future |
| FR-15 | The application may support reminders on notes. | Future |
| FR-16 | The application may support image, file, drawing, or voice attachments. | Future |
| FR-17 | The application may support user accounts, authentication, and per-user data isolation. | Future |
| FR-18 | The application may support offline note access and synchronization. | Future |
| FR-19 | The application may support real-time collaboration. | Future |
| FR-20 | The application may support manual drag-to-reorder of notes. | Future |
| FR-21 | The application may support exporting notes as JSON. | Future |
| FR-22 | When no notes exist in the currently selected view, the application shall display an empty-state message instead of a blank screen. When a search or color filter matches no notes, the application shall display an empty-state message and a control that clears the search and filter. | MVP |

## 5. Non-Functional Requirements (NFR)

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | With up to 500 saved notes, the notes list shall finish loading in under 1 second. |
| NFR-02 | Performance | Search results shall update in under 300 ms after the search input changes, for up to 500 saved notes. Client-side filtering is acceptable. |
| NFR-03 | Security | The application shall store note input without modification and shall display title, body, and checklist text as plain text, so that user-provided markup or script never executes. |
| NFR-04 | Security | The repository shall not contain committed secrets or credentials. |
| NFR-05 | Usability | Note title and body edits shall be available inline, without requiring navigation to a separate editing page. |
| NFR-06 | Accessibility | All interactive controls shall be operable using a keyboard. |
| NFR-07 | Accessibility | Every interactive control shall expose an accessible name, using an ARIA label where a visible label does not provide one. |
| NFR-08 | Compatibility | The application shall support the latest stable versions of Chrome, Firefox, and Microsoft Edge at the time of release. |
| NFR-09 | Compatibility | The web interface shall adapt to all viewport sizes, including mobile phone, tablet, laptop, and desktop widths, without requiring horizontal scrolling to use its core note features. |
| NFR-10 | Maintainability | The frontend shall use React, Vite, TypeScript, and Tailwind CSS. The backend shall use Node.js, Express, TypeScript, and SQLite. |
| NFR-11 | Maintainability | Unit tests shall use Vitest. Integration tests shall use Playwright or Supertest. |
| NFR-12 | Reliability | The API shall return HTTP 400 for invalid input, HTTP 404 for a missing note, and HTTP 500 for a server error, each with a descriptive JSON error message. |

## 6. Data Model

### Note

| Field | Type | Constraints |
|---|---|---|
| `id` | string | Unique and non-empty. The implementation shall use UUIDs. |
| `title` | string | Required string field; empty string is permitted; maximum 200 characters. |
| `body` | string | Required string field; empty string is permitted; maximum 10,000 characters. Plain text, not executable markup. |
| `color` | string | Required preset palette value; defaults to `white`. Values outside the application's preset palette shall be rejected. |
| `checklistItems` | array of ChecklistItem | Required; defaults to an empty array; maximum 50 items per note. |
| `isPinned` | boolean | Required; defaults to `false`. |
| `isArchived` | boolean | Required; defaults to `false`. |
| `createdAt` | timestamp | Required; set when the note is created and stored in UTC. |
| `updatedAt` | timestamp | Required; set when the note is created and refreshed whenever any stored note field changes. Stored in UTC. |

### ChecklistItem

| Field | Type | Constraints |
|---|---|---|
| `text` | string | Required string field; empty string is permitted; maximum 80 characters. |
| `isChecked` | boolean | Required; defaults to `false`. |

Timestamps shall use ISO 8601 UTC representation at the API boundary and shall display in the user's local time zone. A checklist item is stored as part of its parent note.

## 7. Out of Scope
- Labels and tags.
- Reminders.
- Image, file, drawing, and voice attachments.
- Authentication, user accounts, multi-user access, and per-user data isolation.
- Offline use and synchronization.
- Real-time collaboration.
- Manual drag-to-reorder.
- JSON data export.
- Trash or recycle view and restore of deleted notes.
- Encryption at rest and automatic deletion.
- Native mobile or desktop applications.

## 8. Assumptions & Constraints
- The MVP serves one user and one shared collection of notes; no sign-in is required.
- The application is web-only and uses a server-side SQLite database through a REST API; offline operation is not required.
- The supported browser targets are the latest stable Chrome, Firefox, and Edge. The responsive layout is required for all viewport sizes, including mobile phones, tablets, laptops, and desktops.
- Note titles and bodies may be empty. Title is limited to 200 characters and body to 10,000 characters. Checklist item text is limited to 80 characters, and each note holds at most 50 checklist items.
- The exact preset color values are an implementation decision; the palette must include white and be consistent wherever colors are selected or filtered.
- Search matches case-insensitive substrings in title and body only. It applies within the currently selected active or archived view; checklist item text is not searched.
- Color filtering applies within the currently selected active or archived view. A note matches when it has any of the selected colors. Clearing the filter restores all notes in that view.
- Search queries are trimmed of leading and trailing spaces before matching; a whitespace-only query is treated as empty.
- The search query and color filter selection persist across page reloads within the same browser session and reset when the browser session ends.
- Archiving clears a note's pin state; unarchiving returns the note unpinned. Archived notes are read-only until unarchived.
- Active and archived notes are shown in separate views. Pin-first and most-recently-updated ordering applies within either view.
- A note is considered updated when any stored note field changes, including checklist item state, color, pin state, or archive state. A save with no actual change does not update `updatedAt`.
- An edited note's `updatedAt` changes, so it moves within its pin group according to the most-recently-updated rule.
- Deleting a note requires a confirmation prompt; deletion is permanent for the MVP.
- Required stack: React, Vite, TypeScript, and Tailwind CSS for the frontend; Node.js, Express, TypeScript, and SQLite for the backend.
- Required testing tools: Vitest for unit tests and Playwright or Supertest for integration tests.
- MVP scope is limited to the features marked MVP in Section 4; features marked Future are not required for MVP delivery.

## 9. Acceptance Criteria

### Create note
- **Given** the user is viewing the notes application, **when** they create and save a note with a title, body, and optional checklist items, **then** the note is persisted with a unique ID, white color by default, unpinned and unarchived state, and creation and update timestamps.

### Read and list notes
- **Given** notes have been saved, **when** the user opens the application, **then** active notes are displayed separately from archived notes and each note's stored content and state can be viewed.
- **Given** a note is displayed, **when** the user opens or selects it, **then** its title, body, checklist items, color, pin state, archive state, and timestamps are available to read.
- **Given** the currently selected view contains no notes, **when** the user opens that view, **then** an empty-state message is displayed instead of a blank screen.
- **Given** a search or color filter that matches no notes, **when** the result is shown, **then** an empty-state message and a control that clears the search and filter are displayed; **when** the control is used, **then** the notes in the view are shown again.

### Update note
- **Given** a saved note, **when** the user edits its title or body inline and the edit is auto-saved, **then** the new text is displayed and persisted, and `updatedAt` advances only if the stored content changed.

### Delete note
- **Given** a saved note in either view, **when** the user deletes it and confirms the prompt, **then** it is permanently removed from the active and archived views and remains absent after reloading the application.

### Pin and unpin
- **Given** notes in a view include pinned and unpinned notes, **when** the user pins or unpins a note, **then** the note appears in the corresponding group, pinned notes precede unpinned notes, each group is ordered by descending `updatedAt`, and the change persists after reload.

### Color and color filter
- **Given** a saved note, **when** the user selects a color from the preset palette, **then** the note displays that color and the value persists after reload.
- **Given** notes with different preset colors in the selected view, **when** the user selects one or more colors in the filter, **then** only notes having any selected color are shown; **when** the user clears the filter, **then** all notes in that view are shown again.

### Search
- **Given** notes in the selected active or archived view, **when** the user enters a query, **then** only notes with a case-insensitive substring match in the title or body are shown; **when** the query is cleared, **then** all notes in that view are shown, subject to any active color filter.
- **Given** a query with leading or trailing spaces, **when** it is applied, **then** matching uses the trimmed query; **given** a query that is only spaces, **then** all notes in the view are shown, subject to any active color filter.
- **Given** a search query and a color filter are set, **when** the user reloads the page within the same browser session, **then** both remain applied.

### Archive and unarchive
- **Given** an active note, **when** the user archives it, **then** it is absent from the active view, present in the archived view with its content intact, and unpinned.
- **Given** an archived note, **when** the user unarchives it, **then** it is absent from the archived view, present in the active view with its content intact, and unpinned.
- **Given** an archived note, **when** the user attempts to edit its title, body, checklist, color, or pin state, **then** no change is made and the note remains unchanged until it is unarchived.

### Checklist
- **Given** a note, **when** the user adds, edits, removes, checks, or unchecks a checklist item, **then** the displayed checklist reflects the action and the change persists after reload.
- **Given** a checked item, **when** the checklist is displayed, **then** the item stays in its position, its row is muted with a line through its text, and its text meets a contrast ratio of at least 4.5:1 against the background.
- **Given** checklist item text longer than 80 characters, **when** the user saves it, **then** the stored text is the first 80 characters and a subtle message is shown.
- **Given** a note with 50 checklist items, **when** the user adds a 51st item, **then** the item is saved in an overflow note titled "Continued from [original title]"; the original note shows a link below its checklist labeled "Continue in new note" that opens the overflow note, and the overflow note shows a link back to the original note.

### Persistence and input safety
- **Given** a note change has been saved, **when** the user reloads the application, **then** the saved note state is restored from the SQLite-backed REST API.
- **Given** a save fails because the server returns an error or cannot be reached, **when** the failure occurs, **then** the edited text is kept in local browser storage as a draft, the save is sent again, and the draft is cleared once the server confirms the save.
- **Given** a save returns 404 because the note no longer exists, **when** the response is received, **then** the note is removed from the view, its local draft is discarded, and a subtle message is shown.
- **Given** the user enters text containing markup or script-like content, **when** the note is saved and displayed, **then** the content is treated as text and does not execute as HTML or script.

### Performance and accessibility
- **Given** 500 saved notes, **when** the user loads a note view, **then** the list finishes loading in under 1 second.
- **Given** 500 saved notes, **when** the user changes the search query, **then** matching results update in under 300 ms.
- **Given** the application is used with a keyboard, **when** the user navigates through interactive controls, **then** every interactive control can be reached and operated by keyboard and has an accessible name.
- **Given** the application is viewed at a mobile phone, tablet, laptop, or desktop width, **when** the user uses the core note features, **then** no horizontal scrolling is required.

## 10. Open Questions and Assumptions
- **Confirmed:** The overflow note created at 50 items uses the default white color and is unpinned and unarchived.
- **Confirmed:** Title or body input over its limit is rejected with a validation message.
- **Confirmed:** Search query and color filter persistence (Section 9, Search) applies across reloads within one browser session and resets when that session ends, as interpreted from the answer "session only."
