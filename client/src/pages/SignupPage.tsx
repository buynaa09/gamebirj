import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthError } from '../services/auth';
import styles from './AuthPage.module.css';

export function SignupPage() {
  const { user, loading, signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password1 !== password2) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    signup({ username: username.trim(), email: email.trim(), password1, password2 })
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
        <div className={styles.eyebrow}>Join GameBirj</div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Free to list. Escrow-protected trades across 40+ games.</p>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label htmlFor="signup-username">Username</label>
            <input
              id="signup-username"
              type="text"
              autoComplete="username"
              placeholder="Pick a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="signup-password1">Password</label>
            <input
              id="signup-password1"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="signup-password2">Confirm password</label>
            <input
              id="signup-password2"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className={styles.switch}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
