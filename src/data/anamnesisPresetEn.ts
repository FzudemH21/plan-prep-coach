/**
 * "Anamnesis – Training & Health": the English version of the built-in "Anamnese – Training &
 * Gesundheit" (anamnesisPresets.ts) — same questions, help texts, conditions and field ids.
 * Keep both in step when one changes.
 */
import type { AnamnesisCondition, AnamnesisField, AnamnesisSection, AnamnesisTemplateDraft } from '@/types/anamnesis';
import { PROFILE_SEX_SOURCE } from '@/types/anamnesis';

const KIND_NOW = 'Current pain or complaints';
const KIND_INJURY = 'Earlier injury';
const KIND_SURGERY = 'Surgery';
const MILD = 'Mild – I can train and move normally';
const MARKED = 'Significant – they limit me in daily life or in training';

const when = (sourceId: string, ...values: string[]): AnamnesisCondition => ({ sourceId, values });
const now = when('s-kind', KIND_NOW);
const marked = when('s-limit', MARKED);
const past = when('s-kind', KIND_INJURY, KIND_SURGERY);
const markedComplaints: AnamnesisCondition = { sourceId: 'b-map', spotFieldId: 's-limit', values: [MARKED] };
const female = when(PROFILE_SEX_SOURCE, 'female');

const SUDDEN = 'Suddenly (e.g. rolling an ankle or landing)';
const DURATIONS = ['Up to 30 minutes', '30–60 minutes', '60–90 minutes', '90–120 minutes', 'More than 2 hours'];
const DIAGNOSTICS = [
  'X-ray', 'MRI', 'CT', 'Ultrasound', 'Blood test', 'Injection', 'Physiotherapy', 'Osteopathy',
  'Rehab or exercise therapy', 'Surgery', 'No, nothing yet',
];

const q = (field: AnamnesisField): AnamnesisField => field;

const sport: AnamnesisSection = {
  id: 'sec-sport',
  title: 'About your sport',
  athleteFills: true,
  fields: [
    q({ id: 'p-level', label: 'At what level do you do your sport?', fieldType: 'select',
      options: ['Hobby', 'Ambitious amateur', 'Semi-professional', 'Professional'] }),
    q({ id: 'p-position', label: 'Which discipline or position?', fieldType: 'text',
      helpText: 'e.g. 100 m, quarterback, centre-back – if you don\'t compete, just skip this.' }),
    q({ id: 'p-hand', label: 'Which is your dominant hand?', fieldType: 'select', options: ['Right', 'Left', 'Both equally'] }),
    q({ id: 'p-leg', label: 'Which is your take-off or standing leg?', fieldType: 'select', options: ['Right', 'Left', 'Both equally'],
      helpText: 'Which leg do you jump off from?' }),
  ],
};

const body: AnamnesisSection = {
  id: 'sec-body',
  title: 'Pain, injuries & surgery',
  athleteFills: true,
  fields: [
    q({ id: 'b-map', label: 'Where do you have pain or complaints right now – or where have you had an injury or surgery?',
      fieldType: 'bodyMap', bodyMapNone: true,
      placeholder: 'e.g. anything else you think matters',
      helpText: 'Tap every spot that applies – each spot gets a few short questions. '
        + 'Small complaints too (e.g. a pulling feeling in the knee after running), surgery unrelated to sport (e.g. appendix) and stress fractures. '
        + 'Most important: anything from the last 12 months. Never had anything? Then tap "None of these".',
      spotFields: [
        q({ id: 's-kind', label: 'What applies to this spot?', fieldType: 'multiselect',
          options: [KIND_NOW, KIND_INJURY, KIND_SURGERY],
          helpText: 'You can pick several – e.g. an earlier injury that still causes complaints today.' }),
        // Current complaints
        q({ id: 's-nrs', label: 'How strong are the complaints right now?', fieldType: 'scale', scaleMin: 0, scaleMax: 10,
          scaleMinLabel: 'none', scaleMaxLabel: 'worst imaginable', condition: now }),
        q({ id: 's-limit', label: 'How much do the complaints limit you?', fieldType: 'select',
          options: [MILD, MARKED], condition: now }),
        q({ id: 's-since', label: 'How long have you had the complaints?', fieldType: 'select',
          options: ['Less than 6 weeks', '6 to 12 weeks', 'More than 3 months'], condition: now }),
        q({ id: 's-onset', label: 'How did the complaints start?', fieldType: 'select',
          options: [SUDDEN, 'Gradually, without a specific trigger'], condition: marked }),
        q({ id: 's-what', label: 'What exactly happened?', fieldType: 'textarea',
          helpText: 'e.g. sprinting, landing, a collision', condition: when('s-onset', SUDDEN) }),
        q({ id: 's-course', label: 'How have the complaints developed since then?', fieldType: 'select',
          options: ['Got worse', 'Got better', 'Stayed the same', 'Sometimes better, sometimes worse'], condition: marked }),
        q({ id: 's-change', label: 'Did you change anything shortly before the complaints started?', fieldType: 'multiselect', allowOther: true,
          options: ['Trained more or harder', 'New exercises or a new sport', 'New shoes',
            'Different surface (e.g. artificial turf, indoor)', 'Competition phase', 'Nothing changed'],
          condition: marked }),
        q({ id: 's-warmup', label: 'How do the complaints behave during training?', fieldType: 'select',
          options: ['Get better after warming up', 'Stay the same', 'Get worse during training', 'Only come afterwards or the next day'],
          condition: marked }),
        q({ id: 's-belief', label: 'What do you think is causing the complaints?', fieldType: 'text', condition: marked }),
        q({ id: 's-rest', label: 'Do you also have pain …', fieldType: 'yesnoList',
          options: ['at rest (e.g. sitting or lying down)', 'at night (does it wake you up?)'], condition: marked }),
        q({ id: 's-character', label: 'What does the pain feel like?', fieldType: 'multiselect', helpText: 'You can pick several',
          options: ['Burning', 'Stabbing', 'Pulling', 'Dull or pressing', 'Like an electric shock', 'Numb or tingling',
            'Spreads to other parts of the body'],
          condition: marked }),
        q({ id: 's-signs', label: 'Do you also notice …', fieldType: 'yesnoList',
          options: ['Swelling', 'Instability or giving way', 'Locking or catching'], condition: marked }),
        // Warning signs — only for current complaints at the lower back / pelvis or the head / neck
        q({ id: 's-flags-back', label: 'Do you notice any of these?', fieldType: 'yesnoList',
          options: ['Numbness around the buttocks, genitals or inner thighs', 'New problems passing urine or with bowel movements'],
          helpText: 'If you have just noticed this: please see a doctor straight away.',
          condition: now, spotRegions: ['12', '13'] }),
        q({ id: 's-flags-neck', label: 'Do you notice any of these?', fieldType: 'yesnoList',
          options: ['Dizziness', 'Double vision', 'Trouble speaking', 'Trouble swallowing', 'Sudden falls without losing consciousness',
            'Nausea', 'Numbness in the face'],
          condition: now, spotRegions: ['1', '2'] }),
        q({ id: 's-time', label: 'When are the complaints strongest?', fieldType: 'select',
          options: ['In the morning', 'In the evening or after exercise', 'Always the same', 'It varies'], condition: marked }),
        q({ id: 's-worse', label: 'What makes it worse?', fieldType: 'text', condition: now }),
        q({ id: 's-better', label: 'What helps?', fieldType: 'text', condition: marked }),
        q({ id: 's-limits', label: 'What can you not do, or only with limits, because of the complaints?', fieldType: 'textarea',
          helpText: 'e.g. climbing stairs, sitting, sleeping, sprinting, jumping, throwing', condition: marked }),
        q({ id: 's-diag', label: 'Has anything been examined or treated yet?', fieldType: 'multiselect', allowOther: true,
          options: DIAGNOSTICS, condition: marked }),
        q({ id: 's-diag-result', label: 'What was the result?', fieldType: 'textarea', allowFiles: true,
          helpText: 'e.g. the diagnosis, if you know it',
          condition: when('s-diag', ...DIAGNOSTICS.filter((d) => d !== 'No, nothing yet')) }),
        // Earlier injury / surgery
        q({ id: 's-past-when', label: 'When was the injury or surgery?', fieldType: 'text',
          placeholder: 'e.g. 2021 or March 2024',
          helpText: 'Several at this spot? Then list them all with the year.', condition: past }),
        q({ id: 's-past-what', label: 'What was it exactly, and how was it treated?', fieldType: 'textarea',
          helpText: 'e.g. torn ligament, ACL surgery, cast, physiotherapy', condition: past }),
        q({ id: 's-past-out', label: 'How long could you not train normally because of it?', fieldType: 'select',
          options: ['Not at all', 'Up to 1 week', '1–4 weeks', '1–3 months', 'More than 3 months'], condition: past }),
      ],
    }),
    q({ id: 'c-train', label: 'Can you train at the moment?', fieldType: 'select',
      options: ['Yes, normally', 'Yes, but with limits', 'No, I\'m taking a break'], condition: markedComplaints }),
    q({ id: 'i-concussion', label: 'Have you ever had a concussion?', fieldType: 'boolean' }),
    q({ id: 'i-concussion-detail', label: 'How often, and when was the last one?', fieldType: 'text', condition: when('i-concussion', 'true') }),
  ],
};

const health: AnamnesisSection = {
  id: 'sec-health',
  title: 'Health',
  athleteFills: true,
  fields: [
    q({ id: 'h-meds', label: 'Do you take any medication regularly?', fieldType: 'boolean' }),
    q({ id: 'h-meds-which', label: 'Which?', fieldType: 'textarea', helpText: 'Including painkillers, cortisone or blood thinners.',
      condition: when('h-meds', 'true') }),
    q({ id: 'h-doctor', label: 'Are you being treated by a doctor?', fieldType: 'text',
      helpText: 'If so: name and practice, if you like.' }),
    q({ id: 'h-conditions', label: 'Do you have – or have you had – any of these conditions?', fieldType: 'yesnoList', allowOther: true,
      options: ['Heart or circulatory disease', 'High blood pressure', 'Asthma or another lung disease', 'Diabetes',
        'Thyroid disease', 'Rheumatism or another inflammatory joint disease', 'Osteoporosis (also suspected)',
        'Cancer', 'Neurological disease (e.g. epilepsy, MS)', 'Migraine or frequent headaches',
        'Iron deficiency or anaemia', 'Thrombosis or a blood clotting disorder', 'Bowel or stomach disease (e.g. Crohn\'s disease)',
        'Kidney disease', 'Mental health condition (e.g. depression, anxiety or an eating disorder)'] }),
    q({ id: 'h-allergy', label: 'Do you have any allergies?', fieldType: 'boolean' }),
    q({ id: 'h-allergy-which', label: 'Which?', fieldType: 'multiselect', allowOther: true,
      options: ['Pollen / hay fever', 'Insect stings (bees, wasps)', 'Medication (e.g. penicillin)',
        'Plasters, tape or latex', 'Food'],
      condition: when('h-allergy', 'true') }),
    q({ id: 'h-emergency', label: 'Do you have emergency medication you should always carry?', fieldType: 'boolean',
      helpText: 'e.g. an adrenaline pen or an asthma inhaler' }),
    q({ id: 'h-substances', label: 'Which of these do you use regularly?', fieldType: 'multiselect',
      helpText: 'Your answers stay confidential.',
      options: ['Cigarettes, e-cigarettes or snus', 'Alcohol (more than 1–2× a week)', 'Cannabis', 'Other drugs', 'None of these'] }),
    q({ id: 'h-sleep-hours', label: 'How many hours do you usually sleep per night?', fieldType: 'number', placeholder: 'e.g. 7.5' }),
    q({ id: 'h-sleep-quality', label: 'How well do you sleep?', fieldType: 'scale', scaleMin: 0, scaleMax: 10,
      scaleMinLabel: 'very badly', scaleMaxLabel: 'very well' }),
    q({ id: 'h-stress', label: 'How stressed do you feel at the moment?', fieldType: 'scale', scaleMin: 0, scaleMax: 10,
      scaleMinLabel: 'not at all', scaleMaxLabel: 'extremely' }),
    q({ id: 'h-energy', label: 'Do you often feel tired or low on energy in daily life?', fieldType: 'select',
      options: ['Rarely', 'Sometimes', 'Often'] }),
    q({ id: 'h-warning', label: 'Does any of this apply to you at the moment?', fieldType: 'yesnoList',
      options: ['I have lost weight without trying', 'Fever, night sweats or feeling very unwell',
        'Numbness, tingling or weakness in my arms or legs that is getting worse',
        'One calf is swollen, warm, red or painful'] }),
    q({ id: 'h-pregnant', label: 'Are you pregnant, or could you be?', fieldType: 'boolean', condition: female }),
    q({ id: 'h-cycle-info', label: 'About your cycle', fieldType: 'info',
      helpText: 'The next questions help us adapt training and recovery to your cycle. Feel free to skip them.',
      condition: female }),
    q({ id: 'h-cycle', label: 'How regular is your period?', fieldType: 'select',
      options: ['Regular', 'Irregular', 'Absent for at least 3 months', 'I don\'t know'], condition: female }),
    q({ id: 'h-contraception', label: 'Do you use hormonal contraception?', fieldType: 'boolean',
      helpText: 'e.g. the pill, a hormonal IUD, a vaginal ring', condition: female }),
  ],
};

const nutrition: AnamnesisSection = {
  id: 'sec-nutrition',
  title: 'Nutrition',
  athleteFills: true,
  fields: [
    q({ id: 'n-meals', label: 'How many meals do you eat a day?', fieldType: 'select',
      options: ['1–2', '3', '4–5', 'More than 5', 'It varies a lot'] }),
    q({ id: 'n-diet', label: 'Do you follow a particular diet?', fieldType: 'multiselect', allowOther: true,
      options: ['No, I eat everything', 'Vegetarian', 'Vegan', 'Pescatarian', 'Low carb or keto', 'Intermittent fasting'] }),
    q({ id: 'n-intolerances', label: 'Do you have any food intolerances?', fieldType: 'multiselect', allowOther: true,
      options: ['None known', 'Lactose', 'Gluten / coeliac disease', 'Fructose', 'Histamine'] }),
    q({ id: 'n-enough', label: 'Do you feel you eat enough to get through your training well?', fieldType: 'select',
      options: ['Yes', 'Not always', 'Not really'] }),
    q({ id: 'n-weight', label: 'Are you currently trying to change your weight?', fieldType: 'select',
      options: ['No', 'Lose weight', 'Gain weight (muscle)'] }),
    q({ id: 'n-supplements', label: 'Do you take any supplements?', fieldType: 'multiselect', allowOther: true,
      helpText: 'If you are drug-tested: please only use tested products (e.g. Kölner Liste / Informed Sport).',
      options: ['None', 'Protein powder', 'Creatine', 'Vitamin D', 'Magnesium', 'Iron', 'Omega-3', 'Caffeine or pre-workout'] }),
  ],
};

const loadCheck: AnamnesisSection = {
  id: 'sec-load-check',
  title: 'Exercise check',
  helpText: 'Important for tests where you go all out.',
  athleteFills: true,
  fields: [
    q({ id: 'l-exam', label: 'Have you had a sports medical check-up in the last 2 years?', fieldType: 'boolean',
      helpText: 'e.g. with an exercise ECG at a sports doctor or your federation.' }),
    q({ id: 'l-symptoms', label: 'Have you ever had …', fieldType: 'yesnoList',
      options: ['Pain, pressure or tightness in the chest during exercise', 'Unusually severe shortness of breath during exercise',
        'Dizziness or fainting during or shortly after exercise', 'Palpitations or a racing heart without an obvious reason',
        'A heart murmur or an irregular heartbeat diagnosed by a doctor'] }),
    q({ id: 'l-family', label: 'Has anyone in your family died suddenly or had serious heart disease before the age of 50?',
      fieldType: 'boolean', helpText: 'Parents or siblings' }),
    q({ id: 'l-advised', label: 'Has a doctor ever advised you not to do sport?', fieldType: 'boolean' }),
  ],
};

const psychosocial: AnamnesisSection = {
  id: 'sec-psychosocial',
  title: 'How you are doing with the complaints',
  helpText: 'These questions help us understand how you are doing with the complaints. There are no right or wrong answers.',
  athleteFills: true,
  condition: markedComplaints,
  fields: [
    q({ id: 'y-items', label: 'Does this apply to you?', fieldType: 'yesnoList',
      options: ['I\'m afraid that exercise or training will make the complaints worse',
        'I avoid some movements because I expect pain',
        'I think the complaints won\'t really go away or are something serious',
        'I often feel down lately or have lost interest in many things',
        'I\'m under a lot of pressure at the moment – at work, in training or privately',
        'I\'m afraid of getting injured again',
        'I feel under pressure to get back to training or playing quickly'] }),
  ],
};

const goals: AnamnesisSection = {
  id: 'sec-goals',
  title: 'Goals',
  athleteFills: true,
  fields: [
    q({ id: 'g-goal', label: 'What would you like to achieve with the training?', fieldType: 'textarea',
      helpText: 'As specific as possible – e.g. sprint faster, be fit for the season, jog without knee pain, get stronger.' }),
    q({ id: 'g-rts', label: 'By when would you like to be back to full training or playing?', fieldType: 'date', condition: markedComplaints }),
  ],
};

const training: AnamnesisSection = {
  id: 'sec-training',
  title: 'Training & availability',
  athleteFills: true,
  fields: [
    q({ id: 't-sessions', label: 'How many training sessions do you do per week at the moment?', fieldType: 'number' }),
    q({ id: 't-duration', label: 'How long does a training session usually last for you?', fieldType: 'select', options: DURATIONS }),
    q({ id: 't-experience', label: 'How much experience do you have with athletic training?', fieldType: 'select',
      helpText: 'e.g. strength training with weights, jump or sprint training',
      options: ['None', 'A little (irregularly)', 'Regularly for more than a year', 'Very experienced (several years, with a plan)'] }),
    q({ id: 't-phase', label: 'Which phase are you in at the moment?', fieldType: 'select',
      options: ['Pre-season', 'Competition season', 'Off-season', 'I train without a set season'] }),
    q({ id: 't-with-us', label: 'How often per week would you like to train with us?', fieldType: 'number', placeholder: 'e.g. 2' }),
    q({ id: 't-max-duration', label: 'How long can a session with us last at most?', fieldType: 'select', options: DURATIONS }),
    q({ id: 't-week', label: 'When do you already train regularly, and when would you have time to train with us?', fieldType: 'weekGrid',
      helpText: 'Mark in the weekly schedule: green = time to train with us · blue = your regular training (team/club) · '
        + 'orange = other physical load, e.g. physically demanding work, shift work, other sports.' }),
    q({ id: 't-dates', label: 'Are there any important dates in the coming months that we need to plan around?',
      fieldType: 'dateRanges',
      helpText: 'e.g. competitions, holidays, travel, training camps, exams – tap the first and then the last day.' }),
    q({ id: 't-where', label: 'Where can you train?', fieldType: 'multiselect', allowOther: true,
      options: ['Gym', 'At home', 'Sports ground or track', 'Sports hall', 'Outdoors (e.g. park)'] }),
    q({ id: 't-equipment', label: 'What equipment do you have there?', fieldType: 'multiselect', allowOther: true,
      options: ['Barbell with plates', 'Squat or power rack', 'Bench', 'Dumbbells', 'Kettlebells',
        'Machines / cable tower', 'Pull-up bar', 'Resistance bands', 'Plyo box', 'Medicine ball', 'Sprint track (at least 30 m)',
        'No equipment'] }),
  ],
};

const closing: AnamnesisSection = {
  id: 'sec-closing',
  title: 'Final question',
  athleteFills: true,
  fields: [
    q({ id: 'e-more', label: 'Is there anything else we should know?', fieldType: 'textarea',
      helpText: 'e.g. questions for us, wishes, or anything the questionnaire didn\'t cover.' }),
  ],
};

export const TRAINING_HEALTH_ANAMNESIS_EN: AnamnesisTemplateDraft = {
  name: 'Anamnesis – Training & Health',
  introText: 'This questionnaire helps us plan your training to suit you right from the start. '
    + 'Please answer the questions as accurately as you can – if you\'re unsure about something, just skip it; '
    + 'we\'ll go through any open points in our first session. Your answers are confidential.',
  sections: [sport, body, health, nutrition, loadCheck, psychosocial, goals, training, closing],
};
