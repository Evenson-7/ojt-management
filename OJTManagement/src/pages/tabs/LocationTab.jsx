// LocationTab.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';

/** Generate a unique default name like "Geofence 1", "Geofence 2"… */
const generateUniqueName = (geofences, base = 'Geofence') => {
  const usedNums = new Set(
    (geofences || [])
      .map(g => (g?.name || '').trim())
      .map(n => {
        if (!n) return null;
        const m = new RegExp(`^${base}\\s+(\\d+)$`, 'i').exec(n);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter(n => Number.isInteger(n))
  );

  const hasBare = (geofences || []).some(
    g => (g?.name || '').trim().toLowerCase() === base.toLowerCase()
  );
  if (hasBare) usedNums.add(1);

  let i = 1;
  while (usedNums.has(i)) i += 1;
  return `${base} ${i}`;
};

/** Display-only de-dup: “Name”, then “Name (2)”, “Name (3)”, … */
const getDisplayNameFactory = (geofences) => {
  const counts = new Map();
  return (rawName, fallback) => {
    const name = (rawName && String(rawName).trim()) || fallback;
    const key = name.toLowerCase();
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    return n === 1 ? name : `${name} (${n})`;
  };
};

// Build a localStorage key to persist "created once ever" per user/browser
const getGeofenceOnceKey = (user) => {
  const who = user?.id || user?.email || 'anon';
  return `geofence_once_created_${who}`;
};

function LocationTab({
  user, currentLocation, locationAccuracy, locationError,
  isTracking, isInsideGeofence, geofences = [], mapRef, isMobile,
  startLocationTracking, stopLocationTracking, deleteGeofence,
  isVisible = true,
  onRequestMapInit,
  /** Optional: parent can pass this to create a geofence programmatically */
  createGeofence,
  /** 'perSession' (1 at a time) | 'ever' (only once per user/browser). Default: 'perSession' */
  singleCreateMode = 'perSession',
  /** If true, hide the Create button once creation is blocked. Default: false (disable with reason) */
  hideCreateWhenBlocked = false,
}) {
  const lastLocationRef = useRef(null);
  const lastZoomRef = useRef(13);
  const mapFixTimeoutRef = useRef(null);

  // Unified loading flags
  const [loading, setLoading] = useState({
    startTrack: false,
    stopTrack: false,
    deleteGeofenceId: null,
    mapInit: false,
  });

  // Has this browser/user already created a geofence (for "ever" mode)?
  const [hasCreatedEver, setHasCreatedEver] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (singleCreateMode !== 'ever') return false;
    try {
      const key = getGeofenceOnceKey(user);
      return window.localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });

  // If user changes (or mode changes), re-check persisted flag
  useEffect(() => {
    if (singleCreateMode !== 'ever') return;
    try {
      const key = getGeofenceOnceKey(user);
      setHasCreatedEver(window.localStorage.getItem(key) === '1');
    } catch {}
  }, [user, singleCreateMode]);

  // Helper to wrap sync/async functions with loading toggles
  const runMaybeAsync = async (fn, before = () => {}, after = () => {}, ...args) => {
    try {
      before?.();
      const res = fn?.(...args);
      if (res && typeof res.then === 'function') {
        await res;
      }
      return res;
    } finally {
      after?.();
    }
  };

  // Action handlers
  const handleStartTracking = async () => {
    await runMaybeAsync(
      startLocationTracking,
      () => setLoading(l => ({ ...l, startTrack: true })),
      () => setLoading(l => ({ ...l, startTrack: false }))
    );
  };

  const handleStopTracking = async () => {
    await runMaybeAsync(
      stopLocationTracking,
      () => setLoading(l => ({ ...l, stopTrack: true })),
      () => setLoading(l => ({ ...l, stopTrack: false }))
    );
  };

  const handleDeleteGeofence = async (id) => {
    if (!deleteGeofence) return;
    await runMaybeAsync(
      () => deleteGeofence(id),
      () => setLoading(l => ({ ...l, deleteGeofenceId: id })),
      () => setLoading(l => ({ ...l, deleteGeofenceId: null }))
    );
  };

  // One-time creation guard
  const creationBlockedReason = useMemo(() => {
    if (singleCreateMode === 'ever' && hasCreatedEver) return 'A geofence was already created on this browser.';
    if (singleCreateMode === 'perSession' && geofences.length > 0) return 'Only one geofence allowed at a time.';
    return null;
  }, [singleCreateMode, hasCreatedEver, geofences.length]);

  const creationBlocked = Boolean(creationBlockedReason);

  const handleCreateGeofence = async () => {
    if (creationBlocked) {
      alert(creationBlockedReason);
      return;
    }
    const uniqueName = generateUniqueName(geofences, 'Geofence');
    if (typeof createGeofence === 'function') {
      const res = await runMaybeAsync(
        () => createGeofence({ name: uniqueName }),
        () => {}, // you could set a specific create loading flag if you add one
        () => {}
      );
      // Mark as "created ever"
      if (singleCreateMode === 'ever') {
        try {
          const key = getGeofenceOnceKey(user);
          window.localStorage.setItem(key, '1');
        } catch {}
        setHasCreatedEver(true);
      }
      return res;
    } else {
      alert(`Use the drawing tools on the map to create geofences.\nSuggested name: ${uniqueName}`);
      // If the drawing flow results in a geofence creation immediately, also mark:
      if (singleCreateMode === 'ever') {
        try {
          const key = getGeofenceOnceKey(user);
          window.localStorage.setItem(key, '1');
        } catch {}
        setHasCreatedEver(true);
      }
    }
  };

  // Stop tracking on logout
  useEffect(() => {
    if (!user && isTracking) {
      stopLocationTracking?.();
    }
  }, [user, isTracking, stopLocationTracking]);

  // Store last known location
  useEffect(() => {
    if (currentLocation?.lat && currentLocation?.lng) {
      lastLocationRef.current = currentLocation;
    }
  }, [currentLocation]);

  // Enhanced map fix for tab switching + map (re)init loading
  useEffect(() => {
    if (!isVisible || !isTracking) return;
    const el = mapRef?.current;
    if (!el) return;

    const doRefresh = async () => {
      const map = el.__googleMap || el.__map || el._map || window.__activeMap;
      const locationToUse = currentLocation || lastLocationRef.current;

      // Google Maps
      if (typeof window !== 'undefined' && window.google && window.google.maps?.event && map) {
        try {
          window.google.maps.event.trigger(map, 'resize');
          if (locationToUse?.lat && locationToUse?.lng) {
            const center = new window.google.maps.LatLng(locationToUse.lat, locationToUse.lng);
            map.setCenter(center);
            const currentZoom = map.getZoom();
            if (currentZoom) lastZoomRef.current = currentZoom;
          }
          setTimeout(() => window.google.maps.event.trigger(map, 'idle'), 50);
        } catch (error) {
          console.warn('Google Maps refresh failed:', error);
        }
        return;
      }

      // Mapbox
      if (map && typeof map.resize === 'function') {
        try {
          map.resize();
          if (locationToUse?.lat && locationToUse?.lng) {
            if (typeof map.setCenter === 'function') {
              map.setCenter([locationToUse.lng, locationToUse.lat]);
            }
            if (typeof map.setZoom === 'function') {
              map.setZoom(lastZoomRef.current);
            }
          }
          setTimeout(() => { if (map.triggerRepaint) map.triggerRepaint(); }, 50);
        } catch (error) {
          console.warn('Mapbox refresh failed:', error);
        }
        return;
      }

      // Leaflet
      if (map && typeof map.invalidateSize === 'function') {
        try {
          map.invalidateSize();
          if (locationToUse?.lat && locationToUse?.lng) {
            map.setView([locationToUse.lat, locationToUse.lng], lastZoomRef.current);
          }
        } catch (error) {
          console.warn('Leaflet refresh failed:', error);
        }
        return;
      }

      // Re-init if no map content
      const hasMapContent = el.querySelector('canvas') ||
                            el.querySelector('.gm-style') ||
                            el.querySelector('.mapboxgl-map') ||
                            el.querySelector('.leaflet-container');

      if (!hasMapContent && typeof onRequestMapInit === 'function') {
        console.warn("Map content missing. Attempting reinitialization...");
        try {
          await runMaybeAsync(
            () => onRequestMapInit(el),
            () => setLoading(l => ({ ...l, mapInit: true })),
            () => setLoading(l => ({ ...l, mapInit: false }))
          );
        } catch (error) {
          console.error('Map reinitialization failed:', error);
        }
      } else if (!hasMapContent && !onRequestMapInit) {
        console.warn("Map content missing but no reinitialization callback provided");
      }
    };

    if (mapFixTimeoutRef.current) clearTimeout(mapFixTimeoutRef.current);
    doRefresh();
    const t1 = setTimeout(doRefresh, 80);
    const t2 = setTimeout(doRefresh, 200);
    mapFixTimeoutRef.current = t2;

    // Resize observer to keep map sized right
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (mapFixTimeoutRef.current) clearTimeout(mapFixTimeoutRef.current);
        mapFixTimeoutRef.current = setTimeout(doRefresh, 100);
      });
      try { ro.observe(el); } catch (error) {}
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (mapFixTimeoutRef.current) clearTimeout(mapFixTimeoutRef.current);
      if (ro) ro.disconnect();
    };
  }, [isVisible, isTracking, currentLocation, mapRef, onRequestMapInit]);

  // Browser tab visibility changes
  useEffect(() => {
    if (!isTracking) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && isVisible) {
        setTimeout(() => {
          const el = mapRef?.current;
          if (!el) return;
          const map = el.__googleMap || el.__map || el._map || window.__activeMap;
          const locationToUse = currentLocation || lastLocationRef.current;
          if (window.google && window.google.maps?.event && map) {
            try {
              window.google.maps.event.trigger(map, 'resize');
              if (locationToUse?.lat && locationToUse?.lng) {
                map.setCenter(new window.google.maps.LatLng(locationToUse.lat, locationToUse.lng));
              }
            } catch (error) {}
          }
        }, 150);
      }
    };

    const handleFocus = () => isVisible && handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isTracking, isVisible, currentLocation, mapRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapFixTimeoutRef.current) clearTimeout(mapFixTimeoutRef.current);
    };
  }, []);

  const isAnyTrackingActionLoading = useMemo(
    () => loading.startTrack || loading.stopTrack,
    [loading.startTrack, loading.stopTrack]
  );

  // Display-name de-dup (fresh per render)
  const getDisplayName = useMemo(() => getDisplayNameFactory(geofences), [geofences]);

  // Whether to render the Create button at all
  const showCreateBtn = !(hideCreateWhenBlocked && creationBlocked);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Location & Geofencing</h2>
        <div className="flex space-x-3">
          {/* Start/Stop with loading */}
          <button
            onClick={isTracking ? handleStopTracking : handleStartTracking}
            disabled={isAnyTrackingActionLoading}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              isTracking
                ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                : 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
            }`}
          >
            {isTracking
              ? (loading.stopTrack ? 'Stopping…' : 'Stop Tracking')
              : (loading.startTrack ? 'Starting…' : 'Start Tracking')}
          </button>

          {user?.role === 'supervisor' && showCreateBtn && (
            <button
              onClick={handleCreateGeofence}
              disabled={creationBlocked}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                creationBlocked
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={creationBlocked ? creationBlockedReason : 'Create Geofence'}
            >
              {creationBlocked ? 'Creation Locked' : 'Create Geofence'}
            </button>
          )}
        </div>
      </div>

      {/* (Optional) banner explaining why creation is disabled */}
      {creationBlocked && !hideCreateWhenBlocked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          {creationBlockedReason}
        </div>
      )}

      {/* Location Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Current Location</h4>
            {currentLocation ? (
              <div className="text-sm text-gray-600">
                <p>Lat: {currentLocation.lat.toFixed(6)}</p>
                <p>Lng: {currentLocation.lng.toFixed(6)}</p>
                <p>Accuracy: ±{Math.round(locationAccuracy || 0)}m</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Location not available</p>
            )}
            {locationError && (
              <p className="text-xs text-red-600 mt-1">{locationError}</p>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Geofence Status</h4>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isInsideGeofence ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isInsideGeofence ? 'Inside work area' : 'Outside work area'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{geofences.length} geofence(s) active</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Tracking Status</h4>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {isTracking ? 'Real-time tracking active' : 'Tracking disabled'}
              </span>
            </div>
            {isMobile && (
              <p className="text-xs text-gray-500">Mobile optimized</p>
            )}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Interactive Map</h3>
        </div>
        <div className="p-6 relative">
          <div
            ref={mapRef}
            className="w-full h-96 rounded-lg border border-gray-200 overflow-hidden relative"
            style={{
              minHeight: isMobile ? '300px' : '400px',
              position: 'relative',
              zIndex: 1
            }}
          >
            {typeof window !== 'undefined' && (!window.google) && (
              <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <p className="text-gray-500 text-sm mt-2">Loading Google Maps…</p>
                  <p className="text-gray-400 text-xs mt-1">Please wait while the map initializes</p>
                </div>
              </div>
            )}
          </div>

          {/* overlay while map initializing or start/stop in-flight */}
          {(loading.mapInit || isAnyTrackingActionLoading) && (
            <div className="absolute inset-6 rounded-lg bg-white/70 backdrop-blur-sm border border-dashed border-gray-300 flex items-center justify-center" style={{ zIndex: 10 }}>
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  <p className="text-sm text-gray-600">
                    {loading.mapInit ? 'Initializing map…' : (loading.startTrack ? 'Starting tracking…' : 'Stopping tracking…')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isTracking && !isAnyTrackingActionLoading && (
            <div className="absolute inset-6 rounded-lg bg-white/70 backdrop-blur-sm border border-dashed border-gray-300 flex items-center justify-center" style={{ zIndex: 10 }}>
              <div className="text-center">
                <p className="text-sm text-gray-600">Tracking is off.</p>
                <button
                  onClick={handleStartTracking}
                  disabled={loading.startTrack}
                  className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading.startTrack ? 'Starting…' : 'Start Tracking'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geofences List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Geofences</h3>
        </div>
        <div className="p-6">
          {geofences.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <p className="text-gray-500 text-sm mt-2">No geofences created yet</p>
              {user?.role === 'supervisor' && showCreateBtn && (
                <button
                  onClick={handleCreateGeofence}
                  disabled={creationBlocked}
                  className={`mt-2 text-sm font-medium ${
                    creationBlocked ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'
                  }`}
                  title={creationBlocked ? creationBlockedReason : 'Create your first geofence'}
                >
                  {creationBlocked ? 'Creation Locked' : 'Create your first geofence'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {geofences.map((geofence, index) => {
                const id = geofence.id ?? index;
                const isDeleting = loading.deleteGeofenceId === id;
                const displayName = getDisplayName(geofence?.name, `Geofence ${index + 1}`);

                return (
                  <div key={id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{displayName}</h4>
                      <p className="text-sm text-gray-600">
                        {geofence.type === 'circle'
                          ? `Circle - Radius: ${geofence.radius}m`
                          : `Polygon - ${geofence.coordinates?.length || 0} points`
                        }
                      </p>
                      {geofence.description && (
                        <p className="text-xs text-gray-500 mt-1">{geofence.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${geofence.active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-xs text-gray-500">
                        {geofence.active ? 'Active' : 'Inactive'}
                      </span>
                      {user?.role === 'supervisor' && deleteGeofence && (
                        <button
                          onClick={() => handleDeleteGeofence(id)}
                          disabled={isDeleting}
                          className="ml-2 text-red-600 hover:text-red-800 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                          title={isDeleting ? 'Deleting…' : 'Delete geofence'}
                        >
                          {isDeleting ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LocationTab;
