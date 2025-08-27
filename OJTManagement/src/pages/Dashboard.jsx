import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// Import the new tab components
import OverviewTab from '../pages/tabs/OverviewTab'
import TasksTab from '../pages/tabs/TasksTab'
import AnnouncementsTab from '../pages/tabs/AnnouncementsTab'
import AttendanceTab from '../pages/tabs/AttendanceTab'
import LocationTab from '../pages/tabs/LocationTab'
import ManageTab from '../pages/tabs/ManageTab'

// Import Modals
import { NewTaskModal, NewAnnouncementModal } from '../components/Modals';

// Import Utility Functions
import {
  getPriorityColor, getStatusColor, formatDate, formatTime,
  formatDuration, getGreeting, getCurrentShiftType, getLocationErrorMessage
} from './utils';
import {
  isPointInCircle, isPointInPolygon, getDistanceBetweenPoints, isLocationInsideGeofence
} from './geofenceUtils';


function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Data states (will be passed down to children or managed by context if more complex)
  const [tasks, setTasks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // Modals states
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] = useState(false);

  // New Task/Announcement form states
  const [newTask, setNewTask] = useState({
    title: '', description: '', dueDate: '', priority: 'medium', assignedTo: ''
  });
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '', message: '', priority: 'normal'
  });

  // Geofencing and GPS tracking states
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isInsideGeofence, setIsInsideGeofence] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftSchedule, setShiftSchedule] = useState({
    morning: { start: '08:00', end: '12:00' },
    evening: { start: '13:00', end: '17:00' }
  });

  // Map related refs
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const geofenceShapesRef = useRef([]);
  const currentLocationMarkerRef = useRef(null);

  // Mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Load data on component mount
  useEffect(() => {
    loadDashboardData();
    initializeGeolocation();
    loadGeofences();
    loadAttendanceRecords();
    loadShiftFromStorage();
    loadGoogleMaps(); // Load Google Maps script

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);

  // Initialize Google Maps after script loads and mapRef is available
  useEffect(() => {
    if (window.google && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [currentLocation, geofences]); // Re-initialize map when location or geofences change

  const loadGoogleMaps = () => {
    if (window.google) return; // Already loaded

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyA6myHzS10YXdcazAFalmXvDkrYCp5cLc8&libraries=drawing,geometry`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("Failed to load the Google Maps JavaScript API.");
    };
    script.onload = () => {
      if (mapRef.current) {
        initializeMap(); // Initialize map once script is loaded
      }
    };
    document.head.appendChild(script);
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadTasks(),
        loadAnnouncements()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const tasksRef = collection(db, 'tasks');
      let q;

      if (user.role === 'supervisor') {
        q = query(tasksRef, where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'));
      } else {
        q = query(tasksRef, where('assignedTo', '==', user.uid), orderBy('createdAt', 'desc'));
      }

      const querySnapshot = await getDocs(q);
      const tasksData = [];
      querySnapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() });
      });
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const announcementsRef = collection(db, 'announcements');
      const q = query(announcementsRef, orderBy('createdAt', 'desc'), limit(10));

      const querySnapshot = await getDocs(q);
      const announcementsData = [];
      querySnapshot.forEach((doc) => {
        announcementsData.push({ id: doc.id, ...doc.data() });
      });
      setAnnouncements(announcementsData);
    } catch (error) {
      console.error('Error loading announcements:', error);
      setAnnouncements([]);
    }
  };

  const loadGeofences = async () => {
    try {
      const geofencesRef = collection(db, 'geofences');
      let q;

      if (user.role === 'supervisor') {
        q = query(geofencesRef, where('createdBy', '==', user.uid));
      } else {
        q = query(geofencesRef); // Interns can see all geofences
      }

      const querySnapshot = await getDocs(q);
      const geofencesData = [];
      querySnapshot.forEach((doc) => {
        geofencesData.push({ id: doc.id, ...doc.data() });
      });
      setGeofences(geofencesData);
    } catch (error) {
      console.error('Error loading geofences:', error);
      setGeofences([]);
    }
  };

  const loadAttendanceRecords = () => {
    const stored = localStorage.getItem(`attendance_${user.uid}`);
    if (stored) {
      setAttendanceRecords(JSON.parse(stored));
    }
  };

  const loadShiftFromStorage = () => {
    const stored = localStorage.getItem(`current_shift_${user.uid}`);
    if (stored) {
      const shift = JSON.parse(stored);
      const today = new Date().toDateString();
      if (shift.date === today) {
        setCurrentShift(shift);
      } else {
        localStorage.removeItem(`current_shift_${user.uid}`);
      }
    }
  };

  const saveShiftToStorage = (shift) => {
    localStorage.setItem(`current_shift_${user.uid}`, JSON.stringify(shift));
  };

  const saveAttendanceRecord = (record) => {
    const updated = [...attendanceRecords, record];
    setAttendanceRecords(updated);
    localStorage.setItem(`attendance_${user.uid}`, JSON.stringify(updated));
  };

  const initializeGeolocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(location);
        setLocationAccuracy(position.coords.accuracy);
        // Set map center only if it's the initial load or if current location is significantly different
        if (!mapInstanceRef.current || !mapInstanceRef.current.getCenter() ||
            getDistanceBetweenPoints(location, { lat: mapInstanceRef.current.getCenter().lat(), lng: mapInstanceRef.current.getCenter().lng() }) > 100) {
          mapInstanceRef.current?.setCenter(location);
        }
        checkGeofenceStatus(location);
      },
      (error) => {
        setLocationError(getLocationErrorMessage(error));
      },
      options
    );
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) return;

    const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: isMobile ? 30000 : 10000 };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentLocation(location);
        setLocationAccuracy(position.coords.accuracy);
        checkGeofenceStatus(location);

        if (mapInstanceRef.current && currentLocationMarkerRef.current) {
          currentLocationMarkerRef.current.setPosition(location);
        }
      },
      (error) => {
        setLocationError(getLocationErrorMessage(error));
      },
      options
    );
    setIsTracking(true);
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  const checkGeofenceStatus = (location) => {
    let insideAny = false;
    geofences.forEach(geofence => {
      if (isLocationInsideGeofence(location, geofence)) {
        insideAny = true;
      }
    });
    setIsInsideGeofence(insideAny);
  };

  const handleTimeIn = async () => {
    if (!currentLocation) {
      alert('Location not available. Please enable GPS and try again.');
      return;
    }
    if (!isInsideGeofence && geofences.length > 0) {
      alert('You are not within the designated work area. Please move to the correct location.');
      return;
    }
    if (currentShift) {
      alert('You are already clocked in.');
      return;
    }

    const record = {
      id: Date.now(), userId: user.uid, userName: user.name, type: 'time-in',
      timestamp: new Date().toISOString(), location: currentLocation,
      accuracy: locationAccuracy, date: new Date().toDateString()
    };

    try {
      await addDoc(collection(db, 'attendance'), record);
      saveAttendanceRecord(record);
      setCurrentShift(record);
      saveShiftToStorage(record);
      if (isMobile && navigator.vibrate) { navigator.vibrate(200); }
      alert('Successfully clocked in!');
    } catch (error) {
      console.error('Error recording time in:', error);
      alert('Error recording attendance. Please try again.');
    }
  };

  const handleTimeOut = async () => {
    if (!currentLocation) {
      alert('Location not available. Please enable GPS and try again.');
      return;
    }
    if (!isInsideGeofence && geofences.length > 0) {
      alert('You are not within the designated work area. Please move to the correct location.');
      return;
    }
    if (!currentShift) {
      alert('You are not currently clocked in.');
      return;
    }

    const record = {
      id: Date.now(), userId: user.uid, userName: user.name, type: 'time-out',
      timestamp: new Date().toISOString(), location: currentLocation,
      accuracy: locationAccuracy, date: new Date().toDateString(),
      shiftDuration: Date.now() - new Date(currentShift.timestamp).getTime()
    };

    try {
      await addDoc(collection(db, 'attendance'), record);
      saveAttendanceRecord(record);
      setCurrentShift(null);
      localStorage.removeItem(`current_shift_${user.uid}`);
      if (isMobile && navigator.vibrate) { navigator.vibrate([100, 50, 100]); }
      alert('Successfully clocked out!');
    } catch (error) {
      console.error('Error recording time out:', error);
      alert('Error recording attendance. Please try again.');
    }
  };

  const initializeMap = () => {
    // Only initialize if the Google Maps API is available and the map container exists
    if (!window.google || !mapRef.current) return;
    
    // If a map already exists but the container shows no content, force reinitialization
    if (mapInstanceRef.current) {
      // Check for a missing canvas or map display
      const isMapVisible = mapRef.current.querySelector('canvas') || mapRef.current.querySelector('.gm-style');
      if (isMapVisible) return;
      // Otherwise, clear out the existing instance
      mapInstanceRef.current = null;
    }

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: currentLocation || { lat: 14.5995, lng: 120.9842 }, // Manila default
        zoom: isMobile ? 16 : 15,
        mapTypeId: 'roadmap',
        gestureHandling: isMobile ? 'greedy' : 'cooperative'
      });

      mapInstanceRef.current = map;

      // Clear existing geofence shapes
      geofenceShapesRef.current.forEach(s => s.shape.setMap(null));
      geofenceShapesRef.current = [];

      // Add current location marker if available
      if (currentLocation) {
        if (currentLocationMarkerRef.current) {
          currentLocationMarkerRef.current.setMap(null);
        }
        const marker = new window.google.maps.Marker({
          position: currentLocation, map: map, title: 'Your Location',
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE, scale: 8,
            fillColor: '#3B82F6', fillOpacity: 0.8, strokeColor: '#FFFFFF', strokeWeight: 2
          }
        });
        currentLocationMarkerRef.current = marker;
      }

      // Re-draw existing geofences
      geofences.forEach(geofence => {
        drawGeofenceOnMap(map, geofence);
      });

      // Initialize drawing manager for supervisors
      if (user.role === 'supervisor') {
        initializeDrawingManager(map);
      }

      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const initializeDrawingManager = (map) => {
    if (drawingManagerRef.current) { drawingManagerRef.current.setMap(null); }

    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: null, drawingControl: true,
      drawingControlOptions: {
        position: window.google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          window.google.maps.drawing.OverlayType.CIRCLE,
          window.google.maps.drawing.OverlayType.RECTANGLE,
          window.google.maps.drawing.OverlayType.POLYGON
        ]
      },
      circleOptions: { fillColor: '#3B82F6', fillOpacity: 0.2, strokeWeight: 2, strokeColor: '#3B82F6', clickable: false, editable: true, zIndex: 1 },
      rectangleOptions: { fillColor: '#10B981', fillOpacity: 0.2, strokeWeight: 2, strokeColor: '#10B981', clickable: false, editable: true, zIndex: 1 },
      polygonOptions: { fillColor: '#F59E0B', fillOpacity: 0.2, strokeWeight: 2, strokeColor: '#F59E0B', clickable: false, editable: true, zIndex: 1 }
    });

    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    window.google.maps.event.addListener(drawingManager, 'overlaycomplete', (event) => {
      const shape = event.overlay;
      const type = event.type;

      let geofenceData = {
        name: `Geofence ${geofences.length + 1}`, type: type.toLowerCase(),
        createdBy: user.uid, createdAt: new Date().toISOString()
      };

      if (type === 'circle') {
        geofenceData.center = { lat: shape.getCenter().lat(), lng: shape.getCenter().lng() };
        geofenceData.radius = shape.getRadius();
      } else if (type === 'rectangle') {
        const bounds = shape.getBounds();
        geofenceData.coordinates = [
          { lat: bounds.getNorthEast().lat(), lng: bounds.getSouthWest().lng() },
          { lat: bounds.getNorthEast().lat(), lng: bounds.getNorthEast().lng() },
          { lat: bounds.getSouthWest().lat(), lng: bounds.getNorthEast().lng() },
          { lat: bounds.getSouthWest().lat(), lng: bounds.getSouthWest().lng() }
        ];
      } else if (type === 'polygon') {
        geofenceData.coordinates = shape.getPath().getArray().map(point => ({
          lat: point.lat(), lng: point.lng()
        }));
      }
      saveGeofence(geofenceData, shape);
    });
  };

  const saveGeofence = async (geofenceData, shape) => {
    try {
      const docRef = await addDoc(collection(db, 'geofences'), geofenceData);
      const newGeofence = { id: docRef.id, ...geofenceData };

      if (user.role === 'supervisor') {
        shape.setEditable(true);
        attachGeofenceEditListeners(shape, newGeofence.id, newGeofence.type);
      }

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div><strong>${newGeofence.name}</strong><br>Type: ${newGeofence.type}</div>`
      });
      shape.addListener('click', (e) => {
        infoWindow.setPosition(e.latLng || newGeofence.center || newGeofence.coordinates[0]);
        infoWindow.open(mapInstanceRef.current);
      });

      setGeofences(prevGeofences => [...prevGeofences, newGeofence]);
      geofenceShapesRef.current.push({ id: docRef.id, shape });
      alert(`Geofence "${geofenceData.name}" created successfully!`);
    } catch (error) {
      console.error('Error saving geofence:', error);
      alert('Error saving geofence. Please try again.');
    }
  };

  const drawGeofenceOnMap = (map, geofence) => {
    let shape;

    if (geofence.type === 'circle') {
      shape = new window.google.maps.Circle({
        map: map, center: geofence.center, radius: geofence.radius,
        fillColor: '#3B82F6', fillOpacity: 0.2, strokeWeight: 2, strokeColor: '#3B82F6', clickable: true
      });
    } else if (geofence.type === 'rectangle') {
      const bounds = new window.google.maps.LatLngBounds();
      geofence.coordinates.forEach(coord => bounds.extend(coord));
      shape = new window.google.maps.Rectangle({
        map: map, bounds: bounds,
        fillColor: '#10B981', fillOpacity: 0.2, strokeWeight: 2, strokeColor: '#10B981', clickable: true
      });
    } else if (geofence.type === 'polygon') {
      shape = new window.google.maps.Polygon({
        map: map, paths: geofence.coordinates,
        fillColor: '#F59E0B', fillOpacity: 0.2, strokeWeight: 2, strokeColor: '#F59E0B', clickable: true
      });
    }

    if (shape) {
      if (user.role === 'supervisor') {
        shape.setEditable(true);
        attachGeofenceEditListeners(shape, geofence.id, geofence.type);
      }

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div><strong>${geofence.name}</strong><br>Type: ${geofence.type}</div>`
      });
      shape.addListener('click', (e) => {
        infoWindow.setPosition(e.latLng || geofence.center || geofence.coordinates[0]);
        infoWindow.open(map);
      });
      geofenceShapesRef.current.push({ id: geofence.id, shape });
    }
  };

  const attachGeofenceEditListeners = (shape, geofenceId, type) => {
    if (type === 'circle') {
      shape.addListener('center_changed', () => handleShapeEdit(shape, geofenceId, 'circle'));
      shape.addListener('radius_changed', () => handleShapeEdit(shape, geofenceId, 'circle'));
    } else if (type === 'rectangle') {
      shape.addListener('bounds_changed', () => handleShapeEdit(shape, geofenceId, 'rectangle'));
    } else if (type === 'polygon') {
      shape.getPath().addListener('set_at', () => handleShapeEdit(shape, geofenceId, 'polygon'));
      shape.getPath().addListener('insert_at', () => handleShapeEdit(shape, geofenceId, 'polygon'));
      shape.getPath().addListener('remove_at', () => handleShapeEdit(shape, geofenceId, 'polygon'));
    }
  };

  const handleShapeEdit = async (shape, geofenceId, type) => {
    let updatedData = {};
    if (type === 'circle') {
      updatedData = { center: { lat: shape.getCenter().lat(), lng: shape.getCenter().lng() }, radius: shape.getRadius() };
    } else if (type === 'rectangle') {
      const bounds = shape.getBounds();
      updatedData = {
        coordinates: [
          { lat: bounds.getNorthEast().lat(), lng: bounds.getSouthWest().lng() },
          { lat: bounds.getNorthEast().lat(), lng: bounds.getNorthEast().lng() },
          { lat: bounds.getSouthWest().lat(), lng: bounds.getNorthEast().lng() },
          { lat: bounds.getSouthWest().lat(), lng: bounds.getSouthWest().lng() }
        ]
      };
    } else if (type === 'polygon') {
      updatedData = {
        coordinates: shape.getPath().getArray().map(point => ({ lat: point.lat(), lng: point.lng() }))
      };
    }

    try {
      await updateDoc(doc(db, 'geofences', geofenceId), updatedData);
      setGeofences(prevGeofences =>
        prevGeofences.map(g => (g.id === geofenceId ? { ...g, ...updatedData } : g))
      );
      console.log(`Geofence ${geofenceId} updated successfully.`);
    } catch (error) {
      console.error('Error updating geofence:', error);
      alert('Error updating geofence. Please try again.');
    }
  };

  const deleteGeofence = async (geofenceId) => {
    if (!confirm('Are you sure you want to delete this geofence?')) return;
    try {
      await deleteDoc(doc(db, 'geofences', geofenceId));
      setGeofences(geofences.filter(g => g.id !== geofenceId));
      const shapeRef = geofenceShapesRef.current.find(s => s.id === geofenceId);
      if (shapeRef) {
        shapeRef.shape.setMap(null);
        geofenceShapesRef.current = geofenceShapesRef.current.filter(s => s.id !== geofenceId);
      }
      alert('Geofence deleted successfully!');
    } catch (error) {
      console.error('Error deleting geofence:', error);
      alert('Error deleting geofence. Please try again.');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.description) return;
    try {
      const taskData = {
        ...newTask, createdBy: user.uid, createdByName: user.name,
        createdAt: new Date().toISOString(), status: 'pending', completedAt: null
      };
      await addDoc(collection(db, 'tasks'), taskData);
      setNewTask({ title: '', description: '', dueDate: '', priority: 'medium', assignedTo: '' });
      setShowNewTaskModal(false);
      loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Error creating task. Please try again.');
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.message) return;
    try {
      const announcementData = {
        ...newAnnouncement, createdBy: user.uid, createdByName: user.name,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'announcements'), announcementData);
      setNewAnnouncement({ title: '', message: '', priority: 'normal' });
      setShowNewAnnouncementModal(false);
      loadAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('Error creating announcement. Please try again.');
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      const updateData = {
        status: newStatus,
        ...(newStatus === 'completed' && { completedAt: new Date().toISOString() })
      };
      await updateDoc(taskRef, updateData);
      loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Error updating task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="flex items-center space-x-3">
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700 font-medium">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">OJT Management System</h1>
                <p className="text-sm text-gray-600">
                  {getGreeting()}, {user?.name || 'User'}! ({user?.role === 'supervisor' ? 'Supervisor' : 'Intern'})
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Location Status */}
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${currentLocation ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs text-gray-600">
                    {currentLocation ? 'GPS Active' : 'GPS Inactive'}
                  </span>
                </div>
                {isInsideGeofence && (
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-blue-600">In Work Area</span>
                  </div>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-red-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'tasks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'announcements'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Announcements
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveTab('location')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'location'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Location & Map
            </button>
            {user?.role === 'supervisor' && (
              <button
                onClick={() => setActiveTab('manage')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'manage'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Manage
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab
            user={user}
            tasks={tasks}
            announcements={announcements}
            geofences={geofences}
            attendanceRecords={attendanceRecords}
            currentShift={currentShift}
            shiftSchedule={shiftSchedule}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksTab
            user={user}
            tasks={tasks}
            handleUpdateTaskStatus={handleUpdateTaskStatus}
            handleDeleteTask={handleDeleteTask}
          />
        )}

        {activeTab === 'announcements' && (
          <AnnouncementsTab
            announcements={announcements}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab
            user={user}
            currentLocation={currentLocation}
            locationAccuracy={locationAccuracy}
            locationError={locationError}
            isInsideGeofence={isInsideGeofence}
            geofences={geofences}
            currentShift={currentShift}
            attendanceRecords={attendanceRecords}
            isMobile={isMobile}
            handleTimeIn={handleTimeIn}
            handleTimeOut={handleTimeOut}
            initializeGeolocation={initializeGeolocation}
          />
        )}

        {activeTab === 'location' && (
          <LocationTab
            user={user}
            currentLocation={currentLocation}
            locationAccuracy={locationAccuracy}
            locationError={locationError}
            isTracking={isTracking}
            isInsideGeofence={isInsideGeofence}
            geofences={geofences}
            mapRef={mapRef}
            isMobile={isMobile}
            startLocationTracking={startLocationTracking}
            stopLocationTracking={stopLocationTracking}
            deleteGeofence={deleteGeofence}
            onRequestMapInit={initializeMap}
            isVisible={activeTab === 'location'}
          />
        )}

        {activeTab === 'manage' && user?.role === 'supervisor' && (
          <ManageTab
            user={user}
            setShowNewTaskModal={setShowNewTaskModal}
            setShowNewAnnouncementModal={setShowNewAnnouncementModal}
            setActiveTab={setActiveTab}
            shiftSchedule={shiftSchedule}
            setShiftSchedule={setShiftSchedule}
          />
        )}
      </main>

      {/* Modals */}
      {showNewTaskModal && (
        <NewTaskModal
          newTask={newTask}
          setNewTask={setNewTask}
          handleCreateTask={handleCreateTask}
          setShowNewTaskModal={setShowNewTaskModal}
        />
      )}

      {showNewAnnouncementModal && (
        <NewAnnouncementModal
          newAnnouncement={newAnnouncement}
          setNewAnnouncement={setNewAnnouncement}
          handleCreateAnnouncement={handleCreateAnnouncement}
          setShowNewAnnouncementModal={setShowNewAnnouncementModal}
        />
      )}
    </div>
  );
}

export default Dashboard;
