import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  // Navigate to the demo app
  await page.goto('http://localhost:5179/soroban-render/', { waitUntil: 'networkidle2' });
  
  // Enter the contract ID
  await page.type('#contractId', 'CCKWTQX67V3AGSR7SYTLRPQGQNQJMAK6DCLPDOV7DHTORRSVYCLV27WW');
  
  // Click Load Contract
  await page.click('button[type="submit"]');
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Get the rendered content
  const content = await page.evaluate(() => {
    return document.querySelector('.soroban-render-view, .soroban-render-json')?.innerHTML || 'No content found';
  });
  
  console.log('\n=== MARKDOWN RENDER (default path /) ===');
  console.log(content.substring(0, 500) + '...');
  
  // Now test JSON rendering by entering path /json
  await page.evaluate(() => {
    const pathInput = document.querySelector('#path');
    if (pathInput) {
      pathInput.value = '/json';
      pathInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  
  // Click Load Contract again to refresh with new path
  await page.click('button[type="submit"]');
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Get the rendered content for JSON view
  const jsonContent = await page.evaluate(() => {
    return {
      hasJsonView: !!document.querySelector('.soroban-render-json'),
      hasMarkdownView: !!document.querySelector('.soroban-render-view'),
      content: (document.querySelector('.soroban-render-json') || document.querySelector('.soroban-render-view'))?.innerHTML || 'No content found',
      format: document.body.innerText.includes('soroban-render-json-v1') ? 'json (raw)' : 'rendered'
    };
  });
  
  console.log('\n=== JSON RENDER (path /json) ===');
  console.log('Has JSON View:', jsonContent.hasJsonView);
  console.log('Has Markdown View:', jsonContent.hasMarkdownView);
  console.log('Format:', jsonContent.format);
  console.log('Content preview:', jsonContent.content.substring(0, 500) + '...');
  
  await browser.close();
  console.log('\nTest complete!');
}

test().catch(console.error);
