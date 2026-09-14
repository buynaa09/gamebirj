import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';
import { FacebookIcon, GoogleIcon } from '../components/icons/Icons';
import styles from './AuthPage.module.css';

const backendOrigin = API_BASE.replace(/\/api\/?$/, '');
const googleLoginUrl = `${backendOrigin}/accounts/google/login/`;
const facebookLoginUrl = `${backendOrigin}/accounts/facebook/login/`;

export function LoginPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const error = params.get('error');

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Welcome back</div>
        <h1 className={styles.title}>Log in to GameBirj</h1>
        <p className={styles.subtitle}>Buy and sell gaming accounts with escrow protection.</p>
        {error && <div className={styles.error}>Social login failed. Please try again.</div>}
        <div className={styles.socialList}>
          <a className={`${styles.socialBtn} ${styles.googleBtn}`} href={googleLoginUrl}>
            <GoogleIcon size={18} />
            Continue with Google
          </a>
          <a className={`${styles.socialBtn} ${styles.facebookBtn}`} href={facebookLoginUrl}>
            <FacebookIcon size={18} />
            Continue with Facebook
          </a>
        </div>
        <p className={styles.hint}>New here? The same buttons create your account automatically.</p>
      </div>
    </main>
  );
}
