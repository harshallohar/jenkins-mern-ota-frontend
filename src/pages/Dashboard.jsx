import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { RefreshCw, Download as DownloadIcon, Trash2, CheckCircle, XCircle, CircleSlash } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { BACKEND_BASE_URL } from '../utils/api';
import './react-select-tailwind.css';

const DEVICES_API = `${BACKEND_BASE_URL}/devices`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;
const DASHBOARD_CHART_API = `${BACKEND_BASE_URL}/dashboard/chart-data`;
const DASHBOARD_TIME_STATS_API = `${BACKEND_BASE_URL}/dashboard/time-stats`;
const DASHBOARD_OTA_UPDATES_API = `${BACKEND_BASE_URL}/dashboard/ota-updates`;
const DASHBOARD_EXPORT_API = `${BACKEND_BASE_URL}/dashboard/export`;
const DASHBOARD_DELETE_API = `${BACKEND_BASE_URL}/dashboard/delete`;


export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [range, setRange] = useState('7'); // 7, 30, 90, custom
  const [customMode, setCustomMode] = useState(false);

  const [userRole, setUserRole] = useState(null);

useEffect(() => {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      setUserRole(parsed.role);
    } catch {}
  }
}, []);

  
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const getStartDateForRange = (days) => {
    const n = parseInt(days, 10);
    if (isNaN(n) || n <= 0) return getTodayDateString();
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1));
    const startYear = d.getFullYear();
    const startMonth = String(d.getMonth() + 1).padStart(2, '0');
    const startDay = String(d.getDate()).padStart(2, '0');
    return `${startYear}-${startMonth}-${startDay}`;
  };

  const [startDateInput, setStartDateInput] = useState(getTodayDateString());
  const [endDateInput, setEndDateInput] = useState(getTodayDateString());
  
  const [chartData, setChartData] = useState({
    barChartData: [],
    pieChartData: [],
    totalCounts: { success: 0, failure: 0, other: 0, total: 0 }
  });
  const [recentUpdates, setRecentUpdates] = useState([]);

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

  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      const first = projects[0];
      setSelectedProject({ value: first._id, label: first.projectName });
    }
  }, [projects, selectedProject]);

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

  useEffect(() => {
    setStartDateInput(getStartDateForRange('7'));
    setEndDateInput(getTodayDateString());
  }, []);

  const projectOptions = useMemo(() => projects.map(p => ({ value: p._id, label: p.projectName })), [projects]);
  const deviceOptions = useMemo(() => {
    if (!selectedProject) return [];
    return devices
      .filter(d => d.project === selectedProject.value)
      .map(d => ({ value: d.deviceId, label: `${d.name} (${d.deviceId})` }));
  }, [devices, selectedProject]);

  const formatDate = (dateString) => {
    const parts = String(dateString).split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateInput = (dateString) => {
    if (!dateString) return '';
    const parts = String(dateString).split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const validateDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end;
  };

  // fetchChartData same as before
  const fetchChartData = async () => {
    setLoading(true);
    setError('');
    try {
      let url = DASHBOARD_CHART_API;
      const params = new URLSearchParams();
      if (customMode && startDateInput && endDateInput) {
        if (!validateDateRange(startDateInput, endDateInput)) {
          setError('Invalid date range: Start date must be before or equal to end date');
          setLoading(false);
          return;
        }
        url = DASHBOARD_TIME_STATS_API;
        params.set('startDate', startDateInput);
        params.set('endDate', endDateInput);
      } else {
        params.set('days', range);
      }
      if (selectedProject) params.set('projectId', selectedProject.value);
      if (selectedDevice) params.set('deviceId', selectedDevice.value);

      const token = localStorage.getItem('authToken');
      const res = await fetch(`${url}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json = await res.json();

      if (json.success && json.data) {
        if (customMode && startDateInput && endDateInput) {
          const daily = (json.data.dailyData || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
          setChartData({
            barChartData: daily,
            pieChartData: [
              { label: 'Success', value: json.data.totalCounts.success, color: '#10B981' },
              { label: 'Failure', value: json.data.totalCounts.failure, color: '#EF4444' },
              { label: 'Other', value: json.data.totalCounts.other, color: '#F59E0B' }
            ],
            totalCounts: json.data.totalCounts || { success: 0, failure: 0, other: 0, total: 0 }
          });
        } else {
          const bars = (json.data.barChartData || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
          const pies = json.data.pieChartData || [];
          setChartData({
            barChartData: bars,
            pieChartData: pies,
            totalCounts: json.data.totalCounts || { success: 0, failure: 0, other: 0, total: 0 }
          });
        }
      }
    } catch (e) {
      setError(e.message || 'Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentUpdates = async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '10');
      if (selectedProject) params.set('projectId', selectedProject.value);
      if (selectedDevice) params.set('deviceId', selectedDevice.value);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${DASHBOARD_OTA_UPDATES_API}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setRecentUpdates(json.data || []);
        }
      }
    } catch (e) {
      console.error('Error fetching recent updates:', e);
    }
  };

  useEffect(() => {
    fetchChartData();
    fetchRecentUpdates();
    if (!customMode) {
      setStartDateInput(getStartDateForRange(range));
      setEndDateInput(getTodayDateString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedDevice, range]);

  useEffect(() => {
    if (customMode) {
      fetchChartData();
      fetchRecentUpdates();
    }
  }, [customMode, startDateInput, endDateInput]);

  const handleQuickRange = (val) => {
    setRange(val);
    setCustomMode(false);
    if (val !== 'custom') {
      setStartDateInput(getStartDateForRange(val));
      setEndDateInput(getTodayDateString());
    }
  };

  const handleUseCustom = () => {
    setCustomMode(true);
    setRange('custom');
  };

  // Export CSV (same as earlier implementation)
  const exportCSV = async () => {
    let exportParams = new URLSearchParams();
    if (customMode && startDateInput && endDateInput) {
      if (!validateDateRange(startDateInput, endDateInput)) {
        alert('Invalid date range: start must be before or equal to end');
        return;
      }
      exportParams.set('startDate', startDateInput);
      exportParams.set('endDate', endDateInput);
    } else {
      const start = getStartDateForRange(range);
      const end = getTodayDateString();
      exportParams.set('startDate', start);
      exportParams.set('endDate', end);
    }
    if (selectedProject) exportParams.set('projectId', selectedProject.value);
    if (selectedDevice) exportParams.set('deviceId', selectedDevice.value);

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${DASHBOARD_EXPORT_API}?${exportParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch export data');
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Export failed');

      const rows = json.data.rows || [];
      const detailHeaders = [
        'Date','Device ID','Outcome','PIC ID','Previous Version','Updated Version','Timestamp (ISO)'
      ];
      const summaryRows = [
        ['Dashboard Export Summary'],[''],
        ['Export Date', new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })],
        ['Export Time', new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })],
        ['Time Range', customMode ? `${startDateInput} to ${endDateInput}` : `Last ${range} days (${getStartDateForRange(range)} to ${getTodayDateString()})`],
        ['Project', selectedProject ? selectedProject.label : 'All Projects'],
        ['Device', selectedDevice ? selectedDevice.label : 'All Devices'],
        ['Total Success', chartData.totalCounts.success],
        ['Total Failure', chartData.totalCounts.failure],
        ['Total Other', chartData.totalCounts.other],
        ['Total Updates', chartData.totalCounts.total],
        [''],['Detailed Records'],[''], detailHeaders
      ];

      const detailRows = rows.map(r => [
        r.date, r.deviceId, r.outcome, r.picID || '', r.previousVersion || '', r.updatedVersion || '', r.timestamp || ''
      ]);

      const allRows = [...summaryRows, ...detailRows];
      const csv = allRows.map(row =>
        row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = customMode
        ? `dashboard_${startDateInput}_to_${endDateInput}_detailed.csv`
        : `dashboard_${getStartDateForRange(range)}_to_${getTodayDateString()}_detailed.csv`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert(error.message || 'Failed to export report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete handler:
   * - Builds the same date range as export
   * - Prompts user with confirm dialog containing exact filters & dates
   * - Calls DELETE /dashboard/delete?confirm=true&...
   */
  const deleteData = async () => {
    // determine start/end for deletion
    let start = '', end = '';
    if (customMode && startDateInput && endDateInput) {
      if (!validateDateRange(startDateInput, endDateInput)) {
        alert('Invalid date range: start must be before or equal to end');
        return;
      }
      start = startDateInput;
      end = endDateInput;
    } else {
      start = getStartDateForRange(range);
      end = getTodayDateString();
    }

    // Build confirmation message
    const filters = [
      `Date range: ${start} → ${end}`,
      selectedProject ? `Project: ${selectedProject.label}` : 'Project: All Projects',
      selectedDevice ? `Device: ${selectedDevice.label}` : 'Device: All Devices'
    ].join('\n');

    const ok = window.confirm(`DELETE Dashboard data — this cannot be undone.\n\n${filters}\n\nAre you sure you want to delete the matching Dashboard records?`);
    if (!ok) return;

    // Build params and call API
    const params = new URLSearchParams();
    params.set('confirm', 'true');
    params.set('startDate', start);
    params.set('endDate', end);
    if (selectedDevice) params.set('deviceId', selectedDevice.value);
    else if (selectedProject) params.set('projectId', selectedProject.value);

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${DASHBOARD_DELETE_API}?${params.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Delete failed');
      }
      alert(`Deleted ${json.deletedCount} Dashboard records (${json.start} to ${json.end}).`);
      // Refresh the dashboard
      fetchChartData();
      fetchRecentUpdates();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.message || 'Delete failed. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Date Range Display */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <span className="font-medium">Current Date Range:</span> 
          {customMode ? (
            <span className="ml-2">{formatDateInput(startDateInput)} to {formatDateInput(endDateInput)}</span>
          ) : (
            <span className="ml-2">Last {range} days (from {formatDateInput(startDateInput)} to {formatDateInput(endDateInput)})</span>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="min-w-[220px]">
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
            <div className="flex items-center gap-2">
              <button onClick={() => handleQuickRange('7')} className={`px-3 py-2 rounded-full text-sm ${!customMode && range==='7' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>7d</button>
              <button onClick={() => handleQuickRange('30')} className={`px-3 py-2 rounded-full text-sm ${!customMode && range==='30' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>30d</button>
              <button onClick={() => handleQuickRange('90')} className={`px-3 py-2 rounded-full text-sm ${!customMode && range==='90' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>90d</button>
              <button onClick={handleUseCustom} className={`px-3 py-2 rounded-full text-sm ${customMode ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>Custom</button>
            </div>
            {customMode && (
              <div className="flex items-center gap-2">
                <input type="date" className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2" value={startDateInput} onChange={(e) => setStartDateInput(e.target.value)} />
                <span className="text-gray-600 dark:text-gray-300">to</span>
                <input type="date" className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2" value={endDateInput} onChange={(e) => setEndDateInput(e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
          <button onClick={fetchChartData} className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </button>

          <button onClick={exportCSV} disabled={loading} className="inline-flex items-center px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <DownloadIcon className="h-4 w-4 mr-2" /> {loading ? 'Exporting...' : 'Export CSV'}
          </button>

          {userRole === "admin" && (
            <button onClick={deleteData} disabled={loading} className="inline-flex items-center px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash2 className="h-4 w-4 mr-2" /> {loading ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
        </div>
      </div>

      {/* (rest of the dashboard UI remains unchanged) */}
      {/* Summary Cards, Charts, Daily Table, Recent Updates — same as earlier component */}
      {/* For brevity, keep the rest of your UI code unchanged (you can re-use the previous component's JSX) */}
      {/* ... */}
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total" value={chartData.totalCounts.total} gradientFrom="from-blue-50" icon={CircleSlash} iconClass="text-blue-600" />
        <StatCard title="Success" value={chartData.totalCounts.success} gradientFrom="from-green-50" icon={CheckCircle} iconClass="text-green-600" valueClass="text-green-600" />
        <StatCard title="Failure" value={chartData.totalCounts.failure} gradientFrom="from-red-50" icon={XCircle} iconClass="text-red-600" valueClass="text-red-600" />
        <StatCard title="Other" value={chartData.totalCounts.other} gradientFrom="from-yellow-50" icon={CircleSlash} iconClass="text-yellow-600" valueClass="text-yellow-600" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">Daily Outcomes</div>
            {loading && <div className="text-sm text-gray-500">Loading...</div>}
            {error && <div className="text-sm text-red-500">{error}</div>}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.barChartData} barCategoryGap={12} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="date" stroke="#9CA3AF" tickFormatter={formatDate} />
                <YAxis stroke="#9CA3AF" allowDecimals={false} />
                <Tooltip labelFormatter={(label) => `Date: ${label}`} formatter={(value, name) => [value, name]} />
                <Legend />
                <Bar dataKey="success" fill="#16a34a" name="Success" radius={[4,4,0,0]} />
                <Bar dataKey="failure" fill="#dc2626" name="Failure" radius={[4,4,0,0]} />
                <Bar dataKey="other" fill="#f59e0b" name="Other" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Outcome Mix Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700">
          <div className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Outcome Mix</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData.pieChartData} dataKey="value" nameKey="label" innerRadius={60} outerRadius={90} label={({ label, value }) => `${label}: ${value}`}>
                  {chartData.pieChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily Table */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">Daily Breakdown</div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Success</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Failure</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Other</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {chartData.barChartData.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No data</td></tr>
              )}
              {chartData.barChartData.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(row => (
                <tr key={`${row.date}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{formatDate(row.date)}</td>
                  <td className="px-4 py-2 text-sm text-green-600">{row.success}</td>
                  <td className="px-4 py-2 text-sm text-red-600">{row.failure}</td>
                  <td className="px-4 py-2 text-sm text-yellow-600">{row.other}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Updates Table */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">Recent OTA Updates</div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PIC ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Device ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Versions</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Badge</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {recentUpdates.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No recent updates</td></tr>
              )}
              {recentUpdates.map(update => (
                <tr key={`${update.pic_id}-${update.timestamp}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{new Date(update.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono text-xs">{update.pic_id?.substring(0,8)}...</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono text-xs">{update.deviceId}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{update.previousVersion} → {update.updatedVersion}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{update.statusMessage}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      update.badge === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : update.badge === 'failure' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>{update.badge}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, value, gradientFrom, icon: Icon, iconClass, valueClass }) {
  return (
    <div className={`rounded-xl p-5 shadow border border-gray-100 dark:border-gray-800 bg-gradient-to-br ${gradientFrom} to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-between`}>
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</div>
        <div className={`mt-1 text-3xl font-semibold text-gray-900 dark:text-white ${valueClass || ''}`}>{value}</div>
      </div>
      {Icon && <Icon className={`h-8 w-8 ${iconClass || 'text-gray-400'}`} />}
    </div>
  );
}
