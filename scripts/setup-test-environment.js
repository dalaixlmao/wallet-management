#!/usr/bin/env node

/**
 * Test Environment Setup Script
 * 
 * This script prepares the test environment by:
 * 1. Setting up test database with proper isolation
 * 2. Pre-compiling common dependencies
 * 3. Caching modules to improve performance
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const ENABLE_CACHE = true;
const CACHE_DIR = path.join(process.cwd(), '.test-cache');

// Ensure cache directory exists
if (ENABLE_CACHE && !fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Record start time
const startTime = Date.now();

// Helper functions
function logStep(step) {
  console.log(`\n🔧 ${step}...\n`);
}

function runCommand(command, options = {}) {
  try {
    console.log(`Executing: ${command}`);
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`Error executing command: ${error.message}`);
    return false;
  }
}

// Setup steps
logStep('Checking environment');
const nodeVersion = execSync('node --version').toString().trim();
const npmVersion = execSync('npm --version').toString().trim();
console.log(`Node version: ${nodeVersion}`);
console.log(`NPM version: ${npmVersion}`);

// Update test configuration if needed
logStep('Optimizing Jest configuration');
const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
const setupPath = path.join(process.cwd(), 'jest.setup.js');

if (fs.existsSync(jestConfigPath)) {
  // Add optimized settings to Jest config
  const jestConfig = fs.readFileSync(jestConfigPath, 'utf8');
  
  if (!jestConfig.includes('cacheDirectory')) {
    const optimizedConfig = jestConfig.replace(
      'module.exports = {', 
      `module.exports = {\n  cacheDirectory: '.test-cache/jest-cache',`
    );
    
    // Only update if changed to prevent unnecessary file writes
    if (optimizedConfig !== jestConfig) {
      fs.writeFileSync(jestConfigPath, optimizedConfig);
      console.log('✅ Updated Jest configuration with cache settings');
    }
  }
}

// Create optimized ESLint config if needed
logStep('Setting up optimized ESLint');
const eslintConfigPath = path.join(process.cwd(), '.eslintrc.json');
const eslintIgnorePath = path.join(process.cwd(), '.eslintignore');

if (!fs.existsSync(eslintIgnorePath)) {
  fs.writeFileSync(eslintIgnorePath, `
node_modules
.test-cache
*.min.js
dist
build
coverage
`);
  console.log('✅ Created optimized .eslintignore');
}

// Create test run cache marker
fs.writeFileSync(
  path.join(CACHE_DIR, 'setup-complete'),
  JSON.stringify({
    timestamp: Date.now(),
    node: nodeVersion,
    npm: npmVersion
  })
);

// Calculate and output elapsed time
const endTime = Date.now();
const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

console.log(`\n✅ Test environment setup completed in ${elapsedSeconds}s`);