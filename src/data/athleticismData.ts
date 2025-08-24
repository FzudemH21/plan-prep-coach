import { AthleticismDatabase } from '@/types/athleticism';

export const defaultAthleticismData: AthleticismDatabase = {
  entries: [
    {
      id: '1',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Start technique',
      mappedMethods: ['Sprinting - Acceleration', 'Sprinting - Technical Drills', 'Sprinting - Resisted Sprinting', 'Sprinting - Overspeed Sprinting'],
      loadingRecommendations: {
        'Sprinting - Acceleration': {
          'Frequency': '2-3 /wk',
          'Intensity [%]': '95-100',
          'Rep Distance [m]': '10-30',
          'Sets [#]': '3-6',
          'Reps [#]': '2-6',
          'Session Volume [m]': '150-400',
          'Total Efforts [#]': '6-16',
          'Inter-Rep Rest Duration [s]': '90-180',
          'Inter-Set Rest Duration [s]': '180-300',
          'Distance [m]': '10-50',
          'Intensity [%Vmax]': '>98',
          'Recoveries [min]': '2-7',
          'Total Session Volume [m]': '100-300'
        },
        'Sprinting - Technical Drills': {},
        'Sprinting - Resisted Sprinting': {
          'Frequency': '1-2/wk',
          'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ',
          'Sets [#]': '3-6',
          'Reps [#]': '3-6',
          'Total Efforts [#]': '6-16',
          'Session Volume [m]': '120-300',
          'Inter-Rep Rest Duration [s]': '120-240',
          'Inter-Set Rest Duration [s]': '180-360',
          'Velocity Decrement [%]': '10-50',
          'Resistance [kg]': '15-40',
          'Hill Incline [%]': '5-15',
          'Rep Distance [m]': '10-30',
          'Distance [m]': '10-30',
          'Intensity [%Vmax]': '80-95',
          'Recoveries [min]': '3-6',
          'Total Session Volume [m]': '50-200'
        },
        'Sprinting - Overspeed Sprinting': {
          'Frequency': '0.5-1/wk',
          'Overspeed [%] | Resistance [kg] | Hill decline [%]': '2-6 |  | 1-3',
          'Rep Distance [m]': '20-40',
          'Session Volume [m]': '80-200',
          'Total Efforts [#]': '4-8',
          'Inter-Rep Rest Duration [s]': '180-300',
          'Inter-Set Rest Duration [s]': '240-480',
          'Overspeed [%]': '2-6',
          'Resistance [kg]': '0',
          'Hill Decline [%]': '1-3',
          'Sets [#]': '3-5',
          'Reps [#]': '2-4',
          'Distance [m]': '10-30',
          'Intensity [%Vmax]': '<=105',
          'Recoveries [min]': '5-15',
          'Total Session Volume [m]': '<=100'
        }
      }
    },
    {
      id: '2',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Reaction time',
      mappedMethods: ['Sprinting - Technical Drills', 'Sprinting - Acceleration', 'Proprioception & Coordination'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Sprinting - Acceleration': {
          'Frequency': '2-3 /wk',
          'Intensity [%]': '95-100',
          'Rep Distance [m]': '10-30',
          'Sets [#]': '3-6',
          'Reps [#]': '2-6',
          'Session Volume [m]': '150-400',
          'Total Efforts [#]': '6-16',
          'Inter-Rep Rest Duration [s]': '90-180',
          'Inter-Set Rest Duration [s]': '180-300',
          'Distance [m]': '10-50',
          'Intensity [%Vmax]': '>98',
          'Recoveries [min]': '2-7',
          'Total Session Volume [m]': '100-300'
        },
        'Proprioception & Coordination': {}
      }
    }
    // ... Additional entries would be added here from the full data
  ],
  lastUpdated: new Date().toISOString()
};