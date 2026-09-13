import { useEffect, useState } from 'react';
import type { SellDraft } from './useSellDraft';
import { emptyDraft } from './useSellDraft';
import type { RentalUnit } from '../types';

export interface RentDraft extends SellDraft {
  rentalUnit: RentalUnit;
}

export const emptyRentDraft: RentDraft = {
  ...emptyDraft,
  rentalUnit: 'day',
};

const STORAGE_KEY = 'soliltsoo-rent-draft-v1';

function loadDraft(): { draft: RentDraft; restored: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { draft: emptyRentDraft, restored: false };
    const parsed = { ...emptyRentDraft, ...(JSON.parse(raw) as Partial<RentDraft>) };
    if (parsed.rentalUnit !== 'hour' && parsed.rentalUnit !== 'day' && parsed.rentalUnit !== 'month') {
      parsed.rentalUnit = 'day';
    }
    const hasContent =
      parsed.gameName !== null ||
      parsed.listingTitle.trim() !== '' ||
      parsed.rank.trim() !== '' ||
      parsed.price.trim() !== '' ||
      parsed.description.trim() !== '' ||
      Object.values(parsed.detailValues).some((v) => v.trim() !== '');
    return { draft: parsed, restored: hasContent };
  } catch {
    return { draft: emptyRentDraft, restored: false };
  }
}

export function useRentDraft() {
  const [initial] = useState(loadDraft);
  const [draft, setDraft] = useState<RentDraft>(initial.draft);
  const [restored, setRestored] = useState(initial.restored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage full or unavailable — draft simply won't persist.
    }
  }, [draft]);

  const update = (patch: Partial<RentDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const reset = () => {
    setDraft(emptyRentDraft);
    setRestored(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
  };

  return { draft, update, reset, restored };
}
