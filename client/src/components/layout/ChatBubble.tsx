import { ChatIcon } from '../icons/Icons';
import styles from './ChatBubble.module.css';

export function ChatBubble() {
  return (
    <button className={styles.bubble} aria-label="Chat with us">
      <ChatIcon />
      <span className={styles.bubbleText}>Chat with us</span>
    </button>
  );
}