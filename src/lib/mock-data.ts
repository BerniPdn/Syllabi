import { DEFAULT_SCALE, type Course } from "./types";

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
