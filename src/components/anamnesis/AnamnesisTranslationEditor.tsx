/**
 * Translation mode of the template editor: every text of the template (name, intro, sections,
 * questions, choices, checklist items, scale ends, list columns) in the main language with a field
 * for its translation. "Translate missing with AI" fills the empty ones (the coach checks them).
 * The questions' structure is edited in the main language only — here only texts change.
 */
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendMessage, AI_MODEL } from '@/utils/anthropicApi';
import { applyTexts, missingTexts, translationProgress } from '@/utils/anamnesisI18n';
import {
  ANAMNESIS_LANG_LABELS, type AnamnesisField, type AnamnesisFieldTranslation, type AnamnesisLang, type AnamnesisTemplateDraft,
} from '@/types/anamnesis';
import { cn } from '@/lib/utils';

function Row({ original, value, onChange, multiline }: {
  original: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 items-start">
      <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1.5 leading-snug">{original}</p>
      {multiline ? (
        <Textarea className={cn('min-h-[52px] text-xs resize-y', !value.trim() && 'border-amber-300')} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <Input className={cn('h-7 text-xs', !value.trim() && 'border-amber-300')} value={value} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

function FieldTranslation({ field, lang, onChange }: {
  field: AnamnesisField; lang: AnamnesisLang; onChange: (f: AnamnesisField) => void;
}) {
  const t = field.translations?.[lang] ?? {};
  const set = (patch: Partial<AnamnesisFieldTranslation>) => onChange({ ...field, translations: { ...field.translations, [lang]: { ...t, ...patch } } });
  return (
    <div className="rounded-md border bg-background p-2 space-y-1.5">
      <Row original={field.label || '(no text)'} value={t.label ?? ''} onChange={label => set({ label })} />
      {field.helpText && <Row original={field.helpText} value={t.helpText ?? ''} onChange={helpText => set({ helpText })} multiline />}
      {field.placeholder && <Row original={field.placeholder} value={t.placeholder ?? ''} onChange={placeholder => set({ placeholder })} />}
      {field.scaleMinLabel && <Row original={field.scaleMinLabel} value={t.scaleMinLabel ?? ''} onChange={scaleMinLabel => set({ scaleMinLabel })} />}
      {field.scaleMaxLabel && <Row original={field.scaleMaxLabel} value={t.scaleMaxLabel ?? ''} onChange={scaleMaxLabel => set({ scaleMaxLabel })} />}
      {(field.options ?? []).length > 0 && (
        <div className="pl-3 border-l-2 space-y-1">
          {(field.options ?? []).map((o, i) => (
            <Row key={i} original={o} value={t.options?.[i] ?? ''}
              onChange={v => { const options = [...(t.options ?? [])]; options[i] = v; set({ options }); }} />
          ))}
        </div>
      )}
      {(field.listColumns ?? []).map((c, ci) => (
        <div key={c.id} className="pl-3 border-l-2 space-y-1">
          <Row original={c.label || '(column)'} value={t.listColumns?.[ci]?.label ?? ''}
            onChange={label => { const cols = [...(t.listColumns ?? [])]; cols[ci] = { ...cols[ci], label }; set({ listColumns: cols }); }} />
          {(c.options ?? []).map((o, oi) => (
            <Row key={oi} original={o} value={t.listColumns?.[ci]?.options?.[oi] ?? ''}
              onChange={v => {
                const cols = [...(t.listColumns ?? [])];
                const opts = [...(cols[ci]?.options ?? [])]; opts[oi] = v;
                cols[ci] = { ...cols[ci], options: opts };
                set({ listColumns: cols });
              }} />
          ))}
        </div>
      ))}
      {/* A body map's questions per spot */}
      {(field.spotFields ?? []).length > 0 && (
        <div className="pl-3 border-l-2 border-primary/30 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Questions per spot</p>
          {(field.spotFields ?? []).map((sf, pi) => (
            <FieldTranslation key={sf.id} field={sf} lang={lang}
              onChange={next => onChange({ ...field, spotFields: (field.spotFields ?? []).map((x, i) => (i === pi ? next : x)) })} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AnamnesisTranslationEditor({ draft, lang, onChange }: {
  draft: AnamnesisTemplateDraft;
  /** The language the translation is into (not the main language) */
  lang: AnamnesisLang;
  onChange: (next: AnamnesisTemplateDraft) => void;
}) {
  const { toast } = useToast();
  const [translating, setTranslating] = useState(false);
  const [done, total] = translationProgress(draft, lang);
  const main = draft.language ?? 'de';
  const tpl = draft.translations?.[lang] ?? {};

  const translateMissing = async () => {
    const missing = missingTexts(draft, lang);
    if (missing.length === 0) return;
    setTranslating(true);
    try {
      let next = draft;
      // In chunks — a long template has a few hundred texts
      for (let i = 0; i < missing.length; i += 120) {
        const chunk = missing.slice(i, i + 120);
        const reply = await sendMessage(
          [{ role: 'user', content: JSON.stringify(Object.fromEntries(chunk.map(m => [m.key, m.text]))) }],
          `You translate the texts of a sports-science / physiotherapy intake questionnaire (anamnesis) from ${ANAMNESIS_LANG_LABELS[main]} into ${ANAMNESIS_LANG_LABELS[lang]}. `
          + 'The athlete fills it in on the phone: plain, friendly words, the same informal tone ("du" in German, "you" in English), short. '
          + 'Keep medical meaning exact; keep numbers, units, brand names and list markers. '
          + 'Answer with ONLY a JSON object with the same keys and the translated texts as values — no comments, no Markdown.',
          AI_MODEL,
          16000,
        );
        const json = reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1);
        next = applyTexts(next, lang, JSON.parse(json) as Record<string, string>);
      }
      onChange(next);
      toast({ title: 'Translated', description: 'Please check the translations before saving.' });
    } catch (err) {
      console.error('[AnamnesisTranslationEditor] translate error', err);
      toast({ title: 'Translation failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-2.5 sticky top-0 z-10">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{done} of {total}</span> texts translated into {ANAMNESIS_LANG_LABELS[lang]}.
          {' '}Questions, choices and conditions are edited in the main language; answers are always stored in {ANAMNESIS_LANG_LABELS[main]}.
        </p>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0" disabled={translating || done === total} onClick={translateMissing}>
          {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Translate missing with AI
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1">
        <span>{ANAMNESIS_LANG_LABELS[main]}</span>
        <span>{ANAMNESIS_LANG_LABELS[lang]}</span>
      </div>

      <div className="rounded-lg border p-2.5 space-y-1.5 bg-muted/20">
        <Row original={draft.name || '(template name)'} value={tpl.name ?? ''}
          onChange={name => onChange({ ...draft, translations: { ...draft.translations, [lang]: { ...tpl, name } } })} />
        {draft.introText.trim() && (
          <Row original={draft.introText} value={tpl.introText ?? ''} multiline
            onChange={introText => onChange({ ...draft, translations: { ...draft.translations, [lang]: { ...tpl, introText } } })} />
        )}
      </div>

      {draft.sections.map((s, si) => {
        const st = s.translations?.[lang] ?? {};
        const setSection = (patch: { title?: string; helpText?: string }) => onChange({
          ...draft,
          sections: draft.sections.map((x, i) => (i === si ? { ...x, translations: { ...x.translations, [lang]: { ...st, ...patch } } } : x)),
        });
        return (
          <div key={s.id} className="rounded-lg border p-2.5 space-y-2 bg-muted/20">
            <Row original={s.title || '(section)'} value={st.title ?? ''} onChange={title => setSection({ title })} />
            {s.helpText && <Row original={s.helpText} value={st.helpText ?? ''} onChange={helpText => setSection({ helpText })} multiline />}
            {s.fields.map((f, fi) => (
              <FieldTranslation key={f.id} field={f} lang={lang}
                onChange={next => onChange({
                  ...draft,
                  sections: draft.sections.map((x, i) => (i !== si ? x : {
                    ...x,
                    fields: x.fields.map((y, j) => (j === fi ? next : y)),
                  })),
                })} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
