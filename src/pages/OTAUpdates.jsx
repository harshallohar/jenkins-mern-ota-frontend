import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  Square,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  Smartphone,
  BarChart3
} from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';
import * as XLSX from 'xlsx';

const DEVICES_PER_PAGE = 5;
const UPDATES_PER_PAGE = 5;

const DEVICES_API = `${BACKEND_BASE_URL}/devices`;
const OTA_API = `${BACKEND_BASE_URL}/ota-updates`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;

const OTAUpdates = () => {
  const [devices, setDevices] = useState([]);
  const [otaUpdates, setOtaUpdates] = useState([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [devicePage, setDevicePage] = useState(1);
  const [updatesPage, setUpdatesPage] = useState(1);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedUpdates, setSelectedUpdates] = useState([]);

  // Fetch devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(DEVICES_API, { headers: { Authorization: `Bearer ${token}` } });
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
    };
    fetchDevices();
  }, []);

  // Fetch OTA updates
  useEffect(() => {
    const fetchUpdates = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(OTA_API);
        const data = await res.json();
        setOtaUpdates(data);
      } catch (err) {
        setError('Failed to fetch OTA updates');
      }
      setLoading(false);
    };
    fetchUpdates();
  }, []);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(PROJECTS_API, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch {}
    };
    fetchProjects();
  }, []);

  // Defensive: if devices is not an array, show error
  if (!Array.isArray(devices)) {
    return <div className="p-8 text-center text-red-500 font-semibold">Error loading devices.</div>;
  }
  
  // Filter devices by selected project
  const filteredDevices = selectedProject
    ? devices.filter(d => d.project === selectedProject.value)
    : devices;
  const pagedDevices = filteredDevices.slice((devicePage - 1) * DEVICES_PER_PAGE, devicePage * DEVICES_PER_PAGE);
  const totalDevicePages = Math.ceil(filteredDevices.length / DEVICES_PER_PAGE);

  // Helper function to normalize status (for backward compatibility)
  const normalizeStatus = (status) => {
    if (!status) return 'Failed';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('success') && !statusLower.includes('unsuccessful')) {
      return 'Success';
    } else if (statusLower.includes('unsuccessful') || statusLower.includes('fail')) {
      return 'Failed';
    } else if (statusLower.includes('already updated')) {
      return 'In Progress';
    } else {
      return 'In Progress';
    }
  };

  // Filtered OTA updates for selected device
  const filteredUpdates = useMemo(() => {
    let updates = otaUpdates;
    if (selectedDeviceId) {
      // Find the selected device to get its deviceId
      const selectedDevice = devices.find(d => d._id === selectedDeviceId);
      if (selectedDevice) {
        // Filter OTA updates by the device's deviceId
        // Handle both formats: with and without 0x prefix
        const deviceIdToMatch = selectedDevice.deviceId;
        const deviceIdWithoutPrefix = deviceIdToMatch.replace(/^0x/i, '');
        
        updates = updates.filter(u => {
          const updateDeviceId = u.deviceId;
          const updateDeviceIdWithoutPrefix = updateDeviceId.replace(/^0x/i, '');
          
          return u.deviceId === deviceIdToMatch || 
                 updateDeviceIdWithoutPrefix === deviceIdWithoutPrefix ||
                 u.deviceId === deviceIdWithoutPrefix ||
                 updateDeviceIdWithoutPrefix === deviceIdToMatch;
        });
      }
    }
    return updates;
  }, [otaUpdates, selectedDeviceId, devices]);
  const pagedUpdates = filteredUpdates.slice((updatesPage - 1) * UPDATES_PER_PAGE, updatesPage * UPDATES_PER_PAGE);
  const totalUpdatesPages = Math.ceil(filteredUpdates.length / UPDATES_PER_PAGE);

  // Summary counts
  const successCount = filteredUpdates.filter(u => normalizeStatus(u.status) === 'Success').length;
  const failedCount = filteredUpdates.filter(u => normalizeStatus(u.status) === 'Failed').length;

  // --- UI helpers for pill badges ---
  const getDeviceStatusBadge = (status) => {
    const map = {
      online: 'text-blue-700',
      offline: 'text-red-700',
      updating: 'text-yellow-700',
    };
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return <span className={`px-3 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{label}</span>;
  };
  const getUpdateStatusBadge = (status) => {
    const map = {
      Success: 'text-blue-700',
      Failed: 'text-red-700',
      'In Progress': 'text-gray-700',
      Scheduled: 'text-yellow-700',
    };
    return <span className={`px-3 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'scheduled': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      'paused': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    };

    const statusIcons = {
      'in-progress': <Clock className="h-3 w-3" />,
      'completed': <CheckCircle className="h-3 w-3" />,
      'scheduled': <Clock className="h-3 w-3" />,
      'failed': <AlertTriangle className="h-3 w-3" />,
      'paused': <Pause className="h-3 w-3" />
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
        {statusIcons[status]}
        <span className="ml-1 capitalize">{status.replace('-', ' ')}</span>
      </span>
    );
  };

  const getProgressBar = (progress, status) => {
    const getColor = () => {
      if (status === 'failed') return 'bg-red-600';
      if (status === 'completed') return 'bg-green-600';
      return 'bg-blue-600';
    };

    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getColor()}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUpdates(filteredUpdates.map(update => update.id));
    } else {
      setSelectedUpdates([]);
    }
  };

  const handleSelectUpdate = (updateId) => {
    if (selectedUpdates.includes(updateId)) {
      setSelectedUpdates(selectedUpdates.filter(id => id !== updateId));
    } else {
      setSelectedUpdates([...selectedUpdates, updateId]);
    }
  };

  // Export OTA Updates data
  const exportOTAUpdatesData = () => {
    const selectedDevice = filteredDevices.find(d => d._id === selectedDeviceId);
    const selectedProjectData = projects.find(p => p._id === selectedProject?.value);
    
    const data = [
      {
        sheet: 'OTA Updates Summary',
        data: [
          { 'Export Date': new Date().toLocaleDateString() },
          { 'Export Time': new Date().toLocaleTimeString() },
          { 'Selected Project': selectedProjectData?.projectName || 'All Projects' },
          { 'Selected Device': selectedDevice?.name || 'All Devices' },
          { 'Total Updates': filteredUpdates.length },
          { 'Success Count': filteredUpdates.filter(u => normalizeStatus(u.status) === 'Success').length },
          { 'Failed Count': filteredUpdates.filter(u => normalizeStatus(u.status) === 'Failed').length },
          { 'In Progress Count': filteredUpdates.filter(u => normalizeStatus(u.status) === 'In Progress').length },
          { 'Success Rate': `${((filteredUpdates.filter(u => normalizeStatus(u.status) === 'Success').length / filteredUpdates.length) * 100).toFixed(1)}%` }
        ]
      },
      {
        sheet: 'OTA Updates Details',
        data: filteredUpdates.map(update => ({
          'PIC ID': update.pic_id || 'N/A',
          'Device ID': update.deviceId,
          'Device Name': devices.find(d => d.deviceId === update.deviceId)?.name || 'Unknown',
          'Status': update.status,
          'Normalized Status': normalizeStatus(update.status),
          'Previous Version': update.previousVersion || 'N/A',
          'Updated Version': update.updatedVersion || 'N/A',
          'Update Date': update.date ? new Date(update.date).toLocaleDateString() : 'N/A',
          'Update Time': update.date ? new Date(update.date).toLocaleTimeString() : 'N/A',
          'Full Date': update.date ? new Date(update.date).toISOString() : 'N/A',
          'Project': selectedProjectData?.projectName || 'N/A'
        }))
      },
      {
        sheet: 'Device Information',
        data: filteredDevices.map(device => ({
          'Device Name': device.name,
          'Device ID': device.deviceId,
          'Project': selectedProjectData?.projectName || 'N/A',
          'Status': device.status || 'Active',
          'Date Created': device.dateCreated ? new Date(device.dateCreated).toLocaleDateString() : 'N/A',
          'Total Updates': filteredUpdates.filter(u => u.deviceId === device.deviceId).length,
          'Success Count': filteredUpdates.filter(u => u.deviceId === device.deviceId && normalizeStatus(u.status) === 'Success').length,
          'Failed Count': filteredUpdates.filter(u => u.deviceId === device.deviceId && normalizeStatus(u.status) === 'Failed').length,
          'Success Rate': (() => {
            const deviceUpdates = filteredUpdates.filter(u => u.deviceId === device.deviceId);
            return deviceUpdates.length > 0 
              ? `${((deviceUpdates.filter(u => normalizeStatus(u.status) === 'Success').length / deviceUpdates.length) * 100).toFixed(1)}%`
              : '0%';
          })()
        }))
      }
    ];

    const wb = XLSX.utils.book_new();
    data.forEach(({ sheet, data }) => {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheet);
    });
    
    const fileName = `OTA_Updates_${selectedProjectData?.projectName || 'All'}_${selectedDevice?.name || 'AllDevices'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="min-h-screen py-8 px-2 sm:px-6 md:px-12 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OTA Updates</h1>
        <button
          onClick={exportOTAUpdatesData}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </button>
      </div>
      {/* Project and Device Selection */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
        <Select
          className="min-w-[220px]"
          classNamePrefix="react-select"
          options={projects.map(p => ({ value: p._id, label: p.projectName }))}
          isClearable
          placeholder="Select project..."
          value={selectedProject}
          onChange={option => { setSelectedProject(option); setSelectedDeviceId(null); setDevicePage(1); }}
        />
        <Select
          className="min-w-[220px]"
          classNamePrefix="react-select"
          options={filteredDevices.map(d => ({ value: d._id, label: `${d.name} (${d.deviceId})` }))}
          isClearable
          placeholder="Select device..."
          value={selectedDeviceId ? { value: selectedDeviceId, label: (filteredDevices.find(d => d._id === selectedDeviceId)?.name || '') + ' (' + (filteredDevices.find(d => d._id === selectedDeviceId)?.deviceId || '') + ')' } : null}
          onChange={option => setSelectedDeviceId(option ? option.value : null)}
          isDisabled={!selectedProject}
        />
      </div>
      {/* Main Content: OTA Updates History Only */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">OTA Updates History</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400 mb-4">{selectedDeviceId ? `Showing updates for ${filteredDevices.find(d => d._id === selectedDeviceId)?.name}` : 'Showing all updates. Select a device to filter.'}</span>
          {loading && <div className="p-4 text-center text-gray-500">Loading...</div>}
          {error && <div className="p-4 text-center text-red-500">{error}</div>}
          <div className="overflow-x-auto rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">PIC ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Device ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Previous Version</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Updated Version</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {pagedUpdates.map(update => (
                  <tr key={update._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{update.pic_id}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{update.deviceId}</td>
                    <td className="px-4 py-2">
                      {normalizeStatus(update.status) === 'Success' && <span className="inline-block px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">{update.status}</span>}
                      {normalizeStatus(update.status) === 'Failed' && <span className="inline-block px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold">{update.status}</span>}
                      {normalizeStatus(update.status) === 'In Progress' && <span className="inline-block px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">{update.status}</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{update.previousVersion}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{update.updatedVersion}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{update.date ? new Date(update.date).toLocaleString() : ''}</td>
                  </tr>
                ))}
                {pagedUpdates.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-2 text-center text-gray-400 dark:text-gray-500">No updates found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex justify-end items-center mt-3 gap-2">
            <button
              className="px-4 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-200 disabled:opacity-50"
              onClick={() => setUpdatesPage(p => Math.max(1, p - 1))}
              disabled={updatesPage === 1}
            >Previous</button>
            <button
              className="px-4 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-200 disabled:opacity-50"
              onClick={() => setUpdatesPage(p => Math.min(totalUpdatesPages, p + 1))}
              disabled={updatesPage === totalUpdatesPages}
            >Next</button>
        </div>
      </div>
    </div>
  );
};

export default OTAUpdates; 