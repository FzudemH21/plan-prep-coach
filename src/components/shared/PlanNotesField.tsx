/**
 * PlanNotesField — the plan's "Notes & Brainstorming" (shared by all wizard steps). Shown formatted
 * as light Markdown so long notes stay readable: "## " headings, "- " bullets (indented = nested),
 * "1." numbered points, **bold**; a line starting with an UPPERCASE LABEL: gets the label in bold
 * (older notes written that way). Click the text or "Edit" to change it — the stored text stays plain
 * Markdown, which is also what the AI writes (set_plan_notes).
 */
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PLACEHOLDER = 'Notizen, Überlegungen, Ideen zum Plan...';

/** **bold** inside a line */
function renderInline(text: string, key: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => (
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={`${key}-${i}`} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={`${key}-${i}`}>{part}</span>
  ));
}

/** A line's text; an UPPERCASE "LABEL:" at the start is shown bold */
function renderLineText(text: string, key: string): React.ReactNode {
  const label = text.match(/^([A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 &/()+\-.]{1,40}):\s*(.*)$/);
  if (label && /[A-ZÄÖÜ]{2}/.test(label[1])) {
    return <><strong className="font-semibold text-foreground">{label[1]}:</strong> {renderInline(label[2], key)}</>;
  }
  return renderInline(text, key);
}

export function PlanNotesView({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return (
    <div className={cn('text-sm leading-relaxed text-foreground/90 space-y-0.5', className)}>
      {lines.map((line, i) => {
        const key = `l${i}`;
        if (!line.trim()) return <div key={key} className="h-2" />;
        const heading = line.match(/^\s*#{1,4}\s+(.*)$/);
        if (heading) {
          return <p key={key} className={cn('font-semibold text-foreground', i > 0 && 'pt-2')}>{renderInline(heading[1], key)}</p>;
        }
        const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
        const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
        if (bullet || numbered) {
          const indent = Math.floor(((bullet ?? numbered)?.[1] ?? '').replace(/\t/g, '  ').length / 2);
          const content = bullet ? bullet[2] : numbered![3];
          return (
            <div key={key} className="flex gap-2" style={{ paddingLeft: indent * 18 }}>
              <span className="shrink-0 text-muted-foreground w-4 text-right">{bullet ? '•' : `${numbered![2]}.`}</span>
              <span className="min-w-0 flex-1">{renderLineText(content, key)}</span>
            </div>
          );
        }
        return <p key={key}>{renderLineText(line, key)}</p>;
      })}
    </div>
  );
}

export function PlanNotesField({ value, onChange, minHeight = 180, className }: {
  value: string;
  onChange: (next: string) => void;
  /** Height of the text box while editing (px) */
  minHeight?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  // Empty notes: straight to the text box
  const showEditor = editing || !value.trim();

  if (showEditor) {
    return (
      <div className={cn('space-y-1.5', className)} onClick={(e) => e.stopPropagation()}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus={editing}
          placeholder={PLACEHOLDER}
          className="resize-y text-sm font-mono"
          // About as tall as the formatted view (up to 480 px), so editing doesn't shrink the notes
          style={{ minHeight: Math.max(minHeight, Math.min(480, value.split('\n').length * 20 + 24)) }}
        />
        <p className="text-[11px] text-muted-foreground">
          Formatting: <code>## Heading</code> · <code>- bullet</code> (indent with two spaces for sub-points) · <code>**bold**</code>
        </p>
      </div>
    );
  }

  return (
    <div className={cn('relative group rounded-md border bg-background', className)} onClick={(e) => e.stopPropagation()}>
      <div
        className="max-h-[480px] overflow-y-auto px-3 py-2.5 cursor-text"
        onClick={() => { if (!window.getSelection()?.toString()) setEditing(true); }}
        title="Click to edit"
      >
        <PlanNotesView text={value} />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-1 right-3 h-7 gap-1 text-xs bg-background/80 opacity-70 group-hover:opacity-100"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    </div>
  );
}
