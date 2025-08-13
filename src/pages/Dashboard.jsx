import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { RefreshCw, Download as DownloadIcon, CheckCircle, XCircle, CircleSlash } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BACKEND_BASE_URL } from '../utils/api';
import './react-select-tailwind.css';

const DEVICES_API = `${BACKEND_BASE_URL}/devices`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;
const DAILY_UNIQUE_API = `${BACKEND_BASE_URL}/ota-updates/daily-unique-stats`;

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [range, setRange] = useState('7'); // 7, 30, 90, custom
  const [customMode, setCustomMode] = useState(false);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [data, setData] = useState([]);
  const totals = useMemo(() => {
    return data.reduce((acc, d) => ({
      success: acc.success + (d.success || 0),
      failure: acc.failure + (d.failure || 0),
      total: acc.total + (d.total || 0)
    }), { success: 0, failure: 0, total: 0 });
  }, [data]);
  const pieData = useMemo(() => ([
    { name: 'Success', value: totals.success, color: '#16a34a' },
    { name: 'Failure', value: totals.failure, color: '#dc2626' },
  ]), [totals]);

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
    // If current selected device is not part of this project, or not set, pick first
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

  const computeDateRange = () => {
    if (customMode && startDateInput && endDateInput) {
      const s = new Date(startDateInput);
      const e = new Date(endDateInput);
      const start = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59, 999));
      return { start, end };
    }
  const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
    const days = parseInt(range, 10) || 7;
    const startBase = new Date(end);
    startBase.setUTCDate(startBase.getUTCDate() - (days - 1));
    const start = new Date(Date.UTC(startBase.getUTCFullYear(), startBase.getUTCMonth(), startBase.getUTCDate(), 0, 0, 0, 0));
    return { start, end };
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const { start, end } = computeDateRange();
      const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString() });
      if (selectedProject) params.set('projectId', selectedProject.value);
      if (selectedDevice) params.set('deviceId', selectedDevice.value);
      const res = await fetch(`${DAILY_UNIQUE_API}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const json = await res.json();
      setData(Array.isArray(json?.daily) ? json.daily : []);
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedDevice, range, customMode, startDateInput, endDateInput]);

  const handleQuickRange = (val) => {
    setRange(val);
    setCustomMode(false);
  };

  const handleUseCustom = () => {
    setCustomMode(true);
    setRange('custom');
  };

  const exportCSV = async () => {
    if (!data || data.length === 0) return;
    
    setLoading(true);
    try {
      // Fetch detailed OTA attempts data for the selected date range and filters
      const { start, end } = computeDateRange();
      const params = new URLSearchParams({ startDate: start.toISOString(), endDate: end.toISOString() });
      if (selectedProject) params.set('projectId', selectedProject.value);
      if (selectedDevice) params.set('deviceId', selectedDevice.value);
      
      const token = localStorage.getItem('authToken');
      const attemptsRes = await fetch(`${BACKEND_BASE_URL}/ota-updates/attempts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!attemptsRes.ok) throw new Error('Failed to fetch detailed data');
      const attemptsData = await attemptsRes.json();
      
      // Create detailed report headers
      const headers = [
        'Date',
        'PIC ID',
        'Device ID',
        'Device Name',
        'Project',
        'Previous Version',
        'Updated Version',
        'Status',
        'Status Message',
        'Badge',
        'Attempt Number',
        'Timestamp'
      ];
      
      // Create detailed rows
      const rows = attemptsData.map(attempt => [
        new Date(attempt.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
        `"${attempt.pic_id}"`, // Wrap PIC ID in quotes to force text format
        attempt.deviceId,
        // Get device name from devices array
        devices.find(d => d.deviceId === attempt.deviceId)?.name || 'Unknown',
        // Get project name from projects array
        projects.find(p => p._id === devices.find(d => d.deviceId === attempt.deviceId)?.project)?.projectName || 'Unassigned',
        attempt.previousVersion,
        attempt.updatedVersion,
        attempt.status,
        attempt.statusMessage || '',
        attempt.badge,
        attempt.attemptNumber,
        new Date(attempt.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) + ' ' + new Date(attempt.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      ]);
      
      // Add summary section at the top
      const summaryRows = [
        ['Dashboard Export Summary'],
        [''],
        ['Export Date', new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })],
        ['Export Time', new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })],
        ['Date Range', `${start.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })} to ${end.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}`],
        ['Project', selectedProject ? selectedProject.label : 'All Projects'],
        ['Device', selectedDevice ? selectedDevice.label : 'All Devices'],
        ['Total Attempts', attemptsData.length],
        ['Success Count', attemptsData.filter(a => a.badge === 'success').length],
        ['Failure Count', attemptsData.filter(a => a.badge === 'failure').length],
        ['Other Count', attemptsData.filter(a => a.badge === 'other').length],
        [''],
        ['IMPORTANT: If you see "###" in Excel, double-click the column header to auto-resize the column width'],
        ['NOTE: PIC IDs are wrapped in quotes to preserve their full length in Excel'],
        [''],
        ['Detailed Attempts Report'],
        [''],
        headers
      ];
      
      const csv = [...summaryRows, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dashboard_detailed_report_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export detailed report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
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
            <button
              onClick={fetchData}
              className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadIcon className="h-4 w-4 mr-2" /> 
              {loading ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total" value={totals.total} gradientFrom="from-blue-50" icon={CircleSlash} iconClass="text-blue-600" />
        <StatCard title="Success" value={totals.success} gradientFrom="from-green-50" icon={CheckCircle} iconClass="text-green-600" valueClass="text-green-600" />
        <StatCard title="Failure" value={totals.failure} gradientFrom="from-red-50" icon={XCircle} iconClass="text-red-600" valueClass="text-red-600" />
            </div>
            
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Bar Chart (grouped) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">Daily Outcomes</div>
            {loading && <div className="text-sm text-gray-500">Loading...</div>}
            {error && <div className="text-sm text-red-500">{error}</div>}
                </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barCategoryGap={12} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" fill="#16a34a" name="Success" radius={[4,4,0,0]} />
                <Bar dataKey="failure" fill="#dc2626" name="Failure" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        {/* Outcome Mix Pie */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700">
          <div className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Outcome Mix</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                <Tooltip />
                <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      {/* Removed cumulative trend by request */}

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
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No data</td>
                </tr>
              )}
              {data
                .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, newest first
                .map(row => (
                <tr key={row.date} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{row.date}</td>
                  <td className="px-4 py-2 text-sm text-green-600">{row.success}</td>
                  <td className="px-4 py-2 text-sm text-red-600">{row.failure}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{row.total}</td>
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


