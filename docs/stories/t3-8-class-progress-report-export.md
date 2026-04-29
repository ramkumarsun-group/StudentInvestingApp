# Story T3.8: Class Progress Report Export

**Status:** ready-for-dev
**Epic:** Thread 3 — School & Classroom Loop
**Sprint Key:** t3-8-class-progress-report-export
**Date Prepared:** 2026-04-29

---

## Story

As a teacher,
I want to export a class progress report with one click,
So that I can share evidence of student engagement with my department head.

---

## Acceptance Criteria

**AC1 — CSV downloads within 3 seconds**
**Given** I am on a class detail page and click "Export Report"
**When** the export is requested
**Then** a CSV file downloads within 3 seconds named `{class-name}-report-{YYYY-MM-DD}.csv`

**AC2 — CSV contains required columns with correct formatting**
**Given** the CSV is opened in a spreadsheet
**When** I review the data
**Then** all columns are present with clear headers: `Display Name, Portfolio Return %, XP Total, Current Level, Modules Completed, Lessons Completed, Trades Placed, Streak Days, Last Active`; percentages are plain numbers (e.g. `12.34`); dates are ISO formatted (`2026-04-28`)

**AC3 — Empty class exports header row only**
**Given** I have no students enrolled
**When** I click "Export Report"
**Then** the CSV downloads with only the header row and no data rows

**AC4 — Report button is disabled during export**
**Given** I click "Export Report"
**When** the request is in flight
**Then** the button shows a loading state and cannot be clicked again until the download completes

---

## Tasks / Subtasks

### Task 1 — Backend: CSV export endpoint

- [ ] In `apps/api/src/controllers/teacher.controller.ts`, add:
  ```typescript
  export async function exportClassReport(req: Request, res: Response) {
    const { classId } = req.params;
    const teacherId = req.user!.userId;

    // Verify ownership
    const { rows: cls } = await db.query(
      'SELECT name FROM classes WHERE id=$1 AND teacher_id=$2',
      [classId, teacherId],
    );
    if (cls.length === 0) return res.status(404).json({ error: 'Class not found' });

    const { rows } = await db.query(
      `SELECT
         u.username AS "Display Name",
         ROUND(COALESCE(p.total_return_pct, 0)::numeric, 2) AS "Portfolio Return %",
         COALESCE(ux.total_xp, 0) AS "XP Total",
         COALESCE(ux.current_level, 1) AS "Current Level",
         COUNT(DISTINCT CASE WHEN ulp.status='completed' AND m.is_module THEN ulp.id END) AS "Modules Completed",
         COUNT(DISTINCT CASE WHEN ulp.status='completed' THEN ulp.id END) AS "Lessons Completed",
         COUNT(DISTINCT o.id) AS "Trades Placed",
         COALESCE(s.current_streak, 0) AS "Streak Days",
         TO_CHAR(GREATEST(MAX(o.created_at), MAX(ulp.updated_at)), 'YYYY-MM-DD') AS "Last Active"
       FROM class_enrollments ce
       JOIN users u ON u.id=ce.student_id
       LEFT JOIN portfolios p ON p.id=ce.portfolio_id
       LEFT JOIN user_xp ux ON ux.user_id=u.id
       LEFT JOIN user_lesson_progress ulp ON ulp.user_id=u.id
       LEFT JOIN lessons lsn ON lsn.id=ulp.lesson_id
       LEFT JOIN modules m ON m.id=lsn.module_id
       LEFT JOIN orders o ON o.user_id=u.id
       LEFT JOIN streaks s ON s.user_id=u.id
       WHERE ce.class_id=$1
       GROUP BY u.username, p.total_return_pct, ux.total_xp, ux.current_level, s.current_streak
       ORDER BY p.total_return_pct DESC NULLS LAST`,
      [classId],
    );

    // Build CSV manually (no external dependency)
    const headers = [
      'Display Name', 'Portfolio Return %', 'XP Total', 'Current Level',
      'Modules Completed', 'Lessons Completed', 'Trades Placed', 'Streak Days', 'Last Active',
    ];
    const csvRows = [headers.join(',')];
    for (const row of rows) {
      csvRows.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
    }
    const csv = csvRows.join('\n');

    const date = new Date().toISOString().slice(0, 10);
    const filename = `${cls[0].name.replace(/[^a-z0-9]/gi, '-')}-report-${date}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  }
  ```

- [ ] Register in `apps/api/src/routes/index.ts`:
  ```typescript
  router.get('/teacher/classes/:classId/export', authMiddleware, requireRole('teacher', 'admin'), teacher.exportClassReport);
  ```

### Task 2 — Frontend: Export Report button on class detail page

- [ ] In `apps/web/app/(teacher)/teacher/classes/[classId]/page.tsx`:
  - Add state: `const [exporting, setExporting] = useState(false)`
  - Add export handler:
    ```typescript
    const handleExport = async () => {
      setExporting(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/teacher/classes/${classId}/export`,
          {
            headers: { Authorization: `Bearer ${session?.accessToken}` },
          },
        );
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = response.headers.get('content-disposition') ?? '';
        a.download = disposition.match(/filename="(.+)"/)?.[1] ?? 'report.csv';
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error('Export failed — please try again');
      } finally {
        setExporting(false);
      }
    };
    ```
  - Use `useSession()` to get the access token (already imported via NextAuth)
  - Add the button to the page header area:
    ```tsx
    <button
      onClick={handleExport}
      disabled={exporting}
      className="btn-secondary flex items-center gap-2 text-sm"
    >
      <Download size={14} />
      {exporting ? 'Exporting…' : 'Export Report'}
    </button>
    ```
  - Add `Download` to lucide-react imports

---

## Dev Notes

### No external CSV library needed
Build CSV manually with `JSON.stringify(value)` for each cell — this handles values with commas and quotes correctly. The `JSON.stringify` of a string adds double quotes and escapes internal quotes. No `csv-writer` or `papaparse` needed on the server.

### Why `fetch` instead of `apiClient` for the download
`apiClient` (axios) returns parsed JSON by default. For binary/text blob downloads, use the native `fetch` API with `response.blob()` and the `URL.createObjectURL` pattern. This is the standard browser approach for triggering a file download from a fetch response.

### `NEXT_PUBLIC_API_URL` env var
Check that `NEXT_PUBLIC_API_URL` is defined in `apps/web/.env.local` and `.env.example`. It should be `http://localhost:4000` for local dev and the production API URL in prod. If a different env var name is used in the project (e.g. `NEXT_PUBLIC_API_BASE`), use the existing one.

### Modules vs lessons distinction in the query
"Modules Completed" counts distinct modules where all lessons in the module are completed. The simplified query above uses `m.is_module` (check if this column exists — if not, use the count of distinct module IDs with all lessons completed). For MVP simplicity, count distinct modules that have at least one completed lesson:
```sql
COUNT(DISTINCT lsn.module_id) AS "Modules Completed"
```
and call it "Modules Started" if full completion tracking is complex.

### `ulp.updated_at` column
Verify `user_lesson_progress` has an `updated_at` column. If not, fall back to `ulp.completed_at` for the last lesson activity timestamp.

### Filename sanitisation
`cls[0].name.replace(/[^a-z0-9]/gi, '-')` removes spaces and special characters from the class name. A class named "AP Finance Period 1" becomes `AP-Finance-Period-1-report-2026-04-29.csv`.

---

## QA Tasks / Test Coverage

### Unit / Integration Tests (API)
- [ ] `GET /teacher/classes/:classId/export` → `Content-Type: text/csv` header
- [ ] `GET /teacher/classes/:classId/export` → `Content-Disposition` header contains correct filename (`{class-name}-report-{YYYY-MM-DD}.csv`)
- [ ] `GET /teacher/classes/:classId/export` → CSV first row is the exact header string: `Display Name,Portfolio Return %,XP Total,Current Level,Modules Completed,Lessons Completed,Trades Placed,Streak Days,Last Active`
- [ ] `GET /teacher/classes/:classId/export` with enrolled students → data rows match DB values
- [ ] `GET /teacher/classes/:classId/export` with no enrolled students → only header row, no data rows
- [ ] `GET /teacher/classes/:classId/export` with student JWT → 403
- [ ] `GET /teacher/classes/:classId/export` for class owned by different teacher → 404
- [ ] CSV values with commas in usernames → correctly quoted by `JSON.stringify`

### E2E Tests (Playwright)
- [ ] Teacher on class detail page sees "Export Report" button
- [ ] Teacher clicks Export Report → file download triggered within 3 seconds
- [ ] Downloaded filename matches `{class-name}-report-{YYYY-MM-DD}.csv` pattern
- [ ] Export button shows loading state ("Exporting…") while request is in flight
- [ ] Export button not clickable while loading (disabled state)
- [ ] Export on empty class → CSV downloads with header only (no error)

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
- 2026-04-29: T3.8 story created — class progress report export
