import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  // Navigate directly with path parameter
  await page.goto('http://localhost:5179/soroban-render/?contract=CCKWTQX67V3AGSR7SYTLRPQGQNQJMAK6DCLPDOV7DHTORRSVYCLV27WW&path=/json', { waitUntil: 'networkidle2' });
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check the render result
  const result = await page.evaluate(() => {
    const jsonView = document.querySelector('.soroban-render-json');
    const mdView = document.querySelector('.soroban-render-view');
    const error = document.querySelector('.soroban-render-error');
    
    return {
      hasJsonView: !!jsonView,
      hasMarkdownView: !!mdView,
      hasError: !!error,
      errorText: error?.innerText || '',
      bodyPreview: document.body.innerText.substring(0, 1000)
    };
  });
  
  console.log('Has JSON View:', result.hasJsonView);
  console.log('Has Markdown View:', result.hasMarkdownView);
  console.log('Has Error:', result.hasError);
  console.log('Error:', result.errorText);
  console.log('\nBody Preview:', result.bodyPreview);
  
  await browser.close();
}

test().catch(console.error);
