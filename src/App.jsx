import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Project from './pages/Project';
import Location from './pages/Location';
import Legal from './pages/Legal';
import NRB from './pages/NRB';
import Contact from './pages/Contact';

// Premium Features
import VirtualTour from './pages/VirtualTour';
import LiveCameras from './pages/LiveCameras';
import ProjectProgress from './pages/ProjectProgress';

// Auth and User Dashboard
import AuthPage from './pages/Auth/AuthPage';
import Booking from './pages/Booking';
import Overview from './pages/Dashboard/Overview';
import Wishlist from './pages/Dashboard/Wishlist';
import BookingDetail from './pages/Dashboard/BookingDetail';

// Admin Features
import AdminLogin from './pages/Admin/Login';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminMessages from './pages/Admin/Messages';
import AdminBookings from './pages/Admin/Bookings';
import AdminBookingDetail from './pages/Admin/BookingDetailAdmin';
import BookingRequests from './pages/Admin/BookingRequests';
import PropertyForm from './pages/Admin/PropertyForm';
import ProgressManager from './pages/Admin/ProgressManager';
import AdminNewsletter from './pages/Admin/Newsletter';
import UserManager from './pages/Admin/UserManager';

// Route Guards
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedUserRoute from './components/ProtectedUserRoute';
import SuperAdminRoute from './components/SuperAdminRoute';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="projects" element={<Projects />} />
          <Route path="project" element={<Project />} />
          <Route path="property/:id" element={<Project />} />
          <Route path="location" element={<Location />} />
          <Route path="legal" element={<Legal />} />
          <Route path="nrb" element={<NRB />} />
          <Route path="contact" element={<Contact />} />

          {/* New Premium Routes */}
          <Route path="virtual-tour" element={<VirtualTour />} />
          <Route path="live-cameras" element={<LiveCameras />} />
          <Route path="progress" element={<ProjectProgress />} />
          
          <Route path="auth" element={<AuthPage />} />
          <Route path="booking" element={<ProtectedUserRoute><Booking /></ProtectedUserRoute>} />
          
          <Route path="dashboard" element={<ProtectedUserRoute><Overview /></ProtectedUserRoute>} />
          <Route path="dashboard/wishlist" element={<ProtectedUserRoute><Wishlist /></ProtectedUserRoute>} />
          <Route path="dashboard/booking/:bookingId" element={<ProtectedUserRoute><BookingDetail /></ProtectedUserRoute>} />
        </Route>

        {/* Admin Routes (No Layout) */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/admin/messages"
          element={<ProtectedRoute><AdminMessages /></ProtectedRoute>}
        />
        <Route
          path="/admin/bookings"
          element={<ProtectedRoute><AdminBookings /></ProtectedRoute>}
        />
        <Route
          path="/admin/bookings/:bookingId"
          element={<ProtectedRoute><AdminBookingDetail /></ProtectedRoute>}
        />
        <Route
          path="/admin/booking-requests"
          element={<ProtectedRoute><BookingRequests /></ProtectedRoute>}
        />
        <Route
          path="/admin/progress"
          element={<ProtectedRoute><ProgressManager /></ProtectedRoute>}
        />
        <Route
          path="/admin/newsletter"
          element={<ProtectedRoute><AdminNewsletter /></ProtectedRoute>}
        />
        <Route
          path="/admin/property/new"
          element={<ProtectedRoute><PropertyForm /></ProtectedRoute>}
        />
        <Route
          path="/admin/property/:id"
          element={<ProtectedRoute><PropertyForm /></ProtectedRoute>}
        />
        <Route
          path="/admin/users"
          element={<SuperAdminRoute><UserManager /></SuperAdminRoute>}
        />
      </Routes>
    </Router>
  );
}

export default App;
