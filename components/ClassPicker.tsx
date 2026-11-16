'use client';

import React from 'react';

// GET form that reloads the page as soon as the class changes.
export default function ClassPicker({ classes, value }: { classes: { id: number; name: string }[]; value: number }) {
  return (
    <form className="row" method="get" onChange={(e) => e.currentTarget.requestSubmit()}>
      <label>
        Class
        <select name="class" defaultValue={value}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
