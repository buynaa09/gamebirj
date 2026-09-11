export interface DetailFieldDef {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'select';
  placeholder?: string;
  options?: string[];
}

// Rank ladders per game. Games not listed fall back to GENERIC_RANKS.
const MLBB_RANKS = [
  'Warrior',
  'Elite',
  'Master',
  'Grandmaster',
  'Epic',
  'Legend',
  'Mythic',
  'Mythical Honor',
  'Mythical Glory',
];

const GENERIC_RANKS = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Master',
  'Grandmaster',
  'Challenger',
];

export const rankOptionsByGame: Record<string, string[]> = {
  'Mobile Legends': MLBB_RANKS,
};

export function rankOptionsFor(gameName: string | null): string[] {
  if (gameName && rankOptionsByGame[gameName]) return rankOptionsByGame[gameName];
  return GENERIC_RANKS;
}

export interface GameDetailSection {
  heading: string;
  subheading: string;
  fields: DetailFieldDef[];
}

const MLBB_DETAILS: GameDetailSection = {
  heading: 'Mobile Legends details',
  subheading: 'These details help buyers find your listing',
  fields: [
    { key: 'server', label: 'Server', kind: 'text', placeholder: 'Server / region' },
    { key: 'skins', label: 'Number of Skins', kind: 'number', placeholder: 'e.g., 150' },
    { key: 'heroes', label: 'Heroes Owned', kind: 'number', placeholder: 'e.g., 80' },
    { key: 'starlight', label: 'Starlight Skins', kind: 'number', placeholder: 'e.g., 12' },
    { key: 'epic_plus', label: 'Epic+ Skins', kind: 'number', placeholder: 'e.g., 30' },
  ],
};

const GENERIC_DETAILS: GameDetailSection = {
  heading: 'Account details',
  subheading: 'These details help buyers find your listing',
  fields: [
    { key: 'server', label: 'Server', kind: 'text', placeholder: 'Server / region' },
    { key: 'level', label: 'Account Level', kind: 'number', placeholder: 'e.g., 60' },
  ],
};

export function detailSectionFor(gameName: string | null): GameDetailSection {
  if (gameName === 'Mobile Legends') return MLBB_DETAILS;
  return {
    ...GENERIC_DETAILS,
    heading: gameName ? `${gameName} details` : GENERIC_DETAILS.heading,
  };
}

export function detailLabelFor(gameName: string | null, key: string): string {
  const field = detailSectionFor(gameName).fields.find((f) => f.key === key);
  return field ? field.label : key;
}
