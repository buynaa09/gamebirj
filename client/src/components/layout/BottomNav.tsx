import { NavLink } from 'react-router-dom';
import { HomeIcon, ShopIcon, ClockIcon, ChatBubbleIcon, CheckIcon } from '../icons/Icons';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import styles from './BottomNav.module.css';

const routeLinks = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/marketplace', label: 'Market', icon: ShopIcon },
  { to: '/sell', label: 'Sell', icon: ClockIcon },
];

const placeholderLinks = [{ label: 'Trades', icon: CheckIcon }];

export function BottomNav() {
  const unreadMessages = useUnreadMessages();
  return (
    <nav className={styles.nav} aria-label="Mobile navigation">
      {routeLinks.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={label}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
      <NavLink
        to="/messages"
        className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
      >
        <ChatBubbleIcon />
        Messages
        {unreadMessages > 0 && <span className={styles.dot} aria-hidden="true" />}
      </NavLink>
      {placeholderLinks.map(({ label, icon: Icon }) => (
        <a key={label} href="#" className={styles.link}>
          <Icon />
          {label}
        </a>
      ))}
    </nav>
  );
}
