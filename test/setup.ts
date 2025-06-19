/**
 * Test setup and configuration
 */

import { beforeAll, afterAll } from "bun:test";

// Global test setup
beforeAll(async () => {
  // Set NODE_ENV to test
  process.env.NODE_ENV = "test";
  
  // Disable console.error during tests to reduce noise
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Only show errors that contain "ERROR" or "FAIL" (actual test failures)
    if (args.some(arg => typeof arg === 'string' && (arg.includes('ERROR') || arg.includes('FAIL')))) {
      originalConsoleError(...args);
    }
  };
});

// Global test teardown
afterAll(async () => {
  // Restore console.error
  console.error = console.error;
});