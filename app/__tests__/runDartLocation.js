const xml2js = require('xml2js');

const API_URL = 'http://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML_WithTrainType?TrainType=D';

async function fetchDartLocations() {
  const response = await fetch(API_URL);
  const xmlText = await response.text();
  
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlText);
  
  const trains = result.ArrayOfObjTrainPositions.objTrainPositions || [];
  
  return trains.map(train => ({
    TrainCode: train.TrainCode[0],
    TrainLatitude: train.TrainLatitude[0],
    TrainLongitude: train.TrainLongitude[0]
  }));
}

fetchDartLocations()
  .then(dartLocations => {
    console.log('DART Locations:', JSON.stringify(dartLocations, null, 2));
    console.log(`\nTotal DART trains: ${dartLocations.length}`);
  })
  .catch(error => {
    console.error('Error fetching DART locations:', error);
  });
