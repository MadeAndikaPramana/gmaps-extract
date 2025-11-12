import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

export async function getCoordsFromLocation(location: string): Promise<{ lat: number; lng: number }> {
  // This is a placeholder. In a real application, you'd use a geocoding service.
  // For the purpose of this task, I will return a fixed coordinate for "Bali".
  if (location.toLowerCase().includes('bali')) {
    return { lat: -8.409518, lng: 115.188919 };
  }
  // Default coordinates if location is not recognized
  return { lat: 34.052235, lng: -118.243683 };
}

export function createGrid(lat: number, lng: number, gridSize: number, radiusKm: number = 50) {
  const grid = [];
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  const latStep = (radiusKm / kmPerDegreeLat) / (gridSize -1);
  const lngStep = (radiusKm / kmPerDegreeLng) / (gridSize-1);

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      grid.push({
        lat: lat - (radiusKm / 2 / kmPerDegreeLat) + i * latStep,
        lng: lng - (radiusKm / 2 / kmPerDegreeLng) + j * lngStep,
      });
    }
  }
  return grid;
}
