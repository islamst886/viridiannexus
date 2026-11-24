import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import RouteSeoManager from './components/RouteSeoManager';
import ScrollToTop from './components/ScrollToTop';
import Contact from './pages/Contact';
import Home from './pages/Home';
import JournalArticle from './pages/JournalArticle';
import Leadership from './pages/Leadership';
import Legal from './pages/Legal';
import Location from './pages/Location';
import NRB from './pages/NRB';
import Project from './pages/Project';
import Projects from './pages/Projects';
import VerifyDocument from './pages/VerifyDocument';

// Premium Features
import LiveCameras from './pages/LiveCameras';
import ProjectProgress from './pages/ProjectProgress';
import VirtualTour from './pages/VirtualTour';

// Auth and User Dashboard
import AuthPage from './pages/Auth/AuthPage';
import Booking from './pages/Booking';
import BookingDetail from './pages/Dashboard/BookingDetail';
import Overview from './pages/Dashboard/Overview';
import Wishlist from './pages/Dashboard/Wishlist';

// Admin Features
import AdminBookingDetail from './pages/Admin/BookingDetailAdmin';
import BookingRequests from './pages/Admin/BookingRequests';
import AdminBookings from './pages/Admin/Bookings';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminLogin from './pages/Admin/Login';
import AdminMessages from './pages/Admin/Messages';
import AdminNewsletter from './pages/Admin/Newsletter';
import ProgressManager from './pages/Admin/ProgressManager';
import PropertyForm from './pages/Admin/PropertyForm';
import AdminSiteSettings from './pages/Admin/SiteSettings';
import UserManager from './pages/Admin/UserManager';

// Route Guards
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedUserRoute from './components/ProtectedUserRoute';
import SuperAdminRoute from './components/SuperAdminRoute';

function Root() {
  return (
    <>
      <RouteSeoManager />
      <ScrollToTop />
      <ToastContainer position="top-right" autoClose={3000} />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'projects', element: <Projects /> },
          { path: 'project', element: <Project /> },
          { path: 'property/:id', element: <Project /> },
          { path: 'location', element: <Location /> },
          { path: 'leadership', element: <Leadership /> },
          { path: 'managing-director', element: <Leadership /> },
          { path: 'legal', element: <Legal /> },
          { path: 'nrb', element: <NRB /> },
          { path: 'contact', element: <Contact /> },
          { path: 'verify', element: <VerifyDocument /> },
          { path: 'journal/:slug', element: <JournalArticle /> },
          { path: 'journal', element: <JournalArticle /> },

          { path: 'virtual-tour', element: <VirtualTour /> },
          { path: 'live-cameras', element: <LiveCameras /> },
          { path: 'progress', element: <ProjectProgress /> },

          { path: 'auth', element: <AuthPage /> },
          {
            path: 'booking',
            element: (
              <ProtectedUserRoute>
                <Booking />
              </ProtectedUserRoute>
            ),
          },

          {
            path: 'dashboard',
            element: (
              <ProtectedUserRoute>
                <Overview />
              </ProtectedUserRoute>
            ),
          },
          {
            path: 'dashboard/wishlist',
            element: (
              <ProtectedUserRoute>
                <Wishlist />
              </ProtectedUserRoute>
            ),
          },
          {
            path: 'dashboard/booking/:bookingId',
            element: (
              <ProtectedUserRoute>
                <BookingDetail />
              </ProtectedUserRoute>
            ),
          },
        ],
      },
      // Admin Routes (No Layout)
      { path: 'admin', element: <AdminLogin /> },
      {
        path: 'admin/dashboard',
        element: (
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/messages',
        element: (
          <ProtectedRoute>
            <AdminMessages />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/bookings',
        element: (
          <ProtectedRoute>
            <AdminBookings />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/bookings/:bookingId',
        element: (
          <ProtectedRoute>
            <AdminBookingDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/booking-requests',
        element: (
          <ProtectedRoute>
            <BookingRequests />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/progress',
        element: (
          <ProtectedRoute>
            <ProgressManager />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/newsletter',
        element: (
          <ProtectedRoute>
            <AdminNewsletter />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/property/new',
        element: (
          <ProtectedRoute>
            <PropertyForm />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/property/:id',
        element: (
          <ProtectedRoute>
            <PropertyForm />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <SuperAdminRoute>
            <UserManager />
          </SuperAdminRoute>
        ),
      },
      {
        path: 'admin/settings',
        element: (
          <SuperAdminRoute>
            <AdminSiteSettings />
          </SuperAdminRoute>
        ),
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
