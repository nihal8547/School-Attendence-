'use client';
import { useState } from 'react';

type Stu = { id: number; roll: number; name: string; status: 'P' | 'A' };

export default function AttendanceForm({ classId, date, session, students }: { classId: number; date: string; session: string; students: Stu[] }) {
  const [marks, setMarks] = useState<Record<number, 'P' | 'A'>>(Object.fromEntries(students.map((s) => [s.id, s.status])));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const absent = students.filter((s) => marks[s.id] === 'A').length;
  const set = (id: number, v: 'P' | 'A') => setMarks((m) => ({ ...m, [id]: v }));

  async function submit() {
    if (!confirm(`Submit ${session} attendance?\n${students.length - absent} present, ${absent} absent.\nParents will get a WhatsApp message.`)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ class_id: classId, date, session, marks: students.map((s) => ({ student_id: s.id, status: marks[s.id] })) }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) setResult({ ok: false, text: j.error || 'Could not save' });
      else setResult({ ok: true, text: j.notify_started ? 'Saved. Messages are being sent to parents; you will get a summary on WhatsApp.' : 'Saved, but the message sender could not be started. Admin can retry from the Message Log.' });
    } catch {
      setResult({ ok: false, text: 'Network error. Try again.' });
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className="ghost" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'P'])))}>All present</button>
        <span className="muted" style={{ alignSelf: 'center' }}>{students.length - absent} present · {absent} absent</span>
      </div>
      <table>
        <thead><tr><th>Roll</th><th>Student</th><th>Present / Absent</th></tr></thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.roll}</td>
              <td>{s.name}</td>
              <td>
                <div className="mark">
                  <button type="button" aria-label={`${s.name} present`} className={`p ${marks[s.id] === 'P' ? 'on' : ''}`} onClick={() => set(s.id, 'P')}>✓</button>
                  <button type="button" aria-label={`${s.name} absent`} className={`a ${marks[s.id] === 'A' ? 'on' : ''}`} onClick={() => set(s.id, 'A')}>✗</button>
                </div>
              </td>
            </tr>
          ))}
          {!students.length && <tr><td colSpan={3} className="muted">No students in this class yet.</td></tr>}
        </tbody>
      </table>
      {result && <div className={`msg ${result.ok ? '' : 'err'}`} style={{ marginTop: 12 }}>{result.text}</div>}
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={submit} disabled={busy || !students.length}>{busy ? 'Submitting…' : 'Submit attendance'}</button>
      </div>
    </div>
  );
}
