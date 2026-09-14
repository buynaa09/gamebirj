import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { MoonIcon, SunIcon, SearchIcon, BellIcon, MenuIcon, ChatBubbleIcon } from '../icons/Icons';
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
  const unreadMessages = useUnreadMessages();

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

  const handleBrandClick = () => {
    setDropdownOpen(false);
    closeMobileMenu();
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    closeMobileMenu();
    logout()
      .catch(() => {
        // Ниш хэдийн дууссан ч гарсанд тооцно.
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
          <img src={theme === 'dark' ? darkLogo : lightLogo} alt="GameBirj" className={styles.brandLogo} />
          <span className={styles.brandWord}>GameBirj</span>
        </NavLink>

        <nav className={styles.navLinks} aria-label="Үндсэн цэс">
          <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : '')} end>
            Нүүр
          </NavLink>
          <NavLink to="/marketplace" className={({ isActive }) => (isActive ? styles.active : '')}>
            Зарууд
          </NavLink>
        
          <NavLink to="/sell" className={({ isActive }) => (isActive ? styles.active : '')}>
            Зарах
          </NavLink>
          <NavLink to="/rent" className={({ isActive }) => (isActive ? styles.active : '')}>
            Түрээс
          </NavLink>
          <a href="#">Бусад ▾</a>
        </nav>

        <div className={styles.topActions}>
          <div className={styles.themeToggle} role="group" aria-label="Загвар солих">
            <button
              className={theme === 'dark' ? styles.on : ''}
              title="Харанхуй горим"
              aria-label="Харанхуй горим"
              onClick={toggleTheme}
            >
              <MoonIcon />
            </button>
            <button
              className={theme === 'light' ? styles.on : ''}
              title="Гэгээлэг горим"
              aria-label="Гэгээлэг горим"
              onClick={toggleTheme}
            >
              <SunIcon />
            </button>
          </div>

          <button className={styles.iconBtn} aria-label="Хайх">
            <SearchIcon />
          </button>

          {!loading && user ? (
            <>
              <button
                className={`${styles.iconBtn} ${styles.hideOnMobile}`}
                aria-label="Зурвас"
                onClick={() => navigate('/messages')}
              >
                <ChatBubbleIcon />
                {unreadMessages > 0 && <span className={styles.dotBadge} />}
              </button>
              <button className={styles.iconBtn} aria-label="Мэдэгдэл">
                <BellIcon />
              </button>

              <div className={styles.profileWrap} ref={dropdownRef}>
                <button
                  className={styles.avatar}
                  aria-label="Профайл цэс"
                  aria-expanded={dropdownOpen}
                  onClick={() => setDropdownOpen((o) => !o)}
                >
                  {initial}
                </button>
                {dropdownOpen && (
                  <div className={styles.dropdown} role="menu">
                    <div className={styles.dropdownHeader}>{user.username}</div>
                    <a href="#" role="menuitem">
                      Профайл
                    </a>
                    <a href="#" role="menuitem">
                      Гүйлгээнүүд
                    </a>
                    <NavLink to="/wishlist" role="menuitem">
                      Хадгалсан
                    </NavLink>
                    <button role="menuitem" className={styles.dropdownLogout} onClick={handleLogout}>
                      Гарах
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            !loading && (
              <div className={styles.authBtns}>
                <NavLink to="/login" className={`btn btn-primary ${styles.authBtn}`}>
                  Нэвтрэх
                </NavLink>
              </div>
            )
          )}

          <button
            className={styles.hamburger}
            aria-label="Цэс"
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
        Нүүр
      </NavLink>
      <NavLink
        to="/marketplace"
        onClick={onNavigate}
        className={`${styles.mobileLink} ${currentPath === '/marketplace' ? styles.mobileActive : ''}`}
      >
        Зарууд
      </NavLink>
      <a href="#" className={styles.mobileLink}>
        Хамт олон
      </a>
      <NavLink
        to="/sell/processing"
        onClick={onNavigate}
        className={`${styles.mobileLink} ${currentPath === '/sell/processing' ? styles.mobileActive : ''}`}
      >
        Зарах
      </NavLink>
      <NavLink
        to="/rent"
        onClick={onNavigate}
        className={`${styles.mobileLink} ${currentPath === '/rent' ? styles.mobileActive : ''}`}
      >
        Түрээс
      </NavLink>
      <a href="#" className={styles.mobileLink}>
        Гүйлгээнүүд
      </a>
      <a href="#" className={`${styles.mobileLink} ${styles.mobileLast}`}>
        Бусад
      </a>

      {!loading &&
        (user ? (
          <div className={styles.mobileAuth}>
            <span className={styles.mobileUser}>{user.username}</span>
            <button className={`btn btn-outline ${styles.mobileAuthBtn}`} onClick={onLogout}>
              Гарах
            </button>
          </div>
        ) : (
          <div className={styles.mobileAuth}>
            <NavLink to="/login" onClick={onNavigate} className={`btn btn-primary ${styles.mobileAuthBtn}`}>
              Нэвтрэх
            </NavLink>
          </div>
        ))}
    </div>
  );
}