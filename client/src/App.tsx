import { Show, SignIn } from '@clerk/react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';
import { WishlistProvider } from './context/WishlistProvider';
import { ClerkTokenBridge } from './components/auth/ClerkTokenBridge';
import { Seo } from './components/seo/Seo';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
// import { ChatBubble } from './components/layout/ChatBubble';
import { HomePage } from './pages/HomePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { RentalPage } from './pages/RentalPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { SignupPage } from './pages/SignupPage';
import { SellPage } from './pages/SellPage';
import { RentCreatePage } from './pages/RentCreatePage';
import { SellDashboardPage } from './pages/SellDashboardPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { FacebookPolicyPage } from './pages/FacebookPolicyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { WishlistPage } from './pages/WishlistPage';
import { MessagesPage } from './pages/MessagesPage';
import './App.module.css';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ClerkTokenBridge />
        <WishlistProvider>
          <AppShell />
        </WishlistProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function AppShell() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/rent" element={<RentalPage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournaments/:id" element={<TournamentRoute />} />
        <Route path="/rent/create" element={<RentCreatePage />} />
        <Route
          path="/login/*"
          element={
            <>
              <Show when="signed-in">
                <Navigate to="/" replace />
              </Show>
              <Show when="signed-out">
                <main style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem' }}>
                  <Seo
                    title="Нэвтрэх | GameBirj"
                    description="GameBirj-д нэвтэрч тоглоомын аккаунт худалдах, худалдан авах, түрээслэх боломжтой болоорой."
                    path="/login"
                    noindex
                  />
                  <SignIn signUpUrl="/signup" />
                </main>
              </Show>
            </>
          }
        />
        <Route path="/signup/*" element={<SignupPage />} />
        <Route path="/sell" element={<SellDashboardPage />} />
        <Route path="/sell/processing" element={<SellPage />} />
        <Route path="/listing/:id" element={<ListingRoute />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/facebook-policy" element={<FacebookPolicyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* <ChatBubble /> */}
      <Footer />
      <BottomNav />
    </>
  );
}

function ListingRoute() {
  const { id } = useParams();
  // Remount on id change so gallery state and data reset between listings.
  return <ListingDetailPage key={id} id={Number(id)} />;
}

function TournamentRoute() {
  const { id } = useParams();
  return <TournamentDetailPage key={id} id={Number(id)} />;
}
