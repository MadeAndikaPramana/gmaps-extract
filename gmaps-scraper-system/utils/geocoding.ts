// gmaps-scraper-system/utils/geocoding.ts

// Simple delay function to respect API rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface NominatimResponse {
  boundingbox: [string, string, string, string]; // [south_lat, north_lat, west_lon, east_lon]
}

/**
 * Fetches the bounding box for a given location using the Nominatim API.
 * @param location The location to geocode (e.g., "Bali").
 * @returns A promise that resolves to the bounding box array or null if not found.
 */
export async function getBoundaryBox(location: string): Promise<[number, number, number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;

  try {
    console.log(`Fetching bounding box for "${location}"...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GoogleMapsScraper/1.0 (https://github.com/your-repo)', // Nominatim requires a custom User-Agent
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned status ${response.status}`);
    }

    const data: NominatimResponse[] = await response.json();

    if (data && data.length > 0 && data[0].boundingbox) {
      const [south, north, west, east] = data[0].boundingbox.map(parseFloat);
      console.log(`Found bounding box: [${south}, ${north}, ${west}, ${east}]`);

      // Respect the 1 request per second rate limit
      await delay(1000);

      return [south, north, west, east];
    } else {
      console.log(`No bounding box found for "${location}"`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching bounding box for "${location}":`, error);
    return null;
  }
}

/**
 * Generates a grid of latitude/longitude coordinates within a given bounding box.
 * @param boundingBox The bounding box [south, north, west, east].
 * @param gridSize The number of cells per side of the grid (e.g., 5 for a 5x5 grid).
 * @returns An array of { lat: number; lng: number } objects representing the center of each grid cell.
 */
export function generateGrid(boundingBox: [number, number, number, number], gridSize: number): { lat: number; lng: number }[] {
  const [south, north, west, east] = boundingBox;
  const grid: { lat: number; lng: number }[] = [];

  const latStep = (north - south) / gridSize;
  const lngStep = (east - west) / gridSize;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = south + (i + 0.5) * latStep;
      const lng = west + (j + 0.5) * lngStep;
      grid.push({ lat, lng });
    }
  }

  console.log(`Generated a ${gridSize}x${gridSize} grid with ${grid.length} cells.`);
  return grid;
}
