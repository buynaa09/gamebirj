import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';
import { AuthProvider } from './context/AuthProvider';
import { WishlistProvider } from './context/WishlistProvider';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
// import { ChatBubble } from './components/layout/ChatBubble';
import { HomePage } from './pages/HomePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { RentalPage } from './pages/RentalPage';
import { LoginPage } from './pages/LoginPage';
import { SellPage } from './pages/SellPage';
import { RentCreatePage } from './pages/RentCreatePage';
import { SellDashboardPage } from './pages/SellDashboardPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { MessagesPage } from './pages/MessagesPage';
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
        <Route path="/rent" element={<RentalPage />} />
        <Route path="/rent/create" element={<RentCreatePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/sell" element={<SellDashboardPage />} />
        <Route path="/sell/processing" element={<SellPage />} />
        <Route path="/listing/:id" element={<ListingRoute />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/messages" element={<MessagesPage />} />
      </Routes>
      {/* <ChatBubble /> */}
      <BottomNav />
    </>
  );
}

function ListingRoute() {
  const { id } = useParams();
  // Remount on id change so gallery state and data reset between listings.
  return <ListingDetailPage key={id} id={Number(id)} />;
}
