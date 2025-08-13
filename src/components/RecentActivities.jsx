import { useState, useEffect } from 'react';
import { 
  Activity, 
  Trash2, 
  Eye, 
  EyeOff, 
  Filter, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Download,
  Upload,
  Plus,
  User,
  Smartphone,
  HardDrive,
  LogOut,
  LogIn
} from 'lucide-react';
import { BACKEND_BASE_URL } from '../utils/api';

const RecentActivities = ({ compact = false }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: compact ? 5 : 20
  });
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [includeSystemActivities, setIncludeSystemActivities] = useState(true);

  const user = JSON.parse(localStorage.getItem('user'));

  // Activity type options for filter
  const activityTypeOptions = [
    { value: 'all', label: 'All Activities' },
    { value: 'OTA_UPDATE_SUCCESS', label: 'OTA Updates (Success)' },
    { value: 'OTA_UPDATE_FAILED', label: 'OTA Updates (Failed)' },
    { value: 'FIRMWARE_UPLOADED', label: 'Firmware Uploads' },
    { value: 'DEVICE_ADDED', label: 'Device Added' },
    { value: 'DEVICE_REMOVED', label: 'Device Removed' },
    { value: 'USER_ADDED', label: 'User Added' },
    { value: 'USER_REMOVED', label: 'User Removed' },
    { value: 'PROJECT_CREATED', label: 'Project Created' },
    { value: 'PROJECT_UPDATED', label: 'Project Updated' },
    { value: 'DEVICE_ASSIGNED', label: 'Device Assigned' },
    { value: 'DEVICE_UNASSIGNED', label: 'Device Unassigned' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'LOGOUT', label: 'Logout' },
    { value: 'EXPORT_DATA', label: 'Data Export' },
    { value: 'BULK_OPERATION', label: 'Bulk Operations' }
  ];

  // Get activity icon based on type
  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'OTA_UPDATE_SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'OTA_UPDATE_FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'FIRMWARE_UPLOADED':
        return <Upload className="h-5 w-5 text-blue-500" />;
      case 'DEVICE_ADDED':
      case 'DEVICE_REMOVED':
      case 'DEVICE_ASSIGNED':
      case 'DEVICE_UNASSIGNED':
        return <Smartphone className="h-5 w-5 text-purple-500" />;
      case 'USER_ADDED':
      case 'USER_REMOVED':
        return <User className="h-5 w-5 text-indigo-500" />;
      case 'PROJECT_CREATED':
      case 'PROJECT_UPDATED':
        return <HardDrive className="h-5 w-5 text-orange-500" />;
      case 'LOGIN':
        return <LogIn className="h-5 w-5 text-green-500" />;
      case 'LOGOUT':
        return <LogOut className="h-5 w-5 text-gray-500" />;
      case 'EXPORT_DATA':
        return <Download className="h-5 w-5 text-blue-500" />;
      case 'BULK_OPERATION':
        return <Activity className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'success':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'error':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Fetch activities
  const fetchActivities = async (page = 1, filter = selectedFilter) => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.itemsPerPage.toString(),
        includeSystem: includeSystemActivities.toString()
      });
      
      if (filter !== 'all') {
        params.append('activityType', filter);
      }

      console.log('Fetching activities with params:', params.toString());
      console.log('Token:', token ? 'Present' : 'Missing');

      const response = await fetch(`${BACKEND_BASE_URL}/recent-activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch activities: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Activities data:', data);
      setActivities(data.activities);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error in fetchActivities:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/recent-activities/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Unread count response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Unread count data:', data);
        setUnreadCount(data.unreadCount);
      } else {
        const errorText = await response.text();
        console.error('Unread count error response:', errorText);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  // Mark activities as read
  const markAsRead = async (activityIds) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/recent-activities/mark-read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activityIds })
      });

      if (response.ok) {
        // Update local state
        setActivities(prev => prev.map(activity => 
          activityIds.includes(activity._id) 
            ? { ...activity, isRead: true }
            : activity
        ));
        fetchUnreadCount();
      }
    } catch (err) {
      console.error('Error marking activities as read:', err);
    }
  };

  // Clear all activities
  const clearAllActivities = async () => {
    if (!window.confirm('Are you sure you want to clear all activities? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/recent-activities/clear-all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setActivities([]);
        setPagination(prev => ({ ...prev, totalItems: 0, totalPages: 1, currentPage: 1 }));
        setUnreadCount(0);
        setSelectedActivities([]);
      }
    } catch (err) {
      setError('Failed to clear activities');
    }
  };

  // Delete specific activity
  const deleteActivity = async (activityId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_BASE_URL}/recent-activities/${activityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setActivities(prev => prev.filter(activity => activity._id !== activityId));
        setPagination(prev => ({ ...prev, totalItems: prev.totalItems - 1 }));
      }
    } catch (err) {
      console.error('Error deleting activity:', err);
    }
  };

  // Handle filter change
  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
    setSelectedActivities([]);
    fetchActivities(1, filter);
  };

  // Handle page change
  const handlePageChange = (page) => {
    fetchActivities(page, selectedFilter);
  };

  // Handle activity selection
  const handleActivitySelect = (activityId) => {
    setSelectedActivities(prev => 
      prev.includes(activityId)
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedActivities.length === activities.length) {
      setSelectedActivities([]);
    } else {
      setSelectedActivities(activities.map(activity => activity._id));
    }
  };

  // Mark selected as read
  const markSelectedAsRead = () => {
    if (selectedActivities.length > 0) {
      markAsRead(selectedActivities);
      setSelectedActivities([]);
    }
  };

  // Initial load
  useEffect(() => {
    fetchActivities();
    fetchUnreadCount();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className={`${compact ? 'px-4 py-3' : 'px-6 py-4'} border-b border-gray-200 dark:border-gray-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} text-blue-600`} />
            <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-semibold text-gray-900 dark:text-white`}>
              Recent Activities
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchActivities(pagination.currentPage, selectedFilter)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            
            {selectedActivities.length > 0 && (
              <button
                onClick={markSelectedAsRead}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              >
                <Eye className="h-4 w-4" />
                Mark as Read
              </button>
            )}
            
            <button
              onClick={clearAllActivities}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Select All */}
      <div className={`${compact ? 'px-4 py-2' : 'px-6 py-3'} border-b border-gray-200 dark:border-gray-700`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={selectedFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {activityTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {activities.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedActivities.length === activities.length && activities.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Select All ({selectedActivities.length}/{activities.length})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={compact ? "p-4" : "p-6"}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
            <span className="ml-2 text-gray-500">Loading activities...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No activities found</p>
          </div>
        ) : (
          <>
            {/* Activities List */}
            <div className={`${compact ? 'space-y-2' : 'space-y-3'}`}>
              {activities.map((activity) => (
                <div
                  key={activity._id}
                  className={`${compact ? 'p-3' : 'p-4'} rounded-lg border transition-colors ${
                    activity.isRead
                      ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedActivities.includes(activity._id)}
                      onChange={() => handleActivitySelect(activity._id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(activity.activityType)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-gray-900 dark:text-white`}>
                            {activity.title}
                          </h3>
                          <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-300 mt-1`}>
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(activity.severity)}`}>
                              {activity.severity}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTimestamp(activity.timestamp)}
                            </span>
                            {!activity.isRead && (
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-full">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {!activity.isRead && (
                            <button
                              onClick={() => markAsRead([activity._id])}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title="Mark as read"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteActivity(activity._id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete activity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
                  {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
                  {pagination.totalItems} activities
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-1 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 text-sm font-medium rounded-md ${
                        page === pagination.currentPage
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="px-3 py-1 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecentActivities; 