import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  executablePath: 'C:/Users/Iacca/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'
});
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`);
  console.log(`[browser ${msg.type()}] ${msg.text()}`);
});

// Navigate
console.log('Opening http://localhost:3000/transcribe ...');
await page.goto('http://localhost:3000/transcribe', { waitUntil: 'networkidle', timeout: 30000 });
console.log('Page loaded');

// Upload a REAL audio file (Voce_001.m4a)
const realFile = 'C:/Users/Iacca/braynr-studio-app/uploads/1773124743818_Voce_001.m4a';
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 5000 }),
  page.click('.card.border-dashed'),
]);
await fileChooser.setFiles(realFile);
await page.waitForTimeout(1000);
console.log('File added to queue');

// Select "Veloce" method for faster test
await page.click('button:has-text("Veloce")');
await page.waitForTimeout(300);
console.log('Selected "Veloce" method');

// Screenshot before click
await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/ss-before-click.png', fullPage: true });

// Click TRASCRIVI
const btn = await page.$('button:has-text("TRASCRIVI")');
console.log(`Button found: ${!!btn}`);
console.log(`Button text: ${await btn?.textContent()}`);

console.log('Clicking TRASCRIVI...');
await btn.click();

// Monitor for 120 seconds
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(2000);

  // Take periodic screenshots
  if (i % 5 === 0) {
    await page.screenshot({ path: `C:/Users/Iacca/braynr-studio-app/ss-progress-${i}.png`, fullPage: true });
  }

  const bodyText = await page.textContent('body');

  if (bodyText.includes('completate')) {
    console.log(`SUCCESS at ${i*2}s!`);
    await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/ss-success.png', fullPage: true });
    break;
  }
  if (bodyText.includes('Errore') && !bodyText.includes('Errore"')) {
    const errorEl = await page.$('p[style*="danger"]');
    const errText = errorEl ? await errorEl.textContent() : 'unknown';
    console.log(`ERROR at ${i*2}s: ${errText}`);
    await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/ss-error.png', fullPage: true });
    break;
  }

  // Check progress bar
  const progress = await page.$eval('.h-full.rounded-full.transition-all', el => el.style.width).catch(() => 'no bar');
  const statusText = await page.$eval('.animate-spin', () => 'spinning').catch(() => 'no spinner');
  console.log(`[${i*2}s] progress=${progress}, spinner=${statusText}`);
}

if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
}

// Keep browser open for 10 more seconds so user can see
await page.waitForTimeout(10000);
await browser.close();
