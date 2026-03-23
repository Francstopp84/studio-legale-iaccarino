import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/Iacca/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'
});
const page = await browser.newPage();

// Capture ALL console messages and errors
const consoleMessages = [];
const errors = [];

page.on('console', msg => {
  consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
});

page.on('pageerror', err => {
  errors.push(`PAGE ERROR: ${err.message}`);
});

page.on('requestfailed', req => {
  errors.push(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`);
});

// 1. Navigate to transcribe page
console.log('=== NAVIGATING TO /transcribe ===');
const response = await page.goto('http://localhost:3000/transcribe', { waitUntil: 'networkidle', timeout: 30000 });
console.log(`Status: ${response.status()}`);

await page.waitForTimeout(2000);

// 2. Take screenshot
await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/screenshot-transcribe.png', fullPage: true });
console.log('Screenshot saved');

// 3. Check page content
const pageText = await page.textContent('body');
console.log(`\n=== PAGE TEXT (first 500 chars) ===\n${pageText?.substring(0, 500)}`);

// 4. Check if upload area exists and is clickable
const uploadArea = await page.$('.card.border-dashed');
console.log(`\nUpload area found: ${!!uploadArea}`);

// 5. Check if transcribe button exists
const h1 = await page.textContent('h1');
console.log(`H1: ${h1}`);

// 6. Try to simulate file upload via the API input
const fileInput = await page.$('input[type="file"]');
console.log(`File input found: ${!!fileInput}`);

// 7. Try clicking the upload area and check for file input
await uploadArea?.click();
await page.waitForTimeout(500);

// Check if a file input was created in the DOM
const allInputs = await page.$$('input[type="file"]');
console.log(`File inputs after click: ${allInputs.length}`);

// 8. Test: Upload a file programmatically
const testFilePath = 'C:/Users/Iacca/braynr-studio-app/uploads/test_tone.wav';
if (allInputs.length > 0) {
  await allInputs[allInputs.length - 1].setInputFiles(testFilePath);
  await page.waitForTimeout(1000);

  // Check queue
  const queueText = await page.textContent('body');
  console.log(`\n=== AFTER FILE UPLOAD (first 800 chars) ===\n${queueText?.substring(0, 800)}`);

  await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/screenshot-after-upload.png', fullPage: true });
  console.log('Screenshot after upload saved');

  // Look for transcribe button
  const transcribeBtn = await page.$('button:has-text("TRASCRIVI")');
  console.log(`\nTranscribe button found: ${!!transcribeBtn}`);

  if (transcribeBtn) {
    const btnText = await transcribeBtn.textContent();
    console.log(`Button text: ${btnText}`);
    const btnDisabled = await transcribeBtn.isDisabled();
    console.log(`Button disabled: ${btnDisabled}`);

    // Click it!
    console.log('\n=== CLICKING TRANSCRIBE BUTTON ===');
    await transcribeBtn.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/screenshot-transcribing.png', fullPage: true });

    const afterClickText = await page.textContent('body');
    console.log(`\n=== AFTER CLICK (first 800 chars) ===\n${afterClickText?.substring(0, 800)}`);
  }
} else {
  console.log('NO FILE INPUT FOUND - trying alternative approach');
  // Use page.setInputFiles with a file chooser
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
    uploadArea?.click(),
  ]);

  if (fileChooser) {
    await fileChooser.setFiles(testFilePath);
    await page.waitForTimeout(1000);
    console.log('File set via file chooser');
    await page.screenshot({ path: 'C:/Users/Iacca/braynr-studio-app/screenshot-after-chooser.png', fullPage: true });
  } else {
    console.log('File chooser did not appear!');
  }
}

// Print all console messages and errors
if (consoleMessages.length > 0) {
  console.log('\n=== BROWSER CONSOLE ===');
  consoleMessages.forEach(m => console.log(m));
}

if (errors.length > 0) {
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
}

await browser.close();
