import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Project from './pages/Project';
import Location from './pages/Location';
import Legal from './pages/Legal';
import NRB from './pages/NRB';
import Contact from './pages/Contact';

// Premium Features
import VirtualTour from './pages/VirtualTour';
import LiveCameras from './pages/LiveCameras';
import ProjectProgress from './pages/ProjectProgress';
import Booking from './pages/Booking';
import Overview from './pages/Dashboard/Overview';
import Wishlist from './pages/Dashboard/Wishlist';
import Bidding from './pages/Dashboard/Bidding';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="project" element={<Project />} />
          <Route path="location" element={<Location />} />
          <Route path="legal" element={<Legal />} />
          <Route path="nrb" element={<NRB />} />
          <Route path="contact" element={<Contact />} />
          
          {/* New Premium Routes */}
          <Route path="virtual-tour" element={<VirtualTour />} />
          <Route path="live-cameras" element={<LiveCameras />} />
          <Route path="progress" element={<ProjectProgress />} />
          <Route path="booking" element={<Booking />} />
          <Route path="dashboard" element={<Overview />} />
          <Route path="dashboard/wishlist" element={<Wishlist />} />
          <Route path="dashboard/bidding" element={<Bidding />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
