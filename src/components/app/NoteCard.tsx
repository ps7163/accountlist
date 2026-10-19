import type { Note } from '@/lib/db/schema';
import { Icon, Logo } from '../icons';

export function NoteCard({ note, target, mini, onClick }: { note: Pick<Note, 'id' | 'title' | 'body' | 'color' | 'pinned' | 'updatedAt'>; target?: { name: string; logo: string }; mini?: boolean; onClick?: () => void }) {
  return (
    <article className={`note nc-${note.color}`} tabIndex={0} role="button" onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick?.())}>
      <div className="note-h">
        <b>{note.title}</b>
        {note.pinned && <span className="pin" title="已置顶"><Icon name="pin" /></span>}
      </div>
      {note.body && <div className="note-b">{note.body}</div>}
      <div className="note-f">
        {!mini && target ? (
          <span className="note-t"><Logo name={target.logo} size="xs" /><span className="ell">{target.name}</span></span>
        ) : <span />}
        <span className="t3">{note.updatedAt.slice(5, 10)}</span>
      </div>
    </article>
  );
}
