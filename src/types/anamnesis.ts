export type AnamnesisFieldType = 'text' | 'textarea' | 'number' | 'select' | 'boolean';

export interface AnamnesisField {
  id: string;
  label: string;
  fieldType: AnamnesisFieldType;
  options?: string[];
  placeholder?: string;
}

export interface AnamnesisSection {
  id: string;
  title: string;
  fields: AnamnesisField[];
}

export interface AnamnesisTemplate {
  id: string;
  coachUserId: string;
  name: string;
  sections: AnamnesisSection[];
  createdAt: string;
  updatedAt: string;
}

export interface AnamnesisTemplateSnapshot {
  name: string;
  sections: AnamnesisSection[];
}

export interface AthleteAnamnesis {
  id: string;
  coachUserId: string;
  athleteLocalId: string;
  templateId: string | null;
  templateSnapshot: AnamnesisTemplateSnapshot;
  conductedAt: string;
  customQuestions: AnamnesisField[];
  fieldValues: Record<string, string>;
  customFieldValues: Record<string, string>;
  notes: string;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

// Predefined default template seeded from the sports-science anamnesis protocol
export const DEFAULT_ANAMNESIS_TEMPLATE: Omit<AnamnesisTemplate, 'id' | 'coachUserId' | 'createdAt' | 'updatedAt'> = {
  name: 'General Anamnesis',
  sections: [
    {
      id: 'sec-basic',
      title: 'Basic Information',
      fields: [
        { id: 'f-name', label: 'Name', fieldType: 'text' },
        { id: 'f-dob', label: 'Date of Birth', fieldType: 'text', placeholder: 'e.g. 1995-04-12' },
        {
          id: 'f-sex',
          label: 'Sex / Gender',
          fieldType: 'select',
          options: ['Male', 'Female', 'Other', 'Prefer not to say'],
        },
        { id: 'f-profession', label: 'Profession', fieldType: 'text' },
        { id: 'f-complaint', label: 'Main Complaint / Current Status', fieldType: 'textarea' },
        { id: 'f-injury-history', label: 'Injury / Surgery History', fieldType: 'textarea' },
        {
          id: 'f-activity',
          label: 'Previous Activity Level',
          fieldType: 'select',
          options: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Competitive Athlete'],
        },
        { id: 'f-prev-therapy', label: 'Previous Therapy / Treatment', fieldType: 'textarea' },
      ],
    },
    {
      id: 'sec-medical',
      title: 'Medical History',
      fields: [
        {
          id: 'f-smoking',
          label: 'Smoking',
          fieldType: 'select',
          options: ['Never', 'Former smoker', 'Active smoker'],
        },
        {
          id: 'f-alcohol',
          label: 'Alcohol',
          fieldType: 'select',
          options: ['None', 'Occasional', 'Regular'],
        },
        { id: 'f-medications', label: 'Current Medications', fieldType: 'textarea' },
        {
          id: 'f-sleep',
          label: 'Sleep Quality',
          fieldType: 'select',
          options: ['Poor', 'Fair', 'Good', 'Excellent'],
        },
        { id: 'f-nutrition', label: 'Nutrition Habits', fieldType: 'text' },
        { id: 'f-family-history', label: 'Family History of Relevant Conditions', fieldType: 'textarea' },
        { id: 'f-head-injuries', label: 'Head Injuries / Concussions', fieldType: 'textarea' },
        { id: 'f-eyes', label: 'Eye Conditions', fieldType: 'text' },
        { id: 'f-dental', label: 'Dental / Jaw Issues', fieldType: 'text' },
        { id: 'f-gynaecology', label: 'Gynaecology / Urology', fieldType: 'text' },
      ],
    },
    {
      id: 'sec-lower',
      title: 'Movement Screening — Lower Body',
      fields: [
        { id: 'f-overhead-squat', label: 'Overhead Squat', fieldType: 'textarea' },
        { id: 'f-thomas-test', label: 'Thomas Test (bilateral)', fieldType: 'textarea' },
        { id: 'f-gait', label: 'Gait Analysis', fieldType: 'textarea' },
        { id: 'f-hip-rom', label: 'Hip ROM (bilateral)', fieldType: 'textarea' },
        { id: 'f-knee-to-wall', label: 'Knee-to-Wall', fieldType: 'textarea' },
      ],
    },
    {
      id: 'sec-upper',
      title: 'Movement Screening — Upper Body / Core / Posture',
      fields: [
        { id: 'f-cervical', label: 'Cervical Rotation (bilateral)', fieldType: 'textarea' },
        { id: 'f-shoulder-rom', label: 'Shoulder ROM', fieldType: 'textarea' },
        { id: 'f-anti-rotation', label: 'Anti-rotation Test', fieldType: 'textarea' },
        { id: 'f-anti-flexion', label: 'Anti-flexion Test', fieldType: 'textarea' },
        { id: 'f-single-leg', label: 'Single-Leg Balance', fieldType: 'textarea' },
      ],
    },
    {
      id: 'sec-summary',
      title: 'Summary & Training Focus',
      fields: [
        { id: 'f-key-findings', label: 'Key Findings', fieldType: 'textarea' },
        { id: 'f-training-priorities', label: 'Training Priorities / Focus', fieldType: 'textarea' },
        { id: 'f-contraindications', label: 'Contraindications / Limitations', fieldType: 'textarea' },
      ],
    },
  ],
};
