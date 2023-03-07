const fs = require('fs');
const csv = require('csv-parser');
const https = require('https');
const axios = require('axios');
const moment = require('moment-timezone');
const xml2js = require('xml2js');
const path = require('path');
const API_TOKEN = '3f217f07-093a-47b2-a6c1-a3827a418e84'; //please fill in your token here. Request an API key by sending an email to transparency@entsoe.eu with “Restful API access” in the subject line. In the email body state your registered email address. You will receive an email when you have been provided with the API key. The key is then visible in your ENTSO-E account under “Web API Security Token”
const csvpath = '/Users/hansbontinck/Downloads/Verbruikshistoriek_elektriciteit_541448820045269231_20230109_20230227_kwartiertotalen.csv'; // please  fill the path of the csv file with the 15-minute-totals in here.
const data = [];

fs.createReadStream(csvpath)
  .pipe(csv({
    separator: ';'
  }))
  .on('data', (row) => {
    const hour = parseInt(row['Van Tijdstip'].split(':')[0]);
    const energyStr = row['Volume'].replace(',', '.').trim();

    const energy = parseFloat(energyStr);

    if (row['Register'] === 'Afname Nacht' || row['Register'] === 'Afname Dag') {
      data.push({
        date: row['\uFEFFVan Datum'],
        hour,
        energy
      });
    }
  })
  .on('end', () => {
    // Get the oldest and most recent dates in the data array
    const dates = data.map(row => moment(row.date, 'DD-MM-YYYY'));
    const oldestDate = moment.min(dates).format('DD-MM-YYYY');
    const mostRecentDate = moment.max(dates).format('DD-MM-YYYY');
    
    const oldestDateFormatted = moment(oldestDate, 'DD-MM-YYYY').format('YYYYMMDD');
    const mostRecentDateFormatted = moment(mostRecentDate, 'DD-MM-YYYY').format('YYYYMMDD');
    const formattedStart = oldestDateFormatted + '0000';
    const formattedEnd = mostRecentDateFormatted + '0000';
    
    // Construct the URL for the API call
    const url = `https://web-api.tp.entsoe.eu/api?documentType=A44&in_Domain=10YBE----------2&out_Domain=10YBE----------2&periodStart=${formattedStart}&periodEnd=${formattedEnd}&securityToken=${API_TOKEN}`;
console.log(url);
    // Make the API call
    axios.get(url)
    .then(response => {
        const xml = response.data;
       
        const parser = new xml2js.Parser();
        parser.parseString(xml, (err, result) => {
          if (err) {
            console.error(err);
            return;
          }

          const timeSeries = result.Publication_MarketDocument.TimeSeries;

          // Extract hourly prices from the API response
          const hourlyPrices = timeSeries.flatMap(series => {
            const date2 = String(series.Period[0].timeInterval[0].start);
            if (typeof date2 === 'string' && date2.includes('T')) {
  
    const dateParts = date2.split('T')[0].split('-');


    const datedayafter = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    const datedayaftertostring = moment(datedayafter, 'DD-MM-YYYY'); 
const date = datedayaftertostring.add(1, 'days').format('DD-MM-YYYY'); //we moeten de dag voor de gevraagde dag selecteren
    
    
    
//     const prices = series.Period[0].Point.map(point => parseFloat(point['price.amount'][0]));

const prices = series.Period[0].Point.map(point => {
  const price = parseFloat(point['price.amount'][0]) / 1000;
  return price.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).replace('.', ',');
});


      return prices.map((price, index) => ({ date, hour: index, price }));

              }

          });
         

    // Add actual prices to the data array
         data.forEach(row => {
  let actualPrice; // Initialize actualPrice variable
  const priceRow = hourlyPrices.find(priceRow => priceRow.date === row.date && priceRow.hour === row.hour);
  if (priceRow) {
    actualPrice = priceRow.price;
  }
  row.actualPrice = actualPrice;
  
});

// Functie om de minuutwaarde op basis van positie in te stellen
function setMinuutByPosition(index) {
  switch (index % 4) {
    case 0:
      return 0;
    case 1:
      return 15;
    case 2:
      return 30;
    case 3:
      return 45;
  }
}

// Loop door de array en voeg minuten en tijdstip toe op basis van positie
for (let i = 0; i < data.length; i++) {
  const hour = data[i].hour;
  const minuut = setMinuutByPosition(i);
  const tijdstip = hour.toString().padStart(2, '0') + ':' + minuut.toString().padStart(2, '0') + ':00';
  data[i].minuut = minuut;
  data[i].tijdstip = tijdstip;
}


const results = [];

fs.createReadStream(csvpath)
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (row.Register.includes('Afname')) {
      data.forEach((item) => {
        
      
        if (item.date === row['\uFEFFVan Datum'] && item.tijdstip === row['Van Tijdstip']) {
          row.actualprice = item.actualPrice;
          results.push(row);
        }
      });
    }
  })
  .on('end', () => {
  
  //
const directory = path.dirname(csvpath);
const outputFilePath = path.join(directory, 'output.csv');

 
// Define the path and name of the output file

// Define the array of data to be written to the CSV file

// Define the header row for the CSV file
const headerRow = 'Van Datum;Van Tijdstip;Volume;actualprice;paidprice\n';

// Build the CSV file content as a string
let csvContent = headerRow;
let totalPaidPrice = 0;
let totalVolume = 0;
for (let i = 0; i < results.length; i++) {
  const row = results[i];
  const paidPrice = parseFloat(row.Volume.replace(',', '.')) * parseFloat(row.actualprice.replace(',', '.'));
  const volumetodot = parseFloat(row.actualprice.replace(',', '.'));
  const newRow = `${row['\uFEFFVan Datum']};${row['Van Tijdstip']};${row.Volume};${row.actualprice};${paidPrice}\n`;
  
 totalVolume += volumetodot;

  if (!isNaN(paidPrice)) {
    totalPaidPrice += paidPrice;
  }

  csvContent += newRow;
}
console.log('Total paid price:', totalPaidPrice);
console.log('Total volume price:', totalVolume);
console.log('Gemiddeld betaalde prijs:', totalPaidPrice/totalVolume);
// Write the CSV file to disk
fs.writeFile(outputFilePath, csvContent, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log(outputFilePath);
    console.log('CSV file written successfully!');
  }
});
});

     
        });
      })
      .catch(error => {
        console.error(error);
      });
  });
