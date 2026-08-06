# Fix: Dashboard cards show no grade data

## What I verified

1. **Course data is fine.** The stored courses for your account have complete extracted data: course name, code, professor, grading components, and assignments. The cards do render code, name and professor correctly.

2. **What is actually empty** on each card is the grade block: current grade shows `—%`, the letter badge shows `—`, and progress reads `0% graded`.

3. **Root cause (confirmed):** the shared course query used by the dashboard and sidebar reads only the `courses` table. It never reads the saved grades, so every assignment comes back with `score = null`, and the grade engine correctly reports "nothing graded yet".

   Proof: the database has saved scores for a course that the dashboard renders as `0% graded` (e.g. scores on `a-4`, `a-9`, `a-14` for the Medieval World course). The Course Workspace screen does merge grades and shows those same scores — the dashboard is the only surface missing that merge step.

   So this is a missing data-join on the dashboard read path, not a field-name mismatch and not a grade-calculation bug.

## Fix

In the shared course query (`src/lib/use-courses.ts`):

- After loading the user's ready courses, also load that user's grade rows for those courses in one query.
- Merge each score onto the matching assignment using the same `assignment_key` → assignment id matching the Course Workspace already uses.
- Keep the same return shape (`Course[]`), so the dashboard cards, sidebar, and any other consumer pick up the grades with no component changes.
- Invalidate this query when a grade is saved or deleted in the workspace, so the dashboard reflects edits immediately.

Nothing else changes: no redesign, no changes to AI extraction, grade calculation, course creation, or the database schema.

## Side observation (not part of this fix)

The deadline pills read things like "6520d overdue" because the uploaded syllabi genuinely list 2008/2009 dates — the app is reporting stored data faithfully. Tell me if you want a follow-up for handling past-semester dates.

## Technical notes

- Change is limited to `src/lib/use-courses.ts` (add grades fetch + merge) plus a cache invalidation of the `["courses"]` key where grade mutations already run in `src/routes/_authenticated/course.$courseId.tsx`.
- Grade lookup reuses the existing `assignment_key` convention produced by `src/lib/course-mapping.ts` (`a-<index>` and `component-<slug>`), so no key format changes.
