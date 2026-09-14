import { SignUp, useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import styles from './AuthPage.module.css';

export function SignupPage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <main className={styles.page}>
        <p className={styles.subtitle}>Уншиж байна…</p>
      </main>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Join GameBirj</div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Buy and sell gaming accounts with escrow protection.</p>
        <SignUp signInUrl="/login" />
      </div>
    </main>
  );
}
