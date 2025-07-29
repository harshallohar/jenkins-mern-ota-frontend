import { useState, useEffect } from 'react';
import { BACKEND_BASE_URL } from '../utils/api';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import Select from 'react-select';

const API_URL = `${BACKEND_BASE_URL}/projects`;

const ProjectManagement = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [form, setForm] = useState({ projectName: '', projectDescription: '' });
  const [editId, setEditId] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const user = JSON.parse(localStorage.getItem('user'));

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      setError('Failed to fetch projects');
    }
    setLoading(false);
  };

  // Fetch available devices (not assigned to any project)
  const fetchAvailableDevices = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${BACKEND_BASE_URL}/devices`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      // Only devices not assigned to any project
      setAvailableDevices(Array.isArray(data) ? data.filter(d => !d.project) : []);
    } catch {}
  };

  // Fetch all devices for display in project table
  const fetchAllDevices = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${BACKEND_BASE_URL}/devices`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAllDevices(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { fetchProjects(); fetchAllDevices(); }, []);
  useEffect(() => { if (modalOpen) fetchAvailableDevices(); }, [modalOpen]);

  const handleAdd = () => {
    setForm({ projectName: '', projectDescription: '' });
    setSelectedDevices([]);
    setModalMode('add');
    setModalOpen(true);
    setEditId(null);
  };

  const handleEdit = (project) => {
    setForm({ projectName: project.projectName, projectDescription: project.projectDescription });
    setSelectedDevices(
      Array.isArray(project.devices)
        ? project.devices
            .map(deviceId => {
              const device = availableDevices.find(d => d._id === String(deviceId)) || allDevices.find(d => d._id === String(deviceId));
              return device ? { value: device._id, label: `${device.name} (${device.deviceId})` } : null;
            })
            .filter(Boolean)
        : []
    );
    setModalMode('edit');
    setModalOpen(true);
    setEditId(project._id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchProjects();
    } catch (err) {
      setError('Failed to delete project');
      setLoading(false);
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      if (modalMode === 'add') {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, devices: selectedDevices.map(d => d.value) })
        });
      } else if (modalMode === 'edit') {
        await fetch(`${API_URL}/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, devices: selectedDevices.map(d => d.value) })
        });
      }
      setModalOpen(false);
      fetchProjects();
      fetchAllDevices();
    } catch (err) {
      setError('Failed to save project');
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return <div className="p-8 text-center text-red-500 font-semibold">Access denied. Admins only.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Project Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create, edit, and delete projects</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button onClick={handleAdd} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <Plus className="h-4 w-4 mr-2" /> Add Project
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Projects ({projects.length})</h3>
        </div>
        {loading && <div className="p-6 text-center text-gray-500">Loading...</div>}
        {error && <div className="p-6 text-center text-red-500">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Project Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assigned Devices</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {projects.map(project => (
                <tr key={project._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{project.projectName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{project.projectDescription}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {Array.isArray(project.devices) && project.devices.length > 0
                      ? project.devices.map(deviceId => {
                          const device = allDevices.find(d => d._id === String(deviceId));
                          return device ? `${device.name} (${device.deviceId})` : null;
                        }).filter(Boolean).join(', ')
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" onClick={() => handleEdit(project)}>
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" onClick={() => handleDelete(project._id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-gray-400">No projects found.</td></tr>
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
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{modalMode === 'add' ? 'Add Project' : 'Edit Project'}</h2>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name</label>
                <input type="text" name="projectName" value={form.projectName} onChange={e => setForm({ ...form, projectName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea name="projectDescription" value={form.projectDescription} onChange={e => setForm({ ...form, projectDescription: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" rows={3} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Devices</label>
                  <Select
                    options={availableDevices.concat(allDevices.filter(d => selectedDevices.some(sd => sd.value === d._id && !availableDevices.some(ad => ad._id === d._id)))).map(d => ({ value: d._id, label: `${d.name} (${d.deviceId})` }))}
                    value={selectedDevices}
                    onChange={setSelectedDevices}
                    isMulti
                    isClearable
                    placeholder="Select devices..."
                  />
                </div>
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

export default ProjectManagement; 