# Syllabi — Product Architecture

An AI academic copilot: upload a syllabus once, get a live course workspace that always answers "where do I stand?".

## Product shape

Five surfaces, nothing more:

1. **Auth** — sign up / log in / log out. Always lands on Dashboard.
2. **Dashboard** — upcoming-deadlines strip (all courses) + one card per course (name, current / target / projected grade, next assignment, days until it, completion % with progress bar) + "Add Course" CTA. Empty state is the welcome screen with a single CTA.
3. **Upload & Review** — drag & drop PDF or image → "Analyzing your syllabus…" → editable review screen (course info, grading components, dates, policies, grading scale, target grade) → confirm creates the course.
4. **Course Workspace** — tabs: Overview, Assignments, Simulator, Insights, Assistant.
5. **Settings-free by design** — dark/light toggle lives in the app header, nothing else.

## Division of responsibility (the core architectural rule)

```text
AI            → reads the syllabus, writes prose, answers questions
App logic     → every number: current, projected, needed, weights, impact
```

The grade engine is a single pure TypeScript module used by Overview, cards, Simulator, and as *pre-computed input* to the AI. The AI never does math; it is handed already-computed numbers and asked to explain them.

## Grade engine (deterministic, pure, unit-testable)

- Categories carry weights; assignments belong to a category and carry an optional weight inside it.
- **Current grade** = weighted average over graded work only (earned / weight-so-far).
- **Projected grade** = graded work at actual scores + ungraded work at its simulated (or assumed-target) score.
- **Needed score** = solve the weighted equation for the remaining bucket to hit the target.
- **Impact** = each remaining item's share of the remaining weight — powers "biggest impact" and Insights.
- **Completion %** = graded weight / total weight.
- Configurable letter scale per course (defaults to a standard US scale, editable on the review screen); target grade is chosen on the review screen.
- Policies are stored as text: displayed in Overview, given to the assistant as context, never applied to the math.

Simulator changes are local state only — sliders recompute instantly, no network, no AI. "Save as actual grade" is an explicit action.

## Data model (Lovable Cloud / Postgres, RLS per user)

```text
profiles          id → auth user
courses           name, professor, semester, target_grade, grading_scale(jsonb),
                  policies(text[]), syllabus_path, status
categories        course_id, name, weight
assignments       course_id, category_id, name, weight, due_date, score, status
insights          course_id, body, generated_at        (latest snapshot)
chat_messages     course_id, role, content, created_at (per-course history)
```

Every table gets grants + RLS scoped to `auth.uid()`. Syllabus files go to private storage with per-user path policies.

## AI surfaces (3 server functions)

| Function | Input | Output |
| --- | --- | --- |
| `extractSyllabus` | uploaded file | structured JSON (course, categories, assignments, policies) validated with Zod |
| `generateInsights` | course + engine-computed numbers | 3-5 short proactive insights, regenerated when grades change |
| `courseChat` | question + course context + engine numbers + history | grounded answer, refuses anything outside the course |

Extraction is vision-capable so images and scanned PDFs work. All three are authenticated server functions; the model is instructed to use only provided context.

## Design direction

Premium, calm, Linear/Notion-adjacent: blue accent, rounded cards, generous spacing, soft shadows, one confident type pairing, first-class dark mode, mobile-first with a real desktop layout. Micro-interactions where they carry meaning — the analyzing state, the simulator's live projected number, tab transitions.

## PWA

Manifest + icons + service worker for install and offline shell. Installable on desktop and mobile.

## Build order

1. Design system + PWA shell + auth + empty dashboard
2. Grade engine with tests (before any UI depends on it)
3. Data model + RLS
4. Upload → extract → review → create course
5. Workspace: Overview, Assignments
6. Simulator
7. Insights + Assistant with quick actions
8. Polish pass: dark mode, responsive, motion, metadata

## Explicitly not built

Moodle / Canvas / Blackboard, calendar sync, push notifications, native apps, professor accounts, collaboration, sharing, social, gamification, analytics dashboards.
