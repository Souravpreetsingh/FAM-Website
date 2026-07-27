import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ProtectedRoute, GuestRoute } from './components/ui/ProtectedRoute'
import AdminProtectedRoute from './admin/components/AdminProtectedRoute'
import AdminLayout from './admin/components/AdminLayout'
import DashboardLayout from './dashboard/components/DashboardLayout'
import Home from './pages/Home'
import Booking from './pages/Booking'
import BookingReview from './pages/BookingReview'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'
import NotFound from './pages/NotFound'
import AdminLogin from './admin/pages/AdminLogin'
import { PageLoader } from './components/ui/LoadingSpinner'

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

const MyBookings = lazy(() => import('./pages/MyBookings'))
const Profile = lazy(() => import('./pages/Profile'))

const AdminDashboard = lazy(() => import('./admin/pages/Dashboard'))
const AdminBookings = lazy(() => import('./admin/pages/Bookings'))
const AdminRooms = lazy(() => import('./admin/pages/Rooms'))
const AdminUsers = lazy(() => import('./admin/pages/Users'))
const AdminReviews = lazy(() => import('./admin/pages/Reviews'))
const AdminContact = lazy(() => import('./admin/pages/Contact'))
const AdminBookingManagement = lazy(() => import('./admin/pages/BookingManagement'))
const AdminRoomStatus = lazy(() => import('./admin/pages/RoomStatus'))
const AdminReports = lazy(() => import('./admin/pages/Reports'))
const AdminCafeManagement = lazy(() => import('./admin/pages/CafeManagement'))
const AdminExperiencesManagement = lazy(() => import('./admin/pages/ExperiencesManagement'))
const AdminAIInsights = lazy(() => import('./admin/pages/AIInsights'))

const DashboardHome = lazy(() => import('./dashboard/pages/DashboardHome'))
const DashboardProfile = lazy(() => import('./dashboard/pages/Profile'))
const DashboardBookings = lazy(() => import('./dashboard/pages/MyBookings'))
const DashboardBookingDetail = lazy(() => import('./dashboard/pages/BookingDetail'))
const DashboardSaved = lazy(() => import('./dashboard/pages/Favorites'))
const DashboardFavorites = lazy(() => import('./dashboard/pages/Favorites'))
const DashboardReviews = lazy(() => import('./dashboard/pages/Reviews'))
const DashboardPayments = lazy(() => import('./dashboard/pages/Payments'))
const DashboardSettings = lazy(() => import('./dashboard/pages/Settings'))
const DashboardSecurity = lazy(() => import('./dashboard/pages/Security'))
const DashboardNotifications = lazy(() => import('./dashboard/pages/Notifications'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/booking/review" element={<BookingReview />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:slug" element={<RoomDetail />} />
          <Route path="/rooms/:slug/book" element={<RoomDetail />} />
        </Route>

        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/bookings" element={<Lazy><MyBookings /></Lazy>} />
          <Route path="/profile" element={<Lazy><Profile /></Lazy>} />
        </Route>

        <Route path="/admin/login" element={<GuestRoute><AdminLogin /></GuestRoute>} />

        <Route element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
          <Route path="/admin/dashboard" element={<Lazy><AdminDashboard /></Lazy>} />
          <Route path="/admin/bookings" element={<Lazy><AdminBookings /></Lazy>} />
          <Route path="/admin/rooms" element={<Lazy><AdminRooms /></Lazy>} />
          <Route path="/admin/users" element={<Lazy><AdminUsers /></Lazy>} />
          <Route path="/admin/experiences" element={<Lazy><AdminExperiencesManagement /></Lazy>} />
          <Route path="/admin/cafe" element={<Lazy><AdminCafeManagement /></Lazy>} />
          <Route path="/admin/reviews" element={<Lazy><AdminReviews /></Lazy>} />
          <Route path="/admin/contact" element={<Lazy><AdminContact /></Lazy>} />
          <Route path="/admin/ai-insights" element={<Lazy><AdminAIInsights /></Lazy>} />
          <Route path="/admin/bookings/manage" element={<Lazy><AdminBookingManagement /></Lazy>} />
          <Route path="/admin/rooms/status" element={<Lazy><AdminRoomStatus /></Lazy>} />
          <Route path="/admin/reports" element={<Lazy><AdminReports /></Lazy>} />
        </Route>

        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Lazy><DashboardHome /></Lazy>} />
          <Route path="/dashboard/profile" element={<Lazy><DashboardProfile /></Lazy>} />
          <Route path="/dashboard/bookings" element={<Lazy><DashboardBookings /></Lazy>} />
          <Route path="/dashboard/booking/:id" element={<Lazy><DashboardBookingDetail /></Lazy>} />
          <Route path="/dashboard/saved" element={<Lazy><DashboardSaved /></Lazy>} />
          <Route path="/dashboard/favorites" element={<Lazy><DashboardFavorites /></Lazy>} />
          <Route path="/dashboard/reviews" element={<Lazy><DashboardReviews /></Lazy>} />
          <Route path="/dashboard/payments" element={<Lazy><DashboardPayments /></Lazy>} />
          <Route path="/dashboard/settings" element={<Lazy><DashboardSettings /></Lazy>} />
          <Route path="/dashboard/security" element={<Lazy><DashboardSecurity /></Lazy>} />
          <Route path="/dashboard/notifications" element={<Lazy><DashboardNotifications /></Lazy>} />
        </Route>

        <Route path="*" element={<Layout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
