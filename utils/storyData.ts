
import { DialogLine } from '../types';

const CHARACTERS = {
  ECHO: {
    name: "Handler Echo",
    color: "#00BFFF", // Cyan
    avatar: "ECHO" as const,
    side: "LEFT" as const
  },
  AGENT: {
    name: "Agent 404",
    color: "#AAAAAA", // Grey
    avatar: "AGENT" as const,
    side: "RIGHT" as const
  },
  ARCHITECT: {
    name: "The Architect",
    color: "#FF3333", // Red
    avatar: "ARCHITECT" as const,
    side: "RIGHT" as const
  },
  SYSTEM: {
    name: "Facility OS",
    color: "#FCD34D", // Amber
    avatar: "SYSTEM" as const,
    side: "CENTER" as const
  }
};

// Helper to create lines
const line = (charKey: keyof typeof CHARACTERS, text: string): DialogLine => {
  const char = CHARACTERS[charKey];
  return {
    id: Math.random().toString(36).substr(2, 9),
    speaker: char.name,
    avatar: char.avatar,
    color: char.color,
    side: char.side,
    text
  };
};

const SCRIPTED_EVENTS: Record<number, DialogLine[]> = {
  1: [
    line('ECHO', "Agent 404, do you copy? This is Echo. Uplink established."),
    line('AGENT', "Loud and clear. I'm at the perimeter."),
    line('ECHO', "Good. Your objective is to infiltrate the Core. The Architect has gone rogue."),
    line('ECHO', "Stay in the shadows. If the light touches you, the automated turrets will fire."),
    line('ARCHITECT', "INTRUDER DETECTED. SECTOR 1..."),
    line('ECHO', "He knows you're here. Move fast. Find the exit."),
  ],
  2: [
    line('ECHO', "Sector 1 cleared. Not bad."),
    line('ECHO', "The facility gets more complex from here. Watch out for patrolling drones."),
    line('AGENT', "Their patterns look basic. I can time this."),
  ],
  5: [
    line('ARCHITECT', "Why do you persist, little mouse?"),
    line('ARCHITECT', "The darkness you hide in... I designed it."),
    line('AGENT', "He's taunting me."),
    line('ECHO', "Ignore him. Focus on the mission. I'm detecting a localized power grid ahead. Switches might disrupt his vision."),
  ],
  10: [
    line('SYSTEM', "WARNING: HIGH SECURITY ZONE. BOSS PROTOCOLS ENGAGED."),
    line('ECHO', "404, be careful! That's a Guardian unit ahead."),
    line('ARCHITECT', "Let's see how you handle my personal guard."),
  ],
  20: [
    line('ECHO', "We're 20 levels deep. The air is getting colder."),
    line('AGENT', "I see strange markings on the walls. This facility isn't just a server farm."),
    line('ECHO', "Focus, Agent. Collect the lore data. We need to know what he's building."),
  ],
  50: [
    line('ARCHITECT', "Halfway... statistically, you should be dead."),
    line('ARCHITECT', "Are you human? Or just another glitch in my system?"),
    line('AGENT', "I'm the one pulling the plug."),
  ],
  75: [
    line('ECHO', "Signal is getting weak... 404... can you... hear..."),
    line('SYSTEM', "CONNECTION UNSTABLE."),
    line('ARCHITECT', "Your little friend is gone. It's just us now."),
  ],
  90: [
    line('AGENT', "Almost there. The hum of the Core is deafening."),
    line('ARCHITECT', "You cannot stop the Ascension. Join me in the light."),
    line('AGENT', "I prefer the dark."),
  ],
  99: [
    line('SYSTEM', "CRITICAL ALERT. CORE CHAMBER BREACH IMMINENT."),
    line('ARCHITECT', "Impossible."),
  ],
  100: [
    line('ARCHITECT', "This is it. The end of the line."),
    line('ARCHITECT', "Defeat me, and you destroy everything."),
    line('AGENT', "That's the plan."),
  ]
};

const GENERIC_LOGS = [
  "Rerouting power to Sector Surveillance...",
  "Patrol density increasing in this quadrant.",
  "Atmospheric sensors detect stale air. Ventilation offline.",
  "Security algorithms updating... optimization complete.",
  "Unauthorized bio-signature tracked.",
  "Shadow density at 84%. Favorable conditions.",
  "Audio sensors active. Maintain silence.",
  "Memory banks corrupted. Recovering fragments..."
];

export const getStoryForLevel = (level: number): DialogLine[] => {
  // Return scripted event if exists
  if (SCRIPTED_EVENTS[level]) {
    return SCRIPTED_EVENTS[level];
  }

  // Otherwise generate a procedural "System Log" to ensure every level has context
  // Deterministic "random" pick based on level
  const logIndex = level % GENERIC_LOGS.length;
  const logText = GENERIC_LOGS[logIndex];
  
  return [
    line('SYSTEM', `LOADING LEVEL ${level}...`),
    line('SYSTEM', `SYSTEM LOG: ${logText}`)
  ];
};
