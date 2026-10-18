/**
 * anamnesisI18n — language versions of anamnesis templates.
 *
 * A template is written in its main language and can carry a translation (field / section /
 * template `translations`). Answers keep the main language's values; these helpers only change what
 * is shown: `localizeField` gives a display copy of a question in a language (texts translated, the
 * choices' labels in `optionLabels`, values unchanged), `localizeSection` the same for a section.
 */
import type {
  AnamnesisField, AnamnesisFieldTranslation, AnamnesisLang, AnamnesisSection, AnamnesisTemplateDraft,
} from '@/types/anamnesis';

const pick = (translated: string | undefined, original: string | undefined) => translated?.trim() || original;

/** The question as shown in `lang` — the main language (no translation) returns it unchanged */
export function localizeField(field: AnamnesisField, lang: AnamnesisLang): AnamnesisField {
  const tr = field.translations?.[lang];
  if (!tr) return field;
  return {
    ...field,
    label: pick(tr.label, field.label) ?? '',
    helpText: pick(tr.helpText, field.helpText),
    placeholder: pick(tr.placeholder, field.placeholder),
    scaleMinLabel: pick(tr.scaleMinLabel, field.scaleMinLabel),
    scaleMaxLabel: pick(tr.scaleMaxLabel, field.scaleMaxLabel),
    optionLabels: field.options?.map((o, i) => pick(tr.options?.[i], o) ?? o),
    listColumns: field.listColumns?.map((c, i) => ({
      ...c,
      label: pick(tr.listColumns?.[i]?.label, c.label) ?? c.label,
      optionLabels: c.options?.map((o, j) => pick(tr.listColumns?.[i]?.options?.[j], o) ?? o),
    })),
  };
}

export function localizeSection(section: AnamnesisSection, lang: AnamnesisLang): AnamnesisSection {
  const tr = section.translations?.[lang];
  if (!tr) return section;
  return { ...section, title: pick(tr.title, section.title) ?? '', helpText: pick(tr.helpText, section.helpText) };
}

/** A stored choice / item value as shown in `lang` */
export function optionLabel(field: AnamnesisField, value: string, lang: AnamnesisLang): string {
  const i = field.options?.indexOf(value) ?? -1;
  return (i >= 0 && field.translations?.[lang]?.options?.[i]?.trim()) || value;
}

// ── Completeness ──────────────────────────────────────────────────────────────

/** How many of the template's texts have a translation into `lang` — [translated, total] */
export function translationProgress(draft: Pick<AnamnesisTemplateDraft, 'name' | 'introText' | 'sections' | 'translations'>, lang: AnamnesisLang): [number, number] {
  let done = 0;
  let total = 0;
  const count = (original: string | undefined, translated: string | undefined) => {
    if (!original?.trim()) return;
    total++;
    if (translated?.trim()) done++;
  };
  count(draft.name, draft.translations?.[lang]?.name);
  count(draft.introText, draft.translations?.[lang]?.introText);
  for (const s of draft.sections) {
    const st = s.translations?.[lang];
    count(s.title, st?.title);
    count(s.helpText, st?.helpText);
    for (const f of s.fields) {
      const t = f.translations?.[lang];
      count(f.label, t?.label);
      count(f.helpText, t?.helpText);
      count(f.placeholder, t?.placeholder);
      count(f.scaleMinLabel, t?.scaleMinLabel);
      count(f.scaleMaxLabel, t?.scaleMaxLabel);
      (f.options ?? []).forEach((o, i) => count(o, t?.options?.[i]));
      (f.listColumns ?? []).forEach((c, i) => {
        count(c.label, t?.listColumns?.[i]?.label);
        (c.options ?? []).forEach((o, j) => count(o, t?.listColumns?.[i]?.options?.[j]));
      });
    }
  }
  return [done, total];
}

// ── Building a bilingual template from two versions with the same structure ───

/**
 * Takes the texts of `other` (same sections and questions in the same order, e.g. the English
 * preset) as the `lang` translation of `main`.
 */
export function withTranslation(main: AnamnesisTemplateDraft, other: AnamnesisTemplateDraft, lang: AnamnesisLang): AnamnesisTemplateDraft {
  return {
    ...main,
    translations: { ...main.translations, [lang]: { name: other.name, introText: other.introText } },
    sections: main.sections.map((s, si) => {
      const os = other.sections[si];
      if (!os) return s;
      return {
        ...s,
        translations: { ...s.translations, [lang]: { title: os.title, helpText: os.helpText } },
        fields: s.fields.map((f, fi) => {
          const of = os.fields[fi];
          if (!of || of.id !== f.id) return f;
          const t: AnamnesisFieldTranslation = {
            label: of.label,
            helpText: of.helpText,
            placeholder: of.placeholder,
            options: of.options,
            scaleMinLabel: of.scaleMinLabel,
            scaleMaxLabel: of.scaleMaxLabel,
            listColumns: of.listColumns?.map(c => ({ label: c.label, options: c.options })),
          };
          return { ...f, translations: { ...f.translations, [lang]: t } };
        }),
      };
    }),
  };
}

// ── AI translation ────────────────────────────────────────────────────────────

/** One text to translate: where it goes and the original */
interface TextSlot { key: string; text: string }

/** The texts still missing a translation into `lang` (keys address where each one goes) */
export function missingTexts(draft: AnamnesisTemplateDraft, lang: AnamnesisLang): TextSlot[] {
  const out: TextSlot[] = [];
  const add = (key: string, original: string | undefined, translated: string | undefined) => {
    if (original?.trim() && !translated?.trim()) out.push({ key, text: original.trim() });
  };
  add('name', draft.name, draft.translations?.[lang]?.name);
  add('intro', draft.introText, draft.translations?.[lang]?.introText);
  draft.sections.forEach((s, si) => {
    const st = s.translations?.[lang];
    add(`s${si}.title`, s.title, st?.title);
    add(`s${si}.help`, s.helpText, st?.helpText);
    s.fields.forEach((f, fi) => {
      const t = f.translations?.[lang];
      const k = `s${si}.f${fi}`;
      add(`${k}.label`, f.label, t?.label);
      add(`${k}.help`, f.helpText, t?.helpText);
      add(`${k}.placeholder`, f.placeholder, t?.placeholder);
      add(`${k}.min`, f.scaleMinLabel, t?.scaleMinLabel);
      add(`${k}.max`, f.scaleMaxLabel, t?.scaleMaxLabel);
      (f.options ?? []).forEach((o, oi) => add(`${k}.o${oi}`, o, t?.options?.[oi]));
      (f.listColumns ?? []).forEach((c, ci) => {
        add(`${k}.c${ci}.label`, c.label, t?.listColumns?.[ci]?.label);
        (c.options ?? []).forEach((o, oi) => add(`${k}.c${ci}.o${oi}`, o, t?.listColumns?.[ci]?.options?.[oi]));
      });
    });
  });
  return out;
}

/** Writes translated texts (key → text, from missingTexts) into the draft's `lang` translation */
export function applyTexts(draft: AnamnesisTemplateDraft, lang: AnamnesisLang, texts: Record<string, string>): AnamnesisTemplateDraft {
  const get = (k: string) => (typeof texts[k] === 'string' && texts[k].trim() ? texts[k].trim() : undefined);
  const keep = <T,>(v: T | undefined, current: T | undefined) => (v !== undefined ? v : current);
  const tpl = draft.translations?.[lang] ?? {};
  return {
    ...draft,
    translations: { ...draft.translations, [lang]: { name: keep(get('name'), tpl.name), introText: keep(get('intro'), tpl.introText) } },
    sections: draft.sections.map((s, si) => {
      const st = s.translations?.[lang] ?? {};
      return {
        ...s,
        translations: { ...s.translations, [lang]: { title: keep(get(`s${si}.title`), st.title), helpText: keep(get(`s${si}.help`), st.helpText) } },
        fields: s.fields.map((f, fi) => {
          const k = `s${si}.f${fi}`;
          const t = f.translations?.[lang] ?? {};
          const next: AnamnesisFieldTranslation = {
            label: keep(get(`${k}.label`), t.label),
            helpText: keep(get(`${k}.help`), t.helpText),
            placeholder: keep(get(`${k}.placeholder`), t.placeholder),
            scaleMinLabel: keep(get(`${k}.min`), t.scaleMinLabel),
            scaleMaxLabel: keep(get(`${k}.max`), t.scaleMaxLabel),
            options: f.options?.map((_, oi) => keep(get(`${k}.o${oi}`), t.options?.[oi]) ?? ''),
            listColumns: f.listColumns?.map((c, ci) => ({
              label: keep(get(`${k}.c${ci}.label`), t.listColumns?.[ci]?.label),
              options: c.options?.map((_, oi) => keep(get(`${k}.c${ci}.o${oi}`), t.listColumns?.[ci]?.options?.[oi]) ?? ''),
            })),
          };
          return { ...f, translations: { ...f.translations, [lang]: next } };
        }),
      };
    }),
  };
}
