/**
 * "Anamnesis – Training & Health": the English version of the built-in "Anamnese – Training &
 * Gesundheit" (anamnesisPresets.ts) — same questions, help texts, conditions and field ids.
 * Keep both in step when one changes.
 */
import type { AnamnesisCondition, AnamnesisField, AnamnesisSection, AnamnesisTemplateDraft } from '@/types/anamnesis';
import { PROFILE_SEX_SOURCE } from '@/types/anamnesis';

const NO_COMPLAINTS = 'No';
const MILD = 'Yes, mild – I can train and move normally';
const MARKED = 'Yes, significant – they limit me in daily life or in training';

const when = (sourceId: string, ...values: string[]): AnamnesisCondition => ({ sourceId, values });
const anyComplaints = when('c-check', MILD, MARKED);
const markedComplaints = when('c-check', MARKED);
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

const complaints: AnamnesisSection = {
  id: 'sec-complaints',
  title: 'Current complaints',
  athleteFills: true,
  fields: [
    q({ id: 'c-check', label: 'Do you currently have any pain or complaints?', fieldType: 'select',
      options: [NO_COMPLAINTS, MILD, MARKED],
      helpText: 'Small ones too, e.g. a pulling feeling in the knee after running.' }),
    q({ id: 'c-where', label: 'Where do you have complaints?', fieldType: 'bodyMap', bodyMapIntensity: true,
      placeholder: 'What do you feel there?',
      helpText: 'Mark every spot that belongs to your current complaints and say how strong they are. '
        + 'Do you have two complaints that have nothing to do with each other? Then answer the next questions for the more important one and write something about the other in its note.',
      condition: anyComplaints }),
    q({ id: 'c-since', label: 'How long have you had the complaints?', fieldType: 'select',
      options: ['Less than 6 weeks', '6 to 12 weeks', 'More than 3 months'], condition: anyComplaints }),
    q({ id: 'c-onset', label: 'How did the complaints start?', fieldType: 'select',
      options: [SUDDEN, 'Gradually, without a specific trigger'], condition: markedComplaints }),
    q({ id: 'c-what', label: 'What exactly happened?', fieldType: 'textarea',
      helpText: 'e.g. sprinting, landing, a collision', condition: when('c-onset', SUDDEN) }),
    q({ id: 'c-before', label: 'Have you had complaints or an injury in this spot before?', fieldType: 'boolean',
      condition: markedComplaints }),
    q({ id: 'c-course', label: 'How have the complaints developed since then?', fieldType: 'select',
      options: ['Got worse', 'Got better', 'Stayed the same', 'Sometimes better, sometimes worse'], condition: markedComplaints }),
    q({ id: 'c-change', label: 'Did you change anything shortly before the complaints started?', fieldType: 'multiselect', allowOther: true,
      options: ['Trained more or harder', 'New exercises or a new sport', 'New shoes',
        'Different surface (e.g. artificial turf, indoor)', 'Competition phase', 'Nothing changed'],
      condition: markedComplaints }),
    q({ id: 'c-warmup', label: 'How do the complaints behave during training?', fieldType: 'select',
      options: ['Get better after warming up', 'Stay the same', 'Get worse during training', 'Only come afterwards or the next day'],
      condition: markedComplaints }),
    q({ id: 'c-belief', label: 'What do you think is causing the complaints?', fieldType: 'text', condition: markedComplaints }),
    q({ id: 'c-rest', label: 'Do you also have pain …', fieldType: 'yesnoList',
      options: ['at rest (e.g. sitting or lying down)', 'at night (does it wake you up?)'], condition: markedComplaints }),
    q({ id: 'c-character', label: 'What does the pain feel like?', fieldType: 'multiselect', helpText: 'You can pick several',
      options: ['Burning', 'Stabbing', 'Pulling', 'Dull or pressing', 'Like an electric shock', 'Numb or tingling',
        'Spreads to other parts of the body'],
      condition: markedComplaints }),
    q({ id: 'c-signs', label: 'Do you also notice …', fieldType: 'yesnoList',
      options: ['Swelling', 'Instability or giving way', 'Locking or catching'], condition: markedComplaints }),
    q({ id: 'c-flags-back', label: 'Do you notice any of these?', fieldType: 'yesnoList',
      options: ['Numbness around the buttocks, genitals or inner thighs', 'New problems passing urine or with bowel movements'],
      helpText: 'If you have just noticed this: please see a doctor straight away.',
      condition: when('c-where', '12', '13') }),
    q({ id: 'c-flags-neck', label: 'Do you notice any of these?', fieldType: 'yesnoList',
      options: ['Dizziness', 'Double vision', 'Trouble speaking', 'Trouble swallowing', 'Sudden falls without losing consciousness',
        'Nausea', 'Numbness in the face'],
      condition: when('c-where', '1', '2') }),
    q({ id: 'c-time', label: 'When are the complaints strongest?', fieldType: 'select',
      options: ['In the morning', 'In the evening or after exercise', 'Always the same', 'It varies'], condition: markedComplaints }),
    q({ id: 'c-worse', label: 'What makes it worse?', fieldType: 'text', condition: anyComplaints }),
    q({ id: 'c-better', label: 'What helps?', fieldType: 'text', condition: markedComplaints }),
    q({ id: 'c-limits', label: 'What can you not do, or only with limits, because of the complaints?', fieldType: 'textarea',
      helpText: 'e.g. climbing stairs, sitting, sleeping, sprinting, jumping, throwing', condition: markedComplaints }),
    q({ id: 'c-train', label: 'Can you train at the moment?', fieldType: 'select',
      options: ['Yes, normally', 'Yes, but with limits', 'No, I\'m taking a break'], condition: markedComplaints }),
    q({ id: 'c-diag', label: 'Has anything been examined or treated yet?', fieldType: 'multiselect', allowOther: true,
      options: DIAGNOSTICS, condition: markedComplaints }),
    q({ id: 'c-diag-result', label: 'What was the result?', fieldType: 'textarea', allowFiles: true,
      helpText: 'e.g. the diagnosis, if you know it',
      condition: when('c-diag', ...DIAGNOSTICS.filter((d) => d !== 'No, nothing yet')) }),
  ],
};

const injuries: AnamnesisSection = {
  id: 'sec-injuries',
  title: 'Previous injuries & surgery',
  athleteFills: true,
  fields: [
    q({ id: 'i-any', label: 'Have you had injuries or surgery in the past?', fieldType: 'boolean' }),
    q({ id: 'i-map', label: 'Where?', fieldType: 'bodyMap',
      placeholder: 'What happened, when, how long couldn\'t you train, how was it treated?',
      helpText: 'Tap every spot where you were injured or had surgery – one spot per injury. '
        + 'Include surgery unrelated to sport, e.g. appendix, and stress fractures. Most important: anything from the last 12 months.',
      condition: when('i-any', 'true') }),
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
  sections: [sport, complaints, injuries, health, nutrition, loadCheck, psychosocial, goals, training, closing],
};
