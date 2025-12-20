/**
 * Test script for include resolution functionality
 */

import { createClient, callRender, resolveIncludes, parseIncludes, hasIncludes } from '@soroban-render/core';

const CONTRACT_ID = 'CACTK64E6SPOKK54KXYJNJRGNQW5F5IKMR4U4EP5KUSMMOEDFWFGTT6G';
const LOCAL_RPC = 'http://localhost:8000/soroban/rpc';
const LOCAL_PASSPHRASE = 'Standalone Network ; February 2017';

async function test() {
  console.log('=== Include Resolution Test ===\n');

  const client = createClient(LOCAL_RPC, LOCAL_PASSPHRASE);

  // Step 1: Get raw render output (with include tags)
  console.log('1. Fetching raw render output...');
  const rawContent = await callRender(client, CONTRACT_ID, { path: '/' });
  console.log('\nRaw output (before resolution):');
  console.log('---');
  console.log(rawContent);
  console.log('---\n');

  // Step 2: Check for includes
  console.log('2. Checking for includes...');
  const hasInc = hasIncludes(rawContent);
  console.log(`   Has includes: ${hasInc}`);

  if (hasInc) {
    const parsed = parseIncludes(rawContent);
    console.log(`   Found ${parsed.includes.length} include(s):`);
    for (const inc of parsed.includes) {
      console.log(`   - contract=${inc.contract}, func=${inc.func || 'render'}, path=${inc.path || '/'}`);
    }
  }

  // Step 3: Resolve includes
  console.log('\n3. Resolving includes...');
  const resolved = await resolveIncludes(client, rawContent, {
    contractId: CONTRACT_ID,
  });

  console.log(`   Cycle detected: ${resolved.cycleDetected}`);
  console.log(`   Resolved ${resolved.resolvedIncludes.length} include(s)`);

  console.log('\nResolved output:');
  console.log('---');
  console.log(resolved.content);
  console.log('---\n');

  // Step 4: Test render_* functions directly
  console.log('4. Testing render_* functions directly...');

  const header = await callRender(client, CONTRACT_ID, { functionName: 'header' });
  console.log('\nrender_header output:');
  console.log(header);

  const footer = await callRender(client, CONTRACT_ID, { functionName: 'footer' });
  console.log('\nrender_footer output:');
  console.log(footer);

  console.log('\n=== Test Complete ===');
}

test().catch(console.error);
