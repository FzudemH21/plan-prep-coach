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
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' },
        'Sprinting - Technical Drills': {},
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Sprinting - Overspeed Sprinting': { 'Frequency': '0.5-1/wk', 'Overspeed [%] | Resistance [kg] | Hill decline [%]': '2-6 |  | 1-3', 'Rep Distance [m]': '20-40', 'Session Volume [m]': '80-200', 'Total Efforts [#]': '4-8', 'Inter-Rep Rest Duration [s]': '180-300', 'Inter-Set Rest Duration [s]': '240-480', 'Overspeed [%]': '2-6', 'Resistance [kg]': '0', 'Hill Decline [%]': '1-3', 'Sets [#]': '3-5', 'Reps [#]': '2-4', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '<=105', 'Recoveries [min]': '5-15', 'Total Session Volume [m]': '<=100' }
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
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' },
        'Proprioception & Coordination': {}
      }
    },
    {
      id: '3',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Initial RFD (0 100 ms)',
      mappedMethods: ['Isometrics - Joint Angle', 'Lower Body Resistance Training - Power', 'Intensive Plyometrics - Gazelle-Tier', 'Intensive Plyometrics - Tiger-Tier', 'Intensive Plyometrics - Frog-Tier'],
      loadingRecommendations: {
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Lower Body Resistance Training - Power': { 'Frequency': '1-2/wk', 'Intensity': '30-60 %1RM', 'Load': 'Light-Moderate', 'Intensity [%1RM]': '30-60', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-30' },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' },
        'Intensive Plyometrics - Tiger-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' },
        'Intensive Plyometrics - Frog-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '4',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Horizontal impulse at 1st 3rd step',
      mappedMethods: ['Sprinting - Resisted Sprinting', 'Sprinting - Acceleration', 'Lower Body Resistance Training - Strength'],
      loadingRecommendations: {
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '30-50 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' },
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' }
      }
    },
    {
      id: '5',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Shin angle management',
      mappedMethods: ['Sprinting - Technical Drills', 'Sprinting - Acceleration'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' }
      }
    },
    {
      id: '6',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Intermuscular coordination (hip knee ankle)',
      mappedMethods: ['Sprinting - Technical Drills', 'Sprinting - Acceleration', 'Moderate Plyometrics - Frog-/Deep-Tier'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' },
        'Moderate Plyometrics - Frog-/Deep-Tier': { 'Frequency': '1-3 /wk', 'Total Ground contacts [#]': '60-120', 'Ground Contacts per session [#of jumps]': '30-60', 'Inter-Set Rest Duration [s]': '60-120', 'Inter-Rep Rest Duration [s]': '3-10' }
      }
    },
    {
      id: '7',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Motor unit recruitment & firing rate',
      mappedMethods: ['Lower Body Resistance Training - Strength', 'Isometrics - Joint Angle', 'Lower Body Resistance Training - Power'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' },
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Lower Body Resistance Training - Power': { 'Frequency': '1-2/wk', 'Intensity': '30-60 %1RM', 'Load': 'Light-Moderate', 'Intensity [%1RM]': '30-60', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-30' }
      }
    },
    {
      id: '8',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Trunk stiffness & bracing',
      mappedMethods: ['Core', 'Isometrics - Joint Angle', 'Upper Body Resistance Training - Accessories'],
      loadingRecommendations: {
        'Core': {},
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Upper Body Resistance Training - Accessories': { 'Frequency': '1-3 /wk', 'Intensity': 'RPE 6-8', 'Load': 'Light-Heavy' }
      }
    },
    {
      id: '9',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Arm swing timing',
      mappedMethods: ['Sprinting - Technical Drills', 'Proprioception & Coordination'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Proprioception & Coordination': {}
      }
    },
    {
      id: '10',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Block start & reaction',
      quality: 'Psychological arousal & attentional focus',
      mappedMethods: ['Recovery Modalities', 'PRI (Postural Restoration)'],
      loadingRecommendations: {
        'Recovery Modalities': {},
        'PRI (Postural Restoration)': {}
      }
    },
    {
      id: '11',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Horizontal force production',
      mappedMethods: ['Sprinting - Resisted Sprinting', 'Lower Body Resistance Training - Strength', 'Lower Body Resistance Training - Power'],
      loadingRecommendations: {
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' },
        'Lower Body Resistance Training - Power': { 'Frequency': '1-2/wk', 'Intensity': '30-60 %1RM', 'Load': 'Light-Moderate', 'Intensity [%1RM]': '30-60', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-30' }
      }
    },
    {
      id: '12',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Force orientation (horizontal vs vertical)',
      mappedMethods: ['Sprinting - Resisted Sprinting', 'Sprinting - Acceleration'],
      loadingRecommendations: {
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' }
      }
    },
    {
      id: '13',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Step length frequency balance',
      mappedMethods: ['Sprinting - Technical Drills', 'Sprinting - Acceleration', 'Moderate Plyometrics - Gazelle-/Reactive-Tier'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' },
        'Moderate Plyometrics - Gazelle-/Reactive-Tier': { 'Frequency': '1-3 /wk', 'Total Ground contacts [#]': '60-120', 'Ground Contacts per session [#of jumps]': '30-60', 'Inter-Set Rest Duration [s]': '60-120', 'Inter-Rep Rest Duration [s]': '3-10' }
      }
    },
    {
      id: '14',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Early-phase RFD',
      mappedMethods: ['Isometrics - Joint Angle', 'Lower Body Resistance Training - Power', 'Intensive Plyometrics - Gazelle-Tier', 'Intensive Plyometrics - Tiger-Tier', 'Intensive Plyometrics - Frog-Tier'],
      loadingRecommendations: {
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Lower Body Resistance Training - Power': { 'Frequency': '1-2/wk', 'Intensity': '30-60 %1RM', 'Load': 'Light-Moderate', 'Intensity [%1RM]': '30-60', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-30' },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' },
        'Intensive Plyometrics - Tiger-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' },
        'Intensive Plyometrics - Frog-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '15',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Hip extensor strength',
      mappedMethods: ['Lower Body Resistance Training - Strength', 'Isometrics - Joint Angle'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' },
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } }
      }
    },
    {
      id: '16',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Ankle plantarflexor stiffness',
      mappedMethods: ['Isometrics - Joint Angle', 'Extensive Plyometrics - Reactive-Tier', 'Intensive Plyometrics - Gazelle-Tier'],
      loadingRecommendations: {
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Extensive Plyometrics - Reactive-Tier': { 'Frequency': '2-4 /wk', 'Total Ground contacts [#]': '100-200', 'Ground Contacts per session [#of jumps]': '50-100', 'Inter-Set Rest Duration [s]': '30-90' },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '17',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Front-side mechanics',
      mappedMethods: ['Sprinting - Technical Drills', 'Sprinting - Acceleration'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' }
      }
    },
    {
      id: '18',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Interlimb coordination',
      mappedMethods: ['Sprinting - Technical Drills', 'Proprioception & Coordination'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Proprioception & Coordination': {}
      }
    },
    {
      id: '19',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Technique under load',
      mappedMethods: ['Sprinting - Resisted Sprinting', 'Sprinting - Acceleration'],
      loadingRecommendations: {
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' }
      }
    },
    {
      id: '20',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 0-10 m',
      quality: 'Tendon elasticity',
      mappedMethods: ['Extensive Plyometrics - Elastic-Tier', 'Intensive Plyometrics - Gazelle-Tier'],
      loadingRecommendations: {
        'Extensive Plyometrics - Elastic-Tier': { 'Frequency': '2-4 /wk', 'Total Ground contacts [#]': '100-200', 'Ground Contacts per session [#of jumps]': '50-100', 'Inter-Set Rest Duration [s]': '30-90' },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '21',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Net impulse per step',
      mappedMethods: ['Sprinting - Acceleration', 'Sprinting - Resisted Sprinting', 'Lower Body Resistance Training - Strength'],
      loadingRecommendations: {
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' },
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' }
      }
    },
    {
      id: '22',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Progressive body angle rise',
      mappedMethods: ['Sprinting - Acceleration', 'Sprinting - Technical Drills'],
      loadingRecommendations: {
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' },
        'Sprinting - Technical Drills': {}
      }
    },
    {
      id: '23',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Hamstring eccentric strength',
      mappedMethods: ['Lower Body Resistance Training - Strength', 'Lower Body Resistance Training - Accessories'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' },
        'Lower Body Resistance Training - Accessories': { 'Frequency': '1-3/wk', 'Intensity': 'RPE 6-8', 'Load': 'Light-Heavy', 'Sets [#]': '2-5', 'Reps [#]': '8-15' }
      }
    },
    {
      id: '24',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Gluteus maximus power',
      mappedMethods: ['Lower Body Resistance Training - Power', 'Lower Body Resistance Training - Strength'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Power': { 'Frequency': '1-2/wk', 'Intensity': '30-60 %1RM', 'Load': 'Light-Moderate', 'Intensity [%1RM]': '30-60', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-30' },
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' }
      }
    },
    {
      id: '25',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Step-to-step variability control',
      mappedMethods: ['Sprinting - Technical Drills', 'Proprioception & Coordination'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Proprioception & Coordination': {}
      }
    },
    {
      id: '26',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Stretch shortening cycle utilization',
      mappedMethods: ['Intensive Plyometrics - Tiger-Tier', 'Intensive Plyometrics - Gazelle-Tier'],
      loadingRecommendations: {
        'Intensive Plyometrics - Tiger-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '27',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Technical rhythm',
      mappedMethods: ['Sprinting - Technical Drills'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {}
      }
    },
    {
      id: '28',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Acceleration 10-30 m',
      quality: 'Braking minimization',
      mappedMethods: ['Sprinting - Technical Drills'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {}
      }
    },
    {
      id: '29',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Very short ground contact time',
      mappedMethods: ['Sprinting - Top Speed', 'Intensive Plyometrics - Gazelle-Tier'],
      loadingRecommendations: {
        'Sprinting - Top Speed': { 'Frequency': '1-2 /wk', 'Intensity [%]': '98-100', 'Rep Distance [m]': '20-60', 'Sets [#]': '3-6', 'Reps [#]': '1-4', 'Session Volume [m]': '120-360', 'Total Efforts [#]': '4-10', 'Inter-Rep Rest Duration [s]': '180-300', 'Inter-Set Rest Duration [s]': '240-480', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '4-15', 'Total Session Volume [m]': '50-150' },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '30',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Step frequency optimization',
      mappedMethods: ['Sprinting - Technical Drills', 'Sprinting - Top Speed'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Sprinting - Top Speed': { 'Frequency': '1-2 /wk', 'Intensity [%]': '98-100', 'Rep Distance [m]': '20-60', 'Sets [#]': '3-6', 'Reps [#]': '1-4', 'Session Volume [m]': '120-360', 'Total Efforts [#]': '4-10', 'Inter-Rep Rest Duration [s]': '180-300', 'Inter-Set Rest Duration [s]': '240-480', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '4-15', 'Total Session Volume [m]': '50-150' }
      }
    },
    {
      id: '31',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Functional leg stiffness',
      mappedMethods: ['Isometrics - Joint Angle', 'Intensive Plyometrics - Gazelle-Tier'],
      loadingRecommendations: {
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '32',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Vertical force at speed',
      mappedMethods: ['Lower Body Resistance Training - Strength', 'Sprinting - Top Speed'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Intensity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' },
        'Sprinting - Top Speed': { 'Frequency': '1-2 /wk', 'Intensity [%]': '98-100', 'Rep Distance [m]': '20-60', 'Sets [#]': '3-6', 'Reps [#]': '1-4', 'Session Volume [m]': '120-360', 'Total Efforts [#]': '4-10', 'Inter-Rep Rest Duration [s]': '180-300', 'Inter-Set Rest Duration [s]': '240-480', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '4-15', 'Total Session Volume [m]': '50-150' }
      }
    },
    {
      id: '33',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Hip flexor velocity',
      mappedMethods: ['Sprinting - Technical Drills', 'Lower Body Resistance Training - Accessories'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Lower Body Resistance Training - Accessories': { 'Frequency': '1-3/wk', 'Intensity': 'RPE 6-8', 'Load': 'Light-Heavy', 'Sets [#]': '2-5', 'Reps [#]': '8-15' }
      }
    },
    {
      id: '34',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Hip extensor velocity',
      mappedMethods: ['Sprinting - Resisted Sprinting', 'Sprinting - Top Speed'],
      loadingRecommendations: {
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Sprinting - Top Speed': { 'Frequency': '1-2 /wk', 'Intensity [%]': '98-100', 'Rep Distance [m]': '20-60', 'Sets [#]': '3-6', 'Reps [#]': '1-4', 'Session Volume [m]': '120-360', 'Total Efforts [#]': '4-10', 'Inter-Rep Rest Duration [s]': '180-300', 'Inter-Set Rest Duration [s]': '240-480', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '4-15', 'Total Session Volume [m]': '50-150' }
      }
    },
    {
      id: '35',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Ankle stiffness',
      mappedMethods: ['Isometrics - Joint Angle', 'Extensive Plyometrics - Reactive-Tier'],
      loadingRecommendations: {
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Extensive Plyometrics - Reactive-Tier': { 'Frequency': '2-4 /wk', 'Total Ground contacts [#]': '100-200', 'Ground Contacts per session [#of jumps]': '50-100', 'Inter-Set Rest Duration [s]': '30-90' }
      }
    },
    {
      id: '36',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Elastic energy return',
      mappedMethods: ['Extensive Plyometrics - Elastic-Tier', 'Intensive Plyometrics - Gazelle-Tier'],
      loadingRecommendations: {
        'Extensive Plyometrics - Elastic-Tier': { 'Frequency': '2-4 /wk', 'Total Ground contacts [#]': '100-200', 'Ground Contacts per session [#of jumps]': '50-100', 'Inter-Set Rest Duration [s]': '30-90' },
        'Intensive Plyometrics - Gazelle-Tier': { 'Frequency': '1-2 /wk', 'Total Ground contacts [#]': '40-80', 'Ground Contacts per session [#of jumps]': '20-40', 'Inter-Set Rest Duration [s]': '90-180', 'Inter-Rep Rest Duration [s]': '5-20' }
      }
    },
    {
      id: '37',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Max velocity development',
      quality: 'Technical posture and pelvis control',
      mappedMethods: ['Sprinting - Technical Drills', 'Core'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Core': {}
      }
    },
    {
      id: '38',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Speed endurance (7-15 s)',
      quality: 'Neuromuscular fatigue resistance',
      mappedMethods: ['Sprinting - Speed Endurance'],
      loadingRecommendations: {
        'Sprinting - Speed Endurance': { 'Frequency': '1-2 /wk', 'Intensity [%Vmax]': '90-95', 'Work Duration [s]': '7-15', 'Rep Distance [m]': '60-120', 'Sets [#]': '1-3', 'Reps [#]': '4-8', 'Total Efforts [#]': '4-16', 'Inter-Rep Rest Duration [s]': '120-600', 'Inter-Set Rest Duration [s]': '300-600', 'Distance [m]': '60-80', 'Recoveries [min]': '2-4 (8-15)', 'Total Session Volume [m]': '600-2000' }
      }
    },
    {
      id: '39',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Speed endurance (7-15 s)',
      quality: 'Anaerobic capacity (glycolytic power)',
      mappedMethods: ['Sprinting - Speed Endurance', 'Energy System Development - Interval-Training'],
      loadingRecommendations: {
        'Sprinting - Speed Endurance': { 'Frequency': '1-2 /wk', 'Intensity [%Vmax]': '90-95', 'Work Duration [s]': '7-15', 'Rep Distance [m]': '60-120', 'Sets [#]': '1-3', 'Reps [#]': '4-8', 'Total Efforts [#]': '4-16', 'Inter-Rep Rest Duration [s]': '120-600', 'Inter-Set Rest Duration [s]': '300-600', 'Distance [m]': '60-80', 'Recoveries [min]': '2-4 (8-15)', 'Total Session Volume [m]': '600-2000' },
        'Energy System Development - Interval-Training': { 'Frequency': '1-3 /wk', 'Intensity': '85-100 %V02max | HRzone 4-5', 'Work Duration [s]': '20-240', 'Sets [#]': '1-4', 'Reps [#]': '4-12', 'Total Volume [m, km, kcal]': '1-5 km | 100-600 kcal', 'Inter-Rep Rest Intensity': 'OFF|Z1', 'Inter-Set Rest Duration [s]': '120-300' }
      }
    },
    {
      id: '40',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Speed endurance (7-15 s)',
      quality: 'Buffering capacity',
      mappedMethods: ['Sprinting - Speed Endurance', 'Energy System Development - Interval-Training'],
      loadingRecommendations: {
        'Sprinting - Speed Endurance': { 'Frequency': '1-2 /wk', 'Intensity [%Vmax]': '90-95', 'Work Duration [s]': '7-15', 'Rep Distance [m]': '60-120', 'Sets [#]': '1-3', 'Reps [#]': '4-8', 'Total Efforts [#]': '4-16', 'Inter-Rep Rest Duration [s]': '120-600', 'Inter-Set Rest Duration [s]': '300-600', 'Distance [m]': '60-80', 'Recoveries [min]': '2-4 (8-15)', 'Total Session Volume [m]': '600-2000' },
        'Energy System Development - Interval-Training': { 'Frequency': '1-3 /wk', 'Intensity': '85-100 %V02max | HRzone 4-5', 'Work Duration [s]': '20-240', 'Sets [#]': '1-4', 'Reps [#]': '4-12', 'Total Volume [m, km, kcal]': '1-5 km | 100-600 kcal', 'Inter-Rep Rest Intensity': 'OFF|Z1', 'Inter-Set Rest Duration [s]': '120-300' }
      }
    },
    {
      id: '41',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Speed endurance (7-15 s)',
      quality: 'Technique retention under fatigue',
      mappedMethods: ['Sprinting - Speed Endurance', 'Sprinting - Technical Drills'],
      loadingRecommendations: {
        'Sprinting - Speed Endurance': { 'Frequency': '1-2 /wk', 'Intensity [%Vmax]': '90-95', 'Work Duration [s]': '7-15', 'Rep Distance [m]': '60-120', 'Sets [#]': '1-3', 'Reps [#]': '4-8', 'Total Efforts [#]': '4-16', 'Inter-Rep Rest Duration [s]': '120-600', 'Inter-Set Rest Duration [s]': '300-600', 'Distance [m]': '60-80', 'Recoveries [min]': '2-4 (8-15)', 'Total Session Volume [m]': '600-2000' },
        'Sprinting - Technical Drills': {}
      }
    },
    {
      id: '42',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Speed endurance (7-15 s)',
      quality: 'PCr resynthesis rate',
      mappedMethods: ['Sprinting - Sprint-specific endurance'],
      loadingRecommendations: {
        'Sprinting - Sprint-specific endurance': { 'Distance [m]': '80-150', 'Intensity [%Vmax]': '>95', 'Recoveries [min]': '8-30', 'Total Session Volume [m]': '300-900' }
      }
    },
    {
      id: '43',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Speed endurance (7-15 s)',
      quality: 'Thermoregulation',
      mappedMethods: ['Recovery Modalities'],
      loadingRecommendations: {
        'Recovery Modalities': {}
      }
    },
    {
      id: '44',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Speed endurance (7-15 s)',
      quality: 'Mental pacing',
      mappedMethods: ['Sprinting - Speed Endurance'],
      loadingRecommendations: {
        'Sprinting - Speed Endurance': { 'Frequency': '1-2 /wk', 'Intensity [%Vmax]': '90-95', 'Work Duration [s]': '7-15', 'Rep Distance [m]': '60-120', 'Sets [#]': '1-3', 'Reps [#]': '4-8', 'Total Efforts [#]': '4-16', 'Inter-Rep Rest Duration [s]': '120-600', 'Inter-Set Rest Duration [s]': '300-600', 'Distance [m]': '60-80', 'Recoveries [min]': '2-4 (8-15)', 'Total Session Volume [m]': '600-2000' }
      }
    },
    {
      id: '45',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Repeated sprint ability',
      quality: 'Aerobic power for recovery',
      mappedMethods: ['Energy System Development - Interval-Training', 'Energy System Development - Steady State Conditioning'],
      loadingRecommendations: {
        'Energy System Development - Interval-Training': { 'Frequency': '1-3 /wk', 'Intensity': '85-100 %V02max | HRzone 4-5', 'Work Duration [s]': '20-240', 'Sets [#]': '1-4', 'Reps [#]': '4-12', 'Total Volume [m, km, kcal]': '1-5 km | 100-600 kcal', 'Inter-Rep Rest Intensity': 'OFF|Z1', 'Inter-Set Rest Duration [s]': '120-300' },
        'Energy System Development - Steady State Conditioning': { 'Frequency': '1-3 /wk', 'Intensity': '60-75 %V02max | HRzone 2-3 | RPE 3-5', 'Elevation [hm]': '0-300', 'Work Duration [s]': '1800-5400', 'Total Volume [m, km, kcal]': '3-12 km | 200-800 kcal' }
      }
    },
    {
      id: '46',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Repeated sprint ability',
      quality: 'PCr resynthesis capacity',
      mappedMethods: ['Sprinting - Sprint-specific endurance'],
      loadingRecommendations: {
        'Sprinting - Sprint-specific endurance': { 'Distance [m]': '80-150', 'Intensity [%Vmax]': '>95', 'Recoveries [min]': '8-30', 'Total Session Volume [m]': '300-900' }
      }
    },
    {
      id: '47',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Repeated sprint ability',
      quality: 'Neuromuscular resilience',
      mappedMethods: ['Sprinting - Sprint-specific endurance'],
      loadingRecommendations: {
        'Sprinting - Sprint-specific endurance': { 'Distance [m]': '80-150', 'Intensity [%Vmax]': '>95', 'Recoveries [min]': '8-30', 'Total Session Volume [m]': '300-900' }
      }
    },
    {
      id: '48',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Repeated sprint ability',
      quality: 'Heat tolerance',
      mappedMethods: ['Recovery Modalities'],
      loadingRecommendations: {
        'Recovery Modalities': {}
      }
    },
    {
      id: '49',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Repeated sprint ability',
      quality: 'COD repeatability',
      mappedMethods: ['Sprinting - Sprint-specific endurance'],
      loadingRecommendations: {
        'Sprinting - Sprint-specific endurance': { 'Distance [m]': '80-150', 'Intensity [%Vmax]': '>95', 'Recoveries [min]': '8-30', 'Total Session Volume [m]': '300-900' }
      }
    },
    {
      id: '50',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Repeated sprint ability',
      quality: 'Efficient acceleration mechanics',
      mappedMethods: ['Sprinting - Resisted Sprinting', 'Sprinting - Acceleration'],
      loadingRecommendations: {
        'Sprinting - Resisted Sprinting': { 'Frequency': '1-2/wk', 'Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]': '10-30 |  | ', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Total Efforts [#]': '6-16', 'Session Volume [m]': '120-300', 'Inter-Rep Rest Duration [s]': '120-240', 'Inter-Set Rest Duration [s]': '180-360', 'Velocity Decrement [%]': '10-50', 'Resistance [kg]': '15-40', 'Hill Incline [%]': '5-15', 'Rep Distance [m]': '10-30', 'Distance [m]': '10-30', 'Intensity [%Vmax]': '80-95', 'Recoveries [min]': '3-6', 'Total Session Volume [m]': '50-200' },
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' }
      }
    },
    {
      id: '51',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Sprint technique robustness',
      quality: 'Front-side mechanics',
      mappedMethods: ['Sprinting - Technical Drills', 'Sprinting - Acceleration'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Sprinting - Acceleration': { 'Frequency': '2-3 /wk', 'Intensity [%]': '95-100', 'Rep Distance [m]': '10-30', 'Sets [#]': '3-6', 'Reps [#]': '2-6', 'Session Volume [m]': '150-400', 'Total Efforts [#]': '6-16', 'Inter-Rep Rest Duration [s]': '90-180', 'Inter-Set Rest Duration [s]': '180-300', 'Distance [m]': '10-50', 'Intensity [%Vmax]': '>98', 'Recoveries [min]': '2-7', 'Total Session Volume [m]': '100-300' }
      }
    },
    {
      id: '52',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Sprint technique robustness',
      quality: 'Pelvis stability',
      mappedMethods: ['Core', 'Isometrics - Joint Angle'],
      loadingRecommendations: {
        'Core': {},
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } }
      }
    },
    {
      id: '53',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Sprint technique robustness',
      quality: 'Foot strike close to CoM',
      mappedMethods: ['Sprinting - Technical Drills'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {}
      }
    },
    {
      id: '54',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Sprint technique robustness',
      quality: 'Arm swing leg timing',
      mappedMethods: ['Sprinting - Technical Drills', 'Proprioception & Coordination'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Proprioception & Coordination': {}
      }
    },
    {
      id: '55',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Sprint technique robustness',
      quality: 'Head/torso alignment',
      mappedMethods: ['Sprinting - Technical Drills', 'Isometrics - Joint Angle'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {},
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } }
      }
    },
    {
      id: '56',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Sprint technique robustness',
      quality: 'Rhythm control',
      mappedMethods: ['Sprinting - Technical Drills'],
      loadingRecommendations: {
        'Sprinting - Technical Drills': {}
      }
    },
    {
      id: '57',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Tissue robustness for sprinting',
      quality: 'Hamstring fascicle length',
      mappedMethods: ['Lower Body Resistance Training - Accessories'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Accessories': { 'Frequency': '1-3/wk', 'Intensity': 'RPE 6-8', 'Load': 'Light-Heavy', 'Sets [#]': '2-5', 'Reps [#]': '8-15' }
      }
    },
    {
      id: '58',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Tissue robustness for sprinting',
      quality: 'Hamstring eccentric strength',
      mappedMethods: ['Lower Body Resistance Training - Strength', 'Lower Body Resistance Training - Accessories'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Strength': { 'Frequency': '2-3/wk', 'Intensity': '80-92 %1RM', 'Load': 'Heavy', 'Integrity [%1RM]': '80-92', 'Sets [#]': '3-6', 'Reps [#]': '3-6', 'Volume [lifts/exercise]': '12-24' },
        'Lower Body Resistance Training - Accessories': { 'Frequency': '1-3/wk', 'Intensity': 'RPE 6-8', 'Load': 'Light-Heavy', 'Sets [#]': '2-5', 'Reps [#]': '8-15' }
      }
    },
    {
      id: '59',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Tissue robustness for sprinting',
      quality: 'Achilles tendon stiffness',
      mappedMethods: ['Isometrics - Joint Angle', 'Extensive Plyometrics - Reactive-Tier'],
      loadingRecommendations: {
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } },
        'Extensive Plyometrics - Reactive-Tier': { 'Frequency': '2-4 /wk', 'Total Ground contacts [#]': '100-200', 'Ground Contacts per session [#of jumps]': '50-100', 'Inter-Set Rest Duration [s]': '30-90' }
      }
    },
    {
      id: '60',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Tissue robustness for sprinting',
      quality: 'Patellar tendon stiffness',
      mappedMethods: ['Isometrics - Joint Angle'],
      loadingRecommendations: {
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } }
      }
    },
    {
      id: '61',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Tissue robustness for sprinting',
      quality: 'Calf soleus capacity',
      mappedMethods: ['Lower Body Resistance Training - Accessories', 'Isometrics - Joint Angle'],
      loadingRecommendations: {
        'Lower Body Resistance Training - Accessories': { 'Frequency': '1-3/wk', 'Intensity': 'RPE 6-8', 'Load': 'Light-Heavy', 'Sets [#]': '2-5', 'Reps [#]': '8-15' },
        'Isometrics - Joint Angle': { 'Frequency': '2-3/wk', 'Modes': { 'Iso-push': { 'Intensity [%]': '80-100', 'Reps [#]': '2-5', 'Repetition Duration [s]': '1.5-5', 'Sets [#]': '2-4', 'Total Volume [s]': '10-40' }, 'Iso-hold': { 'Intensity [%]': '65-80', 'Reps [#]': '1-4', 'Repetition Duration [s]': '4-30', 'Sets [#]': '2-5', 'Total Volume [s]': '16-48' }, 'Iso-switch': { 'Intensity [%]': '35-60', 'Contacts [#]': 'up to 18', 'Sets [#]': '2-3' }, 'Iso-hybrid': { 'Intensity [%]': '30-40', 'Reps [#]': '2-3', 'Repetition Duration [s]': '8 (push) + 32 (hold)' }, 'Iso-catch': { 'Intensity [%]': '20-35', 'Reps [#]': '4-15', 'Sets [#]': '2-3' } } }
      }
    },
    {
      id: '62',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Tissue robustness for sprinting',
      quality: 'Bone loading tolerance',
      mappedMethods: ['Extensive Plyometrics - Deep-Tier'],
      loadingRecommendations: {
        'Extensive Plyometrics - Deep-Tier': { 'Frequency': '2-4 /wk', 'Total Ground contacts [#]': '100-200', 'Ground Contacts per session [#of jumps]': '50-100', 'Inter-Set Rest Duration [s]': '30-90' }
      }
    },
    {
      id: '63',
      overarchingGoal: 'Improving sprint ability',
      subGoal: 'Tissue robustness for sprinting',
      quality: 'Foot intrinsic strength',
      mappedMethods: ['Foot Strength'],
      loadingRecommendations: {
        'Foot Strength': {}
      }
    }
  ],
  lastUpdated: new Date().toISOString()
};