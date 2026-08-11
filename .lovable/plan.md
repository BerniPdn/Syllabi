# Syllabi — Full Product Audit (no changes made)

Findings below were confirmed by reading the code and querying the database. Nothing is implemented yet; approve and I'll fix in priority order.

## P0 — Breaks trust or silently loses user work

1. **Toast notifications never appear.** `sonner`'s `<Toaster />` is not mounted anywhere in the app (only `src/components/ui/sonner.tsx` defines it). Every `toast.success` / `toast.error` — grade save failures, course deleted, delete errors — is invisible. Failures look like nothing happened.
2. **Uploaded courses can vanish.** The dashboard and sidebar only query courses with `status = 'ready'`. Any course left in `processing`, `review`, `draft`, or `failed` disappears with no way to resume or discard it. The database currently holds 21 such orphaned rows (processing 5, review 10, failed 4, draft 2) — real uploads users can no longer see.
3. **Target grade is fake.** `course-mapping.ts` hardcodes `targetGrade: 90` for every course, and no `target_grade` column exists. "Needed on remaining", risk detection, and the on-track badge are all computed against a number the student never set — contradicting the agreed PRD behaviour (student sets target on the review screen).
4. **Grade totals can silently drop below 100%.** The engine computes `weightsValid` but nothing reads it. A grading category with no assignments is skipped entirely (its weight leaves the denominator), and a category whose assignments all have weight 0 contributes nothing. The workspace still shows a confident "Current Avg" with no warning.
5. **Unhandled crash on save.** In the review screen, `findDuplicateCourses` is awaited *outside* the `try` block, so a network blip during "Confirm course" throws an uncaught rejection instead of showing the friendly error.

## P1 — Visible polish and correctness problems

6. **Mixed languages and stale branding.** The app shell has Spanish strings ("Cursos", "No tienes cursos aún", "Estudiante", "Abrir menú de navegación") in an otherwise English product, and the review screen still says "CoursePilot" in four places.
7. **Fake identity in the nav.** The avatar and user menu hardcode "B" / "Bernarda" / "Estudiante" for every signed-in user. Should show the real name/email.
8. **Dashboard flashes a full-page spinner** on every background refetch (`isFetching` treated as loading), so saving a grade or deleting a course blanks the whole dashboard.
9. **Nonsense numbers surfaced.** `neededOnRemaining` is unclamped, so insights can read "you need 137%" or "you need -12%". With nothing graded yet, the projected grade equals the target exactly, giving a false "on track" signal.
10. **Auto-balance doesn't balance.** Splitting a component across 3 assignments gives 33.3 each = 99.9%, which immediately triggers the mismatch warning on the button the user just pressed.
11. **No weight bounds anywhere.** Negative or >100 weights pass the extraction schema, the review form, and Zod validation, and then invert or skew real grade math.
12. **Two different category-matching rules.** The review screen matches assignment→component by exact trimmed name; runtime mapping matches case-insensitively or by slug and otherwise dumps the assignment into whichever component is first. An assignment can end up in a category the user never chose.
13. **Query errors leave permanent spinners.** Review, course workspace, and processing screens handle loading and "not found" but not `isError`.
14. **Dead code / duplicate logic.** `src/lib/mock-data.ts` is unused; the workspace has a fully commented-out Edit/Delete block plus its now-unused mutation and imports, duplicating the live delete on the dashboard.

## P2 — Lower impact

15. **Double extraction window.** Two tabs on the same processing course can both pass the client-side guard before the cached-`extracted` early return lands; needs a status-based server guard.
16. **Blank screen on "/"** while the auth check resolves (`component: () => null`).
17. **"Upload another" silently swallows cleanup failures** with an empty catch, leaving orphan rows behind.
18. **Sidebar item can render with no label** when both course name and code are empty.
19. **Duplicate grading-scale rows** aren't deduped, so ties in letter cutoffs resolve arbitrarily.
20. **Console hydration warning is not an app bug** — it comes from a browser extension (Grammarly attributes) plus the `dark` class applied client-side. Optional: set the theme class server-side to silence it.

## Demo readiness

Blocking a clean demo: 1, 2, 3, 6, 7, 8. Fixing those six makes the product feel finished; the rest are correctness hardening.

## Suggested fix order

1. **Pass 1 (trust):** mount Toaster, real user identity, remove Spanish/CoursePilot strings, fix dashboard loading, delete dead code.
2. **Pass 2 (data integrity):** add `target_grade` column + review-screen control, surface/repair `weightsValid`, clamp weights and needed-score values, unify category matching, fix auto-balance rounding.
3. **Pass 3 (recovery):** show non-ready courses on the dashboard with resume/discard, add `isError` states, wrap the duplicate check, guard double extraction.
