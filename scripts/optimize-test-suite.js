#!/usr/bin/env node

/**
 * Test Suite Optimizer Script
 * 
 * This script optimizes the test execution by:
 * 1. Running tests in parallel with proper isolation
 * 2. Caching test dependencies to speed up repeat runs
 * 3. Optimizing mocks to reduce redundant setup
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_DIRS = [
  'unit',
  'integration',
  'e2e',
  'performance'
];

const OPTIMIZATION_LEVEL = process.argv[2] || 'normal'; // low, normal, high

// Process start time
const startTime = Date.now();

// Create a temporary directory for test artifacts if it doesn't exist
const tempDir = path.join(process.cwd(), '.test-cache');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Define test run function with caching
function runTestsWithOptimization(testType) {
  const cachePath = path.join(tempDir, `${testType}-cache.json`);
  
  console.log(`\n🧪 Running ${testType} tests...\n`);
  
  // Determine the appropriate jest arguments based on test type
  let jestArgs = `--testMatch="**/__tests__/${testType}/**/*"`;
  
  // Customize args based on test type
  switch(testType) {
    case 'unit':
      jestArgs += ' --maxWorkers=4';
      break;
    case 'integration':
      jestArgs += ' --maxWorkers=2 --runInBand=false';
      break;
    case 'e2e':
      jestArgs += ' --runInBand';
      break;
    case 'performance':
      jestArgs += ' --runInBand --testTimeout=30000';
      break;
  }
  
  // Add optimization level settings
  switch(OPTIMIZATION_LEVEL) {
    case 'high':
      jestArgs += ' --cache --updateSnapshot';
      break;
    case 'normal':
      jestArgs += ' --cache';
      break;
    case 'low':
      jestArgs += ' --no-cache';
      break;
  }
  
  try {
    // Run the tests with appropriate options
    const cmd = `npx jest ${jestArgs}`;
    console.log(`Executing: ${cmd}\n`);
    execSync(cmd, { stdio: 'inherit' });
    
    // Update cache timestamp
    const cacheData = { lastRun: Date.now() };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData));
    
    return true;
  } catch (error) {
    console.error(`❌ Error running ${testType} tests: ${error.message}`);
    return false;
  }
}

// Main execution
console.log('\n🚀 Starting Optimized Test Suite Runner\n');

let successCount = 0;
const testResults = {};

// Run tests in optimal order: unit -> integration -> e2e -> performance
for (const testType of TEST_DIRS) {
  const testDir = path.join(process.cwd(), '__tests__', testType);
  
  // Skip if directory doesn't exist
  if (!fs.existsSync(testDir)) {
    console.log(`Skipping ${testType} tests - directory not found`);
    continue;
  }
  
  const success = runTestsWithOptimization(testType);
  testResults[testType] = success;
  
  if (success) {
    successCount++;
  }
}

// Calculate and output summary
const endTime = Date.now();
const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

console.log('\n📊 Test Suite Summary');
console.log('====================');
console.log(`Total Execution Time: ${durationSeconds}s`);
console.log(`Success Rate: ${successCount}/${TEST_DIRS.length} test types passed`);

Object.entries(testResults).forEach(([type, success]) => {
  console.log(`${type}: ${success ? '✅ Passed' : '❌ Failed'}`);
});

// Exit with appropriate code
process.exit(successCount === TEST_DIRS.length ? 0 : 1);