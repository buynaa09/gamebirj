import { SignUp, useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { Seo } from '../components/seo/Seo';

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
      <Seo
        title="Бүртгүүлэх | GameBirj"
        description="GameBirj-д бүртгүүлж тоглоомын аккаунт худалдах, худалдан авах, түрээслэх боломжтой болоорой."
        path="/signup"
        noindex
      />
      <SignUp signInUrl="/login" />
    </main>
  );
}
