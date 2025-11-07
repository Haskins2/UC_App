import { XMLParser } from 'fast-xml-parser';
import { DART_STATION_CODES } from '../app/(tabs)/track';

interface TrainMovement {
  TrainCode: string;
  TrainDate: string;
  LocationCode: string;
  LocationFullName: string;
  LocationOrder: string;
  LocationType: string;
  TrainOrigin: string;
  TrainDestination: string;
  ScheduledArrival: string;
  ScheduledDeparture: string;
  ExpectedArrival: string;
  ExpectedDeparture: string;
  Arrival: string;
  Departure: string;
  AutoArrival: string;
  AutoDepart: string;
  StopType: string;
}

export interface TrainPosition {
  position: number; // Position between stations (0-based index + decimal for interpolation)
  currentStation: string | null;
  nextStation: string | null;
  isAtStation: boolean;
  progress: number; // Raw progress percentage (0-1) between current and next station
}

export async function getTrainMovements(trainCode: string, trainDate?: string): Promise<TrainMovement[]> {
  const date = trainDate || new Date().toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  const apiUrl = `http://api.irishrail.ie/realtime/realtime.asmx/getTrainMovementsXML?TrainId=${encodeURIComponent(trainCode)}&TrainDate=${encodeURIComponent(date)}`;
  
  const response = await fetch(apiUrl);
  const xmlData = await response.text();
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  
  const result = parser.parse(xmlData);
  const movements = result.ArrayOfObjTrainMovements?.objTrainMovements || [];
  
  return Array.isArray(movements) ? movements : [movements];
}

export function calculateTrainPosition(movements: TrainMovement[]): TrainPosition {
  // Filter only stops (S), not timing points (T)
  const stops = movements.filter(m => m.LocationType === 'S');
  
  // Find current and next stops
  const currentStop = stops.find(m => m.StopType === 'C');
  const nextStop = stops.find(m => m.StopType === 'N');
  
  if (!currentStop || !nextStop) {
    console.log('Could not find current or next stop');
    return { position: 0, currentStation: null, nextStation: null, isAtStation: true, progress: 0 };
  }

  console.log(`Current Stop: ${currentStop.LocationFullName} (${currentStop.LocationCode})`);
  console.log(`Next Stop: ${nextStop.LocationFullName} (${nextStop.LocationCode})`);
  console.log(`Expected Arrival at Next: ${nextStop.ExpectedArrival}`);
  console.log(`Actual Departure from Current: ${currentStop.Departure}`);

  // Find indices in the DART_STATION_CODES
  const stationNames = Object.keys(DART_STATION_CODES);
  const currentIndex = stationNames.findIndex(name => 
    DART_STATION_CODES[name] === currentStop.LocationCode
  );
  const nextIndex = stationNames.findIndex(name => 
    DART_STATION_CODES[name] === nextStop.LocationCode
  );

  if (currentIndex === -1 || nextIndex === -1) {
    console.log('Station not found in DART_STATION_CODES');
    return { position: 0, currentStation: null, nextStation: null, isAtStation: true, progress: 0 };
  }

  // Check if train has departed current station
  const hasDeparted = currentStop.Departure && currentStop.Departure !== 'N/A';
  
  if (!hasDeparted) {
    // console.log('Train is at station (not departed yet)');
    return {
      position: currentIndex,
      currentStation: stationNames[currentIndex],
      nextStation: stationNames[nextIndex],
      isAtStation: true,
      progress: 0
    };
  }

  // Train has departed, interpolate position
  const now = new Date();
  const expectedArrival = parseTime(nextStop.ExpectedArrival);
  const actualDeparture = parseTime(currentStop.Departure);

  if (!expectedArrival || !actualDeparture) {
    console.log('Could not parse times');
    // Return progress 0 instead of 0.5 to start at departure station
    return {
      position: currentIndex,
      currentStation: stationNames[currentIndex],
      nextStation: stationNames[nextIndex],
      isAtStation: false,
      progress: 0
    };
  }

  const totalDuration = expectedArrival.getTime() - actualDeparture.getTime();
  const elapsed = now.getTime() - actualDeparture.getTime();
  
  // Clamp progress between 0 and 1
  const progress = Math.min(Math.max(elapsed / totalDuration, 0), 1);

  console.log(`Progress: ${(progress * 100).toFixed(1)}%`);
  console.log(`Time elapsed: ${(elapsed / 1000).toFixed(0)}s of ${(totalDuration / 1000).toFixed(0)}s`);
  console.log(`Actual departure time: ${actualDeparture.toLocaleTimeString()}`);
  console.log(`Expected arrival time: ${expectedArrival.toLocaleTimeString()}`);
  console.log(`Current time: ${now.toLocaleTimeString()}`);

  const interpolatedPosition = currentIndex + progress;

  return {
    position: interpolatedPosition,
    currentStation: stationNames[currentIndex],
    nextStation: stationNames[nextIndex],
    isAtStation: false,
    progress
  };
}

function parseTime(timeStr: string): Date | null {
  if (!timeStr || timeStr === 'N/A') return null;
  
  const today = new Date();
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  
  today.setHours(hours, minutes, seconds || 0, 0);
  return today;
}
