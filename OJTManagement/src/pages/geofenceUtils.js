export const getDistanceBetweenPoints = (point1, point2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const isPointInCircle = (point, center, radius) => {
  const distance = getDistanceBetweenPoints(point, center);
  return distance <= radius;
};

export const isPointInPolygon = (point, coordinates) => {
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    if (((coordinates[i].lat > point.lat) !== (coordinates[j].lat > point.lat)) &&
        (point.lng < (coordinates[j].lng - coordinates[i].lng) * (point.lat - coordinates[i].lat) / (coordinates[j].lat - coordinates[i].lat) + coordinates[i].lng)) {
      inside = !inside;
    }
  }
  return inside;
};

export const isLocationInsideGeofence = (location, geofence) => {
  switch (geofence.type) {
    case 'circle':
      return isPointInCircle(location, geofence.center, geofence.radius);
    case 'rectangle':
      const latMin = Math.min(geofence.coordinates[0].lat, geofence.coordinates[2].lat);
      const latMax = Math.max(geofence.coordinates[0].lat, geofence.coordinates[2].lat);
      const lngMin = Math.min(geofence.coordinates[0].lng, geofence.coordinates[2].lng);
      const lngMax = Math.max(geofence.coordinates[0].lng, geofence.coordinates[2].lng);

      return (
        location.lat >= latMin &&
        location.lat <= latMax &&
        location.lng >= lngMin &&
        location.lng <= lngMax
      );
    case 'polygon':
      return isPointInPolygon(location, geofence.coordinates);
    default:
      return false;
  }
};
