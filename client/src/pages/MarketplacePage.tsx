import { useState, useMemo } from 'react';
import { MarketplaceHeader } from '../components/marketplace/MarketplaceHeader';
import { FiltersSidebar } from '../components/marketplace/FiltersSidebar';
import sidebarStyles from '../components/marketplace/FiltersSidebar.module.css';
import { FiltersDrawer } from '../components/marketplace/FiltersDrawer';
import { SearchBar } from '../components/marketplace/SearchBar';
import { GamePillFilter } from '../components/marketplace/GamePillFilter';
import { SortSelect } from '../components/marketplace/SortSelect';
import { ListingGrid } from '../components/marketplace/ListingGrid';
import { useAccounts } from '../hooks/useAccounts';
import type { MarketAccount, SortKey } from '../types';
import styles from './MarketplacePage.module.css';

function matchesQuery(account: MarketAccount, q: string): boolean {
  return (
    account.title.toLowerCase().includes(q) ||
    (account.game ?? '').toLowerCase().includes(q) ||
    (account.game_rank ?? '').toLowerCase().includes(q)
  );
}

function matchesListingFilters(
  account: MarketAccount,
  listingFilters: Record<number, string>,
): boolean {
  for (const [idStr, rawValue] of Object.entries(listingFilters)) {
    const filterValue = rawValue.trim().toLowerCase();
    if (!filterValue) continue;
    const listingId = Number(idStr);
    const detail = account.listings.find((d) => d.listing_id === listingId);
    if (!detail) return false;
    const haystack = [...detail.choices, detail.value].join(' ').toLowerCase();
    if (!haystack.includes(filterValue)) return false;
  }
  return true;
}

function sortAccounts(accounts: MarketAccount[], sort: SortKey): MarketAccount[] {
  const result = [...accounts];
  switch (sort) {
    case 'newest':
      return result.sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
      );
    case 'oldest':
      return result.sort(
        (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
      );
    case 'price-asc':
      return result.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return result.sort((a, b) => b.price - a.price);
  }
}

export function MarketplacePage() {
  const { accounts, loading, error, reload } = useAccounts();
  const [query, setQuery] = useState('');
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('newest');
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Extra per-game filters: reset whenever the selected game changes.
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [listingFilters, setListingFilters] = useState<Record<number, string>>({});

  const applyGameSelection = (next: string[]) => {
    setSelectedGames(next);
    setSelectedRank(null);
    setListingFilters({});
  };

  const toggleGame = (gameName: string) => {
    // Sidebar is single-select like the pills: selecting one clears the others,
    // clicking the active one clears back to all.
    const next =
      selectedGames.length === 1 && selectedGames[0] === gameName ? [] : [gameName];
    applyGameSelection(next);
  };

  const selectGame = (gameName: string) => {
    // Pills are single-select: tapping the active pill clears back to all.
    const next =
      gameName === 'all' || (selectedGames.length === 1 && selectedGames[0] === gameName)
        ? []
        : [gameName];
    applyGameSelection(next);
  };

  const handleListingFilterChange = (listingId: number, value: string) => {
    setListingFilters((prev) => ({ ...prev, [listingId]: value }));
  };

  const sidebar = (
    <FiltersSidebar
      accounts={accounts}
      minPrice={minPrice}
      maxPrice={maxPrice}
      onMinChange={setMinPrice}
      onMaxChange={setMaxPrice}
      selectedGames={selectedGames}
      onToggleGame={toggleGame}
      selectedRank={selectedRank}
      onRankChange={setSelectedRank}
      listingFilters={listingFilters}
      onListingFilterChange={handleListingFilterChange}
    />
  );

  const filteredListings = useMemo(() => {
    let result = accounts;

    if (selectedGames.length > 0) {
      result = result.filter((a) => a.game !== null && selectedGames.includes(a.game));
    }

    if (selectedRank) {
      result = result.filter((a) => a.game_rank === selectedRank);
    }

    result = result.filter((a) => matchesListingFilters(a, listingFilters));

    if (minPrice !== null) {
      result = result.filter((a) => a.price >= minPrice);
    }

    if (maxPrice !== null) {
      result = result.filter((a) => a.price <= maxPrice);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((a) => matchesQuery(a, q));
    }

    return sortAccounts(result, sort);
  }, [accounts, query, selectedGames, selectedRank, listingFilters, sort, minPrice, maxPrice]);

  return (
    <main>
      <MarketplaceHeader />
      <div className={styles.body}>
        {sidebar}
        <section className={styles.main}>
          <SearchBar query={query} onQueryChange={setQuery} onOpenFilters={() => setFiltersOpen(true)} />
          <GamePillFilter selectedGames={selectedGames} onSelectGame={selectGame} accounts={accounts} />
          <SortSelect shown={filteredListings.length} total={accounts.length} sort={sort} onSortChange={setSort} />
          <ListingGrid listings={filteredListings} loading={loading} error={error} onRetry={reload} />
        </section>
      </div>
      {filtersOpen && (
        <FiltersDrawer resultCount={filteredListings.length} onClose={() => setFiltersOpen(false)}>
          <FiltersSidebar
            accounts={accounts}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinChange={setMinPrice}
            onMaxChange={setMaxPrice}
            selectedGames={selectedGames}
            onToggleGame={toggleGame}
            selectedRank={selectedRank}
            onRankChange={setSelectedRank}
            listingFilters={listingFilters}
            onListingFilterChange={handleListingFilterChange}
            className={sidebarStyles.filtersVisible}
          />
        </FiltersDrawer>
      )}
    </main>
  );
}
