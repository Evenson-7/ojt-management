import React from 'react';

function ManageTab({ user, setShowNewTaskModal, setShowNewAnnouncementModal, setActiveTab, shiftSchedule, setShiftSchedule }) {
  // This component is only rendered if user.role === 'supervisor' in Dashboard.jsx
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Manage Tasks & Announcements</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Task Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 ml-3">Create New Task</h3>
          </div>
          <p className="text-gray-600 mb-4">Assign tasks to interns and track their progress.</p>
          <button
            onClick={() => setShowNewTaskModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            Create Task
          </button>
        </div>

        {/* Create Announcement Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 ml-3">Make Announcement</h3>
          </div>
          <p className="text-gray-600 mb-4">Share important updates with all team members.</p>
          <button
            onClick={() => setShowNewAnnouncementModal(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            Create Announcement
          </button>
        </div>

        {/* Geofence Management Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 ml-3">Manage Geofences</h3>
          </div>
          <p className="text-gray-600 mb-4">Set up work areas and monitor attendance locations.</p>
          <button
            onClick={() => setActiveTab('location')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            Manage Locations
          </button>
        </div>

        {/* Schedule Management Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 ml-3">Shift Schedule</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Morning Shift</label>
              <div className="flex space-x-2">
                <input
                  type="time"
                  value={shiftSchedule.morning.start}
                  onChange={(e) => setShiftSchedule({
                    ...shiftSchedule,
                    morning: { ...shiftSchedule.morning, start: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="time"
                  value={shiftSchedule.morning.end}
                  onChange={(e) => setShiftSchedule({
                    ...shiftSchedule,
                    morning: { ...shiftSchedule.morning, end: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Evening Shift</label>
              <div className="flex space-x-2">
                <input
                  type="time"
                  value={shiftSchedule.evening.start}
                  onChange={(e) => setShiftSchedule({
                    ...shiftSchedule,
                    evening: { ...shiftSchedule.evening, start: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="time"
                  value={shiftSchedule.evening.end}
                  onChange={(e) => setShiftSchedule({
                    ...shiftSchedule,
                    evening: { ...shiftSchedule.evening, end: e.target.value }
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManageTab;
