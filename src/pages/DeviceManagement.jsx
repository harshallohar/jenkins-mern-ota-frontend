import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Edit, Download } from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';
import './react-select-tailwind.css';

const API_URL = `${BACKEND_BASE_URL}/devices`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;
const USERS_API = `${BACKEND_BASE_URL}/users`;

const DeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [form, setForm] = useState({ name: '', deviceId: '' });
  const [editId, setEditId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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
      // If your API returns { success: true, data: [...] } adjust accordingly.
      // Here we defensively support both shapes.
      const devicesArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setDevices(devicesArray);
    } catch (err) {
      console.error('fetchDevices error:', err);
      setError('Failed to fetch devices');
    }
    setLoading(false);
  };

  // Fetch projects (for admin)
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        const res = await fetch(PROJECTS_API, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const projectsArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setProjects(projectsArray);
      } catch (err) {
        console.error('fetchProjects error:', err);
      }
    };
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.role === 'admin') fetchProjects();
  }, []);

  // Fetch users for assigned users column
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        const res = await fetch(USERS_API, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const usersArray = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setUsers(usersArray);
      } catch (err) {
        console.error('fetchUsers error:', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchDevices();
  }, []);

  const filteredDevices = devices.filter(device =>
    (device.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.deviceId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add Device
  const handleAdd = () => {
    setForm({ name: '', deviceId: '' });
    setModalMode('add');
    setModalOpen(true);
    setEditId(null);
    setSelectedProject(null);
    setError('');
  };

  const handleEdit = (device) => {
    setForm({ name: device.name || '', deviceId: device.deviceId || '' });
    setModalMode('edit');
    setModalOpen(true);
    setEditId(device._id || device.id);
    setSelectedProject(device.project ? { value: device.project, label: projects.find(p => p._id === device.project)?.projectName || 'Unknown' } : null);
    setError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this device?')) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const errJson = await res.json().catch(()=>null);
        throw new Error(errJson?.message || res.statusText || 'Delete failed');
      }
      await fetchDevices();
    } catch (err) {
      console.error('handleDelete error:', err);
      setError('Failed to delete device');
      setLoading(false);
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('authToken');

    try {
      let deviceJson = null;

      if (modalMode === 'add') {
        // Build body. Include project on creation if admin selected it.
        const body = { name: form.name, deviceId: form.deviceId };
        if (user && user.role === 'admin' && selectedProject) {
          // If your backend supports creating with project field, include it.
          body.project = selectedProject.value;
        }

        const deviceRes = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify(body)
        });

        if (!deviceRes.ok) {
          // try to parse error message
          const errJson = await deviceRes.json().catch(()=>null);
          throw new Error(errJson?.message || deviceRes.statusText || 'Failed to create device');
        }

        const created = await deviceRes.json();
        // support both { success:true, data: device } and direct device
        deviceJson = created && created.data ? created.data : created;

        // If your backend does NOT accept 'project' in creation, call assign-project endpoint (defensive)
        if (user && user.role === 'admin' && selectedProject && !(deviceJson && (deviceJson.project || deviceJson.project === selectedProject.value))) {
          const createdId = deviceJson._id || deviceJson.id;
          if (createdId) {
            const assignRes = await fetch(`${API_URL}/${createdId}/assign-project`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
              body: JSON.stringify({ projectId: selectedProject.value })
            });
            if (!assignRes.ok) {
              const errJson = await assignRes.json().catch(()=>null);
              console.warn('assign-project failed:', errJson || assignRes.statusText);
              // not throwing here — assignment failure isn't as critical as creation
            }
          } else {
            console.warn('Created device ID not found, skipping assign-project call.');
          }
        }
      } else if (modalMode === 'edit') {
        // Update device fields
        const updateRes = await fetch(`${API_URL}/${editId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ name: form.name, deviceId: form.deviceId })
        });

        if (!updateRes.ok) {
          const errJson = await updateRes.json().catch(()=>null);
          throw new Error(errJson?.message || updateRes.statusText || 'Failed to update device');
        }

        // Optionally assign project
        if (user && user.role === 'admin') {
          if (selectedProject) {
            const assignRes = await fetch(`${API_URL}/${editId}/assign-project`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
              body: JSON.stringify({ projectId: selectedProject.value })
            });
            if (!assignRes.ok) {
              const errJson = await assignRes.json().catch(()=>null);
              console.warn('assign-project failed:', errJson || assignRes.statusText);
            }
          } else {
            // if admin cleared the project selection and you want to unassign, you'd call an unassign endpoint here (if available)
          }
        }
      }

      // Success: close modal and refresh list
      setModalOpen(false);
      await fetchDevices();
    } catch (err) {
      console.error('handleModalSubmit error:', err);
      setError(err.message || 'Failed to save device');
    } finally {
      setSubmitting(false);
    }
  };

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Export Device data (unchanged)
  const exportDeviceData = () => {
    // ... same export function as before (kept for brevity)
    let csvContent = '';
    csvContent += 'Device Management Summary\n';
    csvContent += 'Export Date,' + new Date().toLocaleDateString() + '\n';
    csvContent += 'Export Time,' + new Date().toLocaleTimeString() + '\n';
    csvContent += 'Exported By,' + (user?.name || 'Unknown') + '\n';
    csvContent += 'Total Devices,' + devices.length + '\n';
    csvContent += 'Assigned Devices,' + devices.filter(d => d.project).length + '\n';
    csvContent += 'Unassigned Devices,' + devices.filter(d => !d.project).length + '\n';
    csvContent += 'Search Term,' + (searchTerm || 'None') + '\n';
    csvContent += 'Filtered Results,' + filteredDevices.length + '\n\n';
    csvContent += 'Device Details\n';
    csvContent += 'Device ID,Device Name,Device ID (Hardware),Assigned Project,Project Description,Status,Date Created,Date Assigned,Assigned Users,Assigned User Emails,Total Assigned Users\n';
    devices.forEach(device => {
      const project = projects.find(p => p._id === String(device.project));
      const assignedUsers = users.filter(u => u.projects && u.projects.includes(device.project));
      const row = [
        device._id,
        device.name,
        device.deviceId,
        project?.projectName || 'Unassigned',
        project?.projectDescription || 'N/A',
        device.status || 'Active',
        device.dateCreated ? new Date(device.dateCreated).toLocaleDateString() : 'N/A',
        device.dateAssigned ? new Date(device.dateAssigned).toLocaleDateString() : 'N/A',
        assignedUsers.map(u => u.name).join(', ') || 'None',
        assignedUsers.map(u => u.email).join(', ') || 'None',
        assignedUsers.length
      ];
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.setAttribute('download', `Device_Management_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
              />
            </div>
            {searchTerm && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">{filteredDevices.length} of {devices.length} devices</span>
                <button onClick={() => setSearchTerm('')} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">Clear search</button>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={exportDeviceData} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </button>
            {user && user.role === 'admin' && (
              <button onClick={handleAdd} className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> Add Device
              </button>
            )}
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
                const assignedUserNames = users.filter(u => u.projects && u.projects.includes(device.project)).map(u => u.name).join(', ');
                return (
                  <tr key={device._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{device.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{device.deviceId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{(() => { const p = projects.find(pp => pp._id === String(device.project)); return p ? p.projectName : '-'; })()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{device.dateAssigned ? new Date(device.dateAssigned).toLocaleDateString() : (device.dateCreated ? new Date(device.dateCreated).toLocaleDateString() : '-')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {user && user.role === 'admin' && (
                        <div className="flex items-center justify-end space-x-2">
                          <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" onClick={() => handleEdit(device)}><Edit className="h-4 w-4" /></button>
                          <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" onClick={() => handleDelete(device._id)}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredDevices.length === 0 && (<tr><td colSpan={5} className="py-8 text-center text-gray-400">No devices found.</td></tr>)}
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

            {error && <div className="mb-2 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device Name</label>
                <input type="text" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device ID</label>
                <input type="text" name="deviceId" value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
              </div>

              {/* Show project select for admins in both add and edit */}
              {user && user.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign to Project</label>
                  <Select
                    options={projects.map(p => ({ value: p._id, label: p.projectName }))}
                    value={selectedProject}
                    onChange={setSelectedProject}
                    isClearable
                    placeholder="Select project..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">{submitting ? (modalMode === 'add' ? 'Adding...' : 'Saving...') : (modalMode === 'add' ? 'Add' : 'Save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManagement;
