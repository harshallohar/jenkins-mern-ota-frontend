import { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Filter as FilterIcon, Search as SearchIcon, Trash2 } from 'lucide-react';
import UploadFirmwareModal from '../components/UploadFirmwareModal';
import { BACKEND_BASE_URL } from '../utils/api';
import Select from 'react-select';

const PAGE_SIZE = 5;

const FirmwareManagement = () => {
  const [firmwares, setFirmwares] = useState([]);
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const fileInputRef = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const user = JSON.parse(localStorage.getItem('user'));

  const FIRMWARE_API = `${BACKEND_BASE_URL}/firmware`;
  const DEVICES_API = `${BACKEND_BASE_URL}/devices`;
  const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;

  // Fetch firmwares
  const fetchFirmwares = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${FIRMWARE_API}/firmwares-details`);
      const data = await res.json();
      setFirmwares(data);
    } catch (err) {
      setError('Failed to fetch firmwares');
    }
    setLoading(false);
  };

  // Fetch devices
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
      // ignore for now
    }
  };

  // Fetch projects (for all users - admin sees all, regular users see only assigned)
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(PROJECTS_API, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        setProjects([]);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchFirmwares();
    fetchDevices();
  }, []);

  // Defensive: if devices is not an array, show error
  if (!Array.isArray(devices)) {
    return <div className="p-8 text-center text-red-500 font-semibold">Error loading devices.</div>;
  }
  
  // Filter devices by selected project (for all users)
  const filteredDevices = selectedProject
    ? devices.filter(d => d.project === selectedProject.value)
    : devices;
  const deviceOptions = filteredDevices.map(d => ({
    value: d.deviceId,
    label: `${d.name} (${d.deviceId})`
  }));

  // Search and filter
  const filteredFirmwares = firmwares.filter(fw => {
    const device = devices.find(d => d.deviceId === fw.esp_id);
    const deviceName = device ? device.name : '';
    return (
      fw.version.toLowerCase().includes(search.toLowerCase()) ||
      (fw.uploadedDate && new Date(fw.uploadedDate).toLocaleDateString().includes(search)) ||
      deviceName.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredFirmwares.length / PAGE_SIZE);
  const pagedFirmwares = filteredFirmwares.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Upload firmware
  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('version', version);
      formData.append('description', description);
      formData.append('esp_id', selectedDevice?.value);
      formData.append('file', file);
      await fetch(`${FIRMWARE_API}/upload`, {
        method: 'POST',
        body: formData
      });
      setShowUploadModal(false);
      setVersion('');
      setDescription('');
      setFile(null);
      setSelectedDevice(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFirmwares();
    } catch (err) {
      setError('Failed to upload firmware');
      setLoading(false);
    }
  };

  // Download selected firmwares
  const handleDownloadSelected = async () => {
    if (selectedRows.length === 0) {
      alert('No firmware selected');
      return;
    }
    for (const id of selectedRows) {
      const fw = firmwares.find(f => f._id === id);
      try {
        const res = await fetch(`${FIRMWARE_API}/download/${id}`);
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fw?.fileName || 'firmware.bin';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Download failed for ${fw?.fileName || id}`);
      }
    }
  };

  // Download a single firmware by ID
  const handleDownloadOne = async (fw) => {
    try {
      const res = await fetch(`${FIRMWARE_API}/download/${fw._id}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fw.originalFileName || fw.fileName || 'firmware.bin';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed for ${fw.originalFileName || fw.fileName || fw._id}`);
    }
  };

  // Delete firmware
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this firmware?')) return;
    setLoading(true);
    setError('');
    try {
      await fetch(`${FIRMWARE_API}/delete/${id}`, { method: 'DELETE' });
      fetchFirmwares();
    } catch (err) {
      setError('Failed to delete firmware');
      setLoading(false);
    }
  };

  // Delete selected firmwares
  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) {
      alert('No firmware selected');
      return;
    }
    if (!window.confirm('Delete all selected firmwares?')) return;
    setLoading(true);
    setError('');
    try {
      for (const id of selectedRows) {
        await fetch(`${FIRMWARE_API}/delete/${id}`, { method: 'DELETE' });
      }
      setSelectedRows([]);
      fetchFirmwares();
    } catch (err) {
      setError('Failed to delete selected firmwares');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-2 sm:px-4 md:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-0">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-8 pt-8 pb-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">All Firmwares</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:justify-end md:items-center">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by version, date, or device name..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:border-blue-400 text-sm"
                />
              </div>
              <button className="flex items-center gap-1 px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium">
                <FilterIcon className="h-4 w-4" /> Filter
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-sm"
                onClick={() => setShowUploadModal(true)}
              >
                <Plus className="h-5 w-5" /> Upload Firmware
              </button>
            </div>
          </div>
          {/* Project selection for non-admin */}
          {user && user.role !== 'admin' && (
            <div className="flex flex-col sm:flex-row gap-4 mb-6 px-8">
              <Select
                className="min-w-[220px]"
                classNamePrefix="react-select"
                options={projects.map(p => ({ value: p._id, label: p.projectName }))}
                isClearable
                placeholder="Select project..."
                value={selectedProject}
                onChange={option => { setSelectedProject(option); setSelectedDevice(null); }}
              />
            </div>
          )}
          {/* Table/List */}
          {loading && <div className="p-6 text-center text-gray-500">Loading...</div>}
          {error && <div className="p-6 text-center text-red-500">{error}</div>}
          <div className="overflow-x-auto px-8">
            {/* Download/Delete Selected Buttons - only show if something is selected */}
            {selectedRows.length > 0 && (
              <div className="flex items-center mb-2 gap-2">
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-sm disabled:opacity-50"
                  onClick={handleDownloadSelected}
                >
                  <Upload className="h-4 w-4 rotate-180" /> Download Selected
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white font-semibold shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition text-sm disabled:opacity-50"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="h-4 w-4" /> Delete Selected
                </button>
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead>
                <tr className="bg-white dark:bg-gray-800">
                  <th className="py-3 text-left font-semibold text-gray-500 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={pagedFirmwares.length > 0 && pagedFirmwares.every(fw => selectedRows.includes(fw._id))}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedRows(prev => Array.from(new Set([...prev, ...pagedFirmwares.map(fw => fw._id)])));
                        } else {
                          setSelectedRows(prev => prev.filter(id => !pagedFirmwares.map(fw => fw._id).includes(id)));
                        }
                      }}
                    />
                  </th>
                  <th className="py-3 text-left font-semibold text-gray-500 dark:text-gray-300">VERSION</th>
                  <th className="py-3 text-left font-semibold text-gray-500 dark:text-gray-300">DESCRIPTION</th>
                  <th className="py-3 text-left font-semibold text-gray-500 dark:text-gray-300">SELECTED DEVICE</th>
                  <th className="py-3 text-left font-semibold text-gray-500 dark:text-gray-300">DATE UPLOADED</th>
                  <th className="py-3 text-left font-semibold text-gray-500 dark:text-gray-300">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800">
                {pagedFirmwares.map(fw => {
                  const device = devices.find(d => d.deviceId === fw.esp_id);
                  return (
                    <tr key={fw._id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                      <td className="py-4 pr-2 align-top">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(fw._id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedRows(prev => [...prev, fw._id]);
                            } else {
                              setSelectedRows(prev => prev.filter(id => id !== fw._id));
                            }
                          }}
                        />
                      </td>
                      <td className="py-4 pr-4 align-top font-semibold text-gray-900 dark:text-white">{fw.version}</td>
                      <td className="py-4 pr-4 align-top max-w-xs truncate text-gray-700 dark:text-gray-200">{fw.description}</td>
                      <td className="py-4 pr-4 align-top text-gray-900 dark:text-white">{device ? `${device.name} (${device.deviceId})` : fw.esp_id}</td>
                      <td className="py-4 pr-4 align-top text-gray-500 dark:text-gray-400">{fw.uploadedDate ? new Date(fw.uploadedDate).toLocaleDateString() : ''}</td>
                      <td className="py-4 align-top">
                        <div className="flex gap-2">
                          <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Download" onClick={() => handleDownloadOne(fw)}>
                            <Upload className="h-4 w-4 rotate-180" />
                          </button>
                          <button className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete" onClick={() => handleDelete(fw._id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pagedFirmwares.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">No firmwares found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-8 py-4 border-t border-gray-100 dark:border-gray-700 text-sm">
            <div className="text-gray-500">Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredFirmwares.length)} of {filteredFirmwares.length} results</div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-400" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
              <button className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-400" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        </div>
        {/* Upload Modal */}
        <UploadFirmwareModal
          show={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          projectOptions={projects.map(p => ({ value: p._id, label: p.projectName }))}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          filteredDeviceOptions={deviceOptions}
          selectedDevice={selectedDevice}
          setSelectedDevice={setSelectedDevice}
          version={version}
          setVersion={setVersion}
          description={description}
          setDescription={setDescription}
          file={file}
          setFile={setFile}
          fileInputRef={fileInputRef}
          handleDrop={e => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              setFile(e.dataTransfer.files[0]);
            }
          }}
          handleFileChange={e => {
            if (e.target.files && e.target.files[0]) {
              setFile(e.target.files[0]);
            }
          }}
          handleUpload={handleUpload}
        />
      </div>
    </div>
  );
};

export default FirmwareManagement; 