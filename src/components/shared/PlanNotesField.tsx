/**
 * PlanNotesField — the plan's strategy document (formerly "Notes & Brainstorming"; shared by all wizard steps). Shown formatted
 * as light Markdown so long notes stay readable: "## " headings, "- " bullets (indented = nested),
 * "1." numbered points, **bold**; a line starting with an UPPERCASE LABEL: gets the label in bold
 * (older notes written that way). Click the text or "Edit" to change it — the stored text stays plain
 * Markdown, which is also what the AI writes (set_plan_notes).
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { FileDown, History, Loader2, Maximize2, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import type { PlanNotesVersion } from '@/utils/planStrategy';
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


/** The text: formatted view, click / "Edit" to change */
function NotesEditor({ value, onChange, minHeight, maxViewHeight }: {
  value: string; onChange: (next: string) => void; minHeight: number; maxViewHeight: number;
}) {
  const [editing, setEditing] = useState(false);
  // Empty: straight to the text box
  if (editing || !value.trim()) {
    return (
      <div className="space-y-1.5">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus={editing}
          placeholder={PLACEHOLDER}
          className="resize-y text-sm font-mono"
          // About as tall as the formatted view, so editing doesn't shrink the text
          style={{ minHeight: Math.max(minHeight, Math.min(maxViewHeight, value.split('\n').length * 20 + 24)) }}
        />
        <p className="text-[11px] text-muted-foreground">
          Formatting: <code>## Heading</code> · <code>- bullet</code> (indent with two spaces for sub-points) · <code>**bold**</code>
        </p>
      </div>
    );
  }
  return (
    <div className="relative group rounded-md border bg-background">
      <div
        className="overflow-y-auto px-3 py-2.5 cursor-text"
        style={{ maxHeight: maxViewHeight }}
        onClick={() => { if (!window.getSelection()?.toString()) setEditing(true); }}
        title="Click to edit"
      >
        <PlanNotesView text={value} />
      </div>
      <Button type="button" variant="ghost" size="sm"
        className="absolute top-1 right-3 h-7 gap-1 text-xs bg-background/80 opacity-70 group-hover:opacity-100"
        onClick={() => setEditing(true)}>
        <Pencil className="h-3.5 w-3.5" />Edit
      </Button>
    </div>
  );
}

/**
 * The plan's strategy document (formerly "Notes & Brainstorming"): free-form, grows out of the
 * conversation with the AI. Tools: "Write up from conversation" (asks the AI chat to condense the
 * conversation into the document — applied like any AI suggestion), versions (kept when the AI
 * rewrites it; restore), a large document view and a PDF.
 */
export function PlanNotesField({ value, onChange, minHeight = 180, className, history = [], onRestore, onWriteUp, pdf }: {
  value: string;
  onChange: (next: string) => void;
  /** Height of the text box while editing (px) */
  minHeight?: number;
  className?: string;
  /** Earlier versions, newest first */
  history?: PlanNotesVersion[];
  onRestore?: (version: PlanNotesVersion) => void;
  /** Sends "write up the strategy from our conversation" to the AI chat */
  onWriteUp?: () => void;
  /** For the PDF: plan and athlete */
  pdf?: { planName: string; athleteName?: string };
}) {
  const { toast } = useToast();
  const { profile } = useCoachProfile();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const [{ pdf: render }, { PlanStrategyPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/PlanStrategyPDF'),
      ]);
      const blob = await render(
        <PlanStrategyPDF text={value} planName={pdf?.planName || 'Training plan'} athleteName={pdf?.athleteName}
          branding={profile?.branding} coachName={profile?.name} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Strategy_${(pdf?.planName || 'plan').replace(/[^\p{L}\p{N}]+/gu, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[PlanNotesField] PDF error', err);
      toast({ title: 'PDF failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const tools = (big: boolean) => (
    <div className="flex flex-wrap items-center gap-1">
      {onWriteUp && (
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { setOpen(false); onWriteUp(); }}
          title="The AI condenses your conversation into this document — you apply it like any AI suggestion">
          <Sparkles className="h-3.5 w-3.5" />Write up from conversation
        </Button>
      )}
      {onRestore && history.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"><History className="h-3.5 w-3.5" />Versions ({history.length})</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-[360px] overflow-y-auto z-[300]">
            <DropdownMenuLabel className="text-xs">Restore an earlier version (the current text is kept as a version)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {history.map((v) => (
              <DropdownMenuItem key={v.savedAt} className="flex-col items-start gap-0.5" onSelect={() => onRestore(v)}>
                <span className="text-xs font-medium">
                  {format(new Date(v.savedAt), 'd MMM yyyy, HH:mm')} · {v.reason === 'ai-rewrite' ? 'before AI rewrite' : 'before restore'}
                </span>
                <span className="text-xs text-muted-foreground line-clamp-2">{v.text.replace(/[#*]/g, '').slice(0, 140)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {value.trim() && (
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" disabled={exporting} onClick={() => { void exportPdf(); }}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}PDF
        </Button>
      )}
      {!big && (
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setOpen(true)}>
          <Maximize2 className="h-3.5 w-3.5" />Open
        </Button>
      )}
    </div>
  );

  return (
    <div className={cn('space-y-1.5', className)} onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-end">{tools(false)}</div>
      <NotesEditor value={value} onChange={onChange} minHeight={minHeight} maxViewHeight={480} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl h-[88vh] flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Plan strategy{pdf?.planName ? ` — ${pdf.planName}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">{tools(true)}</div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <NotesEditor value={value} onChange={onChange} minHeight={400} maxViewHeight={4000} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
