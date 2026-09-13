import { NavLink } from 'react-router-dom';
import { HomeIcon, ShopIcon, ClockIcon, ChatBubbleIcon, CheckIcon } from '../icons/Icons';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import styles from './BottomNav.module.css';

const routeLinks = [
  { to: '/', label: 'Нүүр', icon: HomeIcon },
  { to: '/marketplace', label: 'Зарууд', icon: ShopIcon },
  { to: '/messages', label: 'Зурвас', icon: ChatBubbleIcon },
  { to: '/sell', label: 'Зарах', icon: ClockIcon },
  { to: '/rent', label: 'Түрээс', icon: CheckIcon },
];

export function BottomNav() {
  const unreadMessages = useUnreadMessages();
  return (
    <nav className={styles.nav} aria-label="Мобайл цэс">
      {routeLinks.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={label}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon />
          {label}
          {to === '/messages' && unreadMessages > 0 && (
            <span className={styles.dot} aria-hidden="true" />
          )}
        </NavLink>
      ))}
    </nav>
  );
}