import React from 'react';
import { formatDate, formatTime, formatDuration } from '../utils';

function AttendanceTab({
  user, currentLocation, locationAccuracy, locationError,
  isInsideGeofence, geofences, currentShift, attendanceRecords, isMobile,
  handleTimeIn, handleTimeOut, initializeGeolocation
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Attendance & Time Tracking</h2>
      </div>

      {/* Clock In/Out Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Time Clock</h3>
            <p className="text-gray-600">Current time: {new Date().toLocaleTimeString()}</p>
            <p className="text-sm text-gray-500 mt-1">
              Location accuracy: {locationAccuracy ? `±${Math.round(locationAccuracy)}m` : 'Unknown'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
            <button
              onClick={handleTimeIn}
              disabled={!currentLocation || currentShift}
              className={`py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                !currentLocation || currentShift
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isInsideGeofence || geofences.length === 0
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                  : 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time In
            </button>

            <button
              onClick={handleTimeOut}
              disabled={!currentLocation || !currentShift}
              className={`py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                !currentLocation || !currentShift
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isInsideGeofence || geofences.length === 0
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                  : 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time Out
            </button>
          </div>

          {!isInsideGeofence && geofences.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                You are outside the designated work area. Move to the correct location to clock in/out.
              </p>
            </div>
          )}

          {locationError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{locationError}</p>
              <button
                onClick={initializeGeolocation}
                className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Retry Location
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Attendance History</h3>
        </div>
        <div className="p-6">
          {attendanceRecords.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 text-sm mt-2">No attendance records yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendanceRecords.slice().reverse().slice(0, 10).map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      record.type === 'time-in' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        record.type === 'time-in' ? 'text-green-600' : 'text-red-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{record.type.replace('-', ' ')}</p>
                      <p className="text-sm text-gray-500">{formatDate(record.timestamp)} at {formatTime(record.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      Accuracy: ±{Math.round(record.accuracy || 0)}m
                    </p>
                    {record.shiftDuration && (
                      <p className="text-sm text-gray-500">
                        Duration: {formatDuration(record.shiftDuration)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttendanceTab;
