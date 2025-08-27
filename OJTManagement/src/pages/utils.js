export const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return 'text-red-600 bg-red-50 border-red-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-green-600 bg-green-50 border-green-200';
    case 'urgent': return 'text-red-800 bg-red-100 border-red-300';
    case 'normal': return 'text-gray-600 bg-gray-50 border-gray-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'text-green-600 bg-green-50 border-green-200';
    case 'in-progress': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'pending': return 'text-gray-600 bg-gray-50 border-gray-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const formatDate = (dateString, type = 'date') => {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  if (type === 'date') {
    return date.toLocaleDateString();
  } else if (type === 'time') {
    return date.toLocaleTimeString();
  }
  return date.toLocaleString();
};

export const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString();
};

export const formatDuration = (milliseconds) => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export const getCurrentShiftType = (shiftSchedule) => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  if (currentTime >= shiftSchedule.morning.start && currentTime <= shiftSchedule.morning.end) {
    return 'Morning Shift';
  } else if (currentTime >= shiftSchedule.evening.start && currentTime <= shiftSchedule.evening.end) {
    return 'Evening Shift';
  }
  return 'Outside Shift Hours';
};

export const getLocationErrorMessage = (error) => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access denied. Please enable location permissions.";
    case error.POSITION_UNAVAILABLE:
      return "Location information is unavailable.";
    case error.TIMEOUT:
      return "Location request timed out.";
    default:
      return "An unknown error occurred while retrieving location.";
  }
};
