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
  BarChart3,
  ChevronDown,
  ChevronRight
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
  const [expandedStatus, setExpandedStatus] = useState(new Set());

  // Toggle expanded status
  const toggleExpanded = (updateId) => {
    const newExpanded = new Set(expandedStatus);
    if (newExpanded.has(updateId)) {
      newExpanded.delete(updateId);
    } else {
      newExpanded.add(updateId);
    }
    setExpandedStatus(newExpanded);
  };

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

  // Summary counts - now based on final status
  const successCount = filteredUpdates.filter(u => u.finalStatus === 'success').length;
  const failedCount = filteredUpdates.filter(u => u.finalStatus === 'failed').length;
  const pendingCount = filteredUpdates.filter(u => u.finalStatus === 'pending').length;

  // Helper function to get status badge based on status code
  const getStatusBadge = (update) => {
    const hasStatusManagement = update.hasStatusManagement;
    const summary = update.summary;
    const isExpanded = expandedStatus.has(update._id);
    
    // If no status entries, show basic status
    if (!update.statusEntries || update.statusEntries.length === 0) {
      const statusCode = parseInt(update.status);
      
      if (isNaN(statusCode)) {
        return (
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {update.status}
              </span>
            </div>
            {update.statusMessage && update.statusMessage !== update.status && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                {update.statusMessage}
              </span>
            )}
          </div>
        );
      }
      
      // Single status code display
      let badgeConfig = {
        bgColor: 'bg-gray-50 dark:bg-gray-900/20',
        textColor: 'text-gray-700 dark:text-gray-300',
        borderColor: 'border-gray-200 dark:border-gray-800',
        icon: <Clock className="h-3 w-3" />,
        codeBg: 'bg-gray-100 dark:bg-gray-800',
        codeText: 'text-gray-800 dark:text-gray-200'
      };
      
      if (statusCode === 2 || statusCode === 3) {
        badgeConfig = {
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-700 dark:text-green-300',
          borderColor: 'border-green-200 dark:border-green-800',
          icon: <CheckCircle className="h-3 w-3" />,
          codeBg: 'bg-green-100 dark:bg-green-800',
          codeText: 'text-green-800 dark:text-green-200'
        };
      } else {
        // All other codes (including -1, -2, 0, 1, etc.) are considered failures
        badgeConfig = {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          textColor: 'text-red-700 dark:text-red-300',
          borderColor: 'border-red-200 dark:border-red-800',
          icon: <AlertTriangle className="h-3 w-3" />,
          codeBg: 'bg-red-100 dark:bg-red-800',
          codeText: 'text-red-800 dark:text-red-200'
        };
      }
      
      const displayMessage = update.statusMessage && update.statusMessage !== update.status 
        ? update.statusMessage 
        : update.status;
      
      return (
        <div className="flex flex-col space-y-2">
          <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${badgeConfig.bgColor} ${badgeConfig.borderColor}`}>
            <div className="flex items-center space-x-2">
              {badgeConfig.icon}
              <div className={`px-2 py-1 rounded text-xs font-bold ${badgeConfig.codeBg} ${badgeConfig.codeText}`}>
                {update.status}
              </div>
              <span className={`text-sm font-medium ${badgeConfig.textColor} max-w-xs truncate`} title={displayMessage}>
                {displayMessage}
              </span>
            </div>
          </div>
        </div>
      );
    }
    
    // Multiple attempts - show tree structure
    const latestEntry = update.statusEntries[update.statusEntries.length - 1];
    const latestStatusCode = parseInt(latestEntry.status);
    
    let badgeConfig = {
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      textColor: 'text-gray-700 dark:text-gray-300',
      borderColor: 'border-gray-200 dark:border-gray-800',
      icon: <Clock className="h-3 w-3" />,
      codeBg: 'bg-gray-100 dark:bg-gray-800',
      codeText: 'text-gray-800 dark:text-gray-200'
    };
    
    if (latestStatusCode === 2 || latestStatusCode === 3) {
      badgeConfig = {
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-800',
        icon: <CheckCircle className="h-3 w-3" />,
        codeBg: 'bg-green-100 dark:bg-green-800',
        codeText: 'text-green-800 dark:text-green-200'
      };
    } else {
      // All other codes (including -1, -2, 0, 1, etc.) are considered failures
      badgeConfig = {
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        textColor: 'text-red-700 dark:text-red-300',
        borderColor: 'border-red-200 dark:border-red-800',
        icon: <AlertTriangle className="h-3 w-3" />,
        codeBg: 'bg-red-100 dark:bg-red-800',
        codeText: 'text-red-800 dark:text-red-200'
      };
    }
    
    const displayMessage = latestEntry.statusMessage && latestEntry.statusMessage !== latestEntry.status 
      ? latestEntry.statusMessage 
      : latestEntry.status;
    
    return (
      <div className="flex flex-col space-y-2">
        {/* Main Status Badge (Clickable) */}
        <button
          onClick={() => toggleExpanded(update._id)}
          className={`inline-flex items-center px-3 py-2 rounded-lg border ${badgeConfig.bgColor} ${badgeConfig.borderColor} hover:shadow-sm transition-all duration-150 cursor-pointer`}
        >
          <div className="flex items-center space-x-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            {badgeConfig.icon}
            <div className={`px-2 py-1 rounded text-xs font-bold ${badgeConfig.codeBg} ${badgeConfig.codeText}`}>
              {latestEntry.status}
            </div>
            <span className={`text-sm font-medium ${badgeConfig.textColor} max-w-xs truncate`} title={displayMessage}>
              {displayMessage}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              ({summary.totalAttempts} attempts)
            </span>
          </div>
        </button>
        
        {/* Expanded Attempt Tree */}
        {isExpanded && (
          <div className="ml-6 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            {update.statusEntries.map((entry, index) => {
              const statusCode = parseInt(entry.status);
              let entryBadgeConfig = {
                bgColor: 'bg-gray-50 dark:bg-gray-900/20',
                textColor: 'text-gray-700 dark:text-gray-300',
                borderColor: 'border-gray-200 dark:border-gray-800',
                icon: <Clock className="h-3 w-3" />,
                codeBg: 'bg-gray-100 dark:bg-gray-800',
                codeText: 'text-gray-800 dark:text-gray-200'
              };
              
              if (statusCode === 2 || statusCode === 3) {
                entryBadgeConfig = {
                  bgColor: 'bg-green-50 dark:bg-green-900/20',
                  textColor: 'text-green-700 dark:text-green-300',
                  borderColor: 'border-green-200 dark:border-green-800',
                  icon: <CheckCircle className="h-3 w-3" />,
                  codeBg: 'bg-green-100 dark:bg-green-800',
                  codeText: 'text-green-800 dark:text-green-200'
                };
              } else {
                // All other codes (including -1, -2, 0, 1, etc.) are considered failures
                entryBadgeConfig = {
                  bgColor: 'bg-red-50 dark:bg-red-900/20',
                  textColor: 'text-red-700 dark:text-red-300',
                  borderColor: 'border-red-200 dark:border-red-800',
                  icon: <AlertTriangle className="h-3 w-3" />,
                  codeBg: 'bg-red-100 dark:bg-red-800',
                  codeText: 'text-red-800 dark:text-red-200'
                };
              }
              
              const entryDisplayMessage = entry.statusMessage && entry.statusMessage !== entry.status 
                ? entry.statusMessage 
                : entry.status;
              
              return (
                <div key={index} className="flex flex-col space-y-1">
                  <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${entryBadgeConfig.bgColor} ${entryBadgeConfig.borderColor}`}>
                    <div className="flex items-center space-x-2">
                      {entryBadgeConfig.icon}
                      <div className={`px-2 py-1 rounded text-xs font-bold ${entryBadgeConfig.codeBg} ${entryBadgeConfig.codeText}`}>
                        {entry.status}
                      </div>
                      <span className={`text-sm font-medium ${entryBadgeConfig.textColor} max-w-xs truncate`} title={entryDisplayMessage}>
                        {entryDisplayMessage}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        (Attempt {entry.attemptNumber})
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                    {new Date(entry.date).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {!hasStatusManagement && (
          <div className="flex items-center space-x-1 ml-1">
            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              No status management configured
            </span>
          </div>
        )}
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
          { 'Total Records': filteredUpdates.length },
          { 'Final Success Count': successCount },
          { 'Final Failure Count': failedCount },
          { 'Pending Count': pendingCount },
          { 'Total Attempts': filteredUpdates.reduce((sum, u) => sum + (u.summary?.totalAttempts || 0), 0) },
          { 'Success Rate': `${((successCount / filteredUpdates.length) * 100).toFixed(1)}%` }
        ]
      },
      {
        sheet: 'OTA Updates Details',
        data: filteredUpdates.map(update => ({
          'PIC ID': update.pic_id || 'N/A',
          'Device ID': update.deviceId,
          'Device Name': devices.find(d => d.deviceId === update.deviceId)?.name || 'Unknown',
          'Latest Status Code': update.status,
          'Latest Status Message': update.statusMessage || update.status,
          'Final Status': update.summary?.finalStatus || 'N/A',
          'Total Attempts': update.summary?.totalAttempts || 0,
          'Success Attempts': update.summary?.successAttempts || 0,
          'Failure Attempts': update.summary?.failureAttempts || 0,
          'Has Status Management': update.hasStatusManagement ? 'Yes' : 'No',
          'Previous Version': update.previousVersion || 'N/A',
          'Updated Version': update.updatedVersion || 'N/A',
          'Initial Date': update.date ? new Date(update.date).toLocaleDateString() : 'N/A',
          'Last Updated': update.lastUpdated ? new Date(update.lastUpdated).toLocaleDateString() : 'N/A',
          'Last Updated Time': update.lastUpdated ? new Date(update.lastUpdated).toLocaleTimeString() : 'N/A',
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
          'Total Records': filteredUpdates.filter(u => u.deviceId === device.deviceId).length,
          'Final Success Count': filteredUpdates.filter(u => u.deviceId === device.deviceId && u.finalStatus === 'success').length,
          'Final Failure Count': filteredUpdates.filter(u => u.deviceId === device.deviceId && u.finalStatus === 'failed').length,
          'Total Attempts': filteredUpdates.filter(u => u.deviceId === device.deviceId).reduce((sum, u) => sum + (u.summary?.totalAttempts || 0), 0),
          'Success Rate': (() => {
            const deviceUpdates = filteredUpdates.filter(u => u.deviceId === device.deviceId);
            const deviceSuccessCount = deviceUpdates.filter(u => u.finalStatus === 'success').length;
            return deviceUpdates.length > 0 
              ? `${((deviceSuccessCount / deviceUpdates.length) * 100).toFixed(1)}%`
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
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    PIC ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Device ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Attempts
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Previous Version
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Updated Version
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {pagedUpdates.map(update => (
                  <tr key={update._id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">
                      {update.pic_id}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {update.deviceId}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(update)}
                    </td>
                    <td className="px-6 py-4">
                      {update.summary && (
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {update.summary.totalAttempts}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {update.previousVersion}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {update.updatedVersion}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {update.lastUpdated ? new Date(update.lastUpdated).toLocaleString() : ''}
                    </td>
                  </tr>
                ))}
                {pagedUpdates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <Clock className="h-6 w-6 text-gray-400" />
                        </div>
                        <span className="text-sm font-medium">No updates found</span>
                        <span className="text-xs">Select a device to see its update history</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex justify-between items-center mt-6 px-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {((updatesPage - 1) * UPDATES_PER_PAGE) + 1} to {Math.min(updatesPage * UPDATES_PER_PAGE, filteredUpdates.length)} of {filteredUpdates.length} updates
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                onClick={() => setUpdatesPage(p => Math.max(1, p - 1))}
                disabled={updatesPage === 1}
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Page {updatesPage} of {totalUpdatesPages}
              </span>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                onClick={() => setUpdatesPage(p => Math.min(totalUpdatesPages, p + 1))}
                disabled={updatesPage === totalUpdatesPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
    </div>
  );
};

export default OTAUpdates; 