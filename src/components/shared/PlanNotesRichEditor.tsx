/**
 * Editing the plan strategy as formatted text (headings, bullets, numbered points, bold) instead of
 * raw Markdown. TipTap underneath; the text it hands back is the same light Markdown as before
 * (utils/planNotesDoc), so the AI and the formatted view read it unchanged.
 *
 * Typing shortcuts work too: "## " starts a heading, "- " a bullet, "1. " a numbered point,
 * **text** becomes bold; Tab / Shift+Tab indent and outdent a point.
 */
import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, List, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { docToNotes, notesToDoc } from '@/utils/planNotesDoc';

function ToolButton({ editor, active, onClick, title, children }: {
  editor: Editor; active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      // Keeps the focus in the text (leaving it ends editing)
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { onClick(); editor.commands.focus(); }}
      className={cn('h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground',
        active && 'bg-muted text-foreground')}
    >
      {children}
    </button>
  );
}

export function PlanNotesRichEditor({ value, onChange, onStart, onDone, placeholder, minHeight, autoFocus }: {
  value: string;
  onChange: (next: string) => void;
  /** Focus came into the editor */
  onStart?: () => void;
  /** Focus left the editor */
  onDone?: () => void;
  placeholder?: string;
  minHeight: number;
  autoFocus?: boolean;
}) {
  // What this editor last handed out — a different value from outside (e.g. the AI rewrote the
  // strategy) replaces the content
  const emitted = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        // Only what the strategy's format has
        code: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false, italic: false, hardBreak: false,
      }),
    ],
    content: notesToDoc(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'outline-none',
        'aria-label': 'Plan strategy',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: e }) => {
      const next = docToNotes(e.getJSON());
      emitted.current = next;
      onChangeRef.current(next);
    },
    onFocus: () => onStartRef.current?.(),
    onBlur: () => onDoneRef.current?.(),
  });

  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(notesToDoc(value), false);
  }, [editor, value]);

  if (!editor) return null;
  const isEmpty = editor.isEmpty;

  return (
    <div className="rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
        <ToolButton editor={editor} title="Heading" active={editor.isActive('heading')}
          onClick={() => editor.chain().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton editor={editor} title="Bullet points (Tab indents)" active={editor.isActive('bulletList')}
          onClick={() => editor.chain().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton editor={editor} title="Numbered points" active={editor.isActive('orderedList')}
          onClick={() => editor.chain().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton editor={editor} title="Bold (Ctrl+B)" active={editor.isActive('bold')}
          onClick={() => editor.chain().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolButton>
      </div>
      {/* A click anywhere in the box (also below the last line) puts the cursor into the text */}
      <div className="relative"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.ProseMirror')) return;
          e.preventDefault();
          editor.commands.focus('end');
        }}>
        {isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-2.5 text-sm text-muted-foreground">{placeholder}</p>
        )}
        <EditorContent
          editor={editor}
          // The same look as the formatted view (PlanNotesView)
          className={cn(
            'px-3 py-2.5 text-sm leading-relaxed text-foreground/90 cursor-text',
            '[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold',
            '[&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground',
            '[&_h1:not(:first-child)]:pt-2 [&_h2:not(:first-child)]:pt-2 [&_h3:not(:first-child)]:pt-2 [&_h4:not(:first-child)]:pt-2',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_li::marker]:text-muted-foreground',
            '[&_p:empty]:h-2 [&_strong]:font-semibold [&_strong]:text-foreground',
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
