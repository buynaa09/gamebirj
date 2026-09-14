import { SignUp, useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';

export function SignupPage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <main style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem' }}>
        <p>Уншиж байна…</p>
      </main>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return (
    <main style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem' }}>
      <SignUp signInUrl="/login" />
    </main>
  );
}
