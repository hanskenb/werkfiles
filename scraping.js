const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('csv-parser');
const moment = require('moment');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://mijn.fluvius.be');
  
   // Wait for the login page to load
  await page.waitForSelector('#signInName');

  // Fill in the login form and submit it
  await page.type('#signInName', 'login'); // replace login with your login 
  await page.type('#password', 'paswoord'); // replace paswoord with your password
  await page.click('#next');


await page.$eval('#next', button => button.click());

 await page.waitForSelector('.loading');
  await page.waitForTimeout(5000);
 await page.$eval('#fluv-cookies-button-accept-all', button => button.click());

   await page.waitForTimeout(5000);
await page.$eval('#fluv-cookies-popup-container', button => button.click());

await page.goto('https://mijn.fluvius.be/verbruik/541448820045369231/detail'); //adapted to my EAN, change to yours

await page.waitForTimeout(5000);

const [downloadButton] = await page.$x("//button[contains(., 'Rapport downloaden')]");
await downloadButton.click();

//const [downloadButton2] = await page.$x("//button[contains(., 'Rapport downloaden')]");
//await downloadButton2.click();

await page.waitForSelector('#mat-select-value-1');

await page.click('#mat-select-value-1');


await page.waitForSelector('#mat-option-0'); // wait for the dropdown to load
await page.click('#mat-option-0');


const [downloadButton2] = await page.$x("//button[contains(., 'Downloaden')]");
await downloadButton2.click();
  //await browser.close();
})();





const fileName = 'bestemming.csv'; // replace with the name of your CSV file
const rows = [];

// read in the CSV file and push each row to the 'rows' array
fs.createReadStream(fileName)
  .pipe(csv())
  .on('data', (data) => {
    rows.push(data);
  })
  .on('end', () => {
    // filter the rows to only include those from the last month
    const filteredRows = rows.filter((row) => {
      const date = moment(row['Van Datum'], 'DD-MM-YYYY');
      return date.isSameOrAfter(moment().subtract(1, 'month'), 'month');
    });
    
    // log the filtered rows to the console
    console.log(filteredRows);
  });
