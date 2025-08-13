import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Download, CheckSquare, Square, UserPlus, Users, Shield, Mail, Calendar, MapPin, Filter, Eye, EyeOff } from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';

const API = `${BACKEND_BASE_URL}/users`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;
const DEVICES_API = `${BACKEND_BASE_URL}/devices`;

const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [addUserData, setAddUserData] = useState({ name: '', email: '', password: '', role: 'user' });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [devices, setDevices] = useState([]);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API);
      const data = await res.json();
      setUserList(data);
    } catch (err) {
      setError('Failed to fetch users');
    }
    setLoading(false);
  };
  useEffect(() => { fetchUsers(); }, []);

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

  // Fetch devices for assigned devices column
  useEffect(() => {
    const fetchDevices = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      const res = await fetch(DEVICES_API, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    };
    fetchDevices();
  }, []);

  // Add user
  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const user = JSON.parse(localStorage.getItem('user'));
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addUserData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Add user failed');
      // Assign projects if admin and projects selected
      if (user && user.role === 'admin') {
        const token = localStorage.getItem('authToken');
        await fetch(`${API}/${data.user._id}/assign-projects`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ projectIds: selectedProjects.map(p => p.value) })
        });
      }
      setAddModalOpen(false);
      setAddUserData({ name: '', email: '', password: '', role: 'user' });
      setSelectedProjects([]);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Edit user
  const handleEditUser = (user) => {
    setEditingUser({ ...user, password: '' });
    setEditModalOpen(true);
    setSelectedProjects(user.projects ? user.projects.map(pid => {
      const p = projects.find(pr => pr._id === pid);
      return p ? { value: p._id, label: p.projectName } : null;
    }).filter(Boolean) : []);
  };
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingUser((prev) => ({ ...prev, [name]: value }));
  };
  const handleEditSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const currentUser = JSON.parse(localStorage.getItem('user'));
    try {
      // Only include password if not empty
      const updateData = { ...editingUser };
      if (!updateData.password) {
        delete updateData.password;
      }
      const res = await fetch(`${API}/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Edit user failed');
      // Assign projects if admin and projects selected
      if (currentUser && currentUser.role === 'admin') {
        const token = localStorage.getItem('authToken');
        await fetch(`${API}/${editingUser._id}/assign-projects`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ projectIds: selectedProjects.map(p => p.value) })
        });
      }
      
      // If the current user is editing their own profile, update localStorage
      if (currentUser && currentUser._id === editingUser._id) {
        const updatedUserData = {
          ...currentUser,
          name: editingUser.name,
          email: editingUser.email,
          role: editingUser.role,
          canAccessFirmware: editingUser.canAccessFirmware,
          projects: selectedProjects.map(p => p.value)
        };
        localStorage.setItem('user', JSON.stringify(updatedUserData));
        // Force a page reload to update the UI with new permissions
        window.location.reload();
      }
      
      setEditModalOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };
  const handleEditCancel = () => {
    setEditModalOpen(false);
    setEditingUser(null);
  };

  // Delete user(s)
  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    setLoading(true);
    setError('');
    try {
      await fetch(`${API}/${id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
    }
    setLoading(false);
  };
  const handleDeleteSelected = async () => {
    if (!window.confirm('Delete selected users?')) return;
    setLoading(true);
    setError('');
    try {
      for (const id of selectedUsers) {
        await fetch(`${API}/${id}`, { method: 'DELETE' });
      }
      setSelectedUsers([]);
      fetchUsers();
    } catch (err) {
      setError('Failed to delete selected users');
    }
    setLoading(false);
  };

  const getRoleBadge = (role) => {
    const roleClasses = {
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleClasses[role]}`}>
        <Shield className="h-3 w-3 mr-1" />
        {role}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
        {status === 'active' ? '●' : '○'}
        <span className="ml-1 capitalize">{status}</span>
      </span>
    );
  };

  const filteredUsers = userList.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUsers(filteredUsers.map(user => user._id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  // Export User data
  const exportUserData = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Create CSV content
    let csvContent = '';

    // 1. User Management Summary Section
    csvContent += 'User Management Summary\n';
    csvContent += 'Export Date,' + new Date().toLocaleDateString() + '\n';
    csvContent += 'Export Time,' + new Date().toLocaleTimeString() + '\n';
    csvContent += 'Exported By,' + (user?.name || 'Unknown') + '\n';
    csvContent += 'Total Users,' + userList.length + '\n';
    csvContent += 'Admin Users,' + userList.filter(u => u.role === 'admin').length + '\n';
    csvContent += 'Regular Users,' + userList.filter(u => u.role === 'user').length + '\n';
    csvContent += 'Viewer Users,' + userList.filter(u => u.role === 'viewer').length + '\n';
    csvContent += 'Search Term,' + (searchTerm || 'None') + '\n';
    csvContent += 'Role Filter,' + roleFilter + '\n';
    csvContent += 'Filtered Results,' + filteredUsers.length + '\n';
    csvContent += '\n';

    // 2. User Details Section
    csvContent += 'User Details\n';
    csvContent += 'User ID,Name,Email,Role,Status,Date Created,Last Login,Assigned Projects,Total Assigned Projects,Total Assigned Devices,Device Names,Device IDs\n';
    
    userList.forEach(user => {
      const userProjects = projects.filter(p => user.projects && user.projects.includes(p._id));
      const userDevices = devices.filter(d => userProjects.some(p => p.devices && p.devices.includes(d._id)));
      
      const row = [
        user._id,
        user.name,
        user.email,
        user.role,
        user.status || 'Active',
        user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
        user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A',
        userProjects.map(p => p.projectName).join(', ') || 'None',
        userProjects.length,
        userDevices.length,
        userDevices.map(d => d.name).join(', ') || 'None',
        userDevices.map(d => d.deviceId).join(', ') || 'None'
      ];
      
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });
    
    csvContent += '\n';

    // 3. Project Assignments Section
    csvContent += 'Project Assignments\n';
    csvContent += 'Project Name,Project Description,Total Assigned Users,Assigned User Names,Assigned User Emails,Total Devices,Device Names,Device IDs\n';
    
    projects.forEach(project => {
      const assignedUsers = userList.filter(u => u.projects && u.projects.includes(project._id));
      const projectDevices = devices.filter(d => project.devices && project.devices.includes(d._id));
      
      const row = [
        project.projectName,
        project.projectDescription || 'N/A',
        assignedUsers.length,
        assignedUsers.map(u => u.name).join(', ') || 'None',
        assignedUsers.map(u => u.email).join(', ') || 'None',
        projectDevices.length,
        projectDevices.map(d => d.name).join(', ') || 'None',
        projectDevices.map(d => d.deviceId).join(', ') || 'None'
      ];
      
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const fileName = `User_Management_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search and Filter Section */}
          <div className="flex-1 max-w-2xl">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 max-w-sm">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="block px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            
            {/* Search Results Summary */}
            {searchTerm && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  {filteredUsers.length} of {userList.length} users
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
              onClick={exportUserData}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </button>
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Users ({filteredUsers.length})
            </h3>
            {selectedUsers.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedUsers.length} selected
                </span>
                <button className="text-sm text-red-600 hover:text-red-500" onClick={handleDeleteSelected}>
                  Delete Selected
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Password</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assigned Projects</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Firmware Access</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created Date</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => {
                // Find all devices assigned to any of the user's projects
                const userProjectNames = user.projects && user.projects.length > 0
                  ? user.projects.map(pid => {
                      const p = projects.find(pr => pr._id === pid);
                      return p ? p.projectName : null;
                    }).filter(Boolean).join(', ')
                  : '-';
                return (
                  <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user._id)}
                        onChange={() => handleSelectUser(user._id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{'●●●●●●'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{userProjectNames}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{user.canAccessFirmware ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.createdAt}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" onClick={() => handleEditUser(user)}>
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300" onClick={() => handleDeleteUser(user._id)}>
                          <Trash2 className="h-4 w-4" />
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
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 left-0 top-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-0 w-full max-w-2xl relative animate-fade-in">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
              onClick={handleEditCancel}
            >
              <span className="sr-only">Close</span>
              ×
            </button>
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Edit User</h2>
              <form onSubmit={handleEditSave} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={editingUser.name}
                      onChange={handleEditChange}
                      className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={editingUser.email}
                      onChange={handleEditChange}
                      className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        name="password"
                        value={editingUser.password}
                        onChange={handleEditChange}
                        className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                        placeholder="Leave blank to keep current password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowEditPassword(v => !v)}
                        tabIndex={-1}
                      >
                        {showEditPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                    <select
                      name="role"
                      value={editingUser.role}
                      onChange={handleEditChange}
                      className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                      required
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex items-center mt-2">
                    <input
                      type="checkbox"
                      id="canAccessFirmware-edit"
                      checked={!!editingUser.canAccessFirmware}
                      onChange={e => setEditingUser(prev => ({ ...prev, canAccessFirmware: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="canAccessFirmware-edit" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">Allow Firmware Management</label>
                  </div>
                </div>
                {(() => {
                  const user = JSON.parse(localStorage.getItem('user'));
                  if (user && user.role === 'admin') {
                    return (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Projects</label>
                        <Select
                          options={projects.map(p => ({ value: p._id, label: p.projectName }))}
                          value={selectedProjects}
                          onChange={setSelectedProjects}
                          isMulti
                          isClearable
                          placeholder="Select projects..."
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                  <button type="button" onClick={handleEditCancel} className="px-6 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold">Cancel</button>
                  <button type="submit" className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {addModalOpen && (
        <div className="fixed inset-0 left-0 top-0 w-full h-full z-[9999] flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-0 w-full max-w-2xl relative animate-fade-in">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
              onClick={() => setAddModalOpen(false)}
            >
              <span className="sr-only">Close</span>
              ×
            </button>
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Add User</h2>
              <form onSubmit={handleAddUser} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={addUserData.name}
                      onChange={e => setAddUserData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={addUserData.email}
                      onChange={e => setAddUserData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showAddPassword ? 'text' : 'password'}
                        name="password"
                        value={addUserData.password}
                        onChange={e => setAddUserData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowAddPassword(v => !v)}
                        tabIndex={-1}
                      >
                        {showAddPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                    <select
                      name="role"
                      value={addUserData.role}
                      onChange={e => setAddUserData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base"
                      required
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex items-center mt-2">
                    <input
                      type="checkbox"
                      id="canAccessFirmware-add"
                      checked={!!addUserData.canAccessFirmware}
                      onChange={e => setAddUserData(prev => ({ ...prev, canAccessFirmware: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="canAccessFirmware-add" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">Allow Firmware Management</label>
                  </div>
                </div>
                {(() => {
                  const user = JSON.parse(localStorage.getItem('user'));
                  if (user && user.role === 'admin') {
                    return (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Projects</label>
                        <Select
                          options={projects.map(p => ({ value: p._id, label: p.projectName }))}
                          value={selectedProjects}
                          onChange={setSelectedProjects}
                          isMulti
                          isClearable
                          placeholder="Select projects..."
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                  <button type="button" onClick={() => setAddModalOpen(false)} className="px-6 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold">Cancel</button>
                  <button type="submit" className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400">Add</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement; 