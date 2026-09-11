import { useState, useMemo } from 'react';
import { MarketplaceHeader } from '../components/marketplace/MarketplaceHeader';
import { FiltersSidebar } from '../components/marketplace/FiltersSidebar';
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
  const [activeFilter, setActiveFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('newest');

  const filteredListings = useMemo(() => {
    let result = accounts;

    if (activeFilter !== 'all') {
      result = result.filter((a) => a.game === activeFilter);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((a) => matchesQuery(a, q));
    }

    return sortAccounts(result, sort);
  }, [accounts, query, activeFilter, sort]);

  return (
    <main>
      <MarketplaceHeader />
      <div className={styles.body}>
        <FiltersSidebar accounts={accounts} />
        <section className={styles.main}>
          <SearchBar query={query} onQueryChange={setQuery} />
          <GamePillFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} accounts={accounts} />
          <SortSelect shown={filteredListings.length} total={accounts.length} sort={sort} onSortChange={setSort} />
          <ListingGrid listings={filteredListings} loading={loading} error={error} onRetry={reload} />
        </section>
      </div>
    </main>
  );
}
