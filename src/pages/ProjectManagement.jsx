import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Download, Search, RefreshCw, Smartphone, Calendar, Users, XCircle, CheckCircle, AlertCircle, FolderOpen, Activity, Eye } from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';
import './react-select-tailwind.css';

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
  const [searchTerm, setSearchTerm] = useState('');
  
  const user = JSON.parse(localStorage.getItem('user'));
  const isAdmin = user && user.role === 'admin';

  // API URLs
  const USER_API = `${BACKEND_BASE_URL}/users`;
  const PROJECT_API = `${BACKEND_BASE_URL}/projects`;
  const DEVICE_API = `${BACKEND_BASE_URL}/devices`;

  // Fetch user's assigned projects (for regular users)
  const fetchUserProjects = async () => {
    if (isAdmin) return; // Skip for admins
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${USER_API}/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await response.json();
      
      if (userData.projects && userData.projects.length > 0) {
        // Fetch all projects and filter for user's assigned projects
        const allProjectsRes = await fetch(PROJECT_API, {
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
      const response = await fetch(PROJECT_API, {
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
      const res = await fetch(DEVICE_API, { headers: { Authorization: `Bearer ${token}` } });
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
          fetch(PROJECT_API, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(DEVICE_API, {
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
        const devicesRes = await fetch(DEVICE_API, {
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
      await fetch(`${PROJECT_API}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
        await fetch(PROJECT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, devices: selectedDevices.map(d => d.value) })
        });
      } else if (modalMode === 'edit') {
        await fetch(`${PROJECT_API}/${editId}`, {
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



  // Export project data
  const exportProjectData = (project) => {
    const projectDevices = allDevices.filter(device => 
      project.devices && project.devices.includes(device._id)
    );
    
    // Create CSV content
    let csvContent = '';

    // 1. Project Overview Section
    csvContent += 'Project Overview\n';
    csvContent += 'Project Name,' + project.projectName + '\n';
    csvContent += 'Description,' + (project.projectDescription || 'N/A') + '\n';
    csvContent += 'Total Devices,' + projectDevices.length + '\n';
    csvContent += 'Export Date,' + new Date().toLocaleDateString() + '\n';
    csvContent += '\n';

    // 2. Devices Section
    csvContent += 'Devices\n';
    csvContent += 'Device Name,Device ID,Status,Created,Assigned to Project\n';
    
    projectDevices.forEach(device => {
      // Try to find assignment date from user's project assignments
      const userProjectAssignments = user.projectAssignments || [];
      const assignment = userProjectAssignments.find(pa => 
        pa.projectId.toString() === project._id.toString()
      );
      const assignmentDate = assignment ? assignment.assignedAt : device.dateAssigned || device.dateCreated;
      
      const row = [
        device.name,
        device.deviceId,
        device.status || 'Active',
        device.dateCreated ? new Date(device.dateCreated).toLocaleDateString() : 'N/A',
        assignmentDate ? new Date(assignmentDate).toLocaleDateString() : 'N/A'
      ];
      
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const fileName = `${project.projectName}_Project_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  // Filter projects based on search term
  const filteredProjects = allProjects.filter(project => 
    project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.projectDescription && project.projectDescription.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search Section */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
          </div>
                <input
                  type="text"
                  placeholder="Search projects by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                />
              </div>
              
              {/* Search Results Summary */}
              {searchTerm && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {filteredProjects.length} of {allProjects.length} projects
                  </span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    Clear search
            </button>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handleAdd} 
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" /> 
                Add Project
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Projects ({filteredProjects.length})</h3>
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
                {filteredProjects.map(project => (
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
                {filteredProjects.length === 0 && searchTerm && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400">No projects found matching "{searchTerm}".</td></tr>
                )}
                {filteredProjects.length === 0 && !searchTerm && (
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FolderOpen className="h-8 w-8 text-blue-600" />
            My Projects
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
              Welcome back, {user.name}! Here are your assigned projects and devices.
          </p>
        </div>
        
          <div className="mt-4 sm:mt-0">
          <button
            onClick={refreshOTAUpdates}
            disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh Data"
          >
            {refreshing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Refresh
            </button>
          </div>
        </div>
      </div>

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
            
            return (
              <div key={project._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Project Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                          {project.projectName}
                        </h3>
                      
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                        {project.projectDescription || 'No description provided'}
                      </p>
                      
                      {/* Device Count */}
                      <div className="flex items-center gap-2 mb-4">
                            <Smartphone className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                          {projectDevices.length} Device{projectDevices.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        
                      {/* Device List */}
                      {projectDevices.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Assigned Devices:</p>
                          <div className="grid grid-cols-1 gap-2">
                          {projectDevices.map((device) => {
                              // Try to find assignment date from user's project assignments
                              const userProjectAssignments = user.projectAssignments || [];
                              const assignment = userProjectAssignments.find(pa => 
                                pa.projectId.toString() === project._id.toString()
                              );
                              const assignmentDate = assignment ? assignment.assignedAt : device.dateAssigned || device.dateCreated;
                            
                            return (
                              <div 
                                key={device._id} 
                                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                                >
                                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                    <Smartphone className="h-4 w-4 text-blue-600" />
                                    </div>
                                  <div className="flex-1">
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                        {device.name}
                                      </h5>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                      {device.deviceId}
                                    </p>
                                    {assignmentDate && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {assignment ? 'Assigned' : 'Created'}: {new Date(assignmentDate).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                              </div>
                            );
                          })}
                        </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Export Button */}
                    <button
                      onClick={() => exportProjectData(project)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Export Project Data"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
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