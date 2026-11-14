export interface UserLocationState {
  latitude: number;
  longitude: number;
  city: string;
  label: string;
  isLiveGps: boolean;
}

const CITY_COORDINATES: Record<string, { lat: number; lng: number; label: string }> = {
  Karachi: { lat: 24.8138, lng: 67.0303, label: 'Karachi (Near Clifton / DHA)' },
  Lahore: { lat: 31.5102, lng: 74.3441, label: 'Lahore (Gulberg III)' },
  Islamabad: { lat: 33.7294, lng: 73.0761, label: 'Islamabad (F-6 Markaz)' }
};

export const DEFAULT_USER_LOCATION: UserLocationState = {
  latitude: 24.8138,
  longitude: 67.0303,
  city: 'Karachi',
  label: 'Current Location (Karachi)',
  isLiveGps: false
};

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function detectNearestCity(lat: number, lng: number): string {
  let closest = 'Karachi';
  let minDistance = Infinity;
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    const dist = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = city;
    }
  }
  return closest;
}

export function requestUserGeolocation(): Promise<UserLocationState> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(DEFAULT_USER_LOCATION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const city = detectNearestCity(latitude, longitude);
        resolve({
          latitude,
          longitude,
          city,
          label: `Near You (${city})`,
          isLiveGps: true
        });
      },
      () => {
        resolve(DEFAULT_USER_LOCATION);
      },
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

export function getCoordinatesForCity(city: string): UserLocationState {
  const match = CITY_COORDINATES[city];
  if (!match) return DEFAULT_USER_LOCATION;
  return {
    latitude: match.lat,
    longitude: match.lng,
    city,
    label: match.label,
    isLiveGps: false
  };
}
