// 1. Get All Stations - usage http://api.irishrail.ie/realtime/realtime.asmx/getAllStationsXML returns a list of all stations with StationDesc, StaionCode, StationId, StationAlias, StationLatitude and StationLongitude ordered by Latitude, Longitude

const http = require('http');
const xml2js = require('xml2js');

// Function to fetch all stations from Irish Rail API
async function getAllStations() {
    return new Promise((resolve, reject) => {
        const url = 'http://api.irishrail.ie/realtime/realtime.asmx/getAllStationsXML';
        
        http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                xml2js.parseString(data, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}


async function testDartStationRetrieval() {
    try {
        console.log('Fetching all stations from Irish Rail API...\n');
        
        const result = await getAllStations();
        const stations = result.ArrayOfObjStation?.objStation || [];
        
        console.log(`Total stations retrieved: ${stations.length}\n`);
        
        // Display first few stations as sample
        console.log('Sample stations:');
        stations.slice(0, 5).forEach(station => {
            console.log(`- ${station.StationDesc?.[0]} (${station.StationCode?.[0]})`);
            console.log(`  Lat: ${station.StationLatitude?.[0]}, Lng: ${station.StationLongitude?.[0]}\n`);
        });
        
    } catch (error) {
        console.error('Error retrieving stations:', error);
    }
}

// Run the test
testDartStationRetrieval();
