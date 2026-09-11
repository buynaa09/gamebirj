import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MoonIcon, SunIcon, SearchIcon, BellIcon, MenuIcon } from '../icons/Icons';
import darkLogo from '../../assets/logo/dark.png';
import lightLogo from '../../assets/logo/light.png';
import styles from './TopBar.module.css';

export function TopBar() {
  return <TopBarInner />;
}

function TopBarInner() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dropdownOpen]);

  // Close the dropdown when navigating via the brand link.
  const handleBrandClick = () => {
    setDropdownOpen(false);
    closeMobileMenu();
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    closeMobileMenu();
    logout()
      .catch(() => {
        // Session already gone — still treat as logged out.
      })
      .finally(() => {
        navigate('/', { replace: true });
      });
  };

  const initial = user?.username?.charAt(0).toUpperCase() ?? '?';

  return (
    <>
      <header className={styles.topbar}>
        <NavLink to="/" className={styles.brand} onClick={handleBrandClick}>
          <img src={theme === 'dark' ? darkLogo : lightLogo} alt="Soliltsoo" className={styles.brandLogo} />
          <span className={styles.brandWord}>Soliltsoo</span>
        </NavLink>

        <nav className={styles.navLinks} aria-label="Main navigation">
          <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : '')} end>
            Home
          </NavLink>
          <NavLink to="/marketplace" className={({ isActive }) => (isActive ? styles.active : '')}>
            Marketplace
          </NavLink>
          <a href="#">Community</a>
          <NavLink to="/sell" className={({ isActive }) => (isActive ? styles.active : '')}>
            Sell
          </NavLink>
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

          {!loading && user ? (
            <>
              <button className={styles.iconBtn} aria-label="Notifications">
                <BellIcon />
                <span className={styles.dotBadge} />
              </button>

              <div className={styles.profileWrap} ref={dropdownRef}>
                <button
                  className={styles.avatar}
                  aria-label="Profile menu"
                  aria-expanded={dropdownOpen}
                  onClick={() => setDropdownOpen((o) => !o)}
                >
                  {initial}
                </button>
                {dropdownOpen && (
                  <div className={styles.dropdown} role="menu">
                    <div className={styles.dropdownHeader}>{user.username}</div>
                    <a href="#" role="menuitem">
                      Profile
                    </a>
                    <a href="#" role="menuitem">
                      Transactions
                    </a>
                    <button role="menuitem" className={styles.dropdownLogout} onClick={handleLogout}>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            !loading && (
              <div className={styles.authBtns}>
                <NavLink to="/login" className={`btn btn-outline ${styles.authBtn}`}>
                  Log in
                </NavLink>
                <NavLink to="/signup" className={`btn btn-primary ${styles.authBtn}`}>
                  Sign up
                </NavLink>
              </div>
            )
          )}

          <button
            className={styles.hamburger}
            aria-label="Menu"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <MobileMenu
          currentPath={location.pathname}
          onNavigate={closeMobileMenu}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

function MobileMenu({
  currentPath,
  onNavigate,
  onLogout,
}: {
  currentPath: string;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const { user, loading } = useAuth();

  return (
    <div className={styles.mobileMenu}>
      <NavLink
        to="/"
        onClick={onNavigate}
        className={`${styles.mobileLink} ${currentPath === '/' ? styles.mobileActive : ''}`}
      >
        Home
      </NavLink>
      <NavLink
        to="/marketplace"
        onClick={onNavigate}
        className={`${styles.mobileLink} ${currentPath === '/marketplace' ? styles.mobileActive : ''}`}
      >
        Marketplace
      </NavLink>
      <a href="#" className={styles.mobileLink}>
        Community
      </a>
      <NavLink
        to="/sell"
        onClick={onNavigate}
        className={`${styles.mobileLink} ${currentPath === '/sell' ? styles.mobileActive : ''}`}
      >
        Sell
      </NavLink>
      <a href="#" className={styles.mobileLink}>
        Transactions
      </a>
      <a href="#" className={`${styles.mobileLink} ${styles.mobileLast}`}>
        More
      </a>

      {!loading &&
        (user ? (
          <div className={styles.mobileAuth}>
            <span className={styles.mobileUser}>{user.username}</span>
            <button className={`btn btn-outline ${styles.mobileAuthBtn}`} onClick={onLogout}>
              Log out
            </button>
          </div>
        ) : (
          <div className={styles.mobileAuth}>
            <NavLink to="/login" onClick={onNavigate} className={`btn btn-outline ${styles.mobileAuthBtn}`}>
              Log in
            </NavLink>
            <NavLink to="/signup" onClick={onNavigate} className={`btn btn-primary ${styles.mobileAuthBtn}`}>
              Sign up
            </NavLink>
          </div>
        ))}
    </div>
  );
}
