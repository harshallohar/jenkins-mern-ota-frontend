import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';

const AddNewDevice = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    id: '',
  });
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const deviceTypes = [
    'Temperature Sensor',
    'Humidity Sensor',
    'Pressure Sensor',
    'Motion Sensor',
    'Security Camera',
    'HVAC Controller',
    'IoT Gateway',
    'Smart Light',
    'Smart Lock',
    'Other'
  ];

  // Fetch projects (for admin)
  useEffect(() => {
    const fetchProjects = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      const res = await fetch(`${BACKEND_BASE_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProjects(data);
    };
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.role === 'admin') fetchProjects();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // In handleSubmit, assign project if admin
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${BACKEND_BASE_URL}/devices`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          deviceId: formData.id
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to add device');
      }
      
      const device = await res.json();
      
      // Assign project if admin and project selected
      const user = JSON.parse(localStorage.getItem('user'));
      if (user && user.role === 'admin' && selectedProject) {
        const assignRes = await fetch(`${BACKEND_BASE_URL}/devices/${device._id}/assign-project`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ projectId: selectedProject.value })
        });
        
        if (!assignRes.ok) {
          console.warn('Failed to assign device to project, but device was created successfully');
        }
      }
      
      setIsLoading(false);
      navigate('/devices');
    } catch (err) {
      setIsLoading(false);
      console.error('Error adding device:', err);
      alert(err.message || 'Failed to add device');
    }
  };

  const handleCancel = () => {
    navigate('/devices');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/devices')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Device</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Register a new IoT device to your network
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Device Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g., Sensor-001"
                />
              </div>
              <div>
                <label htmlFor="id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Device ID *
                </label>
                <input
                  type="text"
                  id="id"
                  name="id"
                  required
                  value={formData.id}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g., 12345"
                />
              </div>
            </div>
          </div>
          {(() => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (user && user.role === 'admin') {
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign to Project</label>
                  <Select
                    options={projects.map(p => ({ value: p._id, label: p.projectName }))}
                    value={selectedProject}
                    onChange={setSelectedProject}
                    isClearable
                    placeholder="Select project..."
                  />
                </div>
              );
            }
            return null;
          })()}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <X className="h-4 w-4 mr-1" /> Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-1" /> {isLoading ? 'Saving...' : 'Save Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNewDevice; 