import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';

const API_URL = `${BACKEND_BASE_URL}/devices`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;
const USERS_API = `${BACKEND_BASE_URL}/users`;

const DeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [form, setForm] = useState({ name: '', deviceId: '' });
  const [editId, setEditId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [users, setUsers] = useState([]);

  // Fetch devices from backend
  const fetchDevices = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to fetch devices');
    }
    setLoading(false);
  };

  // Fetch projects (for admin)
  useEffect(() => {
    const fetchProjects = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      const res = await fetch(PROJECTS_API, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProjects(data);
    };
    // Only fetch if admin
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.role === 'admin') fetchProjects();
  }, []);

  // Fetch users for assigned users column
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      const res = await fetch(USERS_API, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchDevices();
  }, []);

  // Defensive: if devices is not an array, show error
  if (!Array.isArray(devices)) {
    return <div className="p-8 text-center text-red-500 font-semibold">Error loading devices.</div>;
  }
  // Defensive: if devices is not an array, filteredDevices is empty
  const filteredDevices = Array.isArray(devices) ? devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.deviceId.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Add Device
  const handleAdd = () => {
    setForm({ name: '', deviceId: '' });
    setModalMode('add');
    setModalOpen(true);
    setEditId(null);
    setSelectedProject(null);
  };

  const handleEdit = (device) => {
    setForm({ name: device.name, deviceId: device.deviceId });
    setModalMode('edit');
    setModalOpen(true);
    setEditId(device._id);
    setSelectedProject(device.project ? { value: device.project, label: projects.find(p => p._id === device.project)?.projectName || 'Unknown' } : null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this device?')) return;
    setLoading(true);
    setError('');
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      fetchDevices();
    } catch (err) {
      setError('Failed to delete device');
      setLoading(false);
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const user = JSON.parse(localStorage.getItem('user'));
    try {
      let deviceRes;
      if (modalMode === 'add') {
        deviceRes = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        const device = await deviceRes.json();
        // Assign project if admin and project selected
        if (user && user.role === 'admin' && selectedProject) {
          const token = localStorage.getItem('authToken');
          await fetch(`${API_URL}/${device._id}/assign-project`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ projectId: selectedProject.value })
          });
        }
      } else if (modalMode === 'edit') {
        await fetch(`${API_URL}/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        // Assign project if admin and project selected
        if (user && user.role === 'admin' && selectedProject) {
          const token = localStorage.getItem('authToken');
          await fetch(`${API_URL}/${editId}/assign-project`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ projectId: selectedProject.value })
          });
        }
      }
      setModalOpen(false);
      fetchDevices();
    } catch (err) {
      setError('Failed to save device');
      setLoading(false);
    }
  };

  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Device Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage and monitor all your IoT devices</p>
        </div>
        <div className="mt-4 sm:mt-0">
          {user && user.role === 'admin' && (
          <button onClick={handleAdd} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <Plus className="h-4 w-4 mr-2" /> Add Device
          </button>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Devices ({filteredDevices.length})</h3>
          </div>
        </div>
        {loading && <div className="p-6 text-center text-gray-500">Loading...</div>}
        {error && <div className="p-6 text-center text-red-500">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Device Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Device ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assigned Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date Assigned</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDevices.map(device => {
                // Find all users assigned to this device's project
                const assignedUserNames = users
                  .filter(user => user.projects && user.projects.includes(device.project))
                  .map(user => user.name)
                  .join(', ');
                return (
                  <tr key={device._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{device.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{device.deviceId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{(() => {
                      const project = projects.find(p => p._id === String(device.project));
                      return project ? project.projectName : '-';
                    })()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{device.dateAssigned ? new Date(device.dateAssigned).toLocaleDateString() : (device.dateCreated ? new Date(device.dateCreated).toLocaleDateString() : '-')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {user && user.role === 'admin' && (
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" onClick={() => handleEdit(device)}>
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" onClick={() => handleDelete(device._id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredDevices.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No devices found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fade-in">
            <button onClick={() => setModalOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl">&times;</button>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{modalMode === 'add' ? 'Add Device' : 'Edit Device'}</h2>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device Name</label>
                <input type="text" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device ID</label>
                <input type="text" name="deviceId" value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
              </div>
              {(() => {
                const user = JSON.parse(localStorage.getItem('user'));
                // Only show assign project selection for edit mode (not add)
                if (user && user.role === 'admin' && modalMode === 'edit') {
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
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">{modalMode === 'add' ? 'Add' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManagement; 