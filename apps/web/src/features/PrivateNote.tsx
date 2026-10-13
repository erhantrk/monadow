import { useEffect, useState } from 'react';
import { LockKeyhole, PencilLine, StickyNote } from 'lucide-react';
import { useSession } from '@/store/session';
import { loadNote, saveNote } from '@/lib/vault';

/** A per-payment note, AES-GCM sealed with the passkey-derived vault key. */
export function PrivateNote({ subject }: { subject: string }) {
  const vaultKey = useSession((s) => s.keys?.vaultKey);
  const [note, setNote] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultKey) return;
    loadNote(vaultKey, subject)
      .then(setNote)
      .catch(() => {
        setNote(null);
        setErr('Stored note failed authentication (tampered or another passkey).');
      });
  }, [vaultKey, subject]);

  if (!vaultKey || note === undefined) return null;

  async function save() {
    if (!vaultKey) return;
    try {
      await saveNote(vaultKey, subject, draft);
      setNote(draft.trim() ? draft : null);
      setEditing(false);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (editing) {
    return (
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          autoFocus
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Rent from Alex — encrypted, only you can read it"
          className="h-9 min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 text-[13px] text-ink-50 placeholder:text-ink-500 focus:border-mon-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button type="submit" className="h-9 rounded-lg bg-mon-500 px-3 text-[13px] font-semibold text-white hover:bg-mon-400">
            Encrypt &amp; save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg px-3 text-[13px] text-ink-400 hover:text-ink-100">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-2.5">
      {note ? (
        <div className="flex items-start gap-2 rounded-lg border border-mon-500/25 bg-mon-500/5 px-3 py-2">
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-mon-300" />
          <div className="min-w-0 flex-1">
            <div className="break-words text-[13px] text-ink-100">{note}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-signal-ok">
              <LockKeyhole className="size-3" /> decrypted with passkey-derived vault key
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft(note);
              setEditing(true);
            }}
            className="shrink-0 text-ink-400 hover:text-mon-300"
            aria-label="Edit note"
          >
            <PencilLine className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft('');
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-400 hover:text-mon-300"
        >
          <LockKeyhole className="size-3" /> Add private note
        </button>
      )}
      {err && <div className="mt-1 text-[11px] text-signal-bad">{err}</div>}
    </div>
  );
}
