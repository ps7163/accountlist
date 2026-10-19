'use client';

import { NoteCard } from './NoteCard';
import { useApp } from './AppProvider';
import type { NoteInitial } from './NoteForm';
import { Icon } from '../icons';

export interface NoteRow extends Required<Pick<NoteInitial, 'id' | 'targetType' | 'targetId' | 'title' | 'body' | 'color' | 'pinned'>> {
  updatedAt: string;
  target: { name: string; logo: string };
}

export function NotesGrid({ rows }: { rows: NoteRow[] }) {
  const { openNote } = useApp();
  return (
    <div className="notes-grid">
      {rows.map((n) => <NoteCard key={n.id} note={n} target={n.target} onClick={() => openNote(n)} />)}
    </div>
  );
}

export function NewNoteButton() {
  const { openNote } = useApp();
  return <button className="btn btn-primary" onClick={() => openNote()}><Icon name="plus" />新建卡片</button>;
}
