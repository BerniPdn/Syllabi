import { DEFAULT_SCALE, type ChatMessage, type Course, type Insight } from "./types";

/**
 * Mock data for the UI design pass. Replaced by real data once the backend
 * is wired up — the shape matches the planned database entities exactly.
 */

const isoIn = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

export const MOCK_COURSES: Course[] = [
  {
    id: "algorithms",
    name: "Design & Analysis of Algorithms",
    code: "CS 3510",
    professor: "Prof. Elena Márquez",
    semester: "Fall 2026",
    targetGrade: 93,
    scale: DEFAULT_SCALE,
    categories: [
      { id: "hw", name: "Homework", weight: 25 },
      { id: "midterm", name: "Midterm", weight: 20 },
      { id: "project", name: "Project", weight: 30 },
      { id: "final", name: "Final Exam", weight: 20 },
      { id: "part", name: "Participation", weight: 5 },
    ],
    assignments: [
      { id: "a1", categoryId: "hw", name: "Homework 1 — Divide & Conquer", weight: null, dueDate: isoIn(-34), score: 96 },
      { id: "a2", categoryId: "hw", name: "Homework 2 — Greedy Algorithms", weight: null, dueDate: isoIn(-20), score: 88 },
      { id: "a3", categoryId: "hw", name: "Homework 3 — Dynamic Programming", weight: null, dueDate: isoIn(-6), score: 91 },
      { id: "a4", categoryId: "hw", name: "Homework 4 — Graph Algorithms", weight: null, dueDate: isoIn(4), score: null },
      { id: "a5", categoryId: "hw", name: "Homework 5 — Network Flow", weight: null, dueDate: isoIn(18), score: null },
      { id: "m1", categoryId: "midterm", name: "Midterm Exam", weight: null, dueDate: isoIn(-12), score: 84 },
      { id: "p1", categoryId: "project", name: "Project Proposal", weight: 1, dueDate: isoIn(-8), score: 95 },
      { id: "p2", categoryId: "project", name: "Project Milestone", weight: 2, dueDate: isoIn(9), score: null },
      { id: "p3", categoryId: "project", name: "Final Project Report", weight: 3, dueDate: isoIn(31), score: null },
      { id: "f1", categoryId: "final", name: "Final Exam", weight: null, dueDate: isoIn(45), score: null },
      { id: "pa1", categoryId: "part", name: "Participation", weight: null, dueDate: null, score: 100 },
    ],
    policies: [
      "The lowest homework grade is dropped at the end of the semester.",
      "Late submissions lose 10% per day, up to three days.",
      "Attendance is required; more than three absences lowers participation.",
      "The final exam may replace the midterm if the final score is higher.",
    ],
  },
  {
    id: "microecon",
    name: "Intermediate Microeconomics",
    code: "ECON 2100",
    professor: "Prof. Daniel Okafor",
    semester: "Fall 2026",
    targetGrade: 90,
    scale: DEFAULT_SCALE,
    categories: [
      { id: "ps", name: "Problem Sets", weight: 30 },
      { id: "mid", name: "Midterms", weight: 30 },
      { id: "fin", name: "Final Exam", weight: 35 },
      { id: "att", name: "Attendance", weight: 5 },
    ],
    assignments: [
      { id: "e1", categoryId: "ps", name: "Problem Set 1", weight: null, dueDate: isoIn(-28), score: 92 },
      { id: "e2", categoryId: "ps", name: "Problem Set 2", weight: null, dueDate: isoIn(-14), score: 78 },
      { id: "e3", categoryId: "ps", name: "Problem Set 3", weight: null, dueDate: isoIn(2), score: null },
      { id: "e4", categoryId: "ps", name: "Problem Set 4", weight: null, dueDate: isoIn(21), score: null },
      { id: "em1", categoryId: "mid", name: "Midterm 1", weight: null, dueDate: isoIn(-18), score: 81 },
      { id: "em2", categoryId: "mid", name: "Midterm 2", weight: null, dueDate: isoIn(12), score: null },
      { id: "ef", categoryId: "fin", name: "Final Exam", weight: null, dueDate: isoIn(48), score: null },
      { id: "ea", categoryId: "att", name: "Attendance", weight: null, dueDate: null, score: 95 },
    ],
    policies: [
      "Two lowest problem set grades are dropped.",
      "No make-up exams without documented absence.",
      "Extra credit worth up to 2 points is available through the research seminar.",
    ],
  },
  {
    id: "ochem",
    name: "Organic Chemistry II",
    code: "CHEM 2312",
    professor: "Prof. Hannah Lindqvist",
    semester: "Fall 2026",
    targetGrade: 87,
    scale: DEFAULT_SCALE,
    categories: [
      { id: "quiz", name: "Quizzes", weight: 20 },
      { id: "lab", name: "Lab Reports", weight: 25 },
      { id: "exams", name: "Exams", weight: 30 },
      { id: "cfinal", name: "Final Exam", weight: 25 },
    ],
    assignments: [
      { id: "q1", categoryId: "quiz", name: "Quiz 1", weight: null, dueDate: isoIn(-30), score: 88 },
      { id: "q2", categoryId: "quiz", name: "Quiz 2", weight: null, dueDate: isoIn(-16), score: 74 },
      { id: "q3", categoryId: "quiz", name: "Quiz 3", weight: null, dueDate: isoIn(1), score: null },
      { id: "l1", categoryId: "lab", name: "Lab Report — Aldol Condensation", weight: null, dueDate: isoIn(-9), score: 90 },
      { id: "l2", categoryId: "lab", name: "Lab Report — Grignard Synthesis", weight: null, dueDate: isoIn(6), score: null },
      { id: "x1", categoryId: "exams", name: "Exam 1", weight: null, dueDate: isoIn(-22), score: 79 },
      { id: "x2", categoryId: "exams", name: "Exam 2", weight: null, dueDate: isoIn(15), score: null },
      { id: "cf", categoryId: "cfinal", name: "Final Exam", weight: null, dueDate: isoIn(43), score: null },
    ],
    policies: [
      "Lab attendance is mandatory; a missed lab cannot be made up.",
      "Lowest quiz score is dropped.",
      "Late lab reports lose 5% per day.",
    ],
  },
];

export const getCourse = (id: string) => MOCK_COURSES.find((course) => course.id === id);

export const MOCK_INSIGHTS: Record<string, Insight[]> = {
  algorithms: [
    { id: "i1", tone: "positive", body: "You're on track for an **A-**. Holding your current average through the remaining work lands you at 91.4." },
    { id: "i2", tone: "attention", body: "The **final project report** now carries 22% of everything left to earn — more than the final exam." },
    { id: "i3", tone: "neutral", body: "You need to average **94** across all remaining work to reach your 93 target." },
    { id: "i4", tone: "attention", body: "Two deadlines land within the next 10 days: Homework 4 and the Project Milestone." },
    { id: "i5", tone: "neutral", body: "Participation is fully earned and can't move your grade any further." },
  ],
  microecon: [
    { id: "i1", tone: "attention", body: "You're **2.6 points below** your target pace. Problem Set 2 is the main drag." },
    { id: "i2", tone: "neutral", body: "The **final exam** is 35% of the grade — the single biggest lever you have left." },
    { id: "i3", tone: "positive", body: "Two problem set grades get dropped, so Problem Set 2 may not count against you." },
  ],
  ochem: [
    { id: "i1", tone: "attention", body: "Current average is **82.1**, below your 87 target. Exam 2 is the turning point." },
    { id: "i2", tone: "neutral", body: "You need roughly **91** on everything remaining to reach a B+." },
    { id: "i3", tone: "positive", body: "Your lowest quiz is dropped, which adds about 0.9 points back." },
  ],
};

export const MOCK_CHATS: Record<string, ChatMessage[]> = {
  algorithms: [
    { id: "c1", role: "user", content: "What do I need on the final to earn an A?" },
    {
      id: "c2",
      role: "assistant",
      content:
        "With your graded work so far you're at **90.6%**, and 61.5% of the course is still ungraded.\n\nTo finish at 93 you'd need to average **94.5** across everything remaining. If you hold 92 on the homework and project work, the final exam alone would need about **99** — so the project report is the more realistic lever.\n\nOne thing in your favor: the syllabus drops your lowest homework grade.",
    },
    { id: "c3", role: "user", content: "Can I skip Homework 5?" },
    {
      id: "c4",
      role: "assistant",
      content:
        "You can, but it costs you. Homework 5 is worth **5% of your final grade**, and your lowest homework is already going to be dropped — right now that's Homework 2 at 88.\n\nSkipping it would make a 0 your dropped score instead, so you'd lose the 88 → the net effect is roughly **-1.2 points** on your final grade. Not fatal, but it moves an A- to a B+ if the rest stays flat.",
    },
  ],
};

export const QUICK_ACTIONS = [
  "What do I need for an A?",
  "Upcoming deadlines",
  "Explain grading policy",
  "Next assignment",
  "Course summary",
];

/** Canned reply used while the UI is still front-end only. */
export const MOCK_REPLY =
  "Here's what your course data shows.\n\nYou have **three graded homework assignments** averaging 91.7, a midterm at 84, and the project proposal at 95. That puts your current weighted average at **90.6**.\n\nThe biggest remaining lever is the **final project report** — it carries 22% of everything still ungraded, more than the final exam itself.";

export const SYLLABUS_STAGES = [
  "Reading your syllabus",
  "Finding grading components",
  "Extracting deadlines",
  "Understanding course policies",
  "Building your workspace",
];
