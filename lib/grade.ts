export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export function grade(pct: number) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'E';
}

/** Grade of one subject mark, used where only grades are shown. */
export function subjectGrade(got: number | null, max: number): string {
  return got === null || !max ? '-' : grade((got / max) * 100);
}
