import { XMLParser } from 'fast-xml-parser';

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

function getLocationTypeDescription(code: string): string {
  const types: { [key: string]: string } = {
    'O': 'Origin',
    'S': 'Stop',
    'T': 'Timing Point (non-stopping)',
    'D': 'Destination'
  };
  return types[code] || code;
}

function getStopTypeDescription(code: string): string {
  const types: { [key: string]: string } = {
    'C': 'Current',
    'N': 'Next',
    '': 'N/A'
  };
  return types[code] || code;
}

async function getTrainMovements(): Promise<void> {
  try {
    // Get train code and date from command line arguments
    const trainCode = process.argv[2];
    const trainDate = process.argv[3] || new Date().toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });

    if (!trainCode) {
      console.error('Error: Train code is required.');
      console.log('\nUsage: npx ts-node utils/returnTrainMovements.ts <TrainCode> [TrainDate]');
      console.log('Example: npx ts-node utils/returnTrainMovements.ts E109 "21 Dec 2024"');
      console.log('\nIf no date is provided, today\'s date will be used.');
      return;
    }

    const apiUrl = `http://api.irishrail.ie/realtime/realtime.asmx/getTrainMovementsXML?TrainId=${encodeURIComponent(trainCode)}&TrainDate=${encodeURIComponent(trainDate)}`;
    
    console.log(`Fetching train movements for Train ${trainCode} on ${trainDate}...\n`);
    
    const response = await fetch(apiUrl);
    const xmlData = await response.text();
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    
    const result = parser.parse(xmlData);
    const movements = result.ArrayOfObjTrainMovements?.objTrainMovements || [];
    
    // Ensure movements is always an array
    const movementsArray = Array.isArray(movements) ? movements : [movements];
    
    if (movementsArray.length === 0) {
      console.log(`No movement data found for train ${trainCode} on ${trainDate}.`);
      return;
    }

    const firstMovement = movementsArray[0];
    console.log('='.repeat(100));
    console.log(`TRAIN INFORMATION`);
    console.log('='.repeat(100));
    console.log(`Train Code:        ${firstMovement.TrainCode || 'N/A'}`);
    console.log(`Train Date:        ${firstMovement.TrainDate || 'N/A'}`);
    console.log(`Origin:            ${firstMovement.TrainOrigin || 'N/A'}`);
    console.log(`Destination:       ${firstMovement.TrainDestination || 'N/A'}`);
    console.log(`Total Locations:   ${movementsArray.length}`);
    console.log('='.repeat(100));
    
    console.log(`\nSTOP INFORMATION:\n`);
    
    movementsArray.forEach((movement: any, index: number) => {
      console.log(`\nLocation #${index + 1} (Order: ${movement.LocationOrder || 'N/A'})`);
      console.log('-'.repeat(100));
      console.log(`Location:           ${movement.LocationFullName || 'N/A'} (${movement.LocationCode || 'N/A'})`);
      console.log(`Type:               ${getLocationTypeDescription(movement.LocationType || '')} (${movement.LocationType || 'N/A'})`);
      console.log(`Stop Type:          ${getStopTypeDescription(movement.StopType || '')} (${movement.StopType || 'N/A'})`);
      console.log(`\nScheduled Arrival:  ${movement.ScheduledArrival || 'N/A'}`);
      console.log(`Scheduled Depart:   ${movement.ScheduledDeparture || 'N/A'}`);
      console.log(`Expected Arrival:   ${movement.ExpectedArrival || 'N/A'}`);
      console.log(`Expected Depart:    ${movement.ExpectedDeparture || 'N/A'}`);
      console.log(`Actual Arrival:     ${movement.Arrival || 'N/A'}`);
      console.log(`Actual Departure:   ${movement.Departure || 'N/A'}`);
      console.log(`Auto Arrival:       ${movement.AutoArrival || 'N/A'}`);
      console.log(`Auto Depart:        ${movement.AutoDepart || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(100));
    
  } catch (error) {
    console.error('Error fetching train movements:', error);
  }
}

// Run the function
getTrainMovements();
