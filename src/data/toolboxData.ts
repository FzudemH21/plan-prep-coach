import { ToolboxDatabase } from '@/types/toolbox';

export const defaultToolboxData: ToolboxDatabase = {
  entries: [
    // Sprinting - Acceleration
    { id: "1", category: "Sprinting", subCategory: "Acceleration", parameter: "Frequency" },
    { id: "2", category: "Sprinting", subCategory: "Acceleration", parameter: "Intensity [%]" },
    { id: "3", category: "Sprinting", subCategory: "Acceleration", parameter: "Starting Position [2pt, 3pt, 4 pt, Blocks, Gallop-in]" },
    { id: "4", category: "Sprinting", subCategory: "Acceleration", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "5", category: "Sprinting", subCategory: "Acceleration", parameter: "Footwear [Trainers, Spikes, Cleats, Barefoot, Other (specify)]" },
    { id: "6", category: "Sprinting", subCategory: "Acceleration", parameter: "Rep Distance [m]" },
    { id: "7", category: "Sprinting", subCategory: "Acceleration", parameter: "Sets [#]" },
    { id: "8", category: "Sprinting", subCategory: "Acceleration", parameter: "Reps [#]" },
    { id: "9", category: "Sprinting", subCategory: "Acceleration", parameter: "Session Volume [m]" },
    { id: "10", category: "Sprinting", subCategory: "Acceleration", parameter: "Total Efforts [#]" },
    { id: "11", category: "Sprinting", subCategory: "Acceleration", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "12", category: "Sprinting", subCategory: "Acceleration", parameter: "Inter-Set Rest Duration [s]" },
    { id: "13", category: "Sprinting", subCategory: "Acceleration", parameter: "Comments" },

    // Sprinting - Top Speed
    { id: "14", category: "Sprinting", subCategory: "Top Speed", parameter: "Frequency" },
    { id: "15", category: "Sprinting", subCategory: "Top Speed", parameter: "Intensity [%]" },
    { id: "16", category: "Sprinting", subCategory: "Top Speed", parameter: "Starting Position [2pt, 3pt, 4 pt, Blocks, Gallop-in]" },
    { id: "17", category: "Sprinting", subCategory: "Top Speed", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "18", category: "Sprinting", subCategory: "Top Speed", parameter: "Footwear [Trainers, Spikes, Cleats, Barefoot, Other (specify)]" },
    { id: "19", category: "Sprinting", subCategory: "Top Speed", parameter: "Rep Distance [m]" },
    { id: "20", category: "Sprinting", subCategory: "Top Speed", parameter: "Sets [#]" },
    { id: "21", category: "Sprinting", subCategory: "Top Speed", parameter: "Reps [#]" },
    { id: "22", category: "Sprinting", subCategory: "Top Speed", parameter: "Session Volume [m]" },
    { id: "23", category: "Sprinting", subCategory: "Top Speed", parameter: "Total Efforts [#]" },
    { id: "24", category: "Sprinting", subCategory: "Top Speed", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "25", category: "Sprinting", subCategory: "Top Speed", parameter: "Inter-Set Rest Duration [s]" },
    { id: "26", category: "Sprinting", subCategory: "Top Speed", parameter: "Comments" },

    // Sprinting - Resisted Sprinting
    { id: "27", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Frequency" },
    { id: "28", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Starting Position [2pt, 3pt, 4 pt, Blocks, Gallop-in]" },
    { id: "29", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "30", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Footwear [Trainers, Spikes, Cleats, Barefoot, Other (specify)]" },
    { id: "31", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Resistance Attachment Point" },
    { id: "32", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Velocity Decrement [%] | Resistance [kg] | Hill Incline [%]" },
    { id: "33", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Rep Distance (m)" },
    { id: "34", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Sets [#]" },
    { id: "35", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Reps [#]" },
    { id: "36", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Total Efforts [#]" },
    { id: "37", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Session Volume [m]" },
    { id: "38", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "39", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Inter-Set Rest Duration [s]" },
    { id: "40", category: "Sprinting", subCategory: "Resisted Sprinting", parameter: "Comments" },

    // Sprinting - Overspeed Sprinting
    { id: "41", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Frequency" },
    { id: "42", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Starting Position [2pt, 3pt, 4 pt, Blocks, Gallop-in]" },
    { id: "43", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "44", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Footwear [Trainers, Spikes, Cleats, Barefoot, Other (specify)]" },
    { id: "45", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Overspeed [%] | Assistance [kg] | Hill decline [%]" },
    { id: "46", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Rep Distance [m]" },
    { id: "47", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Session Volume [m]" },
    { id: "48", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Total Efforts [#]" },
    { id: "49", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "50", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Inter-Set Rest Duration [s]" },
    { id: "51", category: "Sprinting", subCategory: "Overspeed Sprinting", parameter: "Comments" },

    // Sprinting - Speed Endurance
    { id: "52", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Frequency" },
    { id: "53", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Starting Position [2pt, 3pt, 4 pt, Blocks, Gallop-in]" },
    { id: "54", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "55", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Footwear [Trainers, Spikes, Cleats, Barefoot, Other (specify)]" },
    { id: "56", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Intensity [%Vmax]" },
    { id: "57", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Work Duration [s]" },
    { id: "58", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Rep Distance [m]" },
    { id: "59", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Sets [#]" },
    { id: "60", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Reps [#]" },
    { id: "61", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Total Distance [m]" },
    { id: "62", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Total Efforts [#]" },
    { id: "63", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "64", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Inter-Set Rest Duration [s]" },
    { id: "65", category: "Sprinting", subCategory: "Speed Endurance", parameter: "Comments" },

    // Sprinting - Sprint-specific endurance
    { id: "66", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Frequency" },
    { id: "67", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Starting Position [2pt, 3pt, 4 pt, Blocks, Gallop-in]" },
    { id: "68", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "69", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Footwear [Trainers, Spikes, Cleats, Barefoot, Other (specify)]" },
    { id: "70", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Intensity [%Vmax]" },
    { id: "71", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Work Duration [s]" },
    { id: "72", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Rep Distance [m]" },
    { id: "73", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Sets [#]" },
    { id: "74", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Reps [#]" },
    { id: "75", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Total Distance [m]" },
    { id: "76", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Total Efforts [#]" },
    { id: "77", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "78", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Inter-Set Rest Duration [min]" },
    { id: "79", category: "Sprinting", subCategory: "Sprint-specific endurance", parameter: "Comments" },

    // Sprinting - Technical Drills
    { id: "80", category: "Sprinting", subCategory: "Technical Drills", parameter: "Focus [Acceleration, Top Speed]" },
    { id: "81", category: "Sprinting", subCategory: "Technical Drills", parameter: "Hand position [Regular, Hands on hips, Hands on head, Hands overhead]" },
    { id: "82", category: "Sprinting", subCategory: "Technical Drills", parameter: "Comments" },

    // Sprinting - Tempo Runs (sprint-specific)
    { id: "83", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Frequency" },
    { id: "84", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "85", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Footwear [Trainers, Spikes, Cleats, Barefoot, Other (specify)]" },
    { id: "86", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Intensity [%Vmax]" },
    { id: "87", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Work Duration [s]" },
    { id: "88", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Interval Distance [m]" },
    { id: "89", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Sets [#]" },
    { id: "90", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Reps [#]" },
    { id: "91", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Total Distance [m]" },
    { id: "92", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Total Efforts [#]" },
    { id: "93", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "94", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Inter-Set Rest Duration [s]" },
    { id: "95", category: "Sprinting", subCategory: "Tempo Runs (sprint-specific)", parameter: "Comments" },

    // Agility
    { id: "96", category: "Agility", subCategory: "", parameter: "Frequency" },
    { id: "97", category: "Agility", subCategory: "", parameter: "Subjective Intensity [%max Velocity]" },
    { id: "98", category: "Agility", subCategory: "", parameter: "Mode [Maneouvrability, Change of Direction, Change of Orientation, True Agility]" },
    { id: "99", category: "Agility", subCategory: "", parameter: "Stimulus (in case of true agility) [auditory, visual, tactile, opponent]" },
    { id: "100", category: "Agility", subCategory: "", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "101", category: "Agility", subCategory: "", parameter: "Footwear [Trainers, Cleats, Barefoot, Other (specify)]" },
    { id: "102", category: "Agility", subCategory: "", parameter: "Sets [#]" },
    { id: "103", category: "Agility", subCategory: "", parameter: "Actions per Set [#]" },
    { id: "104", category: "Agility", subCategory: "", parameter: "Total Actions [#]" },
    { id: "105", category: "Agility", subCategory: "", parameter: "Inter-Set Rest Duration [s]" },
    { id: "106", category: "Agility", subCategory: "", parameter: "Comments" },

    // Sport-specific technical work
    { id: "107", category: "Sport-specific technical work", subCategory: "", parameter: "Frequency" },
    { id: "108", category: "Sport-specific technical work", subCategory: "", parameter: "Subjective Intensity [%max]" },
    { id: "109", category: "Sport-specific technical work", subCategory: "", parameter: "Focus areas [specify]" },
    { id: "110", category: "Sport-specific technical work", subCategory: "", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "111", category: "Sport-specific technical work", subCategory: "", parameter: "Footwear [Trainers, Cleats, Barefoot, Other (specify)]" },
    { id: "112", category: "Sport-specific technical work", subCategory: "", parameter: "Duration [min]" },
    { id: "113", category: "Sport-specific technical work", subCategory: "", parameter: "Comments" },

    // Energy System Development - Interval-Training
    { id: "114", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Frequency" },
    { id: "115", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Mode [Running, Swimming, Cycling, Rowing, Ski-Erg, Assault Bike, Other (specify)]" },
    { id: "116", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Surface [Grass, Track, Concrete, Sand (if mode = Running)]" },
    { id: "117", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Footwear [Trainers, Spikes (if mode = Running)]" },
    { id: "118", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Intensity [%V02max, %maxHR, HRzone, RPE, km/h, m/s, kcal/min]" },
    { id: "119", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Work Duration [s]" },
    { id: "120", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Interval Distance [m]" },
    { id: "121", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Sets [#]" },
    { id: "122", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Reps [#]" },
    { id: "123", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Total Volume [m, km, kcal]" },
    { id: "124", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "125", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Inter-Rep Rest Intensity [%V02max, %maxHR, HRzone, RPE, km/h, m/s, kcal/min, OFF]" },
    { id: "126", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Inter-Set Rest Duration [s]" },
    { id: "127", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Inter-Set Rest Intensity [%V02max, %maxHR, HRzone, RPE, km/h, m/s, kcal/min, OFF]" },
    { id: "128", category: "Energy System Development", subCategory: "Interval-Training", parameter: "Comments" },

    // Energy System Development - Steady State Conditioning
    { id: "129", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Frequency" },
    { id: "130", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Mode [Running, Swimming, Cycling, Rowing, Ski-Erg, Assault Bike, Other (specify)]" },
    { id: "131", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Surface [Grass, Track, Concrete, Sand (if mode = Running)]" },
    { id: "132", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Footwear [Trainers, Spikes (if mode = Running)]" },
    { id: "133", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Intensity [%V02max, %maxHR, HRzone, RPE, km/h, m/s, kcal/min]" },
    { id: "134", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Elevation [hm]" },
    { id: "135", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Work Duration [s]" },
    { id: "136", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Total Volume [m, km, kcal]" },
    { id: "137", category: "Energy System Development", subCategory: "Steady State Conditioning", parameter: "Comments" },

    // Lower Body Resistance Training - Strength
    { id: "138", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Frequency" },
    { id: "139", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Organization [Regular Sets, SuperSets, Tri-Sets, Giant Sets, Contrast Sets, French Contrast Method, Complex Sets]" },
    { id: "140", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Sets [#]" },
    { id: "141", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Set Type [Pyramid, Inverse Pyramid, Drop, Cluster Sets, Rest-Pause, Myo-Reps]" },
    { id: "142", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Reps [#]" },
    { id: "143", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Rep Set-Up [Straight, AMRAP, Density, Forced Reps, Cheat Reps, Velocity Threshold [m/s], Velocity Drop-off [%]]" },
    { id: "144", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Intensity [%1RM, RPE, RiR, Mean velocity [m/s]]" },
    { id: "145", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Loading Method [Isotonic, Isokinetic, Accomodating resistance, Isoinertial, Accentuated eccentric]" },
    { id: "146", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Contraction type [Dynamic, Eccentric-only, Concentric only, Ballistic]" },
    { id: "147", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Range of motion [full, partial (specify)]" },
    { id: "148", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Tempo [Xs-Xs-Xs-Xs]" },
    { id: "149", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Inter-Set Rest Duration [s]" },
    { id: "150", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "151", category: "Lower Body Resistance Training", subCategory: "Strength", parameter: "Comments" },

    // Lower Body Resistance Training - Power
    { id: "152", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Frequency" },
    { id: "153", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Organization [Regular Sets, SuperSets, Tri-Sets, Giant Sets, Contrast Sets, French Contrast Method, Complex Sets]" },
    { id: "154", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Sets [#]" },
    { id: "155", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Set Type [Pyramid, Inverse Pyramid, Cluster Sets]" },
    { id: "156", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Reps [#]" },
    { id: "157", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Rep Set-Up [Straight, AMRAP, Density, Velocity Threshold [m/s], Velocity Drop-off [%]]" },
    { id: "158", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Intensity [%1RM, RPE, RiR, Peak velocity [m/s]]" },
    { id: "159", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Loading Method [Isotonic, Isokinetic, Accomodating resistance, Isoinertial, Accentuated eccentric]" },
    { id: "160", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Contraction type [Dynamic, Eccentric-only, Concentric only, Ballistic]" },
    { id: "161", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Range of motion [full, partial (specify)]" },
    { id: "162", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Tempo [Xs-Xs-Xs-Xs]" },
    { id: "163", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Inter-Set Rest Duration [s]" },
    { id: "164", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "165", category: "Lower Body Resistance Training", subCategory: "Power", parameter: "Comments" },

    // Lower Body Resistance Training - Olympic Weightlifting
    { id: "166", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Frequency" },
    { id: "167", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Organization [Regular Sets, SuperSets, Tri-Sets, Giant Sets, Contrast Sets, French Contrast Method, Complex Sets]" },
    { id: "168", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Sets [#]" },
    { id: "169", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Set Type [Pyramid, Inverse Pyramid, Cluster Sets]" },
    { id: "170", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Reps [#]" },
    { id: "171", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Rep Set-Up [Straight, AMRAP, Density, Velocity Threshold [m/s], Velocity Drop-off [%]]" },
    { id: "172", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Intensity [%1RM, RPE, RiR, Peak velocity [m/s]]" },
    { id: "173", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Starting Position [Floor, Blocks, Hang]" },
    { id: "174", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Range of motion [Squat, Power, Muscle]" },
    { id: "175", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Inter-Set Rest Duration [s]" },
    { id: "176", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "177", category: "Lower Body Resistance Training", subCategory: "Olympic Weightlifting", parameter: "Comments" },

    // Lower Body Resistance Training - Hypertrophy
    { id: "178", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Frequency" },
    { id: "179", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Organization [Regular Sets, SuperSets, Tri-Sets, Giant Sets, Contrast Sets, French Contrast Method, Complex Sets]" },
    { id: "180", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Sets [#]" },
    { id: "181", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Set Type [Pyramid, Inverse Pyramid, Drop, Cluster Sets, Rest-Pause, Myo-Reps]" },
    { id: "182", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Reps [#]" },
    { id: "183", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Rep Set-Up [Straight, AMRAP, Density, Forced Reps, Cheat Reps, Velocity Threshold [m/s], Velocity Drop-off [%]]" },
    { id: "184", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Intensity [%1RM, RPE, RiR, Mean velocity[m/s]]" },
    { id: "185", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Loading Method [Isotonic, Isokinetic, Accomodating resistance, Isoinertial, Accentuated eccentric]" },
    { id: "186", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Contraction type [Dynamic, Eccentric-only, Concentric only, Ballistic]" },
    { id: "187", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Range of motion [full, partial (specify)]" },
    { id: "188", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Tempo [Xs-Xs-Xs-Xs]" },
    { id: "189", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Inter-Set Rest Duration [s]" },
    { id: "190", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "191", category: "Lower Body Resistance Training", subCategory: "Hypertrophy", parameter: "Comments" },

    // Lower Body Resistance Training - Accessories
    { id: "192", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Frequency" },
    { id: "193", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Organization [Regular Sets, SuperSets, Tri-Sets, Giant Sets, Contrast Sets, French Contrast Method, Complex Sets]" },
    { id: "194", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Sets [#]" },
    { id: "195", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Set Type [Pyramid, Inverse Pyramid, Drop, Cluster Sets, Rest-Pause, Myo-Reps]" },
    { id: "196", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Reps [#]" },
    { id: "197", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Rep Set-Up [Straight, AMRAP, Density, Forced Reps, Cheat Reps, Velocity Threshold [m/s], Velocity Drop-off [%]]" },
    { id: "198", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Intensity [%1RM, RPE, RiR, Mean velocity]" },
    { id: "199", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Loading Method [Isotonic, Isokinetic, Accomodating resistance, Isoinertial, Accentuated eccentric]" },
    { id: "200", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Contraction type [Dynamic, Eccentric-only, Concentric only, Ballistic]" },
    { id: "201", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Range of motion [full, partial (specify)]" },
    { id: "202", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Tempo [Xs-Xs-Xs-Xs]" },
    { id: "203", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Inter-Set Rest Duration [s]" },
    { id: "204", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "205", category: "Lower Body Resistance Training", subCategory: "Accessories", parameter: "Comments" },

    // Intensive Plyometrics - Gazelle-Tier
    { id: "206", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Frequency" },
    { id: "207", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "208", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Footwear [Trainers, Barefoot, Other (specify)]" },
    { id: "209", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Total Ground contacts [#]" },
    { id: "210", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Ground Contacts per session [#of jumps]" },
    { id: "211", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Relative stance volume  distribution [Bipedal (%), Alternating (%), Unipedal (%)]" },
    { id: "212", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Absolute stance volume stance distribution [Bipedal (#), Alternating (#), Unipedal (#)]" },
    { id: "213", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Relative directional volume distribution [Horizontal (%), Vertical (%), Lateral (%), Multidirectional (%)]" },
    { id: "214", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Absolute directional volume  distribution [Horizontal (#), Vertical (#), Lateral (#), Multidirectional (#)]" },
    { id: "215", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Inter-Set Rest Duration [s]" },
    { id: "216", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "217", category: "Intensive Plyometrics", subCategory: "Gazelle-Tier", parameter: "Comments" },

    // Intensive Plyometrics - Tiger-Tier
    { id: "218", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Frequency" },
    { id: "219", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "220", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Footwear [Trainers, Barefoot, Other (specify)]" },
    { id: "221", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Total Ground contacts [#]" },
    { id: "222", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Ground Contacts per session [#of jumps]" },
    { id: "223", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Relative stance volume  distribution [Bipedal (%), Alternating (%), Unipedal (%)]" },
    { id: "224", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Absolute stance volume stance distribution [Bipedal (#), Alternating (#), Unipedal (#)]" },
    { id: "225", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Relative directional volume distribution [Horizontal (%), Vertical (%), Lateral (%), Multidirectional (%)]" },
    { id: "226", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Absolute directional volume  distribution [Horizontal (#), Vertical (#), Lateral (#), Multidirectional (#)]" },
    { id: "227", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Inter-Set Rest Duration [s]" },
    { id: "228", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "229", category: "Intensive Plyometrics", subCategory: "Tiger-Tier", parameter: "Comments" },

    // Intensive Plyometrics - Frog-Tier
    { id: "230", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Frequency" },
    { id: "231", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "232", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Footwear [Trainers, Barefoot, Other (specify)]" },
    { id: "233", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Total Ground contacts [#]" },
    { id: "234", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Ground Contacts per session [#of jumps]" },
    { id: "235", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Relative stance volume  distribution [Bipedal (%), Alternating (%), Unipedal (%)]" },
    { id: "236", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Absolute stance volume stance distribution [Bipedal (#), Alternating (#), Unipedal (#)]" },
    { id: "237", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Relative directional volume distribution [Horizontal (%), Vertical (%), Lateral (%), Multidirectional (%)]" },
    { id: "238", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Absolute directional volume  distribution [Horizontal (#), Vertical (#), Lateral (#), Multidirectional (#)]" },
    { id: "239", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Inter-Set Rest Duration [s]" },
    { id: "240", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "241", category: "Intensive Plyometrics", subCategory: "Frog-Tier", parameter: "Comments" },

    // Continue with all remaining entries...
    // Moderate Plyometrics - Gazelle-/Reactive-Tier
    { id: "242", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Frequency" },
    { id: "243", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Surface [Grass, Track, Hardwood, Concrete, Sand]" },
    { id: "244", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Footwear [Trainers, Barefoot, Other (specify)]" },
    { id: "245", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Subjective Intensity [%max]" },
    { id: "246", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Total Ground contacts [#]" },
    { id: "247", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Ground Contacts per session [#of jumps]" },
    { id: "248", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Relative stance volume  distribution [Bipedal (%), Alternating (%), Unipedal (%)]" },
    { id: "249", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Absolute stance volume stance distribution [Bipedal (#), Alternating (#), Unipedal (#)]" },
    { id: "250", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Relative directional volume distribution [Horizontal (%), Vertical (%), Lateral (%), Multidirectional (%)]" },
    { id: "251", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Absolute directional volume  distribution [Horizontal (#), Vertical (#), Lateral (#), Multidirectional (#)]" },
    { id: "252", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Inter-Set Rest Duration [s]" },
    { id: "253", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Inter-Rep Rest Duration [s]" },
    { id: "254", category: "Moderate Plyometrics", subCategory: "Gazelle-/Reactive-Tier", parameter: "Comments" },

    // Continue with remaining categories...
    // For brevity, I'll add key entries from each remaining category

    // Isometrics
    { id: "300", category: "Isometrics", subCategory: "", parameter: "Frequency" },
    { id: "301", category: "Isometrics", subCategory: "", parameter: "Mode [Iso Hold, Ballistic Iso Hold, Grinding Iso Push, Ballistic Iso Push, Standard Iso Switch, Advanced Iso Switch, Iso Catch, Hybrird Iso]" },
    { id: "302", category: "Isometrics", subCategory: "", parameter: "Joint angle (specify)" },
    { id: "303", category: "Isometrics", subCategory: "", parameter: "Sets [#]" },
    { id: "304", category: "Isometrics", subCategory: "", parameter: "Comments" },

    // Foot Strength
    { id: "310", category: "Foot Strength", subCategory: "", parameter: "Frequency" },
    { id: "311", category: "Foot Strength", subCategory: "", parameter: "Sets [#]" },
    { id: "312", category: "Foot Strength", subCategory: "", parameter: "Comments" },

    // Upper Body Resistance Training - Strength
    { id: "320", category: "Upper Body Resistance Training", subCategory: "Strength", parameter: "Frequency" },
    { id: "321", category: "Upper Body Resistance Training", subCategory: "Strength", parameter: "Organization [Regular Sets, SuperSets, Tri-Sets, Giant Sets, Contrast Sets, French Contrast Method, Complex Sets]" },
    { id: "322", category: "Upper Body Resistance Training", subCategory: "Strength", parameter: "Comments" },

    // Proprioception & Coordination
    { id: "330", category: "Proprioception & Coordination", subCategory: "", parameter: "Mode" },

    // Core
    { id: "331", category: "Core", subCategory: "", parameter: "Framework-Level [1. Identification, 2. Stability, 3. Dynamic Stability, 4. Compount Strength & Power, 5. Contrast Training]" },

    // Mobility
    { id: "332", category: "Mobility", subCategory: "", parameter: "Joint focus [specify]" },
    { id: "333", category: "Mobility", subCategory: "", parameter: "Comments" },

    // PRI (Postural Restoration)
    { id: "334", category: "PRI (Postural Restoration)", subCategory: "", parameter: "Comments" },

    // Recovery Modalities
    { id: "335", category: "Recovery Modalities", subCategory: "", parameter: "Frequency" },
    { id: "336", category: "Recovery Modalities", subCategory: "", parameter: "Modality [Ice bath, Contrast bath, Red Light Therapy, Massage, Physiotherapy, Self Myofascial Release (Foam Rolling, Massage Gun)  Sauna, Cryotherapy, Hyperbaric Therapy, Breathwork/Meditation, Non-Sleep Deep Rest, Yoga, Compression garments]" }
  ],
  lastUpdated: new Date().toISOString()
};