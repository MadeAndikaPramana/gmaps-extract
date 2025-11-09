const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('1. Launching browser (visible)...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('2. Searching Google Maps...');
  await page.goto('https://www.google.com/maps/search/hotel+bali', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  console.log('3. Waiting for results...');
  await page.waitForSelector('[role="feed"]', { timeout: 10000 });
  
  console.log('4. Getting first place link...');
  const firstLink = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/maps/place/"]');
    return links[0]?.getAttribute('href');
  });
  
  if (!firstLink) {
    console.log('ERROR: No places found!');
    await browser.close();
    return;
  }
  
  console.log('5. Navigating to place:', firstLink);
  const fullUrl = firstLink.startsWith('http') 
    ? firstLink 
    : `https://www.google.com${firstLink}`;
  
  await page.goto(fullUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  console.log('6. Extracting data...');
  
  // Wait using Promise instead
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const data = await page.evaluate(() => {
    const name = document.querySelector('h1')?.textContent?.trim() || 'NO NAME';
    const rating = document.querySelector('[role="img"][aria-label*="star"]')?.getAttribute('aria-label') || 'NO RATING';
    
    return { name, rating };
  });
  
  console.log('7. RESULT:', data);
  
  console.log('\n8. Closing in 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
  console.log('Done!');
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
