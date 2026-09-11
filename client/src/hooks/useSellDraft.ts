import { useEffect, useState } from 'react';

export interface SellDraft {
  gameName: string | null;
  listingTitle: string;
  rank: string;
  price: string;
  acceptOffers: boolean;
  detailValues: Record<string, string>;
  description: string;
}

export const emptyDraft: SellDraft = {
  gameName: null,
  listingTitle: '',
  rank: '',
  price: '',
  acceptOffers: true,
  detailValues: {},
  description: '',
};

const STORAGE_KEY = 'soliltsoo-sell-draft';

function loadDraft(): { draft: SellDraft; restored: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { draft: emptyDraft, restored: false };
    const parsed = { ...emptyDraft, ...(JSON.parse(raw) as Partial<SellDraft>) };
    const hasContent =
      parsed.gameName !== null ||
      parsed.listingTitle.trim() !== '' ||
      parsed.rank.trim() !== '' ||
      parsed.price.trim() !== '' ||
      parsed.description.trim() !== '' ||
      Object.values(parsed.detailValues).some((v) => v.trim() !== '');
    return { draft: parsed, restored: hasContent };
  } catch {
    return { draft: emptyDraft, restored: false };
  }
}

export function useSellDraft() {
  const [initial] = useState(loadDraft);
  const [draft, setDraft] = useState<SellDraft>(initial.draft);
  const [restored, setRestored] = useState(initial.restored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage full or unavailable — draft simply won't persist.
    }
  }, [draft]);

  const update = (patch: Partial<SellDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const reset = () => {
    setDraft(emptyDraft);
    setRestored(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
  };

  return { draft, update, reset, restored };
}
