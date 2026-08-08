/**
 * Syllabi domain types. Shared by the grade engine, mock data, and UI.
 */

export type GradeScaleStep = { letter: string; min: number };

export type Category = {
  id: string;
  name: string;
  weight: number; // percent of the final grade
};

export type AssignmentStatus = "graded" | "upcoming" | "overdue";

export type Assignment = {
  id: string;
  categoryId: string;
  name: string;
  /** Relative weight inside its category. null = split the category evenly. */
  weight: number | null;
  dueDate: string | null; // ISO date
  score: number | null; // null = not graded yet
};

export type Course = {
  id: string;
  name: string;
  code: string;
  professor: string;
  semester: string;
  targetGrade: number;
  scale: GradeScaleStep[];
  categories: Category[];
  assignments: Assignment[];
  policies: string[];
};

export const DEFAULT_SCALE: GradeScaleStep[] = [
  { letter: "A", min: 93 },
  { letter: "A-", min: 90 },
  { letter: "B+", min: 87 },
  { letter: "B", min: 83 },
  { letter: "B-", min: 80 },
  { letter: "C+", min: 77 },
  { letter: "C", min: 73 },
  { letter: "C-", min: 70 },
  { letter: "D", min: 60 },
  { letter: "F", min: 0 },
];
