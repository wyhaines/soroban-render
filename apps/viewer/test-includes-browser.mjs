import puppeteer from 'puppeteer';

/**
 * Test include resolution in browser via the demo app
 */
async function test() {
  console.log('=== Testing Include Resolution in Browser ===\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  // Navigate to the demo app with the updated contract (using cross-contract includes)
  const CONTRACT_ID = 'CCBHO6AWVDW5U4VLDKSFJMGFD4FAPBYZ5IOZKJFNYVHVKO4Y43RZQ547';
  await page.goto(`http://localhost:5179/soroban-render/?contract=${CONTRACT_ID}`, { waitUntil: 'networkidle2' });

  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check the render result
  const result = await page.evaluate(() => {
    const view = document.querySelector('.soroban-render-view');
    const bodyText = document.body.innerText;

    return {
      hasView: !!view,
      viewHTML: view?.innerHTML || '',
      bodyText: bodyText.substring(0, 2000),
      // Check if includes were resolved (should see header content, not the include tag)
      hasIncludeTag: bodyText.includes('{{include'),
      // Theme contract header says "Soroban App" and "Built with Soroban Render"
      hasHeader: bodyText.includes('Soroban App') && bodyText.includes('Built with'),
      // Theme contract footer says "Powered by Soroban Render" and "Stellar"
      hasFooter: bodyText.includes('Powered by') && bodyText.includes('Stellar'),
      // Theme contract nav has Home, Tasks, About links
      hasNav: bodyText.includes('Home') && bodyText.includes('Tasks') && bodyText.includes('About'),
    };
  });

  console.log('\n=== Results ===');
  console.log('Has view:', result.hasView);
  console.log('Has include tags (should be false after resolution):', result.hasIncludeTag);
  console.log('Has resolved header (from theme contract):', result.hasHeader);
  console.log('Has resolved nav (from theme contract):', result.hasNav);
  console.log('Has resolved footer (from theme contract):', result.hasFooter);

  console.log('\n=== Body Preview ===');
  console.log(result.bodyText);

  await browser.close();

  // Check results
  if (result.hasIncludeTag) {
    console.log('\n\u274C FAIL: Include tags were not resolved!');
    process.exit(1);
  }

  if (!result.hasHeader) {
    console.log('\n\u274C FAIL: Header content from theme contract not found!');
    process.exit(1);
  }

  if (!result.hasNav) {
    console.log('\n\u274C FAIL: Nav content from theme contract not found!');
    process.exit(1);
  }

  if (!result.hasFooter) {
    console.log('\n\u274C FAIL: Footer content from theme contract not found!');
    process.exit(1);
  }

  console.log('\n\u2714 PASS: Cross-contract includes were resolved correctly!');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
