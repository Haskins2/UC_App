import { XMLParser } from 'fast-xml-parser';

export interface TrainMovement {
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
  currentStation: string | null;
  nextStation: string | null;
  isAtStation: boolean;
  position: number;
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

  const allMovements = Array.isArray(movements) ? movements : [movements];
  
  return allMovements;
  // each object returned here represents a single location along the trains route.
}


export function calculateTrainPosition(movements: TrainMovement[], stationCodes: Record<string, string>): TrainPosition {
  // Filter only stops (S), not timing points (T)
  const stops = movements.filter(m => ['S', 'O', 'D'].includes(m.LocationType));
  
  // Find current and next stops
  const currentStop = stops.find(m => m.StopType === 'C');
  const nextStop = stops.find(m => m.StopType === 'N');
  
  if (!currentStop) {
    console.log('Could not find current stop');
    return { currentStation: null, nextStation: null, isAtStation: true, position: -1 };
  }

  const stationNames = Object.keys(stationCodes);
  const currentIndex = stationNames.findIndex(name => 
    stationCodes[name] === currentStop.LocationCode
  );

  if (currentIndex === -1) {
    console.log('Current station not found in stationCodes[]');
    return { currentStation: null, nextStation: null, isAtStation: true, position: -1 };
  }

  // Handle arrival at destination (no next stop)
  if (!nextStop) {
    console.log('Train may be at its destination.');
    return {
      currentStation: stationNames[currentIndex],
      nextStation: null,
      isAtStation: true,
      position: currentIndex,
    };
  }

//   console.log(`Current Stop: ${currentStop.LocationFullName} (${currentStop.LocationCode})`);
//   console.log(`Next Stop: ${nextStop.LocationFullName} (${nextStop.LocationCode})`);
//   console.log(`Expected Arrival at Next: ${nextStop.ExpectedArrival}`);
//   console.log(`Actual Departure from Current: ${currentStop.Departure}`);

  // Find indices in the DART_STATION_CODES
  const nextIndex = stationNames.findIndex(name => 
    stationCodes[name] === nextStop.LocationCode
  );

  if (nextIndex === -1) {
    console.log('Next station not found in stationCodes[]');
    // Still return info about current stop
    return { 
      currentStation: stationNames[currentIndex], 
      nextStation: null, 
      isAtStation: true, 
      position: currentIndex 
    };
  }

  // Check if train has departed current station
  const hasDeparted = currentStop.Departure && currentStop.Departure !== 'N/A';
  
  if (!hasDeparted) {
    // console.log('Train is at station (not departed yet)');
    return {
      currentStation: stationNames[currentIndex],
      nextStation: stationNames[nextIndex],
      isAtStation: true,
      position: currentIndex, // Position is the current station's index
    };
  }

  // Train has departed, interpolate position
  const now = new Date();
  const expectedArrival = parseTime(nextStop.ExpectedArrival);
  const actualDeparture = parseTime(currentStop.Departure);

  if (!expectedArrival || !actualDeparture) {
    console.log('Could not parse times');
    return {
      currentStation: stationNames[currentIndex],
      nextStation: stationNames[nextIndex],
      isAtStation: false,
      position: currentIndex, // Default to current station if times are invalid
    };
 }

  const totalDuration = expectedArrival.getTime() - actualDeparture.getTime();
  const elapsed = now.getTime() - actualDeparture.getTime();
  
  let progress = 0;
  if (totalDuration > 0) {
    progress = Math.max(0, Math.min(1, elapsed / totalDuration));
  }

  console.log(`Actual departure time: ${actualDeparture.toLocaleTimeString()}`);
  console.log(`Expected arrival time: ${expectedArrival.toLocaleTimeString()}`);
  console.log(`Current time: ${now.toLocaleTimeString()}`);


  return {
    currentStation: stationNames[currentIndex],
    nextStation: stationNames[nextIndex],
    isAtStation: false,
    position: currentIndex + progress
  };
}

function parseTime(timeStr: string): Date | null {
  if (!timeStr || timeStr === 'N/A') return null;
  
  const today = new Date();
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  
  today.setHours(hours, minutes, seconds || 0, 0);
  return today;
}

/*
  To test that getTrainMovements is working correctly, you can call this function.
  It will fetch the movements for a specific train and log them to the console.
  You can run this in an environment that supports fetch (like a React Native component, or Node.js with a fetch polyfill).
  
  Example usage:
  testTrainMovements();
*/
export async function testTrainMovements() {
  try {
    // Using a known train code for testing. You can change 'E909' to another valid train code.
    const trainCode = 'E909'; 
    console.log(`Fetching train movements for train: ${trainCode}`);
    const movements = await getTrainMovements(trainCode);
    console.log('Received train movements:', movements);
    
    if (movements.length > 0) {
      console.log(`Successfully fetched ${movements.length} movement records.`);
      console.log('First movement record:', movements[0]);
    } else {
      console.log('No movement records found for this train/date. The train may not be running today.');
    }
  } catch (error) {
    console.error('Error testing getTrainMovements:', error);
  }
}