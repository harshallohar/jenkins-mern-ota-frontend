import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Select from 'react-select';
import { CheckCircle, XCircle, Clock, Download, Activity, Smartphone, HardDrive, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BACKEND_BASE_URL } from '../utils/api';
import RecentActivities from '../components/RecentActivities';

const DEVICES_API = `${BACKEND_BASE_URL}/devices`;
const FIRMWARE_API = `${BACKEND_BASE_URL}/firmware/firmwares-details`;
const OTA_API = `${BACKEND_BASE_URL}/ota-updates`;
const PROJECTS_API = `${BACKEND_BASE_URL}/projects`;
const DASHBOARD_STATS_API = `${BACKEND_BASE_URL}/ota-updates/dashboard-esp-stats`;
const DAILY_STATS_API = `${BACKEND_BASE_URL}/ota-updates/daily-device-stats`;
const WEEKLY_STATS_API = `${BACKEND_BASE_URL}/ota-updates/weekly-device-stats`;

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [devices, setDevices] = useState([]);
  const [firmwares, setFirmwares] = useState([]);
  const [otaUpdates, setOtaUpdates] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // New state for ESP-level statistics
  const [espStats, setEspStats] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Detect dark mode for recharts and react-select
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    window.addEventListener('storage', checkDark);
    window.addEventListener('DOMContentLoaded', checkDark);
    return () => {
      window.removeEventListener('storage', checkDark);
      window.removeEventListener('DOMContentLoaded', checkDark);
    };
  }, []);

  // Fetch all data
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('authToken');
        const [devRes, fwRes, otaRes] = await Promise.all([
          fetch(DEVICES_API, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(FIRMWARE_API, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(OTA_API, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (devRes.status === 401 || fwRes.status === 401 || otaRes.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        const devData = await devRes.json();
        setDevices(Array.isArray(devData) ? devData : []);
        const fwData = await fwRes.json();
        setFirmwares(Array.isArray(fwData) ? fwData : []);
        const otaData = await otaRes.json();
        setOtaUpdates(Array.isArray(otaData) ? otaData : []);
      } catch (err) {
        setError('Failed to fetch dashboard data');
      }
      setLoading(false);
    };
    fetchAll();
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

  // Refresh all dashboard data
  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      // Fetch all data again
      const token = localStorage.getItem('authToken');
      const [devRes, fwRes, otaRes, projectsRes] = await Promise.all([
        fetch(DEVICES_API, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(FIRMWARE_API, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(OTA_API, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(PROJECTS_API, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (devRes.status === 401 || fwRes.status === 401 || otaRes.status === 401 || projectsRes.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      
      const devData = await devRes.json();
      setDevices(Array.isArray(devData) ? devData : []);
      const fwData = await fwRes.json();
      setFirmwares(Array.isArray(fwData) ? fwData : []);
      const otaData = await otaRes.json();
      setOtaUpdates(Array.isArray(otaData) ? otaData : []);
      const projectsData = await projectsRes.json();
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      
      // Refresh ESP statistics
      await fetchESPStats();
      
    } catch (err) {
      setError('Failed to refresh dashboard data');
    }
    setRefreshing(false);
  };

  // Fetch ESP-level statistics
  const fetchESPStats = async () => {
    setStatsLoading(true);
    try {
      const startDate = getStartDate();
      const endDate = new Date(Date.UTC(
        utcNow.getUTCFullYear(),
        utcNow.getUTCMonth(),
        utcNow.getUTCDate(),
        23, 59, 59, 999
      ));
      
      const projectId = selectedProject?.value;
      
      // Fetch dashboard ESP stats
      const dashboardRes = await fetch(
        `${DASHBOARD_STATS_API}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${projectId ? `&projectId=${projectId}` : ''}`
      );
      const dashboardData = await dashboardRes.json();
      setEspStats(dashboardData);
      
      // Fetch daily stats for charts
      const dailyRes = await fetch(
        `${DAILY_STATS_API}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${projectId ? `&projectId=${projectId}` : ''}`
      );
      const dailyData = await dailyRes.json();
      setDailyStats(dailyData);
      
      // Fetch weekly stats for charts (if time range is 30d or 90d)
      if (timeRange === '30d' || timeRange === '90d') {
        const weeklyRes = await fetch(
          `${WEEKLY_STATS_API}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${projectId ? `&projectId=${projectId}` : ''}`
        );
        const weeklyData = await weeklyRes.json();
        setWeeklyStats(weeklyData);
      }
    } catch (err) {
      console.error('Error fetching device stats:', err);
      setError('Failed to fetch device statistics');
    }
    setStatsLoading(false);
  };

  // Fetch ESP stats when time range or project changes
  useEffect(() => {
    fetchESPStats();
  }, [timeRange, selectedProject]);

  // Defensive: if devices is not an array, show error
  if (!Array.isArray(devices)) {
    return <div className="p-8 text-center text-red-500 font-semibold">Error loading devices.</div>;
  }

  // Filter devices by selected project
  const filteredDevices = selectedProject
    ? devices.filter(d => d.project === selectedProject.value)
    : devices;
  const deviceOptions = selectedProject 
    ? filteredDevices.map(d => ({ 
        value: d.deviceId, // Use only device ID as value
        label: `${d.name} (${d.deviceId})` // Keep full label for display
      }))
    : [];

  // Helper function to normalize status (for backward compatibility)
  const normalizeStatus = (status, normalizedStatus) => {
    // If normalizedStatus is available from backend, use it
    if (normalizedStatus) {
      return normalizedStatus;
    }
    
    // Fallback normalization for legacy data or when normalizedStatus is not available
    if (!status) return 'Failed';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('success') || statusLower.includes('programming successfull')) {
      return 'Success';
    } else if (statusLower.includes('fail') || 
               statusLower.includes('unsuccessful') ||
               statusLower.includes('failed to download') ||
               statusLower.includes('error')) {
      return 'Failed';
    } else {
      return 'In Progress';
    }
  };

  // Debug: Log status values to see what we're working with
  useEffect(() => {
    if (otaUpdates.length > 0) {
      console.log('Dashboard - OTA Updates data:', otaUpdates.slice(0, 5).map(u => ({ 
        deviceId: u.deviceId,
        status: u.status, 
        normalizedStatus: u.normalizedStatus,
        normalized: normalizeStatus(u.status, u.normalizedStatus),
        date: u.date,
        pic_id: u.pic_id
      })));
      console.log('Dashboard - Total OTA updates:', otaUpdates.length);
    }
    
    if (devices.length > 0) {
      console.log('Dashboard - Devices data:', devices.slice(0, 5).map(d => ({
        deviceId: d.deviceId,
        name: d.name,
        project: d.project
      })));
      console.log('Dashboard - Total devices:', devices.length);
    }
    
    if (projects.length > 0) {
      console.log('Dashboard - Projects data:', projects.map(p => ({
        _id: p._id,
        projectName: p.projectName
      })));
    }
  }, [otaUpdates, devices, projects]);

  // Use UTC date to avoid timezone issues
  const now = new Date();
  // Get today's date in UTC by using the current date, not the local timezone's UTC date
  const today = new Date();
  const utcNow = new Date(Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    today.getHours(),
    today.getMinutes(),
    today.getSeconds()
  ));
  
  // FORCE REFRESH - This will show if the code is being updated
  console.log('🔥 DASHBOARD COMPONENT RELOADED - UTC NOW:', utcNow.toISOString());
  console.log('🔥 TODAY IS JULY 30, 2025 - UTC DATE:', utcNow.getUTCDate());
  
  // Alert to force cache clear
  if (typeof window !== 'undefined') {
    console.log('🔥 BROWSER DETECTED - CLEARING CACHE');
    // Uncomment the next line if you want to see an alert
    // alert('Dashboard updated! Please check console for week calculations.');
  }
  
  const getStartDate = () => {
    if (timeRange === '7d') {
      // 7 days ago from today (UTC)
      const startDate = new Date(Date.UTC(
        utcNow.getUTCFullYear(),
        utcNow.getUTCMonth(),
        utcNow.getUTCDate() - 6
      ));
      console.log('7d start date (UTC):', startDate.toISOString());
      return startDate;
    }
    if (timeRange === '30d') {
      // 30 days ago from today (UTC)
      const startDate = new Date(Date.UTC(
        utcNow.getUTCFullYear(),
        utcNow.getUTCMonth(),
        utcNow.getUTCDate() - 29
      ));
      console.log('30d start date (UTC):', startDate.toISOString());
      return startDate;
    }
    if (timeRange === '90d') {
      // 90 days ago from today (UTC)
      const startDate = new Date(Date.UTC(
        utcNow.getUTCFullYear(),
        utcNow.getUTCMonth(),
        utcNow.getUTCDate() - 89
      ));
      console.log('90d start date (UTC):', startDate.toISOString());
      return startDate;
    }
    // Default fallback
    const fallbackDate = new Date(0);
    console.log('Using default fallback date:', fallbackDate.toISOString());
    return fallbackDate;
  };
  const startDate = getStartDate();
  
  console.log('=== START DATE DEBUG ===');
  console.log('Time Range:', timeRange);
  console.log('Calculated Start Date:', startDate.toISOString());
  console.log('Current Date (Local):', now.toISOString());
  console.log('Current Date (UTC):', utcNow.toISOString());
  console.log('Sample OTA Update Dates:', otaUpdates.slice(0, 3).map(u => ({
    deviceId: u.deviceId,
    date: u.date,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    parsedDate: new Date(u.date || u.createdAt || u.updatedAt).toISOString()
  })));
  
  // Debug: Show what the 7-day range should be
  if (timeRange === '7d') {
    const debugDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(
        utcNow.getUTCFullYear(),
        utcNow.getUTCMonth(),
        utcNow.getUTCDate() - (6 - i)  // 6 days ago (i=0) to today (i=6)
      ));
      return d;
    });
    console.log('=== 7-DAY RANGE DEBUG ===');
    console.log('Expected 7-day range:', debugDays.map(d => ({
      date: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      fullDay: d.toLocaleDateString(undefined, { weekday: 'long' })
    })));
    console.log('Start date should be:', debugDays[0].toISOString());
    console.log('End date should be:', debugDays[6].toISOString());
    console.log('Today is July 30, 2025, so range should be July 24-30');
    console.log('Current UTC date:', utcNow.toISOString().slice(0, 10));
  }

  const filteredUpdates = useMemo(() => {
    const filtered = otaUpdates.filter(u => {
      // Handle date parsing
      const updateDate = u.date || u.createdAt || u.updatedAt;
      if (!updateDate) {
        console.log('No date found for update:', u);
        return false;
      }
      
      const date = new Date(updateDate);
      if (isNaN(date.getTime())) {
        console.log('Invalid date for update:', u);
        return false;
      }
      
      // Now use the custom date range that includes July 29, 2025
      // Re-enable date filtering - include dates >= startDate (inclusive)
      if (date < startDate) {
        console.log('Date before start date:', {
          updateDate: updateDate,
          parsedDate: date.toISOString(),
          startDate: startDate.toISOString(),
          isBeforeStart: date < startDate
        });
        return false;
      }
      
      // Check if date is within reasonable range (not too far in the future)
      // Use end of today (23:59:59) to include all of today's data
      const endDate = new Date(Date.UTC(
        utcNow.getUTCFullYear(),
        utcNow.getUTCMonth(),
        utcNow.getUTCDate(),
        23, 59, 59, 999
      ));
      
      if (date > endDate) {
        console.log('Date too far in future:', {
          updateDate: updateDate,
          parsedDate: date.toISOString(),
          endDate: endDate.toISOString(),
          isAfterEnd: date > endDate
        });
        return false;
      }
      
      console.log('Date filtering debug:', {
        updateDate: updateDate,
        parsedDate: date.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isInRange: date >= startDate && date <= endDate,
        timeRange
      });
      
      // Filter by project (all devices in the project)
      if (selectedProject) {
        const projectDevices = devices.filter(d => d.project === selectedProject.value);
        const projectDeviceIds = projectDevices.map(d => d.deviceId);
        
        console.log('=== PROJECT FILTERING DEBUG ===');
        console.log('Selected Project ID:', selectedProject.value);
        console.log('All Devices:', devices.map(d => ({ 
          deviceId: d.deviceId, 
          name: d.name, 
          project: d.project,
          projectMatches: d.project === selectedProject.value
        })));
        console.log('Project Devices:', projectDevices.map(d => ({ deviceId: d.deviceId, name: d.name })));
        console.log('Project Device IDs:', projectDeviceIds);
        console.log('Current Update Device ID:', u.deviceId);
        console.log('Is Device in Project:', projectDeviceIds.includes(u.deviceId));
        
        if (!projectDeviceIds.includes(u.deviceId)) {
          console.log('❌ Device not in project:', u.deviceId, 'Project devices:', projectDeviceIds);
          return false;
        } else {
          console.log('✅ Device found in project:', u.deviceId);
        }
      }
      
      // Filter by specific device if selected
      if (selectedDevice) {
        // selectedDevice.value should now be just the device ID (e.g., "0x009CADF19EF0")
        const deviceIdToMatch = selectedDevice.value;
        
        // Handle device ID format mismatches (with/without 0x prefix)
        const deviceIdWithoutPrefix = deviceIdToMatch.replace(/^0x/i, '');
        const updateDeviceId = u.deviceId;
        const updateDeviceIdWithoutPrefix = updateDeviceId.replace(/^0x/i, '');
        
        const matches = u.deviceId === deviceIdToMatch || 
               updateDeviceIdWithoutPrefix === deviceIdWithoutPrefix ||
               u.deviceId === deviceIdWithoutPrefix ||
               updateDeviceIdWithoutPrefix === deviceIdToMatch;
        
        console.log('Device filtering debug:', {
          selectedDeviceValue: deviceIdToMatch,
          updateDeviceId: u.deviceId,
          deviceIdWithoutPrefix,
          updateDeviceIdWithoutPrefix,
          matches
        });
        
        if (!matches) {
          console.log('Device ID mismatch:', {
            selected: deviceIdToMatch,
            update: u.deviceId,
            selectedWithoutPrefix: deviceIdWithoutPrefix,
            updateWithoutPrefix: updateDeviceIdWithoutPrefix
          });
          return false;
        }
        
        return true;
      }
      return true;
    });
    
    console.log('Filtered Updates Debug:', {
      totalUpdates: otaUpdates.length,
      filteredCount: filtered.length,
      selectedProject: selectedProject?.label,
      selectedDevice: selectedDevice?.label,
      timeRange,
      startDate: isNaN(startDate.getTime()) ? 'Invalid Date' : startDate.toISOString(),
      sampleFiltered: filtered.slice(0, 3).map(u => ({
        deviceId: u.deviceId,
        status: u.status,
        normalizedStatus: u.normalizedStatus,
        date: u.date
      }))
    });
    
    return filtered;
  }, [otaUpdates, startDate, selectedDevice, selectedProject, devices]);

  // Stats - using ESP-level statistics
  const totalESPs = espStats?.totalESPs || filteredDevices.length;
  const totalFirmwares = selectedDevice
    ? firmwares.filter(fw => {
        // Handle device ID format mismatches (with/without 0x prefix)
        const deviceIdToMatch = selectedDevice.value;
        const deviceIdWithoutPrefix = deviceIdToMatch.replace(/^0x/i, '');
        const firmwareDeviceId = fw.esp_id;
        const firmwareDeviceIdWithoutPrefix = firmwareDeviceId.replace(/^0x/i, '');
        
        return fw.esp_id === deviceIdToMatch || 
               firmwareDeviceIdWithoutPrefix === deviceIdWithoutPrefix ||
               fw.esp_id === deviceIdWithoutPrefix ||
               firmwareDeviceIdWithoutPrefix === deviceIdToMatch;
      }).length
    : 0;
  
  // Total PIC experiences (counting each PIC experience separately)
  const totalSuccess = espStats?.totalPicsWithSuccess || 0;
  const totalFailed = espStats?.totalPicsWithFailure || 0;

  // Pie chart data - using total PIC experiences
  const pieData = [
    { name: 'Total PIC Success Experiences', value: totalSuccess, color: '#10B981' },
    { name: 'Total PIC Failure Experiences', value: totalFailed, color: '#EF4444' },
  ].filter(item => item.value > 0); // Only show categories with data

  // Bar chart data - using device-level statistics
  const barData = useMemo(() => {
    console.log('=== BAR CHART DATA GENERATION ===');
    console.log('Time Range:', timeRange);
    console.log('Selected Project:', selectedProject?.label);
    console.log('Selected Device:', selectedDevice?.label);
    
    if (timeRange === '7d') {
      // Use daily stats for 7-day view
      if (dailyStats.length === 0) {
        console.log('No daily stats found, returning empty data');
        return [];
      }
      
      const result = dailyStats.map(day => ({
        name: day.dayName,
        date: day.date,
        fullDate: day.fullDate,
        'Total PIC Success Experiences': day.devicesWithSuccess,
        'Total PIC Failure Experiences': day.devicesWithFailure,
      }));
      
      console.log('Final 7d bar data:', result);
      return result;
    } else if (timeRange === '30d') {
      // Use weekly stats for 30-day view
      if (weeklyStats.length === 0) {
        console.log('No weekly stats found, returning empty data');
        return [];
      }
      
      const result = weeklyStats.map(week => ({
        name: week.week,
        date: week.dateRange,
        fullDate: week.dateRange,
        'Total PIC Success Experiences': week.devicesWithSuccess,
        'Total PIC Failure Experiences': week.devicesWithFailure,
      }));
      
      console.log('Final 30d bar data:', result);
      return result;
    } else if (timeRange === '90d') {
      // Use weekly stats for 90-day view (grouped by month)
      if (weeklyStats.length === 0) {
        console.log('No weekly stats found, returning empty data');
        return [];
      }
      
      // Group weekly stats by month
      const monthlyStats = {};
      weeklyStats.forEach(week => {
        const monthKey = week.dateRange.split(' - ')[0].split(' ')[0]; // Get month name
        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = {
            devicesWithSuccess: 0,
            devicesWithFailure: 0,
            totalDevices: 0
          };
        }
        monthlyStats[monthKey].devicesWithSuccess += week.devicesWithSuccess;
        monthlyStats[monthKey].devicesWithFailure += week.devicesWithFailure;
        monthlyStats[monthKey].totalDevices += week.totalDevices;
      });
      
      const result = Object.entries(monthlyStats).map(([month, stats]) => ({
        name: month,
        date: month,
        fullDate: month,
        'Total PIC Success Experiences': stats.devicesWithSuccess,
        'Total PIC Failure Experiences': stats.devicesWithFailure,
      }));
      
      console.log('Final 90d bar data:', result);
      return result;
    }
    return [];
  }, [dailyStats, weeklyStats, timeRange, selectedProject, selectedDevice]);



  // Excel Download Functions
  const downloadStatsData = () => {
    const statsData = [
      {
        Metric: 'Total Devices',
        Value: totalDevices,
        Change: '+0% from last period'
      },
      {
        Metric: 'Total Firmwares Uploaded',
        Value: totalFirmwares,
        Change: '+0% from last period'
      },
      {
        Metric: 'Total Success',
        Value: totalSuccess,
        Change: '+0% from last period'
      },
      {
        Metric: 'Total Failures',
        Value: totalFailed,
        Change: '+0% from last period'
      }
    ];

    const fileName = `Dashboard_Stats_${new Date().toISOString().split('T')[0]}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(statsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Stats');
    XLSX.writeFile(wb, fileName);

    // Log activity
    logExportActivity('Dashboard Stats', fileName);
  };

  const downloadBarChartData = () => {
    const chartData = barData.map(item => ({
      Period: item.name,
      Success: item.Success,
      Failed: item.Failed,
      Total: item.Success + item.Failed,
      Date_Range: item.fullDate || item.date || 'N/A'
    }));

    const fileName = `Bar_Chart_Data_${timeRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(chartData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bar Chart Data');
    XLSX.writeFile(wb, fileName);

    // Log activity
    logExportActivity('Bar Chart Data', fileName);
  };

  const downloadPieChartData = () => {
    const chartData = pieData.map(item => ({
      Status: item.name,
      Count: item.value,
      Percentage: `${((item.value / (totalSuccess + totalFailed)) * 100).toFixed(1)}%`
    }));

    const fileName = `Pie_Chart_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(chartData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pie Chart Data');
    XLSX.writeFile(wb, fileName);

    // Log activity
    logExportActivity('Pie Chart Data', fileName);
  };

  const downloadFilteredUpdates = () => {
    const updatesData = filteredUpdates.map(update => ({
      Device_ID: update.deviceId,
      Status: update.status,
      Normalized_Status: update.normalizedStatus,
      Date: new Date(update.date).toLocaleDateString(),
      PIC_ID: update.pic_id || 'N/A',
      Previous_Version: update.previousVersion || 'N/A',
      Updated_Version: update.updatedVersion || 'N/A'
    }));

    const fileName = `OTA_Updates_${timeRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(updatesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OTA Updates');
    XLSX.writeFile(wb, fileName);

    // Log activity
    logExportActivity('OTA Updates', fileName);
  };

  // Log export activity
  const logExportActivity = async (exportType, fileName) => {
    try {
      const token = localStorage.getItem('authToken');
      const user = JSON.parse(localStorage.getItem('user'));
      
      await fetch(`${BACKEND_BASE_URL}/recent-activities/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          activityType: 'EXPORT_DATA',
          title: 'Data Exported',
          description: `${exportType} data exported to ${fileName}`,
          severity: 'info',
          details: {
            exportType,
            fileName,
            userId: user?._id
          }
        })
      });
    } catch (error) {
      console.error('Error logging export activity:', error);
    }
  };


  // Card icon backgrounds
  const iconBg = {
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
  };

  // Card config for consistent style
  const cardStats = [
    {
      label: 'Total ESPs',
      valueKey: 'totalESPs',
      icon: Smartphone,
      iconBg: iconBg.blue,
      sub: 'ESPs in selected project',
    },
    {
              label: 'Total PIC Success Experiences',
      valueKey: 'totalSuccess',
      icon: CheckCircle,
      iconBg: iconBg.green,
      sub: 'Total PIC experiences with success',
    },
    {
      label: 'ESPs with PIC Failure',
      valueKey: 'totalFailed',
      icon: XCircle,
      iconBg: iconBg.red,
      sub: 'Total PIC experiences with failures',
    },

  ];

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Get the data point to access date information
      const dataPoint = payload[0]?.payload;
      const date = dataPoint?.fullDate || dataPoint?.date || label;
      
      return (
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow px-4 py-2 border border-gray-200 dark:border-gray-700">
          <div className="font-semibold text-gray-900 dark:text-white mb-1">{date}</div>
          <div className="flex flex-col gap-1">
            <span className="text-green-600 dark:text-green-400">Total PIC Success Experiences: <b>{payload.find(p => p.dataKey === 'Total PIC Success Experiences')?.value ?? 0}</b></span>
            <span className="text-red-600 dark:text-red-400">Total PIC Failure Experiences: <b>{payload.find(p => p.dataKey === 'Total PIC Failure Experiences')?.value ?? 0}</b></span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom legend for charts
  const CustomLegend = ({ payload }) => (
    <div className="flex flex-wrap gap-4 mt-4 text-xs justify-center">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-3 h-3 rounded flex-shrink-0" style={{ background: entry.color }}></span>
          <span 
            className="whitespace-nowrap" 
            style={{ color: isDark ? '#d1d5db' : '#374151' }}
          >
            {entry.value} ({entry.payload.value})
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Overview of your device management system
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <Select
            className={`min-w-[220px]`}
            classNamePrefix="react-select"
            options={projects.map(p => ({ value: p._id, label: p.projectName }))}
            isClearable
            placeholder="Select project..."
            value={selectedProject}
            onChange={option => { setSelectedProject(option); setSelectedDevice(null); }}
            styles={{
              control: (base, state) => ({
                ...base,
                backgroundColor: isDark ? '#1f2937' : '#fff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
                boxShadow: state.isFocused ? (isDark ? '0 0 0 1px #2563eb' : '0 0 0 1px #2563eb') : base.boxShadow,
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: isDark ? '#1f2937' : '#fff',
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              singleValue: (base) => ({
                ...base,
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused
                  ? (isDark ? '#374151' : '#f3f4f6')
                  : (isDark ? '#1f2937' : '#fff'),
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              input: (base) => ({
                ...base,
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              placeholder: (base) => ({
                ...base,
                color: isDark ? '#9ca3af' : '#6b7280',
              }),
              dropdownIndicator: (base) => ({
                ...base,
                color: isDark ? '#9ca3af' : '#6b7280',
              }),
              indicatorSeparator: (base) => ({
                ...base,
                backgroundColor: isDark ? '#374151' : '#d1d5db',
              }),
            }}
          />
          <Select
            className={`min-w-[220px]`}
            classNamePrefix="react-select"
            options={deviceOptions}
            isClearable
            placeholder="Select device..."
            value={selectedDevice}
            onChange={setSelectedDevice}
            styles={{
              control: (base, state) => ({
                ...base,
                backgroundColor: isDark ? '#1f2937' : '#fff',
                borderColor: isDark ? '#374151' : '#d1d5db',
                color: isDark ? '#f3f4f6' : '#111827',
                boxShadow: state.isFocused ? (isDark ? '0 0 0 1px #2563eb' : '0 0 0 1px #2563eb') : base.boxShadow,
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: isDark ? '#1f2937' : '#fff',
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              singleValue: (base) => ({
                ...base,
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused
                  ? (isDark ? '#374151' : '#f3f4f6')
                  : (isDark ? '#1f2937' : '#fff'),
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              input: (base) => ({
                ...base,
                color: isDark ? '#f3f4f6' : '#111827',
              }),
              placeholder: (base) => ({
                ...base,
                color: isDark ? '#9ca3af' : '#6b7280',
              }),
              dropdownIndicator: (base) => ({
                ...base,
                color: isDark ? '#9ca3af' : '#6b7280',
              }),
              indicatorSeparator: (base) => ({
                ...base,
                backgroundColor: isDark ? '#374151' : '#d1d5db',
              }),
            }}
            isDisabled={!selectedProject}
          />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="block w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Metrics</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshDashboard}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={downloadStatsData}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Export Stats
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(!selectedDevice
            ? cardStats.filter(stat => stat.valueKey === 'totalDevices')
            : cardStats
          ).map((stat, i) => {
            const Icon = stat.icon;
            const value = (() => {
              if (stat.valueKey === 'totalESPs') return totalESPs;
              if (stat.valueKey === 'totalSuccess') return totalSuccess;
              if (stat.valueKey === 'totalFailed') return totalFailed;
              return 0;
            })();
            return (
              <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-2xl shadow flex flex-col justify-between px-6 py-5 min-h-[120px]">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">{stat.label}</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1 dark:text-white">{value}</div>
                    <div className="text-xs text-gray-400">{stat.sub}</div>
                  </div>
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full ${stat.iconBg} bg-opacity-60`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activities - Always visible */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
        <RecentActivities />
      </div>

      {/* Charts Section - Only show when both project and device are selected */}
      {selectedProject && selectedDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Device Activity Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Device Activity</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total PIC success/failure experiences over the last {timeRange === '7d' ? '7 days' : timeRange === '30d' ? '4 weeks' : '3 months'}
                </p>
              </div>
              <button
                onClick={downloadBarChartData}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Export Chart
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={barData}
                  barGap={8}
                  barCategoryGap={20}
                >
                  <CartesianGrid stroke={isDark ? '#374151' : '#E5E7EB'} />
                  <XAxis dataKey="name" stroke={isDark ? '#9CA3AF' : '#6B7280'} tick={{ fill: isDark ? '#d1d5db' : '#374151' }} />
                  <YAxis stroke={isDark ? '#9CA3AF' : '#6B7280'} allowDecimals={false} tick={{ fill: isDark ? '#d1d5db' : '#374151' }} />
                  <Tooltip
                    content={<CustomBarTooltip />}
                    contentStyle={{
                      backgroundColor: isDark ? '#1F2937' : '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      color: isDark ? '#F9FAFB' : '#111827',
                    }}
                  />
                  <Legend content={<CustomLegend />} />
                  <Bar dataKey="Total PIC Success Experiences" name="Total PIC Success Experiences" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Total PIC Failure Experiences" name="Total PIC Failure Experiences" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Export Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Data Export</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Export filtered OTA updates data
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshDashboard}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm rounded-lg transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={downloadFilteredUpdates}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export Data
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>• Total Records: {filteredUpdates.length}</p>
              <p>• Time Range: {timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : 'Last 90 days'}</p>
              <p>• Project: {selectedProject?.label || 'All Projects'}</p>
              <p>• Device: {selectedDevice?.label || 'All Devices'}</p>
            </div>
          </div>

          {/* OTA Update Status Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">ESP PIC Experience Distribution</h3>
              <button
                onClick={downloadPieChartData}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend 
                    content={<CustomLegend />}
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Message when no project is selected */}
      {!selectedProject && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a Project to View Analytics
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Choose a project from the dropdown above to see detailed analytics, charts, and data for all devices in that project.
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              <p>• View success/failure rates</p>
              <p>• Analyze device activity over time</p>
              <p>• Export data and reports</p>
            </div>
          </div>
        </div>
      )}

      {/* Message when project is selected but no device */}
      {selectedProject && !selectedDevice && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a Device to View Analytics
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              You've selected project "{selectedProject.label}". Now choose a device from the dropdown to see detailed analytics and charts for that specific device.
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              <p>• Device-specific success/failure rates</p>
              <p>• Individual device activity over time</p>
              <p>• Export device-specific data and reports</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 