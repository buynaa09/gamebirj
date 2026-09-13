import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthError } from '../services/auth';
import styles from './AuthPage.module.css';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    login(username.trim(), password)
      .then(() => {
        navigate('/', { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Welcome back</div>
        <h1 className={styles.title}>Log in to GameBirj</h1>
        <p className={styles.subtitle}>Buy and sell gaming accounts with escrow protection.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className={styles.switch}>
          No account yet? <Link to="/signup">Sign up, it&apos;s free</Link>
        </p>
      </div>
    </main>
  );
}
