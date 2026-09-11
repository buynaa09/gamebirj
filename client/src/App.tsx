import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';
import { AuthProvider } from './context/AuthProvider';
import { WishlistProvider } from './context/WishlistProvider';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { ChatBubble } from './components/layout/ChatBubble';
import { HomePage } from './pages/HomePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { SellPage } from './pages/SellPage';
import { SellDashboardPage } from './pages/SellDashboardPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import './App.module.css';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <WishlistProvider>
            <AppShell />
          </WishlistProvider>
        </AuthProvider>
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/sell" element={<SellDashboardPage />} />
        <Route path="/sell/processing" element={<SellPage />} />
        <Route path="/listing/:id" element={<ListingRoute />} />
        <Route path="/wishlist" element={<WishlistPage />} />
      </Routes>
      <ChatBubble />
      <BottomNav />
    </>
  );
}

function ListingRoute() {
  const { id } = useParams();
  // Remount on id change so gallery state and data reset between listings.
  return <ListingDetailPage key={id} id={Number(id)} />;
}
