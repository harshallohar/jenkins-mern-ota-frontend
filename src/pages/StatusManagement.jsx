import { useState, useEffect } from 'react';
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
    setStatusCodes([...statusCodes, { code: '', message: '' }]);
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
    setStatusCodes(entry.statusCodes || []);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Status Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage status codes and messages for different devices</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Status Codes
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Status Management
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
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
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
            <button
              onClick={() => setSuccess('')}
              className="ml-auto -mx-1.5 -my-1.5 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-full p-1.5 hover:bg-green-100 dark:hover:bg-green-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Status Management Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Status Management Entries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status Codes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Based On
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {statusEntries.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No status management entries found
                  </td>
                </tr>
              ) : (
                statusEntries.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Smartphone className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {entry.deviceName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {entry.deviceId}
                          </div>
                        </div>
                      </div>
                    </td>
                                         <td className="px-6 py-4">
                       {entry.isBasedOnOtherDevice ? (
                         <div className="flex flex-wrap gap-1">
                           <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-1 w-full">
                             <Info className="h-3 w-3 mr-1" />
                             Inherited from {entry.baseDeviceName || 'Unknown Device'}
                           </div>
                           {(() => {
                             const baseEntry = statusEntries.find(baseEntry => baseEntry.deviceId === entry.baseDeviceId);
                             if (!baseEntry) {
                               return (
                                 <span className="text-xs text-red-500 dark:text-red-400">
                                   Base device not found - inherited status codes unavailable
                                 </span>
                               );
                             }
                             const isExpanded = expandedEntries.has(entry._id);
                             const displayCodes = isExpanded ? baseEntry.statusCodes : baseEntry.statusCodes?.slice(0, 3);
                             
                             return (
                               <>
                                 {displayCodes?.map((code, index) => (
                                   <span
                                     key={index}
                                     className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                   >
                                     {code.code}: {code.message}
                                   </span>
                                 ))}
                                 {baseEntry.statusCodes?.length > 3 && (
                                   <button
                                     onClick={() => toggleExpanded(entry._id)}
                                     className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium cursor-pointer"
                                   >
                                     {isExpanded ? 'Show Less' : `+${baseEntry.statusCodes.length - 3} more`}
                                   </button>
                                 )}
                               </>
                             );
                           })()}
                         </div>
                       ) : (
                         <div className="flex flex-wrap gap-1">
                           {(() => {
                             const isExpanded = expandedEntries.has(entry._id);
                             const displayCodes = isExpanded ? entry.statusCodes : entry.statusCodes.slice(0, 3);
                             
                             return (
                               <>
                                 {displayCodes.map((code, index) => (
                                   <span
                                     key={index}
                                     className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                   >
                                     {code.code}: {code.message}
                                   </span>
                                 ))}
                                 {entry.statusCodes.length > 3 && (
                                   <button
                                     onClick={() => toggleExpanded(entry._id)}
                                     className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium cursor-pointer"
                                   >
                                     {isExpanded ? 'Show Less' : `+${entry.statusCodes.length - 3} more`}
                                   </button>
                                 )}
                               </>
                             );
                           })()}
                         </div>
                       )}
                     </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {entry.isBasedOnOtherDevice ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusEntries.find(baseEntry => baseEntry.deviceId === entry.baseDeviceId)
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}>
                          {entry.baseDeviceName || 'Unknown Device'}
                          {!statusEntries.find(baseEntry => baseEntry.deviceId === entry.baseDeviceId) && (
                            <span className="ml-1 text-xs">(Missing)</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {entry.createdBy?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry._id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                           <button
                             type="button"
                             onClick={() => removeStatusCode(index)}
                             className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
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