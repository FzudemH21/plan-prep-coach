/**
 * Built-in anamnesis templates to start from (template editor → "Start from"). Choosing one fills
 * the editor; saving creates the coach's own, editable template.
 *
 * "Anamnese – Training & Gesundheit": one anamnesis for everyone without an acute injury — athletes
 * and regular people — that gets more detailed with complaints. The check question "Hast du aktuell
 * Schmerzen oder Beschwerden?" (Nein / leichte / deutliche) decides: "leichte" shows a short
 * complaint block, "deutliche" the full one plus the psychosocial questions. Built from the practice's
 * anamnesis document (Anamnesebogen) with the review of 2026-10-18.
 * English version: anamnesisPresetEn.ts (same ids and conditions) — keep both in step.
 */
import type { AnamnesisCondition, AnamnesisField, AnamnesisSection, AnamnesisTemplateDraft } from '@/types/anamnesis';
import { DEFAULT_ANAMNESIS_TEMPLATE, PROFILE_SEX_SOURCE } from '@/types/anamnesis';
import { TRAINING_HEALTH_ANAMNESIS_EN } from '@/data/anamnesisPresetEn';
import { withTranslation } from '@/utils/anamnesisI18n';

// ── Check question and its answers (conditions refer to them) ───────────────

const NO_COMPLAINTS = 'Nein';
const MILD = 'Ja, leichte – ich kann normal trainieren und mich normal bewegen';
const MARKED = 'Ja, deutliche – sie schränken mich im Alltag oder im Training ein';

const when = (sourceId: string, ...values: string[]): AnamnesisCondition => ({ sourceId, values });
const anyComplaints = when('c-check', MILD, MARKED);
const markedComplaints = when('c-check', MARKED);
const female = when(PROFILE_SEX_SOURCE, 'female');

const DURATIONS = ['Bis 30 Minuten', '30–60 Minuten', '60–90 Minuten', '90–120 Minuten', 'Länger als 2 Stunden'];
const DIAGNOSTICS = [
  'Röntgen', 'MRT', 'CT', 'Ultraschall', 'Blutuntersuchung', 'Spritze', 'Physiotherapie', 'Osteopathie',
  'Reha- oder Trainingstherapie', 'Operation', 'Nein, noch nichts',
];

const q = (field: AnamnesisField): AnamnesisField => field;

// ── Sections ─────────────────────────────────────────────────────────────────

const sport: AnamnesisSection = {
  id: 'sec-sport',
  title: 'Zu deinem Sport',
  athleteFills: true,
  fields: [
    q({ id: 'p-level', label: 'Auf welchem Niveau betreibst du deinen Sport?', fieldType: 'select',
      options: ['Hobby', 'Ambitioniertes Amateurniveau', 'Semi-Professionell', 'Professionell'] }),
    q({ id: 'p-position', label: 'Welche Disziplin oder Position?', fieldType: 'text',
      helpText: 'z. B. 100 m, Quarterback, Innenverteidiger – falls du keinen Wettkampfsport machst, einfach überspringen.' }),
    q({ id: 'p-hand', label: 'Welche Hand ist deine dominante Hand?', fieldType: 'select', options: ['Rechts', 'Links', 'Beide gleich'] }),
    q({ id: 'p-leg', label: 'Welches ist dein Sprung- bzw. Standbein?', fieldType: 'select', options: ['Rechts', 'Links', 'Beide gleich'],
      helpText: 'Mit welchem Bein springst du ab?' }),
  ],
};

const complaints: AnamnesisSection = {
  id: 'sec-complaints',
  title: 'Aktuelle Beschwerden',
  athleteFills: true,
  fields: [
    q({ id: 'c-check', label: 'Hast du aktuell Schmerzen oder Beschwerden?', fieldType: 'select',
      options: [NO_COMPLAINTS, MILD, MARKED],
      helpText: 'Auch kleinere, z. B. ein Ziehen im Knie nach dem Laufen.' }),
    q({ id: 'c-where', label: 'Wo hast du Beschwerden?', fieldType: 'bodyMap', bodyMapIntensity: true,
      placeholder: 'Was spürst du dort?',
      helpText: 'Markiere alle Stellen, die zu deinen aktuellen Beschwerden gehören, und gib an, wie stark sie sind. '
        + 'Hast du zwei Beschwerden, die nichts miteinander zu tun haben? Dann beantworte die nächsten Fragen für die wichtigere und schreib zur anderen etwas in ihre Notiz.',
      condition: anyComplaints }),
    q({ id: 'c-since', label: 'Seit wann hast du die Beschwerden?', fieldType: 'select',
      options: ['Weniger als 6 Wochen', '6 bis 12 Wochen', 'Länger als 3 Monate'], condition: anyComplaints }),
    q({ id: 'c-onset', label: 'Wie haben die Beschwerden angefangen?', fieldType: 'select',
      options: ['Plötzlich (z. B. beim Umknicken oder Landen)', 'Langsam, ohne bestimmten Auslöser'], condition: markedComplaints }),
    q({ id: 'c-what', label: 'Was genau ist passiert?', fieldType: 'textarea',
      helpText: 'z. B. beim Sprint, beim Landen, bei einem Zusammenstoß',
      condition: when('c-onset', 'Plötzlich (z. B. beim Umknicken oder Landen)') }),
    q({ id: 'c-before', label: 'Hattest du an dieser Stelle früher schon einmal Beschwerden oder eine Verletzung?', fieldType: 'boolean',
      condition: markedComplaints }),
    q({ id: 'c-course', label: 'Wie haben sich die Beschwerden seitdem entwickelt?', fieldType: 'select',
      options: ['Schlimmer geworden', 'Besser geworden', 'Gleich geblieben', 'Mal besser, mal schlechter'], condition: markedComplaints }),
    q({ id: 'c-change', label: 'Hast du kurz bevor die Beschwerden anfingen etwas verändert?', fieldType: 'multiselect', allowOther: true,
      options: ['Mehr oder intensiver trainiert', 'Neue Übungen oder eine neue Sportart', 'Neue Schuhe',
        'Anderer Untergrund (z. B. Kunstrasen, Halle)', 'Wettkampfphase', 'Nichts verändert'],
      condition: markedComplaints }),
    q({ id: 'c-warmup', label: 'Wie verhalten sich die Beschwerden beim Training?', fieldType: 'select',
      options: ['Werden nach dem Aufwärmen besser', 'Bleiben gleich', 'Werden während des Trainings schlimmer',
        'Kommen erst danach oder am nächsten Tag'],
      condition: markedComplaints }),
    q({ id: 'c-belief', label: 'Was glaubst du, woher die Beschwerden kommen?', fieldType: 'text', condition: markedComplaints }),
    q({ id: 'c-rest', label: 'Hast du auch Schmerzen …', fieldType: 'yesnoList',
      options: ['in Ruhe (z. B. im Sitzen oder Liegen)', 'nachts (wachst du davon auf?)'], condition: markedComplaints }),
    q({ id: 'c-character', label: 'Wie fühlt sich der Schmerz an?', fieldType: 'multiselect', helpText: 'Mehrfachauswahl möglich',
      options: ['Brennend', 'Stechend', 'Ziehend', 'Dumpf oder drückend', 'Wie ein Stromschlag', 'Taub oder kribbelnd',
        'Strahlt in andere Körperteile aus'],
      condition: markedComplaints }),
    q({ id: 'c-signs', label: 'Bemerkst du außerdem …', fieldType: 'yesnoList',
      options: ['Schwellung', 'Unsicherheit oder Wegknicken', 'Blockieren oder Einklemmen'], condition: markedComplaints }),
    // Warning signs for the lower back / pelvis and for the head / neck — only with a spot there
    q({ id: 'c-flags-back', label: 'Bemerkst du eines davon?', fieldType: 'yesnoList',
      options: ['Taubheit im Bereich von Gesäß, Genitalien oder der Innenseite der Oberschenkel',
        'Neue Probleme beim Wasserlassen oder beim Stuhlgang'],
      helpText: 'Falls du das gerade neu bemerkst: Bitte lass es sofort ärztlich abklären.',
      condition: when('c-where', '12', '13') }),
    q({ id: 'c-flags-neck', label: 'Bemerkst du eines davon?', fieldType: 'yesnoList',
      options: ['Schwindel', 'Doppeltsehen', 'Probleme beim Sprechen', 'Probleme beim Schlucken',
        'Plötzliches Hinfallen ohne Bewusstlosigkeit', 'Übelkeit', 'Taubheit im Gesicht'],
      condition: when('c-where', '1', '2') }),
    q({ id: 'c-time', label: 'Wann sind die Beschwerden am stärksten?', fieldType: 'select',
      options: ['Morgens', 'Abends oder nach Belastung', 'Immer gleich', 'Unterschiedlich'], condition: markedComplaints }),
    q({ id: 'c-worse', label: 'Was macht es schlimmer?', fieldType: 'text', condition: anyComplaints }),
    q({ id: 'c-better', label: 'Was hilft?', fieldType: 'text', condition: markedComplaints }),
    q({ id: 'c-limits', label: 'Was kannst du wegen der Beschwerden nicht oder nur eingeschränkt machen?', fieldType: 'textarea',
      helpText: 'z. B. Treppensteigen, Sitzen, Schlafen, Sprinten, Springen, Werfen', condition: markedComplaints }),
    q({ id: 'c-train', label: 'Kannst du aktuell trainieren?', fieldType: 'select',
      options: ['Ja, ganz normal', 'Ja, aber eingeschränkt', 'Nein, ich mache gerade Pause'], condition: markedComplaints }),
    q({ id: 'c-diag', label: 'Wurde schon etwas untersucht oder behandelt?', fieldType: 'multiselect', allowOther: true,
      options: DIAGNOSTICS, condition: markedComplaints }),
    q({ id: 'c-diag-result', label: 'Was ist dabei herausgekommen?', fieldType: 'textarea',
      helpText: 'z. B. die Diagnose, falls du sie kennst',
      condition: when('c-diag', ...DIAGNOSTICS.filter((d) => d !== 'Nein, noch nichts')) }),
  ],
};

const injuries: AnamnesisSection = {
  id: 'sec-injuries',
  title: 'Frühere Verletzungen & Operationen',
  athleteFills: true,
  fields: [
    q({ id: 'i-any', label: 'Hattest du früher schon Verletzungen oder Operationen?', fieldType: 'boolean' }),
    q({ id: 'i-map', label: 'Wo?', fieldType: 'bodyMap',
      placeholder: 'Was ist passiert, wann, wie lange konntest du nicht trainieren, wie wurde es behandelt?',
      helpText: 'Tippe auf jede Stelle, an der du dich verletzt hast oder operiert wurdest – eine Stelle pro Verletzung. '
        + 'Auch Operationen, die nichts mit Sport zu tun haben, z. B. Blinddarm, und Ermüdungsbrüche. Besonders wichtig: alles aus den letzten 12 Monaten.',
      condition: when('i-any', 'true') }),
    q({ id: 'i-concussion', label: 'Hattest du schon einmal eine Gehirnerschütterung?', fieldType: 'boolean' }),
    q({ id: 'i-concussion-detail', label: 'Wie oft, und wann zuletzt?', fieldType: 'text', condition: when('i-concussion', 'true') }),
  ],
};

const health: AnamnesisSection = {
  id: 'sec-health',
  title: 'Gesundheit',
  athleteFills: true,
  fields: [
    q({ id: 'h-meds', label: 'Nimmst du regelmäßig Medikamente?', fieldType: 'boolean' }),
    q({ id: 'h-meds-which', label: 'Welche?', fieldType: 'textarea', helpText: 'Auch Schmerzmittel, Cortison oder Blutverdünner.',
      condition: when('h-meds', 'true') }),
    q({ id: 'h-doctor', label: 'Bist du bei einer Ärztin oder einem Arzt in Behandlung?', fieldType: 'text',
      helpText: 'Wenn ja: Name und Praxis, falls du möchtest.' }),
    q({ id: 'h-conditions', label: 'Hast du eine dieser Erkrankungen – oder hattest du sie früher?', fieldType: 'yesnoList',
      allowOther: true,
      options: ['Herz-Kreislauf-Erkrankung', 'Bluthochdruck', 'Asthma oder andere Lungenerkrankung', 'Diabetes',
        'Schilddrüsenerkrankung', 'Rheuma oder andere entzündliche Gelenkerkrankung', 'Osteoporose (auch Verdacht)',
        'Krebserkrankung', 'Neurologische Erkrankung (z. B. Epilepsie, MS)', 'Migräne oder häufige Kopfschmerzen',
        'Eisenmangel oder Blutarmut', 'Thrombose oder Blutgerinnungsstörung', 'Magen-Darm-Erkrankung (z. B. Morbus Crohn)',
        'Nierenerkrankung', 'Psychische Erkrankung (z. B. Depression, Angst- oder Essstörung)'] }),
    q({ id: 'h-allergy', label: 'Hast du Allergien?', fieldType: 'boolean' }),
    q({ id: 'h-allergy-which', label: 'Welche?', fieldType: 'multiselect', allowOther: true,
      options: ['Pollen / Heuschnupfen', 'Insektenstiche (Bienen, Wespen)', 'Medikamente (z. B. Penicillin)',
        'Pflaster, Tape oder Latex', 'Nahrungsmittel'],
      condition: when('h-allergy', 'true') }),
    q({ id: 'h-emergency', label: 'Hast du ein Notfallmedikament, das du immer dabei haben solltest?', fieldType: 'boolean',
      helpText: 'z. B. einen Adrenalin-Pen oder ein Asthmaspray' }),
    q({ id: 'h-substances', label: 'Was davon konsumierst du regelmäßig?', fieldType: 'multiselect',
      helpText: 'Deine Angaben bleiben vertraulich.',
      options: ['Zigaretten, E-Zigarette oder Snus', 'Alkohol (mehr als 1–2× pro Woche)', 'Cannabis', 'Andere Drogen', 'Nichts davon'] }),
    q({ id: 'h-sleep-hours', label: 'Wie viele Stunden schläfst du normalerweise pro Nacht?', fieldType: 'number', placeholder: 'z. B. 7,5' }),
    q({ id: 'h-sleep-quality', label: 'Wie gut schläfst du?', fieldType: 'scale', scaleMin: 0, scaleMax: 10,
      scaleMinLabel: 'sehr schlecht', scaleMaxLabel: 'sehr gut' }),
    q({ id: 'h-stress', label: 'Wie gestresst fühlst du dich zurzeit?', fieldType: 'scale', scaleMin: 0, scaleMax: 10,
      scaleMinLabel: 'gar nicht', scaleMaxLabel: 'extrem' }),
    q({ id: 'h-energy', label: 'Fühlst du dich im Alltag oft müde oder ohne Energie?', fieldType: 'select',
      options: ['Selten', 'Manchmal', 'Oft'] }),
    q({ id: 'h-warning', label: 'Trifft zurzeit eines davon auf dich zu?', fieldType: 'yesnoList',
      options: ['Ich habe ungewollt abgenommen', 'Fieber, Nachtschweiß oder ein starkes Krankheitsgefühl',
        'Taubheit, Kribbeln oder Kraftverlust in Armen oder Beinen, der stärker wird',
        'Eine Wade ist geschwollen, warm, gerötet oder schmerzt'] }),
    q({ id: 'h-pregnant', label: 'Bist du schwanger oder könntest du es sein?', fieldType: 'boolean', condition: female }),
    q({ id: 'h-cycle-info', label: 'Zu deinem Zyklus', fieldType: 'info',
      helpText: 'Die nächsten Fragen helfen uns, Training und Erholung an deinen Zyklus anzupassen. Du kannst sie gerne überspringen.',
      condition: female }),
    q({ id: 'h-cycle', label: 'Wie regelmäßig ist deine Periode?', fieldType: 'select',
      options: ['Regelmäßig', 'Unregelmäßig', 'Seit mindestens 3 Monaten ausgeblieben', 'Ich weiß es nicht'], condition: female }),
    q({ id: 'h-contraception', label: 'Verhütest du hormonell?', fieldType: 'boolean',
      helpText: 'z. B. Pille, Hormonspirale, Verhütungsring', condition: female }),
  ],
};

const nutrition: AnamnesisSection = {
  id: 'sec-nutrition',
  title: 'Ernährung',
  athleteFills: true,
  fields: [
    q({ id: 'n-meals', label: 'Wie viele Mahlzeiten isst du am Tag?', fieldType: 'select',
      options: ['1–2', '3', '4–5', 'Mehr als 5', 'Sehr unterschiedlich'] }),
    q({ id: 'n-diet', label: 'Ernährst du dich auf eine bestimmte Art?', fieldType: 'multiselect', allowOther: true,
      options: ['Nein, ganz normal', 'Vegetarisch', 'Vegan', 'Pescetarisch', 'Low Carb oder Keto', 'Intervallfasten'] }),
    q({ id: 'n-intolerances', label: 'Hast du Unverträglichkeiten?', fieldType: 'multiselect', allowOther: true,
      options: ['Keine', 'Laktose', 'Gluten / Zöliakie', 'Fruktose', 'Histamin'] }),
    q({ id: 'n-enough', label: 'Hast du das Gefühl, genug zu essen, um dein Training gut zu schaffen?', fieldType: 'select',
      options: ['Ja', 'Nicht immer', 'Eher nicht'] }),
    q({ id: 'n-weight', label: 'Möchtest du gerade dein Gewicht verändern?', fieldType: 'select',
      options: ['Nein', 'Abnehmen', 'Zunehmen (Muskelmasse)'] }),
    q({ id: 'n-supplements', label: 'Nimmst du Nahrungsergänzungsmittel?', fieldType: 'multiselect', allowOther: true,
      helpText: 'Falls du Dopingkontrollen hast: bitte nur getestete Produkte (z. B. Kölner Liste).',
      options: ['Keine', 'Eiweißpulver', 'Kreatin', 'Vitamin D', 'Magnesium', 'Eisen', 'Omega-3', 'Koffein oder Pre-Workout'] }),
  ],
};

const loadCheck: AnamnesisSection = {
  id: 'sec-load-check',
  title: 'Belastungs-Check',
  helpText: 'Wichtig für Tests, bei denen du dich voll ausbelastest.',
  athleteFills: true,
  fields: [
    q({ id: 'l-exam', label: 'Wurdest du in den letzten 2 Jahren sportärztlich untersucht?', fieldType: 'boolean',
      helpText: 'z. B. mit Belastungs-EKG beim Sportarzt oder im Verband.' }),
    q({ id: 'l-symptoms', label: 'Hattest du schon einmal …', fieldType: 'yesnoList',
      options: ['Schmerzen, Druck oder Engegefühl in der Brust bei Anstrengung', 'Ungewöhnlich starke Atemnot bei Anstrengung',
        'Schwindel oder Ohnmacht während oder kurz nach dem Sport', 'Herzstolpern oder Herzrasen ohne erkennbaren Grund',
        'Ein Herzgeräusch oder eine Herzrhythmusstörung, die ein Arzt festgestellt hat'] }),
    q({ id: 'l-family', label: 'Ist in deiner Familie jemand vor dem 50. Lebensjahr plötzlich gestorben oder hatte eine schwere Herzerkrankung?',
      fieldType: 'boolean', helpText: 'Eltern oder Geschwister' }),
    q({ id: 'l-advised', label: 'Hat dir schon einmal ein Arzt oder eine Ärztin von Sport abgeraten?', fieldType: 'boolean' }),
  ],
};

const psychosocial: AnamnesisSection = {
  id: 'sec-psychosocial',
  title: 'Wie es dir mit den Beschwerden geht',
  helpText: 'Diese Fragen helfen uns zu verstehen, wie es dir mit den Beschwerden geht. Es gibt keine richtigen oder falschen Antworten.',
  athleteFills: true,
  condition: markedComplaints,
  fields: [
    q({ id: 'y-items', label: 'Trifft das auf dich zu?', fieldType: 'yesnoList',
      options: ['Ich habe Angst, dass Bewegung oder Training die Beschwerden schlimmer macht',
        'Ich vermeide manche Bewegungen, weil ich Schmerzen befürchte',
        'Ich glaube, dass die Beschwerden nicht mehr richtig weggehen oder etwas Ernstes sind',
        'Ich fühle mich in letzter Zeit oft niedergeschlagen oder habe an vielem die Lust verloren',
        'Ich stehe gerade unter viel Druck – im Beruf, im Training oder privat',
        'Ich habe Angst, mich wieder zu verletzen',
        'Ich fühle mich unter Druck, schnell wieder zu trainieren oder zu spielen'] }),
  ],
};

const goals: AnamnesisSection = {
  id: 'sec-goals',
  title: 'Ziele',
  athleteFills: true,
  fields: [
    q({ id: 'g-goal', label: 'Was möchtest du mit dem Training erreichen?', fieldType: 'textarea',
      helpText: 'So konkret wie möglich – z. B. schneller sprinten, fit für die Saison, ohne Knieschmerzen joggen, stärker werden.' }),
    q({ id: 'g-restore', label: 'Was soll wieder ohne Beschwerden möglich sein?', fieldType: 'textarea', condition: markedComplaints }),
    q({ id: 'g-rts', label: 'Bis wann möchtest du wieder voll trainieren oder spielen können?', fieldType: 'date', condition: markedComplaints }),
  ],
};

const training: AnamnesisSection = {
  id: 'sec-training',
  title: 'Training & Verfügbarkeit',
  athleteFills: true,
  fields: [
    q({ id: 't-sessions', label: 'Wie viele Trainingseinheiten machst du aktuell pro Woche?', fieldType: 'number' }),
    q({ id: 't-duration', label: 'Wie lange dauert eine Trainingseinheit bei dir meistens?', fieldType: 'select', options: DURATIONS }),
    q({ id: 't-experience', label: 'Wie viel Erfahrung hast du mit Athletiktraining?', fieldType: 'select',
      helpText: 'z. B. Krafttraining mit Gewichten, Sprung- oder Sprinttraining',
      options: ['Keine', 'Ein bisschen (unregelmäßig)', 'Regelmäßig seit über einem Jahr', 'Sehr erfahren (mehrere Jahre, mit Plan)'] }),
    q({ id: 't-phase', label: 'In welcher Phase bist du gerade?', fieldType: 'select',
      options: ['Saisonvorbereitung', 'Wettkampfsaison', 'Saisonpause', 'Ich trainiere ohne feste Saison'] }),
    q({ id: 't-with-us', label: 'Wie oft pro Woche möchtest du mit uns trainieren?', fieldType: 'number', placeholder: 'z. B. 2' }),
    q({ id: 't-max-duration', label: 'Wie lange darf eine Einheit mit uns höchstens dauern?', fieldType: 'select', options: DURATIONS }),
    q({ id: 't-week', label: 'Wann trainierst du schon fest, und wann hättest du Zeit für das Training mit uns?', fieldType: 'weekGrid',
      helpText: 'Markiere im Wochenplan: Grün = Zeit für Training mit uns · Blau = dein festes Training (Team/Verein) · '
        + 'Orange = andere körperliche Belastung, z. B. anstrengende Arbeit, Schichtdienst, andere Sportarten.' }),
    q({ id: 't-dates', label: 'Gibt es in den nächsten Monaten wichtige Termine, die wir in der Planung berücksichtigen müssen?',
      fieldType: 'dateRanges',
      helpText: 'z. B. Wettkämpfe, Urlaub, Reisen, Trainingslager, Prüfungen – tippe auf den ersten und dann auf den letzten Tag.' }),
    q({ id: 't-where', label: 'Wo kannst du trainieren?', fieldType: 'multiselect', allowOther: true,
      options: ['Fitnessstudio', 'Zuhause', 'Sportplatz oder Laufbahn', 'Sporthalle', 'Draußen (z. B. Park)', 'Bei uns vor Ort'] }),
    q({ id: 't-equipment', label: 'Welche Ausstattung hast du dort?', fieldType: 'multiselect', allowOther: true,
      options: ['Langhantel mit Hantelscheiben', 'Squat- oder Power-Rack', 'Hantelbank', 'Kurzhanteln', 'Kettlebells',
        'Geräte / Kabelzug', 'Klimmzugstange', 'Widerstandsbänder', 'Plyo-Box', 'Medizinball', 'Sprintstrecke (mind. 30 m)',
        'Keine Ausstattung'] }),
  ],
};

const closing: AnamnesisSection = {
  id: 'sec-closing',
  title: 'Abschluss',
  athleteFills: true,
  fields: [
    q({ id: 'e-more', label: 'Gibt es noch etwas, das wir wissen sollten?', fieldType: 'textarea',
      helpText: 'z. B. Fragen an uns, Wünsche oder etwas, das im Fragebogen gefehlt hat.' }),
  ],
};

export const TRAINING_HEALTH_ANAMNESIS: AnamnesisTemplateDraft = {
  name: 'Anamnese – Training & Gesundheit',
  introText: 'Dieser Fragebogen hilft uns, dein Training von Anfang an passend für dich zu planen. '
    + 'Bitte beantworte die Fragen so genau wie möglich – wenn du dir bei etwas unsicher bist, überspring es einfach, '
    + 'wir besprechen offene Punkte im Erstgespräch. Deine Angaben sind vertraulich.',
  sections: [sport, complaints, injuries, health, nutrition, loadCheck, psychosocial, goals, training, closing],
};

/** "Start from" choices in the template editor */
export const ANAMNESIS_PRESETS: Array<{ id: string; label: string; draft: AnamnesisTemplateDraft }> = [
  // Bilingual: German questions with the English version (the athlete switches DE / EN in the form) —
  // or the other way round for an English-speaking practice
  {
    id: 'training-health',
    label: 'Anamnese – Training & Gesundheit (German + English)',
    draft: withTranslation({ ...TRAINING_HEALTH_ANAMNESIS, language: 'de' }, TRAINING_HEALTH_ANAMNESIS_EN, 'en'),
  },
  {
    id: 'training-health-en',
    label: 'Anamnesis – Training & Health (English + German)',
    draft: withTranslation({ ...TRAINING_HEALTH_ANAMNESIS_EN, language: 'en' }, TRAINING_HEALTH_ANAMNESIS, 'de'),
  },
  {
    id: 'general',
    label: 'General Anamnesis (English, with movement screening)',
    draft: { name: DEFAULT_ANAMNESIS_TEMPLATE.name, sections: DEFAULT_ANAMNESIS_TEMPLATE.sections, introText: '' },
  },
];
