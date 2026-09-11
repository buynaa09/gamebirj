import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { MoonIcon, SunIcon, SearchIcon, BellIcon, MenuIcon } from '../icons/Icons';
import darkLogo from '../../assets/logo/dark.png';
import lightLogo from '../../assets/logo/light.png';
import styles from './TopBar.module.css';

export function TopBar() {
  return <TopBarInner />;
}

function TopBarInner() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className={styles.topbar}>
        <NavLink to="/" className={styles.brand} onClick={closeMobileMenu}>
          <img src={theme === 'dark' ? darkLogo : lightLogo} alt="Soliltsoo" className={styles.brandLogo} />
          <span className={styles.brandWord}>Soliltsoo</span>
        </NavLink>

        <nav className={styles.navLinks} aria-label="Main navigation">
          <NavLink to="/" className={({ isActive }) => isActive ? styles.active : ''} end>Home</NavLink>
          <NavLink to="/marketplace" className={({ isActive }) => isActive ? styles.active : ''}>Marketplace</NavLink>
          <a href="#">Community</a>
          <a href="#">Sell</a>
          <a href="#">Transactions</a>
          <a href="#">More ▾</a>
        </nav>

        <div className={styles.topActions}>
          <div className={styles.themeToggle} role="group" aria-label="Theme toggle">
            <button
              className={theme === 'dark' ? styles.on : ''}
              title="Dark mode"
              aria-label="Dark mode"
              onClick={toggleTheme}
            >
              <MoonIcon />
            </button>
            <button
              className={theme === 'light' ? styles.on : ''}
              title="Light mode"
              aria-label="Light mode"
              onClick={toggleTheme}
            >
              <SunIcon />
            </button>
          </div>

          <button className={styles.iconBtn} aria-label="Search">
            <SearchIcon />
          </button>

          <button className={styles.iconBtn} aria-label="Notifications">
            <BellIcon />
            <span className={styles.dotBadge} />
          </button>

          <div className={styles.avatar}>B</div>

          <button
            className={styles.hamburger}
            aria-label="Menu"
            onClick={() => setMobileMenuOpen(o => !o)}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <MobileMenu
          currentPath={location.pathname}
          onNavigate={closeMobileMenu}
        />
      )}
    </>
  );
}

function MobileMenu({ currentPath, onNavigate }: { currentPath: string; onNavigate: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '10px 20px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}
    >
      <NavLink to="/" onClick={onNavigate} style={{ padding: '12px 4px', fontWeight: 600, color: currentPath === '/' ? 'var(--red)' : 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Home</NavLink>
      <NavLink to="/marketplace" onClick={onNavigate} style={{ padding: '12px 4px', fontWeight: 600, color: currentPath === '/marketplace' ? 'var(--red)' : 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Marketplace</NavLink>
      <a href="#" style={{ padding: '12px 4px', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Community</a>
      <a href="#" style={{ padding: '12px 4px', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Sell</a>
      <a href="#" style={{ padding: '12px 4px', fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>Transactions</a>
      <a href="#" style={{ padding: '12px 4px', fontWeight: 600, color: 'var(--text-dim)' }}>More</a>
    </div>
  );
}
