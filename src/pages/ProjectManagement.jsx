import React, { useState, useEffect } from 'react';
import { BACKEND_BASE_URL } from '../utils/api';
import { 
  FolderOpen, 
  Smartphone, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity,
  Users,
  Calendar,
  BarChart3,
  Download,
  Eye,
  Settings,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import Select from 'react-select';
import * as XLSX from 'xlsx';

const ProjectManagement = () => {
  const [userProjects, setUserProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [otaUpdates, setOtaUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const [selectedDevice, setSelectedDevice] = useState(null); // Track selected device for filtering
  const [refreshing, setRefreshing] = useState(false); // Loading state for refresh button
  
  // Admin-specific states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [form, setForm] = useState({ projectName: '', projectDescription: '' });
  const [editId, setEditId] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  
  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user && user.role === 'admin';

  // Fetch user's assigned projects (for regular users)
  const fetchUserProjects = async () => {
    if (isAdmin) return; // Skip for admins
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/users/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await response.json();
      
      if (userData.projects && userData.projects.length > 0) {
        // Fetch all projects and filter for user's assigned projects
        const allProjectsRes = await fetch(`${BACKEND_BASE_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const allProjects = await allProjectsRes.json();
        
        // Filter projects that belong to the user
        const userProjectIds = userData.projects.map(id => id.toString());
        const userProjectDetails = allProjects.filter(project => 
          userProjectIds.includes(project._id.toString())
        );
        
        setUserProjects(userProjectDetails);
        setAllProjects(allProjects); // Also set all projects for device filtering
      } else {
        setUserProjects([]);
      }
    } catch (err) {
      console.error('Error fetching user projects:', err);
      setError('Failed to fetch your assigned projects');
    }
  };

  // Fetch all projects (for admin)
  const fetchAllProjects = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setAllProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects');
    }
  };

  // Fetch available devices (not assigned to any project) - for admin
  const fetchAvailableDevices = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${BACKEND_BASE_URL}/devices`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      // Only devices not assigned to any project
      setAvailableDevices(Array.isArray(data) ? data.filter(d => !d.project) : []);
    } catch {}
  };

  // Fetch only essential data for project management
  const fetchEssentialData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (isAdmin) {
        // For admin: fetch projects and devices in parallel
        const [projectsRes, devicesRes] = await Promise.all([
          fetch(`${BACKEND_BASE_URL}/projects`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${BACKEND_BASE_URL}/devices`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        const [projectsData, devicesData] = await Promise.all([
          projectsRes.json(),
          devicesRes.json()
        ]);
        
        setAllProjects(projectsData);
        setAllDevices(devicesData);
      } else {
        // For regular users: fetch user projects (which also sets allProjects)
        await fetchUserProjects();
        // Fetch devices for statistics
        const devicesRes = await fetch(`${BACKEND_BASE_URL}/devices`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const devicesData = await devicesRes.json();
        setAllDevices(devicesData);
      }
    } catch (err) {
      console.error('Error fetching essential data:', err);
      setError('Failed to fetch data');
    }
  };

  // Fetch OTA updates only when needed (for statistics)
  const fetchOTAUpdates = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const updatesRes = await fetch(`${BACKEND_BASE_URL}/ota-updates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatesData = await updatesRes.json();
      setOtaUpdates(updatesData);
    } catch (err) {
      console.error('Error fetching OTA updates:', err);
    }
  };

  // Refresh OTA updates data for real-time statistics
  const refreshOTAUpdates = async () => {
    try {
      setRefreshing(true);
      await fetchOTAUpdates();
    } catch (err) {
      console.error('Error refreshing OTA updates:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Lazy load OTA updates when needed for statistics
  const loadOTAUpdatesIfNeeded = async () => {
    if (otaUpdates.length === 0) {
      await fetchOTAUpdates();
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchEssentialData();
      setLoading(false);
    };
    loadData();
  }, [isAdmin]);

  useEffect(() => { if (modalOpen) fetchAvailableDevices(); }, [modalOpen]);

  // Admin functions
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
      await fetch(`${BACKEND_BASE_URL}/projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      // Only refresh essential data - no need to fetch OTA updates
      await fetchEssentialData();
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
        await fetch(`${BACKEND_BASE_URL}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, devices: selectedDevices.map(d => d.value) })
        });
      } else if (modalMode === 'edit') {
        await fetch(`${BACKEND_BASE_URL}/projects/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, devices: selectedDevices.map(d => d.value) })
        });
      }
      setModalOpen(false);
      // Only refresh essential data
      await fetchEssentialData();
    } catch (err) {
      setError('Failed to save project');
      setLoading(false);
    }
  };

  // Calculate project statistics
  const getProjectStats = (project, deviceId = null) => {
    // Use the same improved device filtering logic
    const projectDevices = allDevices.filter(device => {
      if (!project.devices || !Array.isArray(project.devices)) return false;
      
      // Try multiple matching strategies
      return project.devices.some(projectDeviceId => {
        // Direct ID match
        if (projectDeviceId === device._id) return true;
        if (projectDeviceId === device._id.toString()) return true;
        if (projectDeviceId.toString() === device._id) return true;
        if (projectDeviceId.toString() === device._id.toString()) return true;
        
        // Device ID match (if project stores deviceId instead of _id)
        if (projectDeviceId === device.deviceId) return true;
        
        return false;
      });
    });
    
    // Filter devices if specific device is selected
    const filteredDevices = deviceId 
      ? projectDevices.filter(device => device.deviceId === deviceId || device._id === deviceId)
      : projectDevices;
    
    const deviceIds = filteredDevices.map(d => d.deviceId);
    const projectUpdates = otaUpdates.filter(update => 
      deviceIds.includes(update.deviceId)
    );
    
    const successCount = projectUpdates.filter(u => 
      u.normalizedStatus === 'Success' || u.status === 'Success'
    ).length;
    
    const failedCount = projectUpdates.filter(u => 
      u.normalizedStatus === 'Failed' || u.status === 'Failed'
    ).length;
    
    // Trigger lazy loading of OTA updates if we have devices but no updates
    if (filteredDevices.length > 0 && otaUpdates.length === 0) {
      loadOTAUpdatesIfNeeded();
    }
    
    return {
      totalDevices: filteredDevices.length,
      totalUpdates: projectUpdates.length,
      successCount,
      failedCount,
      successRate: projectUpdates.length > 0 ? ((successCount / projectUpdates.length) * 100).toFixed(1) : 0,
      deviceFilter: deviceId ? filteredDevices[0]?.name || 'Unknown Device' : 'All Devices'
    };
  };

  // Normalize status for consistency
  const normalizeStatus = (status, normalizedStatus) => {
    if (normalizedStatus) return normalizedStatus;
    if (status === 'Success' || status === 'Already Updated') return 'Success';
    if (status === 'Failed' || status === 'Update Failed') return 'Failed';
    return 'In Progress';
  };

  // Get status icon
  const getStatusIcon = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'Success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'Failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  // Export project data
  const exportProjectData = (project) => {
    const stats = getProjectStats(project);
    const projectDevices = allDevices.filter(device => 
      project.devices && project.devices.includes(device._id)
    );
    
    const deviceIds = projectDevices.map(d => d.deviceId);
    const projectUpdates = otaUpdates.filter(update => 
      deviceIds.includes(update.deviceId)
    );

    const data = [
      {
        sheet: 'Project Overview',
        data: [
          { 'Project Name': project.projectName },
          { 'Description': project.projectDescription || 'N/A' },
          { 'Total Devices': stats.totalDevices },
          { 'Total Updates': stats.totalUpdates },
          { 'Success Rate': `${stats.successRate}%` },
          { 'Success Count': stats.successCount },
          { 'Failed Count': stats.failedCount },
          { 'Total Updates': stats.totalUpdates }
        ]
      },
      {
        sheet: 'Devices',
        data: projectDevices.map(device => ({
          'Device Name': device.name,
          'Device ID': device.deviceId,
          'Status': device.status || 'Active',
          'Created': device.dateCreated ? new Date(device.dateCreated).toLocaleDateString() : 'N/A'
        }))
      },
      {
        sheet: 'OTA Updates',
        data: projectUpdates.map(update => ({
          'Device ID': update.deviceId,
          'Status': normalizeStatus(update.status, update.normalizedStatus),
          'Date': new Date(update.date).toLocaleDateString(),
          'PIC ID': update.pic_id || 'N/A',
          'Previous Version': update.previousVersion || 'N/A',
          'Updated Version': update.updatedVersion || 'N/A'
        }))
      }
    ];

    const wb = XLSX.utils.book_new();
    data.forEach(({ sheet, data }) => {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheet);
    });
    
    XLSX.writeFile(wb, `${project.projectName}_Project_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">Error Loading Projects</h3>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  // Admin Interface
  if (isAdmin) {
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Projects ({allProjects.length})</h3>
          </div>
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
                {allProjects.map(project => (
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
                {allProjects.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400">No projects found.</td></tr>
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
  }

  // User Interface
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-blue-600" />
            My Projects
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Welcome back, {user.name}! Here are your assigned projects and their current status.
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <button
            onClick={refreshOTAUpdates}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Data"
          >
            {refreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
            ) : (
              <Activity className="h-4 w-4" />
            )}
          </button>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {userProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{userProjects.length}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <FolderOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Devices</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProjects.reduce((total, project) => {
                    const stats = getProjectStats(project);
                    return total + stats.totalDevices;
                  }, 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Smartphone className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Updates</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProjects.reduce((total, project) => {
                    const stats = getProjectStats(project);
                    return total + stats.totalUpdates;
                  }, 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Success</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {userProjects.reduce((total, project) => {
                    const stats = getProjectStats(project);
                    return total + stats.successCount;
                  }, 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Failed</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {userProjects.reduce((total, project) => {
                    const stats = getProjectStats(project);
                    return total + stats.failedCount;
                  }, 0)}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Success Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProjects.length > 0 
                    ? (userProjects.reduce((total, project) => {
                        const stats = getProjectStats(project);
                        return total + parseFloat(stats.successRate);
                      }, 0) / userProjects.length).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projects Display */}
      {userProjects.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Projects Assigned</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You haven't been assigned to any projects yet. Contact your administrator to get started.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            <p>• Projects will appear here once assigned by an admin</p>
            <p>• You'll be able to view device status and OTA updates</p>
            <p>• Export detailed reports for each project</p>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        // Card View
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {userProjects.map((project) => {
            const projectDevices = allDevices.filter(device => {
              if (!project.devices || !Array.isArray(project.devices)) return false;
              
              // Try multiple matching strategies
              return project.devices.some(projectDeviceId => {
                // Direct ID match
                if (projectDeviceId === device._id) return true;
                if (projectDeviceId === device._id.toString()) return true;
                if (projectDeviceId.toString() === device._id) return true;
                if (projectDeviceId.toString() === device._id.toString()) return true;
                
                // Device ID match (if project stores deviceId instead of _id)
                if (projectDeviceId === device.deviceId) return true;
                
                return false;
              });
            });
            
            // Check if this project has a selected device
            const isProjectSelected = selectedProject === project._id;
            const projectSelectedDevice = isProjectSelected ? selectedDevice : null;
            const stats = getProjectStats(project, projectSelectedDevice);
            
            return (
              <div key={project._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Project Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {project.projectName}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => exportProjectData(project)}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Export Project Data"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSelectedProject(selectedProject === project._id ? null : project._id)}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                        {project.projectDescription || 'No description provided'}
                      </p>
                      
                      {/* Device Filter Indicator */}
                      {isProjectSelected && projectSelectedDevice && (
                        <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                Filtering by: {stats.deviceFilter}
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedDevice(null)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                            >
                              Show All Devices
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Project Stats Row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {stats.totalDevices} {projectSelectedDevice ? 'Device' : 'Devices'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {stats.totalUpdates} Updates
                            </span>
                          </div>
                        </div>
                        
                        {/* Success Rate Badge */}
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.successRate}%</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Success Rate</div>
                        </div>
                      </div>
                      
                      {/* Success/Failed Statistics */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">{stats.successCount}</div>
                          <div className="text-sm text-green-700 dark:text-green-300 font-medium">Success</div>
                        </div>
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">{stats.failedCount}</div>
                          <div className="text-sm text-red-700 dark:text-red-300 font-medium">Failed</div>
                        </div>
                      </div>
                      

                      
                      {/* Interactive Device List */}
                      {projectDevices.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Click device to filter:</p>
                          <div className="flex flex-wrap gap-1">
                            {/* "All Devices" option */}
                            <button
                              onClick={() => {
                                setSelectedProject(project._id);
                                setSelectedDevice(null);
                              }}
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs transition-colors ${
                                isProjectSelected && !projectSelectedDevice
                                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              <FolderOpen className="h-3 w-3 mr-1" />
                              All Devices
                            </button>
                            
                            {/* Individual devices */}
                            {projectDevices.map((device) => (
                              <button
                                key={device._id}
                                onClick={() => {
                                  setSelectedProject(project._id);
                                  setSelectedDevice(device.deviceId);
                                }}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs transition-colors ${
                                  isProjectSelected && projectSelectedDevice === device.deviceId
                                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                <Smartphone className="h-3 w-3 mr-1" />
                                {device.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>



                {/* Expandable Device List */}
                {selectedProject === project._id && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                          {projectSelectedDevice ? `Device Details: ${stats.deviceFilter}` : 'All Assigned Devices'}
                        </h4>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {projectSelectedDevice ? '1 device' : `${projectDevices.length} devices`}
                        </span>
                      </div>
                      {projectDevices.length > 0 ? (
                        <div className="space-y-4">
                          {projectDevices.map((device) => {
                            const deviceUpdates = otaUpdates.filter(update => update.deviceId === device.deviceId);
                            const lastUpdate = deviceUpdates.length > 0 
                              ? deviceUpdates[deviceUpdates.length - 1] 
                              : null;
                            const successUpdates = deviceUpdates.filter(u => 
                              normalizeStatus(u.status, u.normalizedStatus) === 'Success'
                            ).length;
                            const failedUpdates = deviceUpdates.filter(u => 
                              normalizeStatus(u.status, u.normalizedStatus) === 'Failed'
                            ).length;
                            const deviceSuccessRate = deviceUpdates.length > 0 
                              ? ((successUpdates / deviceUpdates.length) * 100).toFixed(1) 
                              : 0;
                            
                            const isSelectedDevice = projectSelectedDevice === device.deviceId;
                            
                            return (
                              <div 
                                key={device._id} 
                                className={`bg-white dark:bg-gray-700 rounded-lg border p-4 transition-all duration-200 ${
                                  isSelectedDevice 
                                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10' 
                                    : 'border-gray-200 dark:border-gray-600'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                      isSelectedDevice 
                                        ? 'bg-blue-100 dark:bg-blue-900/20' 
                                        : 'bg-gray-100 dark:bg-gray-600'
                                    }`}>
                                      <Smartphone className={`h-5 w-5 ${
                                        isSelectedDevice ? 'text-blue-600' : 'text-gray-500'
                                      }`} />
                                    </div>
                                    <div>
                                      <h5 className={`text-sm font-semibold ${
                                        isSelectedDevice 
                                          ? 'text-blue-900 dark:text-blue-300' 
                                          : 'text-gray-900 dark:text-white'
                                      }`}>
                                        {device.name}
                                        {isSelectedDevice && (
                                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                                            Selected
                                          </span>
                                        )}
                                      </h5>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{device.deviceId}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {lastUpdate && getStatusIcon(lastUpdate.status)}
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {deviceUpdates.length > 0 ? `${deviceUpdates.length} updates` : 'No updates'}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Device Summary */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Updates:</span>
                                      <span className="text-sm font-medium text-gray-900 dark:text-white">{deviceUpdates.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Success Rate:</span>
                                      <span className="text-sm font-medium text-green-600 dark:text-green-400">{deviceSuccessRate}%</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Last Update:</span>
                                    <span className="text-xs text-gray-900 dark:text-white">
                                      {lastUpdate 
                                        ? new Date(lastUpdate.date).toLocaleDateString()
                                        : 'None'
                                      }
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Device Details */}
                                <div className="flex items-center justify-between text-xs mb-3">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      device.status === 'Active' 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                      {device.status || 'Active'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400">Created:</span>
                                    <span className="text-gray-900 dark:text-white">
                                      {device.dateCreated ? new Date(device.dateCreated).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Recent Updates */}
                                {deviceUpdates.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                    <h6 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Updates</h6>
                                    <div className="space-y-1">
                                      {deviceUpdates.slice(-3).reverse().map((update, index) => (
                                        <div key={index} className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-2">
                                            {getStatusIcon(update.status)}
                                            <span className="text-gray-600 dark:text-gray-400">
                                              {normalizeStatus(update.status, update.normalizedStatus)}
                                            </span>
                                          </div>
                                          <span className="text-gray-500 dark:text-gray-400">
                                            {new Date(update.date).toLocaleDateString()}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-gray-400 text-sm">No devices assigned to this project.</p>
                          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Contact your administrator to assign devices.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Table View
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Devices
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Updates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {userProjects.map((project) => {
                  const stats = getProjectStats(project);
                  const projectDevices = allDevices.filter(device => 
                    project.devices && project.devices.includes(device._id)
                  );
                  
                  return (
                    <tr key={project._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {project.projectName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {project.projectDescription || 'No description'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {stats.totalDevices}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {stats.totalUpdates}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${stats.successRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900 dark:text-white">{stats.successRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-gray-900 dark:text-white">{stats.successCount}</span>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-gray-900 dark:text-white">{stats.failedCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => exportProjectData(project)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                            title="Export Data"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSelectedProject(selectedProject === project._id ? null : project._id)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement; 