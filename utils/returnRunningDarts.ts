import { XMLParser } from 'fast-xml-parser';

interface DartTrain {
  TrainStatus: string;
  TrainLatitude: string;
  TrainLongitude: string;
  TrainCode: string;
  TrainDate: string;
  PublicMessage: string;
  Direction: string;
}

async function getCurrentDarts(): Promise<void> {
  try {
    const apiUrl = 'http://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML_WithTrainType?TrainType=D';
    
    // Get filter from command line argument
    const filterTrainCode = process.argv[2]?.toUpperCase();
    
    console.log('Fetching current DART trains...\n');
    if (filterTrainCode) {
      console.log(`Filtering by Train Code: ${filterTrainCode}\n`);
    }
    
    const response = await fetch(apiUrl);
    const xmlData = await response.text();
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    
    const result = parser.parse(xmlData);
    const trains = result.ArrayOfObjTrainPositions?.objTrainPositions || [];
    
    // Ensure trains is always an array
    let trainsArray = Array.isArray(trains) ? trains : [trains];
    
    // Filter by train code if provided
    if (filterTrainCode) {
      trainsArray = trainsArray.filter((train: any) => 
        train.TrainCode?.toUpperCase().includes(filterTrainCode)
      );
    }
    
    if (trainsArray.length === 0) {
      console.log(filterTrainCode 
        ? `No DART trains found matching code: ${filterTrainCode}` 
        : 'No DART trains currently running.'
      );
      return;
    }
    
    console.log(`Found ${trainsArray.length} running DART train(s):\n`);
    console.log('='.repeat(80));
    
    trainsArray.forEach((train: any, index: number) => {
      console.log(`\nTrain #${index + 1}`);
      console.log('-'.repeat(80));
      console.log(`Train Code:      ${train.TrainCode || 'N/A'}`);
      console.log(`Status:          ${train.TrainStatus || 'N/A'}`);
      console.log(`Direction:       ${train.Direction || 'N/A'}`);
      console.log(`Latitude:        ${train.TrainLatitude || 'N/A'}`);
      console.log(`Longitude:       ${train.TrainLongitude || 'N/A'}`);
      console.log(`Date:            ${train.TrainDate || 'N/A'}`);
      console.log(`Public Message:  ${train.PublicMessage || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('Error fetching DART trains:', error);
  }
}

// Run the function
getCurrentDarts();
