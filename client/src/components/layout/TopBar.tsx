import { Show, SignInButton, SignUpButton, UserButton, useClerk } from '@clerk/react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { MoonIcon, SunIcon, SearchIcon, BellIcon, MenuIcon, ChatBubbleIcon, GridIcon } from '../icons/Icons';
import darkLogo from '../../assets/logo/dark.png';
import lightLogo from '../../assets/logo/light.png';
import styles from './TopBar.module.css';

export function TopBar() {
  return <TopBarInner />;
}

function TopBarInner() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadMessages = useUnreadMessages();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleBrandClick = () => {
    closeMobileMenu();
  };

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

              <UserButton>
                <UserButton.MenuItems>
                  <UserButton.Link label="Хадгалсан" href="/wishlist" labelIcon={<GridIcon size={15} />} />
                </UserButton.MenuItems>
              </UserButton>
            </>
          ) : (
            !loading && (
              <div className={styles.authBtns}>
                <Show when="signed-out">
                  <SignInButton mode="modal" signUpFallbackRedirectUrl="/">
                    <span className={`btn btn-primary ${styles.authBtn}`}>Нэвтрэх</span>
                  </SignInButton>
                </Show>
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
        <MobileMenu currentPath={location.pathname} onNavigate={closeMobileMenu} />
      )}
    </>
  );
}

function MobileMenu({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: () => void;
}) {
  const { user, loading } = useCurrentUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleLogout = () => {
    onNavigate();
    signOut(() => navigate('/', { replace: true }));
  };

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
            <button className={`btn btn-outline ${styles.mobileAuthBtn}`} onClick={handleLogout}>
              Гарах
            </button>
          </div>
        ) : (
          <div className={styles.mobileAuth}>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <span className={`btn btn-primary ${styles.mobileAuthBtn}`}>Нэвтрэх</span>
              </SignInButton>
              <SignUpButton mode="modal">
                <span className={`btn btn-outline ${styles.mobileAuthBtn}`}>Бүртгүүлэх</span>
              </SignUpButton>
            </Show>
          </div>
        ))}
    </div>
  );
}
