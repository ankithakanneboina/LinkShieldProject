import { Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import PublicLayout from './components/layout/PublicLayout';
import { AdminRoute, GuestRoute, ProtectedRoute } from './components/routes/ProtectedRoute';
import AboutPage from './pages/AboutPage';
import AdminPage from './pages/AdminPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import HowItWorksPage from './pages/HowItWorksPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ScanDetailsPage from './pages/ScanDetailsPage';
import ScannerPage from './pages/ScannerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route element={<GuestRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="scan" element={<ScannerPage />} />
          <Route path="scans/:id" element={<ScanDetailsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
