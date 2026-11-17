// Read endpoints: one per page. They hold the SQL the pages used to run themselves, so the web app never touches the database.
import { q } from '../lib/db.js';
import type { Session } from '../lib/session.js';
import { cached } from '../cache.js';
import { classesFor } from '../lib/access.js';
import { MODULES, GROUP_MODULES, navModules, schoolHas, classesForModule, classHasModule, classPolicy, requireModule, type ModuleKey } from '../lib/modules.js';
import { getSchool } from '../lib/settings.js';
import { getLiveWaStatus } from '../lib/wa.js';
import { todayIST } from '../lib/n8n.js';
import { holidayOn } from '../lib/holidays.js';
import { loadCards } from '../lib/reportcard.js';
import { parseParams, scopeClassIds, studentSummary, absenteeList, classComparison, workingDays } from '../lib/reports.js';
import { Redirect } from '../compat.js';

export class NotFound extends Error {}
export class Forbidden extends Error {}

type P = Record<string, string>;
type Role = Session['role'];
export type QueryDef = { roles: Role[]; fn: (s: Session, p: P) => Promise<unknown> };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pageOf = (p: P, size: number) => {
  const page = Math.max(1, Number(p.page) || 1);
  return { page, size, offset: (page - 1) * size };
};
const base = (s: Session) => (s.role === 'admin' ? '/admin' : '/teacher');

/** Shared start of the class based module pages (homework, syllabus, leaves, remarks, timetable, marks). */
async function moduleClass(s: Session, key: ModuleKey, p: P) {
  if (!(await schoolHas(s.sid, key))) throw new Redirect(`${base(s)}?err=${encodeURIComponent('This module is not enabled for your school.')}`);
  const classes = await classesForModule(s, key);
  const classId = classes.find((c) => String(c.id) === p.class)?.id ?? classes[0]?.id ?? 0;
  return { classes, classId };
}
const activeStudents = (classId: number) =>
  classId ? q<{ id: number; roll_no: number; name: string }>(`SELECT id, roll_no, name FROM att.students WHERE class_id = $1 AND active ORDER BY roll_no, name`, [classId]) : Promise.resolve([]);

export const queries: Record<string, QueryDef> = {
  // Menu data for the layout: which modules are on + school name. Cached 30 s.
  nav: {
    roles: ['superadmin', 'admin', 'teacher'],
    fn: async (s) =>
      s.role === 'superadmin'
        ? { modules: [], schoolName: null }
        : cached(`nav:${s.sid}:${s.role}:${s.uid}`, 30_000, async () => ({ modules: await navModules(s), schoolName: (await getSchool(s.sid)).name })),
  },

  'admin-home': {
    roles: ['admin'],
    fn: async (s) => ({
      teachers: await q(`SELECT id, name, email, phone, wa_status FROM att.users WHERE role='teacher' AND school_id = $1 ORDER BY name`, [s.sid]),
      classes: await q(
        `SELECT c.id, c.name, c.teacher_id, u.name AS teacher_name,
                (SELECT COUNT(*) FROM att.students st WHERE st.class_id = c.id AND st.active) AS students
         FROM att.classes c LEFT JOIN att.users u ON u.id = c.teacher_id WHERE c.school_id = $1 ORDER BY c.name`,
        [s.sid]
      ),
    }),
  },

  students: {
    roles: ['admin'],
    fn: async (s, p) => {
      const classes = await classesFor(s);
      const classId = classes.some((c) => c.id === Number(p.class)) ? Number(p.class) : classes[0]?.id || 0;
      const { page, size, offset } = pageOf(p, 50);
      const [t] = classId ? await q<{ n: string }>(`SELECT COUNT(*) AS n FROM att.students WHERE class_id = $1 AND active`, [classId]) : [{ n: '0' }];
      const students = classId
        ? await q(
            `SELECT s.id, s.roll_no, s.name, COALESCE(string_agg(g.name || ' (' || g.phone || ')', ', '), '') AS guardians
             FROM att.students s LEFT JOIN att.guardians g ON g.student_id = s.id
             WHERE s.class_id = $1 AND s.active GROUP BY s.id ORDER BY s.roll_no, s.name LIMIT $2 OFFSET $3`,
            [classId, size, offset]
          )
        : [];
      return { classes, classId, students, total: Number(t.n), page, pages: Math.max(1, Math.ceil(Number(t.n) / size)) };
    },
  },

  'admin-logs': {
    roles: ['admin'],
    fn: async (s, p) => {
      const { page, size, offset } = pageOf(p, 50);
      const [stats] = await q(
        `SELECT COUNT(*) FILTER (WHERE ml2.status='sent') AS sent,
                COUNT(*) FILTER (WHERE ml2.status='failed') AS failed,
                COUNT(*) FILTER (WHERE ml2.status IN ('queued','sending')) AS queued
         FROM att.message_log ml2 JOIN att.attendance a2 ON a2.id = ml2.attendance_id JOIN att.students s2 ON s2.id = a2.student_id JOIN att.classes c2 ON c2.id = s2.class_id
         WHERE ml2.created_at > now() - interval '7 days' AND c2.school_id = $1`,
        [s.sid]
      );
      const rows = await q(
        `SELECT ml.id, ml.status, ml.error, ml.attempts, ml.sent_at, a.session, to_char(a.att_date,'DD Mon') AS d,
                a.status AS att_status, s.name AS student, c.name AS class_name, g.phone
         FROM att.message_log ml
         JOIN att.attendance a ON a.id = ml.attendance_id
         JOIN att.students s ON s.id = a.student_id
         JOIN att.classes c ON c.id = s.class_id
         JOIN att.guardians g ON g.id = ml.guardian_id
         WHERE c.school_id = $1
         ORDER BY ml.id DESC LIMIT $2 OFFSET $3`,
        [s.sid, size, offset]
      );
      return { stats, rows, page, hasMore: rows.length === size };
    },
  },

  'teacher-home': {
    roles: ['teacher'],
    fn: async (s) => {
      const today = todayIST();
      const waStatus = await getLiveWaStatus(s.uid);
      const [me] = await q(`SELECT name, email, phone, instance_name, to_char(created_at, 'DD Mon YYYY') AS joined FROM att.users WHERE id = $1`, [s.uid]);
      const classes = await q(
        `SELECT c.id, c.name,
                (SELECT COUNT(*) FROM att.students st WHERE st.class_id = c.id AND st.active) AS students,
                (SELECT COUNT(*) FROM att.guardians g JOIN att.students st ON st.id = g.student_id WHERE st.class_id = c.id AND st.active) AS parents
         FROM att.classes c WHERE c.teacher_id = $1 ORDER BY c.name`,
        [s.uid]
      );
      const classIds = classes.map((c: any) => c.id);
      const todayRows = classIds.length
        ? await q(
            `SELECT st.class_id, a.session, COUNT(*) FILTER (WHERE a.status = 'P') AS present, COUNT(*) FILTER (WHERE a.status = 'A') AS absent
             FROM att.attendance a JOIN att.students st ON st.id = a.student_id
             WHERE st.class_id = ANY($1::int[]) AND a.att_date = $2::date GROUP BY st.class_id, a.session`,
            [classIds, today]
          )
        : [];
      const [msgs] = classIds.length
        ? await q(
            `SELECT COUNT(*) FILTER (WHERE ml.status = 'sent') AS sent, COUNT(*) FILTER (WHERE ml.status = 'failed') AS failed, COUNT(*) FILTER (WHERE ml.status = 'queued') AS queued
             FROM att.message_log ml JOIN att.attendance a ON a.id = ml.attendance_id JOIN att.students st ON st.id = a.student_id
             WHERE st.class_id = ANY($1::int[]) AND a.att_date = $2::date`,
            [classIds, today]
          )
        : [{ sent: 0, failed: 0, queued: 0 }];
      const roster = classIds.length
        ? await q(
            `SELECT st.class_id, st.roll_no, st.name, COALESCE(string_agg(COALESCE(g.name, 'Parent') || ' · ' || g.phone, ', '), '') AS parents
             FROM att.students st LEFT JOIN att.guardians g ON g.student_id = st.id
             WHERE st.class_id = ANY($1::int[]) AND st.active GROUP BY st.id ORDER BY st.roll_no, st.name`,
            [classIds]
          )
        : [];
      return { today, waStatus, me, classes, todayRows, msgs, roster };
    },
  },

  'teacher-attendance': {
    roles: ['teacher'],
    fn: async (s, p) => {
      const classes = await q<{ id: number; name: string }>(`SELECT id, name FROM att.classes WHERE teacher_id = $1 ORDER BY name`, [s.uid]);
      const waStatus = await getLiveWaStatus(s.uid);
      if (!classes.length) return { classes, waStatus };
      const classId = classes.find((c) => String(c.id) === p.class)?.id ?? classes[0].id;
      const today = todayIST();
      const date = ISO.test(p.date || '') ? p.date : today;
      const hourIST = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
      const session = p.session === 'afternoon' || p.session === 'morning' ? p.session : hourIST < 12 ? 'morning' : 'afternoon';
      const holiday = await holidayOn(s.sid, date);
      const students = await q(
        `SELECT s.id, s.roll_no, s.name, a.status FROM att.students s
         LEFT JOIN att.attendance a ON a.student_id = s.id AND a.att_date = $2::date AND a.session = $3
         WHERE s.class_id = $1 AND s.active ORDER BY s.roll_no, s.name`,
        [classId, date, session]
      );
      const [sent] = await q(`SELECT 1 AS x FROM att.session_marks WHERE class_id=$1 AND att_date=$2::date AND session=$3`, [classId, date, session]);
      return { classes, waStatus, classId, today, date, session, holiday, students, sent: !!sent };
    },
  },

  'teacher-whatsapp': { roles: ['teacher'], fn: async (s) => ({ waStatus: await getLiveWaStatus(s.uid) }) },

  account: {
    roles: ['superadmin', 'admin', 'teacher'],
    fn: async (s) => {
      const [u] = await q(`SELECT name, email, phone FROM att.users WHERE id = $1`, [s.uid]);
      return { u, school: s.role === 'admin' ? await getSchool(s.sid) : null };
    },
  },

  // ---- fees ----
  fees: {
    roles: ['admin'],
    fn: async (s, p) => {
      if (!(await schoolHas(s.sid, 'fees'))) throw new Redirect(`/admin?err=${encodeURIComponent('This module is not enabled for your school.')}`);
      const classes = await classesForModule(s, 'fees');
      const cf = Number(p.class) || null;
      const items = await q(
        `SELECT fi.id, c.name AS class_name, fi.name, fi.amount, to_char(fi.due_date, 'YYYY-MM-DD') AS due_date,
                COUNT(d.id) AS students,
                COALESCE(SUM(d.amount - d.concession), 0) AS billed,
                COALESCE(SUM((SELECT SUM(pp.amount) FROM att.fee_payments pp WHERE pp.due_id = d.id)), 0) AS paid
         FROM att.fee_items fi JOIN att.classes c ON c.id = fi.class_id
         LEFT JOIN att.fee_dues d ON d.fee_item_id = fi.id
         WHERE c.school_id = $2 AND ($1::int IS NULL OR fi.class_id = $1)
         GROUP BY fi.id, c.name ORDER BY fi.due_date NULLS LAST, c.name, fi.id DESC`,
        [cf, s.sid]
      );
      return { classes, items, today: todayIST() };
    },
  },
  'fee-item': {
    roles: ['admin'],
    fn: async (s, p) => {
      const id = Number(p.id);
      const [item] = await q(
        `SELECT fi.id, fi.name, fi.amount, to_char(fi.due_date, 'YYYY-MM-DD') AS due_date, c.name AS class_name
         FROM att.fee_items fi JOIN att.classes c ON c.id = fi.class_id WHERE fi.id = $1 AND c.school_id = $2`,
        [id, s.sid]
      );
      if (!item) throw new NotFound();
      const rows = await q(
        `SELECT d.id AS due_id, st.roll_no, st.name, d.amount, d.concession,
                COALESCE((SELECT SUM(pp.amount) FROM att.fee_payments pp WHERE pp.due_id = d.id), 0) AS paid,
                (SELECT MAX(pp.id) FROM att.fee_payments pp WHERE pp.due_id = d.id) AS last_payment
         FROM att.fee_dues d JOIN att.students st ON st.id = d.student_id
         WHERE d.fee_item_id = $1 AND st.active ORDER BY st.roll_no, st.name`,
        [id]
      );
      return { item, rows, today: todayIST() };
    },
  },
  'fee-receipt': {
    roles: ['admin'],
    fn: async (s, p) => {
      const [r] = await q(
        `SELECT fi.id AS item_id, st.name AS student, st.roll_no, c.name AS class_name, fi.name AS item, pay.amount, to_char(pay.paid_on, 'YYYY-MM-DD') AS paid_on, pay.method, pay.note,
                (d.amount - d.concession - COALESCE((SELECT SUM(amount) FROM att.fee_payments WHERE due_id = d.id), 0)) AS balance
         FROM att.fee_payments pay JOIN att.fee_dues d ON d.id = pay.due_id
         JOIN att.fee_items fi ON fi.id = d.fee_item_id JOIN att.students st ON st.id = d.student_id JOIN att.classes c ON c.id = fi.class_id
         WHERE pay.id = $1 AND c.school_id = $2`,
        [Number(p.id), s.sid]
      );
      if (!r) throw new NotFound();
      return { r, school: await getSchool(s.sid) };
    },
  },

  // ---- groups / super ----
  groups: {
    roles: ['admin'],
    fn: async (s) => {
      const off = (await q<{ module_key: string }>(`SELECT module_key FROM att.school_modules WHERE school_id = $1 AND NOT enabled`, [s.sid])).map((r) => r.module_key);
      const groups = await q(
        `SELECT g.id, g.name, g.grading, g.show_rank, (SELECT COUNT(*) FROM att.classes c WHERE c.group_id = g.id) AS classes
         FROM att.class_groups g WHERE g.school_id = $1 ORDER BY g.id`,
        [s.sid]
      );
      const groupOff = (
        await q<{ group_id: number; module_key: string }>(
          `SELECT gm.group_id, gm.module_key FROM att.class_group_modules gm JOIN att.class_groups g ON g.id = gm.group_id WHERE g.school_id = $1 AND NOT gm.enabled`,
          [s.sid]
        )
      ).map((r) => `${r.group_id}:${r.module_key}`);
      const classes = await q(`SELECT id, name, group_id FROM att.classes WHERE school_id = $1 ORDER BY name`, [s.sid]);
      return { off, groups, groupOff, classes, groupModules: GROUP_MODULES };
    },
  },
  'super-schools': {
    roles: ['superadmin'],
    fn: async () => ({
      schools: await q(
        `SELECT s.id, s.name, s.active,
                (SELECT COUNT(*) FROM att.users u WHERE u.school_id = s.id AND u.role = 'teacher') AS teachers,
                (SELECT COUNT(*) FROM att.classes c WHERE c.school_id = s.id) AS classes,
                (SELECT COUNT(*) FROM att.students st JOIN att.classes c ON c.id = st.class_id WHERE c.school_id = s.id AND st.active) AS students,
                to_char(s.created_at, 'DD Mon YYYY') AS created
         FROM att.schools s ORDER BY s.name`
      ),
    }),
  },
  'super-school': {
    roles: ['superadmin'],
    fn: async (_s, p) => {
      const id = Number(p.id);
      const [school] = await q(`SELECT id, name, address, active FROM att.schools WHERE id = $1`, [id]);
      if (!school) throw new NotFound();
      const off = (await q<{ module_key: string }>(`SELECT module_key FROM att.school_modules WHERE school_id = $1 AND NOT enabled`, [id])).map((r) => r.module_key);
      const admins = await q(`SELECT id, name, email FROM att.users WHERE school_id = $1 AND role = 'admin' ORDER BY id`, [id]);
      const [c] = await q(
        `SELECT (SELECT COUNT(*) FROM att.users WHERE school_id = $1 AND role = 'teacher') AS teachers,
                (SELECT COUNT(*) FROM att.classes WHERE school_id = $1) AS classes,
                (SELECT COUNT(*) FROM att.students st JOIN att.classes c ON c.id = st.class_id WHERE c.school_id = $1 AND st.active) AS students`,
        [id]
      );
      return { school, off, admins, c, modules: MODULES };
    },
  },

  // ---- announcements / holidays ----
  announcements: {
    roles: ['admin', 'teacher'],
    fn: async (s) => {
      if (!(await schoolHas(s.sid, 'announcements'))) throw new Redirect(`${base(s)}?err=${encodeURIComponent('This module is not enabled for your school.')}`);
      const classes = await classesFor(s);
      const counts = await q<{ class_id: number; n: string }>(
        `SELECT st.class_id, COUNT(DISTINCT g.phone) AS n FROM att.guardians g JOIN att.students st ON st.id = g.student_id AND st.active
         JOIN att.classes cc ON cc.id = st.class_id WHERE g.opt_in AND cc.school_id = $1 GROUP BY st.class_id`,
        [s.sid]
      );
      const [{ total }] = await q<{ total: string }>(
        `SELECT COUNT(DISTINCT g.phone) AS total FROM att.guardians g JOIN att.students st ON st.id = g.student_id AND st.active JOIN att.classes cc ON cc.id = st.class_id WHERE g.opt_in AND cc.school_id = $1`,
        [s.sid]
      );
      const history = await q(
        `SELECT a.id, a.title,
                CASE WHEN a.all_school THEN 'Whole school' ELSE COALESCE('Class ' || c.name, 'Class') END AS audience,
                to_char(a.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM') AS created, a.recipients,
                (SELECT COUNT(*) FROM att.notice_log n WHERE n.kind='announcement' AND n.ref_id = a.id AND n.status='sent') AS sent,
                (SELECT COUNT(*) FROM att.notice_log n WHERE n.kind='announcement' AND n.ref_id = a.id AND n.status='failed') AS failed,
                (SELECT COUNT(*) FROM att.notice_log n WHERE n.kind='announcement' AND n.ref_id = a.id AND n.status='queued') AS pending
         FROM att.announcements a LEFT JOIN att.classes c ON c.id = a.class_id
         WHERE a.school_id = $3 AND ($1 = 'admin' OR a.created_by = $2) ORDER BY a.id DESC LIMIT 30`,
        [s.role, s.uid, s.sid]
      );
      return { classes, counts: counts.map((c) => [c.class_id, Number(c.n)]), total: Number(total), history };
    },
  },
  holidays: {
    roles: ['admin', 'teacher'],
    fn: async (s) => {
      if (!(await schoolHas(s.sid, 'holidays'))) throw new Redirect(`${base(s)}?err=${encodeURIComponent('This module is not enabled for your school.')}`);
      const today = todayIST();
      const rows = await q(
        `SELECT id, to_char(holiday_date, 'YYYY-MM-DD') AS d, name, to_char(holiday_date, 'Dy') AS dow FROM att.holidays
         WHERE school_id = $2 AND holiday_date >= ($1::date - 60) ORDER BY holiday_date`,
        [today, s.sid]
      );
      return { today, rows };
    },
  },

  // ---- academic: timetable / marks ----
  timetable: {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const { classes, classId } = await moduleClass(s, 'timetable', p);
      const rows = classId ? await q(`SELECT day_of_week, period, subject FROM att.timetable WHERE class_id = $1`, [classId]) : [];
      return { classes, classId, rows };
    },
  },
  'marks-list': {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const { classes, classId } = await moduleClass(s, 'marks', p);
      const exams = classId
        ? await q(
            `SELECT e.id, e.name, to_char(e.exam_date, 'DD Mon YYYY') AS date_label,
                    (SELECT COUNT(*) FROM att.exam_subjects x WHERE x.exam_id = e.id) AS subjects,
                    (SELECT COUNT(DISTINCT m.student_id) FROM att.marks m WHERE m.exam_id = e.id) AS students_marked
             FROM att.exams e WHERE e.class_id = $1 ORDER BY e.exam_date DESC NULLS LAST, e.id DESC LIMIT 100`,
            [classId]
          )
        : [];
      return { classes, classId, exams, today: todayIST() };
    },
  },
  exam: {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const examId = Number(p.id);
      const [exam] = await q(
        `SELECT e.id, e.name, e.class_id, c.name AS class_name, c.teacher_id, to_char(e.exam_date, 'DD Mon YYYY') AS date_label
         FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1 AND c.school_id = $2`,
        [examId, s.sid]
      );
      if (!exam || (s.role === 'teacher' && exam.teacher_id !== s.uid) || !(await classHasModule(exam.class_id, 'marks'))) throw new NotFound();
      return {
        exam,
        policy: await classPolicy(exam.class_id),
        cardsOn: await classHasModule(exam.class_id, 'reportcards'),
        subjects: await q(`SELECT subject, max_marks FROM att.exam_subjects WHERE exam_id = $1 ORDER BY position`, [examId]),
        students: await q(`SELECT id, roll_no, name FROM att.students WHERE class_id = $1 AND active ORDER BY roll_no, name`, [exam.class_id]),
        markRows: await q(`SELECT student_id, subject, marks FROM att.marks WHERE exam_id = $1`, [examId]),
      };
    },
  },
  'report-cards': {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const examId = Number(p.exam);
      const [own] = await q<{ teacher_id: number | null; class_id: number }>(
        `SELECT c.teacher_id, c.id AS class_id FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1 AND c.school_id = $2`,
        [examId, s.sid]
      );
      if (!own || (s.role === 'teacher' && own.teacher_id !== s.uid) || !(await classHasModule(own.class_id, 'reportcards'))) throw new NotFound();
      const cards = await loadCards(examId, p.student ? Number(p.student) : undefined);
      if (!cards.length) throw new NotFound();
      return { cards };
    },
  },

  // ---- new class modules ----
  homework: {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const { classes, classId } = await moduleClass(s, 'homework', p);
      const rows = classId
        ? await q(
            `SELECT id, subject, title, details, to_char(due_date, 'YYYY-MM-DD') AS due, to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon') AS created
             FROM att.homework WHERE class_id = $1 ORDER BY created_at DESC LIMIT 60`,
            [classId]
          )
        : [];
      return { classes, classId, rows, today: todayIST() };
    },
  },
  syllabus: {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const { classes, classId } = await moduleClass(s, 'syllabus', p);
      const topics = classId
        ? await q(`SELECT id, subject, chapter, status, to_char(completed_on, 'YYYY-MM-DD') AS done_on FROM att.syllabus_topics WHERE class_id = $1 ORDER BY subject, position, id`, [classId])
        : [];
      return { classes, classId, topics };
    },
  },
  leaves: {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const { classes, classId } = await moduleClass(s, 'leaves', p);
      const rows = classId
        ? await q(
            `SELECT l.id, st.name AS student, to_char(l.from_date,'YYYY-MM-DD') AS f, to_char(l.to_date,'YYYY-MM-DD') AS t, l.reason, l.status
             FROM att.leave_requests l JOIN att.students st ON st.id = l.student_id WHERE st.class_id = $1
             ORDER BY (l.status = 'pending') DESC, l.from_date DESC LIMIT 80`,
            [classId]
          )
        : [];
      return { classes, classId, students: await activeStudents(classId), rows, today: todayIST() };
    },
  },
  remarks: {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      const { classes, classId } = await moduleClass(s, 'remarks', p);
      const rows = classId
        ? await q(
            `SELECT r.id, st.name AS student, r.kind, r.note, to_char(r.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY') AS created, u.name AS by
             FROM att.student_remarks r JOIN att.students st ON st.id = r.student_id LEFT JOIN att.users u ON u.id = r.created_by
             WHERE st.class_id = $1 ORDER BY r.created_at DESC LIMIT 60`,
            [classId]
          )
        : [];
      return { classes, classId, students: await activeStudents(classId), rows };
    },
  },

  // ---- reports ----
  reports: {
    roles: ['admin', 'teacher'],
    fn: async (s, p) => {
      if (!(await schoolHas(s.sid, 'reports'))) throw new Redirect(`${base(s)}?err=${encodeURIComponent('This module is not enabled for your school.')}`);
      const classes = await classesFor(s);
      const params = parseParams(p, s.role);
      const ids = await scopeClassIds(s, params.classId);
      if (!classes.length) return { classes, params };
      const days = await workingDays(ids, params.from, params.to);
      const stu = params.type === 'students' ? await studentSummary(ids, params.from, params.to) : [];
      const abs = params.type === 'absentees' ? await absenteeList(ids, params.from, params.to) : [];
      const cls = params.type === 'classes' ? await classComparison(ids, params.from, params.to) : [];
      return { classes, params, days, stu, abs, cls };
    },
  },
};
