import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { Trash2, MessageSquarePlus, Highlighter, Spline, Brackets } from 'lucide-react'
import { useStore } from '../store.ts'
import { INKS, type Annotation, type Kind } from '../lib/db.ts'
import { ink } from './Page.tsx'

interface Props {
  note: Annotation
  isDisplaced?: boolean
  onHover: (id: string | null) => void
}

const KIND_ICONS: Record<Kind, typeof Highlighter> = {
  highlight: Highlighter,
  squiggle: Spline,
  bracket: Brackets,
  note: MessageSquarePlus,
}

export const MarginCard = memo(function MarginCard({ note, isDisplaced, onHover }: Props) {
  const legend = useStore((s) => s.book?.legend)
  const focusId = useStore((s) => s.focusId)
  const { updateNote, removeNote } = useStore.getState()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<number>(0)
  const [isEditing, setIsEditing] = useState(false)
  const [comment, setComment] = useState(note.note)
  const commentRef = useRef(comment)
  commentRef.current = comment
  const isDirtyRef = useRef(false)

  useEffect(() => {
    if (focusId === note.id && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [focusId, note.id])

  useEffect(() => {
    setComment(note.note)
    commentRef.current = note.note
    isDirtyRef.current = false
  }, [note.note])

  const commitNow = useCallback(() => {
    window.clearTimeout(saveTimeoutRef.current)
    if (isDirtyRef.current && commentRef.current !== note.note) {
      isDirtyRef.current = false
      updateNote(note.id, { note: commentRef.current.trim() })
    }
  }, [note.id, note.note, updateNote])

  // Debounced auto-save (350ms) with guaranteed commit on unmount/blur/pagehide
  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value
      setComment(next)
      commentRef.current = next
      isDirtyRef.current = true
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = window.setTimeout(() => {
        commitNow()
      }, 350)
    },
    [commitNow],
  )

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    commitNow()
  }, [commitNow])

  useEffect(() => {
    const onFlush = () => commitNow()
    window.addEventListener('beforeunload', onFlush)
    document.addEventListener('visibilitychange', onFlush)
    return () => {
      commitNow()
      window.removeEventListener('beforeunload', onFlush)
      document.removeEventListener('visibilitychange', onFlush)
    }
  }, [commitNow])

  const KindIcon = KIND_ICONS[note.kind]
  const isSticky = note.kind === 'note'
  const label = legend?.[note.color] || note.color

  return (
    <div
      data-card={note.id}
      style={ink(note.color)}
      onMouseEnter={() => onHover(note.id)}
      onMouseLeave={() => onHover(null)}
      onFocusCapture={() => onHover(note.id)}
      onBlurCapture={() => onHover(null)}
      className={`slip grain relative p-3.5 text-xs border border-line flex flex-col gap-2.5 will-change-transform ${
        isSticky ? 'sticky' : ''
      } ${isDisplaced ? 'ring-1 ring-line/50' : ''}`}
    >
      <span className="tape" style={ink(note.color)} />

      {/* Header: Type icon, legend label, color dots, delete */}
      <div className="flex items-center justify-between border-b border-line/60 pb-2 text-soft">
        <div className="flex items-center gap-1.5 min-w-0">
          <KindIcon size={13} strokeWidth={1.5} style={{ color: `rgb(var(--${note.color}))` }} />
          <span className="smallcaps truncate font-semibold tracking-wide text-[11px] text-ink">
            {label}
          </span>
          {isDisplaced && (
            <span className="rounded bg-line/60 px-1 font-mono text-[9px] text-soft" title="Stacked to prevent overlap">
              adjusted
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
          {/* Quick color change */}
          <div className="flex items-center gap-0.5 mr-1">
            {INKS.map((c) => (
              <button
                key={c}
                onClick={() => updateNote(note.id, { color: c })}
                style={ink(c)}
                className={`size-2.5 rounded-full transition-transform ${
                  note.color === c ? 'scale-125 ring-1 ring-ink' : 'opacity-60 hover:opacity-100'
                }`}
                title={legend?.[c] || c}
              >
                <span className="block size-full blot" style={ink(c)} />
              </button>
            ))}
          </div>

          <button
            onClick={() => removeNote(note.id)}
            className="p-0.5 text-soft hover:text-accent transition-colors"
            title="Erase margin card"
            aria-label="Delete margin note"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Annotated passage snippet (if not just a pure sticky) */}
      {note.kind !== 'note' && (
        <blockquote className="line-clamp-3 italic text-soft font-serif text-[11px] border-l-2 pl-2.5 border-line/80 my-0.5">
          “{note.quote}”
        </blockquote>
      )}

      {/* Note / Marginalia thought */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={comment}
          onChange={handleCommentChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          placeholder="Jot down a fleeting thought..."
          rows={Math.max(2, (comment.match(/\n/g)?.length || 0) + 1)}
          className="field-auto w-full resize-none bg-transparent font-hand text-[15px] leading-tight text-ink placeholder:text-soft/40 outline-none"
        />
      </div>

      {/* Footer metadata */}
      <div className="pt-1 flex items-center justify-between text-[10px] text-soft/70 border-t border-line/30">
        <span className="font-sans">
          {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {isEditing && <span className="smallcaps text-accent font-semibold">Editing</span>}
      </div>
    </div>
  )
})
