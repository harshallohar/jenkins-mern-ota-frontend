import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import DeviceManagement from './pages/DeviceManagement';
import UserManagement from './pages/UserManagement';
import FirmwareManagement from './pages/FirmwareManagement';
import OTAUpdates from './pages/OTAUpdates';
import AddNewDevice from './pages/AddNewDevice';
import AddNewUser from './pages/AddNewUser';
import Login from './pages/Login';
import ProjectManagement from './pages/ProjectManagement';
import StatusManagement from './pages/StatusManagement';
import './App.css';

function PageWithTitle({ title, children }) {
  return <Layout pageTitle={title}>{children}</Layout>;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem("user");
      setUser(storedUser ? JSON.parse(storedUser) : null);
    };

    // Run once at mount
    handleStorageChange();

    // Listen for changes (including the manual dispatch in Login)
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);



  useEffect(() => {
    // Check if user is authenticated (check localStorage for token)
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  // Also update user state when isAuthenticated changes (e.g., after login)
  useEffect(() => {
    if (isAuthenticated) {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={
              !isAuthenticated ? <Login setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/dashboard" />
            } />
            <Route path="/" element={
              isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
            } />
            <Route path="/*" element={
              isAuthenticated ? (
                <Routes>
                  <Route path="/dashboard" element={<PageWithTitle title="Dashboard"><Dashboard /></PageWithTitle>} />
                  <Route path="/devices" element={user && user.role === 'admin' ? <PageWithTitle title="Device Management"><DeviceManagement /></PageWithTitle> : <Navigate to="/dashboard" />} />
                  {/* Only admin can access User Management */}
                  <Route path="/users" element={user && user.role === 'admin' ? <PageWithTitle title="User Management"><UserManagement /></PageWithTitle> : <Navigate to="/dashboard" />} />
                  {/* Status Management (admin only) */}
                  <Route path="/status-management" element={user && user.role === 'admin' ? <PageWithTitle title="Status Management"><StatusManagement /></PageWithTitle> : <Navigate to="/dashboard" />} />
                  {/* Firmware Management (admin only) */}
                  <Route path="/firmware" element={user && (user.role === 'admin' || user.canAccessFirmware) ? <PageWithTitle title="Firmware Management"><FirmwareManagement /></PageWithTitle> : <Navigate to="/dashboard" />} />
                  <Route path="/ota-updates" element={<PageWithTitle title="OTA Updates"><OTAUpdates /></PageWithTitle>} />
                  <Route path="/add-device" element={<PageWithTitle title="Add New Device"><AddNewDevice /></PageWithTitle>} />
                  <Route path="/add-user" element={<PageWithTitle title="Add New User"><AddNewUser /></PageWithTitle>} />
                  <Route path="/projects" element={<PageWithTitle title="Project Management"><ProjectManagement /></PageWithTitle>} />
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
              ) : (
                <Navigate to="/login" />
              )
            } />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
