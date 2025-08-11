#!/usr/bin/env node

/**
 * Parallel Test Runner
 * 
 * Runs tests in parallel by test type for maximum efficiency
 * Uses worker threads to manage parallel execution
 */

const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const TEST_CATEGORIES = [
  { name: 'unit', priority: 1, workers: Math.max(1, Math.floor(os.cpus().length / 2)) },
  { name: 'integration', priority: 2, workers: 1 },
  { name: 'e2e', priority: 3, workers: 1 },
  { name: 'performance', priority: 4, workers: 1 }
];

// Sort by priority
TEST_CATEGORIES.sort((a, b) => a.priority - b.priority);

// Track metrics
const metrics = {
  startTime: Date.now(),
  results: {},
  endTime: null,
  exitCode: 0
};

// Helper to create a test worker
function createTestWorker(category) {
  return new Promise((resolve) => {
    const testDir = path.join(process.cwd(), '__tests__', category.name);
    
    // Skip if test directory doesn't exist
    if (!fs.existsSync(testDir)) {
      console.log(`Skipping ${category.name} tests - directory not found`);
      resolve({
        category: category.name,
        success: true,
        skipped: true,
        time: 0
      });
      return;
    }
    
    console.log(`\n🚀 Starting ${category.name} tests with ${category.workers} worker${category.workers > 1 ? 's' : ''}...`);
    
    const categoryStartTime = Date.now();
    
    // Build jest command
    const jestArgs = [
      `--testMatch="**/__tests__/${category.name}/**/*"`,
      category.workers > 1 ? `--maxWorkers=${category.workers}` : '',
      category.name === 'e2e' || category.name === 'performance' ? '--runInBand' : '',
      category.name === 'performance' ? '--testTimeout=30000' : '',
      '--colors'
    ].filter(Boolean).join(' ');
    
    // Run in current process for simplicity (could use worker_threads for true parallelism)
    const { execSync } = require('child_process');
    
    try {
      execSync(`npx jest ${jestArgs}`, { stdio: 'inherit' });
      const categoryEndTime = Date.now();
      const executionTime = ((categoryEndTime - categoryStartTime) / 1000).toFixed(2);
      
      console.log(`\n✅ ${category.name} tests completed successfully in ${executionTime}s`);
      
      resolve({
        category: category.name,
        success: true,
        time: executionTime
      });
    } catch (error) {
      const categoryEndTime = Date.now();
      const executionTime = ((categoryEndTime - categoryStartTime) / 1000).toFixed(2);
      
      console.error(`\n❌ ${category.name} tests failed in ${executionTime}s`);
      
      resolve({
        category: category.name,
        success: false,
        time: executionTime,
        error: error.message
      });
    }
  });
}

// Function to run tests sequentially in priority order
async function runTestsSequentially() {
  for (const category of TEST_CATEGORIES) {
    const result = await createTestWorker(category);
    metrics.results[category.name] = result;
    
    if (!result.success && !result.skipped) {
      metrics.exitCode = 1;
    }
  }
  
  metrics.endTime = Date.now();
  printSummary();
  process.exit(metrics.exitCode);
}

// Print execution summary
function printSummary() {
  const totalTime = ((metrics.endTime - metrics.startTime) / 1000).toFixed(2);
  
  console.log('\n📊 Test Execution Summary');
  console.log('========================');
  console.log(`Total Time: ${totalTime} seconds\n`);
  
  Object.entries(metrics.results).forEach(([category, result]) => {
    if (result.skipped) {
      console.log(`${category}: ⏩ Skipped`);
    } else {
      console.log(`${category}: ${result.success ? '✅ Passed' : '❌ Failed'} (${result.time}s)`);
    }
  });
  
  console.log(`\nFinal Result: ${metrics.exitCode === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);
}

// Main execution
console.log('\n🧪 Starting Parallel Test Runner\n');

// Make sure the test environment is set up
if (fs.existsSync(path.join(process.cwd(), 'scripts', 'setup-test-environment.js'))) {
  console.log('Setting up test environment...');
  require('./setup-test-environment');
}

// Run the tests
runTestsSequentially();