import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Check, 
  X, 
  AlertCircle,
  Info,
  Settings,
  Smartphone
} from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';
import '../pages/react-select-tailwind.css';

const StatusManagement = () => {
  const { isDark } = useTheme();
  const [statusEntries, setStatusEntries] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [sourceDevice, setSourceDevice] = useState(null);
  const [statusCodes, setStatusCodes] = useState([]);
  const [isBasedOnOtherDevice, setIsBasedOnOtherDevice] = useState(false);
  const [baseDevice, setBaseDevice] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const user = JSON.parse(localStorage.getItem('user'));

  // Fetch status management entries
  const fetchStatusEntries = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/status-management`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setStatusEntries(data);
    } catch (error) {
      console.error('Error fetching status entries:', error);
      setError('Failed to fetch status entries');
    }
  };

  // Fetch available devices
  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/status-management/devices/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      console.log('Fetched devices data:', data);
      setDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError('Failed to fetch devices');
    }
  };

  // Refresh all data
  const refreshData = async () => {
    try {
      setRefreshing(true);
      await Promise.all([fetchStatusEntries(), fetchDevices()]);
      setSuccess('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStatusEntries(), fetchDevices()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Refresh data when page becomes visible (e.g., after navigating back from project deletion)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Reset form
  const resetForm = () => {
    setSelectedDevice(null);
    setStatusCodes([]);
    setIsBasedOnOtherDevice(false);
    setBaseDevice(null);
    setEditingEntry(null);
    setError('');
  };

  // Add new status code
  const addStatusCode = () => {
    setStatusCodes([...statusCodes, { code: '', message: '', color: '#6B7280', badge: 'other' }]);
  };

  // Remove status code
  const removeStatusCode = (index) => {
    setStatusCodes(statusCodes.filter((_, i) => i !== index));
  };

  // Update status code
  const updateStatusCode = (index, field, value) => {
    const updatedCodes = [...statusCodes];
    updatedCodes[index][field] = value;
    setStatusCodes(updatedCodes);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDevice) {
      setError('Please select a device');
      return;
    }

    if (!isBasedOnOtherDevice && statusCodes.length === 0) {
      setError('Please add at least one status code');
      return;
    }

    if (isBasedOnOtherDevice && !baseDevice) {
      setError('Please select a base device');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const payload = {
        deviceId: selectedDevice.value,
        deviceName: selectedDevice.label,
        statusCodes: isBasedOnOtherDevice ? [] : statusCodes,
        isBasedOnOtherDevice,
        baseDeviceId: isBasedOnOtherDevice ? baseDevice.value : null,
        baseDeviceName: isBasedOnOtherDevice ? baseDevice.label : null
      };

      const url = editingEntry 
        ? `${BACKEND_BASE_URL}/status-management/${editingEntry._id}`
        : `${BACKEND_BASE_URL}/status-management`;
      
      const method = editingEntry ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save status management');
      }

      setSuccess(editingEntry ? 'Status management updated successfully!' : 'Status management created successfully!');
      setShowModal(false);
      resetForm();
      fetchStatusEntries();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle edit
  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setSelectedDevice({ value: entry.deviceId, label: entry.deviceName });
    // Ensure each status code has a color, defaulting to gray if not present
    const statusCodesWithColors = (entry.statusCodes || []).map(code => ({
      ...code,
      color: code.color || '#6B7280'
    }));
    setStatusCodes(statusCodesWithColors);
    setIsBasedOnOtherDevice(entry.isBasedOnOtherDevice);
    if (entry.isBasedOnOtherDevice) {
      setBaseDevice({ value: entry.baseDeviceId, label: entry.baseDeviceName });
    }
    setShowModal(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this status management entry?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/status-management/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete status management');
      }

      setSuccess('Status management deleted successfully!');
      fetchStatusEntries();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle copy status codes
  const handleCopyStatusCodes = async () => {
    if (!selectedDevice || !sourceDevice) {
      setError('Please select both target and source devices');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/status-management/copy/${selectedDevice.value}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sourceDeviceId: sourceDevice.value })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to copy status codes');
      }

      setSuccess('Status codes copied successfully!');
      setShowCopyModal(false);
      setSelectedDevice(null);
      setSourceDevice(null);
      fetchStatusEntries();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Get device options for dropdowns
  const getDeviceOptions = () => {
    return devices.map(device => ({
      value: device.deviceId,
      label: `${device.name} (${device.deviceId})`,
      hasStatusManagement: device.hasStatusManagement
    }));
  };

  const getSourceDeviceOptions = () => {
    const devicesWithStatus = devices.filter(device => device.hasStatusManagement);
    console.log('Devices with status management:', devicesWithStatus);
    return devicesWithStatus.map(device => ({
      value: device.deviceId,
      label: `${device.name} (${device.deviceId})`
    }));
  };

  // Toggle expanded state for status codes
  const toggleExpanded = (entryId) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  // Filter status entries based on search term
  const filteredStatusEntries = useMemo(() => {
    if (!searchTerm.trim()) return statusEntries;
    
    const searchLower = searchTerm.toLowerCase();
    return statusEntries.filter(entry => 
      entry.deviceName?.toLowerCase().includes(searchLower) ||
      entry.deviceId?.toLowerCase().includes(searchLower) ||
      entry.statusCodes?.some(code => 
        code.message?.toLowerCase().includes(searchLower) ||
        code.code?.toString().includes(searchLower)
      )
    );
  }, [statusEntries, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
                placeholder="Search devices by name, ID, or status message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchTerm && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  {filteredStatusEntries.length} of {statusEntries.length} devices
                </span>
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Refresh Data"
            >
              {refreshing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Refresh
            </button>
            <button
              onClick={() => setShowCopyModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Status Codes
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Status
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="ml-auto -mx-1.5 -my-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full p-1.5 hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
            <button
              onClick={() => setSuccess('')}
              className="ml-auto -mx-1.5 -my-1.5 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full p-1.5 hover:bg-green-100 dark:hover:bg-red-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Status Management Content */}
      <div className="space-y-4">
        {statusEntries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-12">
            <Smartphone className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No status configurations</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating your first status management entry.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Status
              </button>
                                 </div>
          </div>
        ) : filteredStatusEntries.length === 0 && searchTerm ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No search results</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No devices found matching "{searchTerm}". Try adjusting your search terms.
            </p>
            <div className="mt-6">
                                   <button
                onClick={() => setSearchTerm('')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                   >
                Clear Search
                                   </button>
                         </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredStatusEntries.map((entry) => (
              <div key={entry._id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Device Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {entry.deviceName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {entry.deviceId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.badgeType === 'Custom' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                      }`}>
                        {entry.badgeType}
                        </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit Status Codes"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry._id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Status Management"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
        </div>
                </div>

                {/* Status Codes Content */}
                <div className="px-6 py-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Status Codes Section */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Status Codes ({entry.statusCodes?.length || 0})
                      </h4>
                      <div className="space-y-2">
                        {entry.statusCodes?.map((code, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: code.color || '#6B7280' }}
                              ></div>
                              <div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {code.code}: {code.message}
                                </span>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              code.badge === 'success' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : code.badge === 'failure'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }`}>
                              {code.badge}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metadata Section */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Configuration Details
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Based On:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {entry.isBasedOnOtherDevice ? entry.baseDeviceName : 'Custom Configuration'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Created By:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {entry.createdBy?.name || entry.createdBy || 'System'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {editingEntry ? 'Edit Status Management' : 'Add New Status Management'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Device Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Device
                  </label>
                  <Select
                    value={selectedDevice}
                    onChange={setSelectedDevice}
                    options={getDeviceOptions().filter(device => 
                      !editingEntry || device.value === editingEntry.deviceId
                    )}
                    placeholder="Select a device..."
                    isDisabled={!!editingEntry}
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                </div>

                {/* Based on Other Device */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="basedOnOther"
                    checked={isBasedOnOtherDevice}
                    onChange={(e) => setIsBasedOnOtherDevice(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="basedOnOther" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Use status codes from another device
                  </label>
                </div>

                                 {/* Base Device Selection */}
                 {isBasedOnOtherDevice && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                       Base Device
                     </label>
                     {getSourceDeviceOptions().length === 0 ? (
                       <div className="text-sm text-gray-500 dark:text-gray-400 p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                         No devices with status management found. Please create status management for at least one device first.
                       </div>
                     ) : (
                       <Select
                         value={baseDevice}
                         onChange={setBaseDevice}
                         options={getSourceDeviceOptions()}
                         placeholder="Select a base device..."
                         className="react-select-container"
                         classNamePrefix="react-select"
                       />
                     )}
                   </div>
                 )}

                {/* Custom Status Codes */}
                {!isBasedOnOtherDevice && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Status Codes
                      </label>
                      <button
                        type="button"
                        onClick={addStatusCode}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Code
                      </button>
                    </div>
                    
                                         <div className="space-y-3">
                       {statusCodes.map((code, index) => (
                         <div key={index} className="flex space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md">
                           <div className="flex-1">
                             <input
                               type="number"
                               placeholder="Code"
                               value={code.code}
                               onChange={(e) => updateStatusCode(index, 'code', e.target.value)}
                               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                             />
                           </div>
                           <div className="flex-1">
                             <input
                               type="text"
                               placeholder="Message"
                               value={code.message}
                               onChange={(e) => updateStatusCode(index, 'message', e.target.value)}
                               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                             />
                           </div>
                           <div className="flex-1">
                             <select
                               value={code.badge || 'other'}
                               onChange={(e) => updateStatusCode(index, 'badge', e.target.value)}
                               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                             >
                               <option value="success">Success</option>
                               <option value="failure">Failure</option>
                               <option value="other">Other</option>
                             </select>
                           </div>
                           <div className="flex items-center space-x-2">
                             <input
                               type="color"
                               value={code.color || '#6B7280'}
                               onChange={(e) => updateStatusCode(index, 'color', e.target.value)}
                               className="w-10 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                               title="Choose color"
                             />
                             <button
                               type="button"
                               onClick={() => removeStatusCode(index)}
                               className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                             >
                               <Trash2 className="h-4 w-4" />
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {editingEntry ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Copy Status Codes Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Copy Status Codes
                </h3>
                <button
                  onClick={() => {
                    setShowCopyModal(false);
                    setSelectedDevice(null);
                    setSourceDevice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Target Device */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Device
                  </label>
                  <Select
                    value={selectedDevice}
                    onChange={setSelectedDevice}
                    options={getDeviceOptions()}
                    placeholder="Select target device..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                </div>

                                 {/* Source Device */}
                 <div>
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                     Source Device
                   </label>
                   {getSourceDeviceOptions().length === 0 ? (
                     <div className="text-sm text-gray-500 dark:text-gray-400 p-3 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                       No devices with status management found. Please create status management for at least one device first.
                     </div>
                   ) : (
                     <Select
                       value={sourceDevice}
                       onChange={setSourceDevice}
                       options={getSourceDeviceOptions()}
                       placeholder="Select source device..."
                       className="react-select-container"
                       classNamePrefix="react-select"
                     />
                   )}
                 </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCopyModal(false);
                      setSelectedDevice(null);
                      setSourceDevice(null);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCopyStatusCodes}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Copy Status Codes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusManagement; 