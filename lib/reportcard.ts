import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { q } from '@/lib/db';
import { grade } from '@/lib/academic';
import { getSchool } from '@/lib/settings';

export type Card = {
  school: { name: string; address: string };
  exam: { id: number; name: string; date: string | null; classId: number; className: string };
  student: { id: number; roll_no: number; name: string };
  subjects: { subject: string; max: number; got: number | null }[];
  total: number;
  maxTotal: number;
  pct: number;
  grade: string;
  rank: number | null;
  classSize: number;
  complete: boolean;
  attendance: number | null;
};

export async function loadCards(examId: number, studentId?: number): Promise<Card[]> {
  const [exam] = await q<{ id: number; name: string; class_id: number; class_name: string; date: string | null }>(
    `SELECT e.id, e.name, e.class_id, c.name AS class_name, to_char(e.exam_date, 'DD Mon YYYY') AS date
     FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1`,
    [examId]
  );
  if (!exam) return [];
  const school = await getSchool();
  const subs = await q<{ subject: string; max_marks: number }>(`SELECT subject, max_marks FROM att.exam_subjects WHERE exam_id = $1 ORDER BY position`, [examId]);
  const students = await q<{ id: number; roll_no: number; name: string }>(
    `SELECT id, roll_no, name FROM att.students WHERE class_id = $1 AND active ORDER BY roll_no, name`,
    [exam.class_id]
  );
  const mk = await q<{ student_id: number; subject: string; marks: string }>(`SELECT student_id, subject, marks FROM att.marks WHERE exam_id = $1`, [examId]);
  const marks = new Map(mk.map((m) => [`${m.student_id}_${m.subject}`, Number(m.marks)]));
  const att = await q<{ student_id: number; p: string; t: string }>(
    `SELECT a.student_id, COUNT(*) FILTER (WHERE a.status = 'P') AS p, COUNT(*) AS t
     FROM att.attendance a JOIN att.students s ON s.id = a.student_id WHERE s.class_id = $1 GROUP BY a.student_id`,
    [exam.class_id]
  );
  const attMap = new Map(att.map((a) => [a.student_id, Number(a.t) ? (Number(a.p) / Number(a.t)) * 100 : null]));
  const maxTotal = subs.reduce((a, s) => a + s.max_marks, 0);

  const all = students.map((st) => {
    const subjects = subs.map((s) => ({ subject: s.subject, max: s.max_marks, got: marks.get(`${st.id}_${s.subject}`) ?? null }));
    const complete = subjects.every((s) => s.got !== null);
    const total = subjects.reduce((a, s) => a + (s.got ?? 0), 0);
    return { st, subjects, complete, total };
  });
  const ranked = all.filter((r) => r.complete).sort((a, b) => b.total - a.total);
  const rankOf = new Map<number, number>();
  ranked.forEach((r, i) => rankOf.set(r.st.id, i > 0 && r.total === ranked[i - 1].total ? rankOf.get(ranked[i - 1].st.id)! : i + 1));

  return all
    .filter((r) => !studentId || r.st.id === studentId)
    .map((r) => {
      const pct = maxTotal ? (r.total / maxTotal) * 100 : 0;
      return {
        school,
        exam: { id: exam.id, name: exam.name, date: exam.date, classId: exam.class_id, className: exam.class_name },
        student: r.st,
        subjects: r.subjects,
        total: r.total,
        maxTotal,
        pct,
        grade: grade(pct),
        rank: r.complete ? rankOf.get(r.st.id) ?? null : null,
        classSize: ranked.length,
        complete: r.complete,
        attendance: attMap.get(r.st.id) ?? null,
      };
    });
}

/** Standard PDF fonts only know WinAnsi (Latin) characters; others become '?'. */
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, '?');

export async function buildPdf(cards: Card[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.2);
  const grey = rgb(0.4, 0.43, 0.5);
  const accent = rgb(0.2, 0.3, 0.8);
  const line = rgb(0.82, 0.84, 0.88);

  for (const c of cards) {
    const page = pdf.addPage([595, 842]);
    const W = 595;
    const text = (t: string, x: number, y: number, size = 11, f = font, color = ink) => page.drawText(clean(t), { x, y, size, font: f, color });
    const center = (t: string, y: number, size: number, f = bold, color = ink) => {
      const w = f.widthOfTextAtSize(clean(t), size);
      text(t, (W - w) / 2, y, size, f, color);
    };
    const right = (t: string, xr: number, y: number, size = 11, f = font) => text(t, xr - f.widthOfTextAtSize(clean(t), size), y, size, f);

    page.drawRectangle({ x: 30, y: 30, width: W - 60, height: 782, borderColor: accent, borderWidth: 1.5 });
    page.drawRectangle({ x: 30, y: 740, width: W - 60, height: 72, color: accent });
    center(c.school.name.slice(0, 48), 782, 20, bold, rgb(1, 1, 1));
    if (c.school.address) center(c.school.address.slice(0, 80), 762, 9, font, rgb(0.9, 0.92, 1));
    center('REPORT CARD', 700, 16, bold, accent);
    center(`${c.exam.name}${c.exam.date ? '  |  ' + c.exam.date : ''}`, 680, 10.5, font, grey);

    text('Student', 55, 640, 9, font, grey); text(c.student.name, 55, 624, 14, bold);
    text('Class', 330, 640, 9, font, grey); text(c.exam.className, 330, 624, 13, bold);
    text('Roll No.', 470, 640, 9, font, grey); text(String(c.student.roll_no), 470, 624, 13, bold);

    // Marks table
    let y = 580;
    page.drawRectangle({ x: 50, y: y - 6, width: W - 100, height: 24, color: rgb(0.93, 0.95, 1) });
    text('Subject', 60, y, 10.5, bold);
    right('Max marks', 380, y, 10.5, bold);
    right('Marks obtained', 500, y, 10.5, bold);
    y -= 26;
    for (const s of c.subjects) {
      text(s.subject.slice(0, 40), 60, y, 11);
      right(String(s.max), 380, y);
      const fail = s.got !== null && s.got < s.max * 0.35;
      if (fail) page.drawText(clean(s.got === null ? '-' : String(s.got)), { x: 500 - bold.widthOfTextAtSize(String(s.got), 11), y, size: 11, font: bold, color: rgb(0.8, 0.1, 0.1) });
      else right(s.got === null ? '-' : String(s.got), 500, y);
      page.drawLine({ start: { x: 50, y: y - 8 }, end: { x: W - 50, y: y - 8 }, thickness: 0.5, color: line });
      y -= 26;
      if (y < 330) break;
    }
    page.drawRectangle({ x: 50, y: y - 6, width: W - 100, height: 24, color: rgb(0.93, 0.95, 1) });
    text('Total', 60, y, 11.5, bold);
    right(String(c.maxTotal), 380, y, 11.5, bold);
    right(c.complete ? String(c.total) : '-', 500, y, 11.5, bold);

    // Summary boxes
    y -= 70;
    const box = (x: number, label: string, value: string) => {
      page.drawRectangle({ x, y: y - 8, width: 112, height: 58, borderColor: line, borderWidth: 1 });
      const w = bold.widthOfTextAtSize(clean(value), 18);
      text(value, x + (112 - w) / 2, y + 22, 18, bold, accent);
      const lw = font.widthOfTextAtSize(label, 9);
      text(label, x + (112 - lw) / 2, y + 4, 9, font, grey);
    };
    box(50, 'Percentage', c.complete ? `${c.pct.toFixed(1)}%` : '-');
    box(172, 'Grade', c.complete ? c.grade : '-');
    box(294, 'Class rank', c.rank ? `${c.rank} / ${c.classSize}` : '-');
    box(416, 'Attendance', c.attendance === null ? '-' : `${c.attendance.toFixed(0)}%`);

    if (!c.complete) text('Some subject marks are not yet entered.', 55, y - 36, 9.5, font, rgb(0.8, 0.1, 0.1));
    text('Grading: A+ 90+  A 80+  B+ 70+  B 60+  C 50+  D 35+  E below 35', 55, y - 56, 8.5, font, grey);

    // Signatures
    page.drawLine({ start: { x: 60, y: 120 }, end: { x: 190, y: 120 }, thickness: 0.8, color: grey });
    page.drawLine({ start: { x: 232, y: 120 }, end: { x: 362, y: 120 }, thickness: 0.8, color: grey });
    page.drawLine({ start: { x: 405, y: 120 }, end: { x: 535, y: 120 }, thickness: 0.8, color: grey });
    text('Class Teacher', 90, 106, 9, font, grey);
    text('Parent', 280, 106, 9, font, grey);
    text('Principal', 450, 106, 9, font, grey);
  }
  return pdf.save();
}

export function fileNameFor(c: Card) {
  return `ReportCard-${c.exam.name}-${c.student.name}`.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) + '.pdf';
}
