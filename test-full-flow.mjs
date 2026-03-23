import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/Iacca/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'
});
const page = await browser.newPage();

const errors = [];
page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));
page.on('console', msg => { if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`); });

// Navigate
await page.goto('http://localhost:3000/transcribe', { waitUntil: 'networkidle', timeout: 30000 });
console.log('Page loaded');

// Upload a real audio file
const testFile = 'C:/Users/Iacca/braynr-studio-app/uploads/test_tone.wav';
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 5000 }),
  page.click('.card.border-dashed'),
]);
await fileChooser.setFiles(testFile);
await page.waitForTimeout(500);
console.log('File uploaded to queue');

// Take screenshot showing queue
await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/ss-1-queue.png', fullPage: true });

// Click TRASCRIVI ORA
const btn = await page.$('button:has-text("TRASCRIVI")');
if (!btn) {
  console.log('ERROR: TRASCRIVI button not found!');
  await browser.close();
  process.exit(1);
}

console.log('Clicking TRASCRIVI...');
await btn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/ss-2-transcribing.png', fullPage: true });
console.log('Screenshot after click saved');

// Wait for completion (poll every 2s, max 60s)
let done = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  const bodyText = await page.textContent('body');

  if (bodyText.includes('Completato') || bodyText.includes('completate')) {
    console.log('TRANSCRIPTION COMPLETED!');
    done = true;
    break;
  }
  if (bodyText.includes('Errore')) {
    console.log('TRANSCRIPTION ERROR DETECTED');
    // Get the error text
    const errorEls = await page.$$('[style*="danger"]');
    for (const el of errorEls) {
      const txt = await el.textContent();
      if (txt) console.log(`Error text: ${txt}`);
    }
    done = true;
    break;
  }

  // Check progress
  const progress = await page.$eval('.h-full.rounded-full', el => el.style.width).catch(() => null);
  if (progress) console.log(`Progress: ${progress}`);
}

await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/ss-3-result.png', fullPage: true });

if (!done) {
  console.log('Timed out waiting for transcription');
}

// Report errors
if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
} else {
  console.log('\nNo browser errors detected!');
}

await browser.close();
