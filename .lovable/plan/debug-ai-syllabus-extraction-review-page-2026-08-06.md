# Debug: AI syllabus extraction → review page

## What I verified (end to end, on your real data)

1. **Is the PDF sent to the AI?** Yes. The server function downloads the file from the `syllabi` bucket, rejects empty files, and sends the real bytes as a base64 PDF attachment to the AI, together with the extraction prompt.
2. **Does the AI return data?** Yes. Your six most recent uploads all came back with structured results and no extraction error.
3. **Where is it stored?** In the course row itself (`extracted` JSON), and the row moves to `review`. Example (History 104-1): course name, code, professor, semester, description, 3 grading components summing to 100%, 5 assignments with dates, 2 important dates, 9 policies.
4. **Does the review page receive it?** Yes. I loaded `/review/<real course id>` in a browser session and read the actual input values: "Introduction to the Modern World", "History 104-1", "Prof. William G. Gray", "Fall 2008", full description, Midterms 40 / Final exam 20 / Written papers 40, "First paper"… The real extraction renders correctly.

## Root cause of the empty page

The pipeline is not broken — the page is blank only when it is opened for a course that has **no** extraction stored, and today it fails silently in that case:

- The review page seeds its editor with `emptyExtraction()` merged over `course.extracted`. When `extracted` is null (or the course id does not exist at all), it renders a fully blank editor that looks like "the AI found nothing" instead of saying anything.
- Your database still has older rows stuck at `processing` / `draft` with no extraction (from before extraction existed). Opening one of those shows exactly the blank page you described.
- The dashboard still lists **mock** courses, whose ids do not exist in the database. Any navigation starting from those ids also lands on empty pages.

## Minimum fix (small, no redesign)

1. In the review page, handle the two non-happy cases explicitly instead of rendering a blank form:
   - course not found → short "We couldn't find that course" state with a link back to the dashboard;
   - course found but `extracted` is null → send the user to `/processing/<courseId>`, which already owns running/retrying extraction and showing extraction errors.
2. Leave everything else untouched: no UI redesign, no change to the extraction prompt, model, schema, or storage.

Optional follow-up (only if you want it, not part of this fix): point the dashboard list at your real courses so it stops offering mock ids.

## Technical notes

- Files touched: `src/routes/_authenticated/review.$courseId.tsx` only (guard clauses around the existing loading branch).
- `src/lib/syllabus.functions.ts`, `src/lib/syllabus-extraction.ts`, `processing.$courseId.tsx` and the review UI markup stay as they are.
