# Story T3.2: Class Creation and Join Code

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-2-class-creation-and-join-code
**Date Prepared:** 2026-04-28

> **Dev Agent Instruction:** Complete ALL Dev Tasks first, then switch to the QA persona (Quinn 🧪) and implement ALL QA Tasks before marking this story done. The story is not complete until both sections are fully checked off.

---

## Story

As a teacher,
I want to create a named class and receive a join code instantly,
So that I can onboard students in under 5 minutes.

---

## Acceptance Criteria

**AC1 — Create class and display join code within 3 seconds**
**Given** I am on My Classes (`/teacher/classes`) and click "Create Class"
**When** I enter a class name and submit
**Then** a class is created, the modal transitions to a success state that prominently displays the generated 6-character join code with a one-click copy button, all within 3 seconds of submit

**AC2 — Class detail page shows join code with copy button**
**Given** my class is created
**When** I navigate to the class detail page (`/teacher/classes/:classId`)
**Then** the join code is prominently displayed in mono font with a clipboard copy button; clicking the button copies the code and shows a brief "Copied!" confirmation

**AC3 — My Classes lists all classes with name, join code, student count, and creation date**
**Given** I have created multiple classes
**When** I view My Classes
**Then** each class card shows: class name, join code (mono), student count, semester, academic year, and formatted creation date (e.g. "Apr 15, 2026")

**AC4 — Empty class name is rejected with inline error**
**Given** I am in the Create Class modal
**When** I submit with an empty class name
**Then** an inline error "Class name is required" appears beneath the input; the form is not submitted to the API

---

## Tasks / Subtasks

### Task 1 — Create class modal: success state with join code

- [ ] In `apps/web/app/(teacher)/teacher/classes/page.tsx`:
  - Add state: `const [newClassCode, setNewClassCode] = useState<string | null>(null)`
  - Update `createMutation.onSuccess` to capture the response:
    ```typescript
    onSuccess: (result) => {
      const joinCode = (result as { data: { join_code: string } }).data.join_code;
      setNewClassCode(joinCode);
      qc.invalidateQueries({ queryKey: ['teacher-classes'] });
      // DO NOT call setShowCreate(false) yet — let success state display first
    },
    ```
  - When `newClassCode` is set, render a success state inside the modal instead of the form:
    ```
    ✓  Class created!
    Your join code:   [  AB12CD  ]  [Copy icon]
    Share this with your students to let them join.
    [Done] button → setShowCreate(false); setNewClassCode(null)
    ```
  - Join code display: `font-mono tracking-[0.3em] text-3xl font-bold text-white bg-surface-container-high px-6 py-3 rounded-xl`
  - Copy button: uses `handleCopy(newClassCode)` (see Task 3 for copy helper)

### Task 2 — Class cards: add copy button and creation date

- [ ] In `apps/web/app/(teacher)/teacher/classes/page.tsx`, update each class card:
  - Show `created_at` formatted: use `new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` — place below the join code
  - Add a copy icon button next to the join code in the card:
    ```tsx
    <button
      onClick={(e) => { e.preventDefault(); handleCopy(c.join_code); }}
      className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded"
      aria-label="Copy join code"
    >
      <Copy size={13} />
    </button>
    ```
  - Add `Copy` to the lucide-react import: `import { ..., Copy } from 'lucide-react'`
  - The card type definition must include `created_at: string`

### Task 3 — Copy helper (shared between modal and detail page)

- [ ] In `apps/web/app/(teacher)/teacher/classes/page.tsx`, add a `handleCopy` function:
  ```typescript
  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}!`);
    } catch {
      toast.error('Copy failed — please copy manually');
    }
  };
  ```
  Note: `navigator.clipboard` requires a secure context (https or localhost). This works in all target environments.

### Task 4 — Class detail page: add copy button to join code

- [ ] In `apps/web/app/(teacher)/teacher/classes/[classId]/page.tsx`:
  - Add copy button next to the join code display:
    ```tsx
    <div className="flex items-center gap-2">
      <span className="text-on-surface-variant text-sm">Join code:</span>
      <span className="bg-surface-container-high text-white px-3 py-1.5 rounded-lg font-mono tracking-widest text-lg font-bold">
        {cls.join_code}
      </span>
      <button
        onClick={() => handleCopy(cls.join_code)}
        className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        aria-label="Copy join code"
      >
        <Copy size={16} />
      </button>
    </div>
    ```
  - Add `handleCopy` function (same pattern as Task 3 — uses `toast.success`)
  - Add `Copy` and `toast` imports

### Task 5 — Inline validation on class name field

- [ ] In the Create Class modal form, add validation before calling `createMutation.mutate`:
  ```typescript
  const [nameError, setNameError] = useState('');

  // On submit:
  if (!form.name.trim()) {
    setNameError('Class name is required');
    return;
  }
  setNameError('');
  createMutation.mutate(form);
  ```
  - Render error beneath input: `{nameError && <p className="text-negative text-xs mt-1">{nameError}</p>}`
  - Clear `nameError` on `onChange` of the name field

---

## Dev Notes

### Backend is complete — no changes needed
All three endpoints are already implemented and registered:
- `POST /api/v1/teacher/classes` → `createClass` — returns full class row including `join_code`, `id`, `created_at` ✅
- `GET /api/v1/teacher/classes` → `getTeacherClasses` — returns array with `student_count` via LEFT JOIN ✅
- `GET /api/v1/teacher/classes/:classId` → `getClassDetail` — returns class + students array ✅

Routes are guarded: `authMiddleware + requireRole('teacher', 'admin')`.

### Join code format
`generateJoinCode()` produces 6 uppercase alphanumeric chars from `Math.random().toString(36).substring(2, 8).toUpperCase()`. The DB column is `VARCHAR(8)` with a `UNIQUE` constraint. The uniqueness spin-loop in `createClass` handles collisions. No changes needed.

### class_enrollments has no `is_active` column
The `classes` table has `is_active BOOLEAN` but `class_enrollments` does NOT — it only has `class_id`, `student_id`, `portfolio_id`, `enrolled_at`. The T3.1 dashboard query draft referenced `ce.is_active = true` which would fail. In T3.1 implementation, filter on `c.is_active = true` (classes table only), not on `ce.is_active`.

### Existing classes page patterns to follow
`apps/web/app/(teacher)/teacher/classes/page.tsx` already uses:
- `useQuery` / `useMutation` from TanStack Query
- `apiClient.post('/teacher/classes', data)` — note: `apiClient` wraps fetch with auth headers; the response shape is `{ data: ClassRow }` (single object from `res.json({ data: rows[0] })`)
- `toast.success` / `toast.error` from sonner
- Editorial Intelligence tokens: `bg-surface-container-high`, `text-on-surface-variant`, `text-primary`, `btn-primary`, `card`, `input` Tailwind class shortcuts

### Existing class detail page patterns to follow
`apps/web/app/(teacher)/teacher/classes/[classId]/page.tsx` already:
- Uses `useParams<{ classId: string }>()` (not `use(params)` — this is a client component)
- Fetches via `apiClient.get(`/teacher/classes/${classId}`)` → response shape: `{ data: { name, join_code, semester, students: [...] } }`
- Uses `formatUSD`, `formatPercent` from `@student-investing/shared-utils`
- Uses `cn` from `@/lib/utils` for conditional classes

### apiClient response shape
`apiClient` is configured to unwrap the outer envelope. Verify by checking `apps/web/lib/api-client.ts` — if it returns raw `axios` response, access via `.data.data`; if it auto-unwraps, access directly. The existing classes page does `.then((r: { data: unknown[] }) => r.data)` suggesting the outer `{ data }` wrapper is NOT auto-unwrapped. Keep consistent with existing patterns.

### No migrations required
`classes` and `class_enrollments` tables already exist in `008_schools_classes.sql`. `classes.created_at` is already a column (TIMESTAMPTZ with DEFAULT NOW()).

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API)
- [ ] `POST /teacher/classes` → 201, returns `join_code` (6-char uppercase alphanumeric)
- [ ] `POST /teacher/classes` with duplicate class name → still 201 (names are not unique)
- [ ] `GET /teacher/classes` → returns all classes with `student_count` and `created_at`
- [ ] `POST /teacher/classes` with student JWT → 403

### E2E Tests (Playwright)
- [ ] Teacher clicks "Create Class", fills name → modal transitions to success state showing join code
- [ ] Join code in success state has a working copy button (clipboard write)
- [ ] After closing modal, new class appears in My Classes grid with correct name, join code, student count (0), and creation date
- [ ] Class card copy button copies join code and shows toast "Copied!"
- [ ] Submitting create form with empty class name → inline error shown, API not called
- [ ] Navigating to class detail page → join code shown with copy button
- [ ] Copy button on class detail page copies code and shows toast

### QA Agent Record
_to be filled by QA agent after dev completes_

---

## Dev Agent Record

### Agent Model Used
_to be filled on implementation_

### Completion Notes
_to be filled on implementation_

### File List
_to be filled on implementation_

### Change Log
- 2026-04-28: T3.2 story created — class creation and join code UX
