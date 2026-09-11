import { useState, useMemo } from 'react';
import { MarketplaceHeader } from '../components/marketplace/MarketplaceHeader';
import { FiltersSidebar } from '../components/marketplace/FiltersSidebar';
import { SearchBar } from '../components/marketplace/SearchBar';
import { GamePillFilter } from '../components/marketplace/GamePillFilter';
import { SortSelect } from '../components/marketplace/SortSelect';
import { ListingGrid } from '../components/marketplace/ListingGrid';
import { listings } from '../data/listings';
import styles from './MarketplacePage.module.css';

export function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredListings = useMemo(() => {
    let result = listings;

    if (activeFilter !== 'all') {
      result = result.filter(l => l.game === activeFilter);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        l =>
          l.title.toLowerCase().includes(q) ||
          l.game.toLowerCase().includes(q) ||
          l.rank.toLowerCase().includes(q)
      );
    }

    return result;
  }, [query, activeFilter]);

  return (
    <main>
      <MarketplaceHeader />
      <div className={styles.body}>
        <FiltersSidebar />
        <section className={styles.main}>
          <SearchBar query={query} onQueryChange={setQuery} />
          <GamePillFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
          <SortSelect total={filteredListings.length} />
          <ListingGrid listings={filteredListings} />
        </section>
      </div>
    </main>
  );
}
