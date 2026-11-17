'use client';

import React, { useState } from 'react';

type Mark = 'P' | 'A' | null;
type Stu = { id: number; roll: number; name: string; status: Mark };

export default function AttendanceForm({
  classId,
  date,
  session,
  students,
}: {
  classId: number;
  date: string;
  session: string;
  students: Stu[];
}) {
  const [marks, setMarks] = useState<Record<number, Mark>>(
    Object.fromEntries(students.map((s) => [s.id, s.status]))
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const presentCount = students.filter((s) => marks[s.id] === 'P').length;
  const absentCount = students.filter((s) => marks[s.id] === 'A').length;
  const unmarkedCount = students.length - presentCount - absentCount;

  const setStatus = (id: number, v: 'P' | 'A') => {
    setMarks((m) => ({ ...m, [id]: v }));
  };

  const markAll = (v: 'P' | 'A') => {
    setMarks(Object.fromEntries(students.map((s) => [s.id, v])));
  };

  async function submit() {
    if (unmarkedCount > 0) {
      setResult({ ok: false, text: `${unmarkedCount} student(s) are not marked yet. Please mark everyone Present or Absent.` });
      return;
    }
    if (
      !confirm(
        `Submit ${session.toUpperCase()} attendance?\n\n• ${presentCount} Present\n• ${absentCount} Absent\n\nParents of marked students will receive a WhatsApp message.`
      )
    ) {
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          class_id: classId,
          date,
          session,
          marks: students.map((s) => ({ student_id: s.id, status: marks[s.id] })),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setResult({ ok: false, text: j.error || 'Failed to record attendance' });
      } else {
        setResult({
          ok: true,
          text: j.queued
            ? `Attendance saved! ${j.queued} WhatsApp message${j.queued > 1 ? 's are' : ' is'} queued and will go out one by one (about ${j.eta_minutes} min).`
            : 'Attendance saved!',
        });
      }
    } catch {
      setResult({ ok: false, text: 'Network connection error. Please try again.' });
    }
    setBusy(false);
  }

  return (
    <div className="card">
      {/* Attendance Stats & Quick Actions Bar */}
      <div className="attendance-stats-bar">
        <div className="stats-group">
          <span className="stat-pill">
            <span className="stat-dot p" />
            <span>{presentCount} Present</span>
          </span>
          <span className="stat-pill">
            <span className="stat-dot a" />
            <span>{absentCount} Absent</span>
          </span>
          {unmarkedCount > 0 && (
            <span className="stat-pill">
              <span className="stat-dot" style={{ background: '#94a3b8' }} />
              <span>{unmarkedCount} Not marked</span>
            </span>
          )}
          <span className="muted">Total: {students.length}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ghost"
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => markAll('P')}
          >
            All Present
          </button>
          <button
            type="button"
            className="ghost"
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => markAll('A')}
          >
            All Absent
          </button>
        </div>
      </div>

      {/* Student List Grid (Mobile Responsive Cards) */}
      <div className="attendance-grid">
        {students.map((s) => {
          const isPresent = marks[s.id] === 'P';
          const isAbsent = marks[s.id] === 'A';
          return (
            <div key={s.id} className={`student-card ${isPresent ? 'is-present' : isAbsent ? 'is-absent' : 'is-unmarked'}`}>
              <div className="student-info">
                <div className="student-roll">#{s.roll}</div>
                <div className="student-name" title={s.name}>
                  {s.name}
                </div>
              </div>

              <span className={`status-label ${isPresent ? 'p' : isAbsent ? 'a' : 'u'}`}>
                {isPresent ? '✓ Present' : isAbsent ? '✕ Absent' : 'Not marked'}
              </span>

              <div className="mark">
                <button
                  type="button"
                  aria-label={`${s.name} present`}
                  className={`p ${isPresent ? 'on' : ''}`}
                  onClick={() => setStatus(s.id, 'P')}
                >
                  ✓
                </button>
                <button
                  type="button"
                  aria-label={`${s.name} absent`}
                  className={`a ${isAbsent ? 'on' : ''}`}
                  onClick={() => setStatus(s.id, 'A')}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {!students.length && (
          <div className="muted" style={{ padding: '24px 0', textAlign: 'center', gridColumn: '1 / -1' }}>
            No active students found in this class.
          </div>
        )}
      </div>

      {result && (
        <div className={`msg ${result.ok ? '' : 'err'}`} style={{ marginTop: 20 }}>
          {result.text}
        </div>
      )}

      {/* Submit Button */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !students.length}
          style={{ width: '100%', maxWidth: 280, height: 46 }}
        >
          {busy ? 'Saving Attendance…' : 'Submit & Send WhatsApp'}
        </button>
      </div>
    </div>
  );
}
