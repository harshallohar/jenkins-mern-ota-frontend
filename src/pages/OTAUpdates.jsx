import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { RefreshCw, Trash2, Download } from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';
import './react-select-tailwind.css';

const DEVICES_API = `${BACKEND_BASE_URL}/devices`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;
const OTA_LIST_API = `${BACKEND_BASE_URL}/ota-updates`;

function Badge({ badge, color, children }) {
  const base = 'px-2 py-0.5 rounded text-xs font-medium';
  const byBadge = badge === 'success'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    : badge === 'failure'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  const style = color ? { borderLeft: `4px solid ${color}` } : {};
  return <span className={`${base} ${byBadge}`} style={style}>{children}</span>;
}

export default function OTAUpdates() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [cards, setCards] = useState({ success: 0, failure: 0, other: 0, total: 0 });
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  const [userRole, setUserRole] = useState(null);

  // New UI states for badge filter + version search
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all'|'success'|'failure'|'other'
  const [versionInput, setVersionInput] = useState(''); // what user types
  const [versionQuery, setVersionQuery] = useState(''); // applied query (set on Search)

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserRole(parsed.role);
      } catch {}
    }
  }, []);

  // Load projects and devices
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const [pRes, dRes] = await Promise.all([
          fetch(PROJECTS_API, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(DEVICES_API, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const [pData, dData] = await Promise.all([pRes.json(), dRes.json()]);
        setProjects(Array.isArray(pData) ? pData : []);
        setDevices(Array.isArray(dData) ? dData : []);
      } catch (e) {
        setProjects([]);
        setDevices([]);
      }
    };
    fetchMeta();
  }, []);

  // Auto-select default project (first) after load
  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      const first = projects[0];
      setSelectedProject({ value: first._id, label: first.projectName });
    }
  }, [projects, selectedProject]);

  // Auto-select first device under selected project
  useEffect(() => {
    if (!selectedProject || devices.length === 0) return;
    const projectDevices = devices.filter(d => d.project === selectedProject.value);
    if (projectDevices.length === 0) {
      setSelectedDevice(null);
      return;
    }
    const isCurrentValid = selectedDevice && projectDevices.some(d => d.deviceId === selectedDevice.value);
    if (!isCurrentValid) {
      const d0 = projectDevices[0];
      setSelectedDevice({ value: d0.deviceId, label: `${d0.name} (${d0.deviceId})` });
    }
  }, [selectedProject, devices]);

  const projectOptions = useMemo(() => projects.map(p => ({ value: p._id, label: p.projectName })), [projects]);
  const deviceOptions = useMemo(() => {
    if (!selectedProject) return [];
    return devices
      .filter(d => d.project === selectedProject.value)
      .map(d => ({ value: d.deviceId, label: `${d.name} (${d.deviceId})` }));
  }, [devices, selectedProject]);

  // filteredUpdates: page items after local device/project filter (still paginated)
  const filteredUpdates = useMemo(() => {
    // updates are already filtered server-side by device/project/badge/version for the page
    return updates;
  }, [updates]);

  // Helper: compute counts from a list (used only as fallback if server didn't return counts)
  const computeCardsFromUpdates = (list) => {
    let success = 0, failure = 0, other = 0, total = 0;
    for (const u of list) {
      total += 1;
      if (u.badge === 'success') success += 1;
      else if (u.badge === 'failure') failure += 1;
      else other += 1;
    }
    return { success, failure, other, total };
  };

  // fetchData: uses badgeFilter and versionQuery to request page + counts from server
  const fetchData = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', pagination.limit.toString());

      if (selectedDevice) params.set('deviceId', selectedDevice.value);
      if (selectedProject) params.set('projectId', selectedProject.value);
      if (badgeFilter && badgeFilter !== 'all') params.set('badge', badgeFilter);
      if (versionQuery && versionQuery.trim() !== '') params.set('versionQuery', versionQuery.trim());

      const token = localStorage.getItem('authToken');
      const listUrl = `${OTA_LIST_API}?${params.toString()}`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!listRes.ok) throw new Error('Failed to load updates');
      const listData = await listRes.json();

      if (listData.success) {
        setUpdates(Array.isArray(listData.data) ? listData.data : []);
        setPagination({
          page: listData.pagination.page,
          limit: listData.pagination.limit,
          total: listData.pagination.total,
          pages: listData.pagination.pages
        });

        if (listData.counts) {
          setCards({
            success: listData.counts.success || 0,
            failure: listData.counts.failure || 0,
            other: listData.counts.other || 0,
            total: listData.counts.total || ((listData.counts.success||0) + (listData.counts.failure||0) + (listData.counts.other||0))
          });
        } else {
          // fallback: compute from whole received page (not ideal)
          setCards(computeCardsFromUpdates(listData.data || []));
        }
      } else {
        setUpdates([]);
        setPagination({ page: 1, limit: 50, total: 0, pages: 0 });
        setCards({ success: 0, failure: 0, other: 0, total: 0 });
      }
    } catch (e) {
      setError(e.message || 'Error loading data');
      setUpdates([]);
      setCards({ success: 0, failure: 0, other: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  // On project/device change -> reload first page and clear version filters
  useEffect(() => {
    setVersionInput('');
    setVersionQuery('');
    // Fetch first page
    if (selectedProject) fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedDevice]);

  // When badgeFilter changes -> clear versionInput & applied versionQuery and fetch
  useEffect(() => {
    setVersionInput('');
    setVersionQuery('');
    if (selectedProject) fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badgeFilter]);

  // Selection state for bulk delete
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => {
    const ids = new Set(filteredUpdates.map(u => u._id));
    setSelectedIds(ids);
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleDelete = async (id) => {
    if (!id) return;
    if (!confirm('Delete this OTA update record?')) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${OTA_LIST_API}/${id}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchData(pagination.page);
      clearSelection();
    } catch (e) {
      alert(e.message || 'Error deleting');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected record(s)?`)) return;
    try {
      const token = localStorage.getItem('authToken');
      await Promise.all(ids.map(id => fetch(`${OTA_LIST_API}/${id}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })));
      await fetchData(pagination.page);
      clearSelection();
    } catch (e) {
      alert(e.message || 'Bulk delete failed');
    }
  };

  const exportOTAUpdates = async () => {
    setExporting(true);
    try {
      // For export we will request server page with limit large enough to capture all matching records
      // Alternatively you can hit a dedicated export endpoint. For now we'll reuse current fetched items if present,
      // otherwise alert that export requires current page data.
      const exportData = updates.length > 0 ? updates : [];
      if (exportData.length === 0) {
        alert('No data to export (please ensure results are loaded)');
        return;
      }

      const headers = [
        'Timestamp','PIC ID','Device ID','Device Name','Project','Previous Version','Updated Version','Status','Status Message','Badge','Color'
      ];

      const rows = exportData.map(update => [
        new Date(update.timestamp || update.createdAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
        `"${update.pic_id}"`,
        update.deviceId,
        devices.find(d => d.deviceId === update.deviceId)?.name || 'Unknown',
        projects.find(p => p._id === devices.find(d => d.deviceId === update.deviceId)?.project)?.projectName || 'Unassigned',
        update.previousVersion,
        update.updatedVersion,
        update.status,
        update.statusMessage || '',
        update.badge,
        update.color || ''
      ]);

      const summaryRows = [
        ['OTA Updates Export Summary'],
        [''],
        ['Export Date', new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })],
        ['Export Time', new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })],
        ['Project', selectedProject ? selectedProject.label : 'All Projects'],
        ['Device', selectedDevice ? selectedDevice.label : 'All Devices'],
        ['Total Records', exportData.length],
        ['Success Count', exportData.filter(u => u.badge === 'success').length],
        ['Failure Count', exportData.filter(u => u.badge === 'failure').length],
        ['Other Count', exportData.filter(u => u.badge === 'other').length],
        [''],
        ['IMPORTANT: If you see "###" in Excel, double-click the column header to auto-resize the column width'],
        ['NOTE: PIC IDs are wrapped in quotes to preserve their full length in Excel'],
        [''],
        ['Detailed OTA Updates Report'],
        [''],
        headers
      ];

      const allRows = [...summaryRows, ...rows];

      const csv = allRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let filename = 'ota_updates_export';
      if (selectedProject) filename += `_${selectedProject.label.replace(/\s+/g, '_')}`;
      if (selectedDevice) filename += `_${selectedDevice.label.split(' (')[0].replace(/\s+/g, '_')}`;
      filename += `_${new Date().toISOString().slice(0, 10)}.csv`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export OTA updates. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchData(newPage);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // UI helpers: which version field based on badgeFilter
  const versionFieldLabel = () => {
    if (badgeFilter === 'failure') return 'Search previous version';
    return 'Search updated version';
  };

  const handleSearchApply = () => {
    // apply typed input to versionQuery and fetch page 1
    setVersionQuery(versionInput.trim());
    fetchData(1);
  };

  const handleClearSearch = () => {
    setVersionInput('');
    setVersionQuery('');
    fetchData(1);
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="space-y-4">
          {/* Filters Section */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            {/* Main filters row */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="min-w-[200px]">
                <Select
                  classNamePrefix="react-select"
                  placeholder="Select Project"
                  options={projectOptions}
                  value={selectedProject}
                  onChange={(v) => { setSelectedProject(v); setSelectedDevice(null); }}
                  isClearable
                />
              </div>
              <div className="min-w-[260px]">
                <Select
                  classNamePrefix="react-select"
                  placeholder="Select Device (optional)"
                  options={deviceOptions}
                  value={selectedDevice}
                  onChange={setSelectedDevice}
                  isClearable
                  isDisabled={!selectedProject}
                />
              </div>

              {/* Badge Filter */}
              <div className="min-w-[180px]">
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  value={badgeFilter}
                  onChange={(e) => setBadgeFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Action Buttons - Always on right */}
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <button
                onClick={() => fetchData(pagination.page)}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors whitespace-nowrap"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </button>
              <button
                onClick={exportOTAUpdates}
                disabled={updates.length === 0}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-2" /> 
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>

              {userRole === "admin" && (
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${selectedIds.size === 0 ? 'bg-red-300 cursor-not-allowed text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                >
                  Delete Selected ({selectedIds.size})
                </button>
              )}
            </div>
          </div>

          {/* Version search row - Only shown when badge filter is not 'all' */}
          {badgeFilter !== 'all' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  placeholder={versionFieldLabel()}
                  value={versionInput}
                  onChange={(e) => setVersionInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchApply(); }}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  onClick={handleSearchApply}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm transition-colors whitespace-nowrap"
                >
                  Search
                </button>
                <button
                  onClick={handleClearSearch}
                  disabled={!versionInput && !versionQuery}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {(!selectedProject) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800 dark:text-blue-200">
              {!selectedProject ? 'Loading projects...' : 'Loading devices...'}
            </span>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{cards.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Success</div>
          <div className="text-2xl font-semibold text-green-600">{cards.success}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Failure</div>
          <div className="text-2xl font-semibold text-red-600">{cards.failure}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Other</div>
          <div className="text-2xl font-semibold text-yellow-600">{cards.other}</div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">OTA Updates</div>
          {loading && <div className="text-sm text-gray-500">Loading...</div>}
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2">
                  <input type="checkbox" onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()} />
                </th>
                
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PIC ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Device</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">From → To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {filteredUpdates.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading...' : 'No updates found'}
                  </td>
                </tr>
              )}
              {filteredUpdates.map(update => (
                <tr key={update._id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-2">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(update._id)} 
                      onChange={() => toggleSelected(update._id)} 
                    />
                  </td>
                  
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono text-xs">
                    {update.pic_id}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">
                    {update.deviceId}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {update.previousVersion} → {update.updatedVersion}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <Badge badge={update.badge} color={update.color}>
                      {update.statusMessage || update.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                    {formatTimestamp(update.timestamp || update.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(update._id)}
                      className="inline-flex items-center px-2 py-1 text-sm text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} total records)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                {pagination.page}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}