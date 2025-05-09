/**
 * API URL Test
 * 
 * This file contains a simple test to verify that the API URL configuration is working correctly.
 * It tests that the API client is correctly handling URL paths with and without the /api prefix.
 */

import apiClient from '../lib/apiClient';

// Test function to verify API URL handling
const testApiUrlHandling = () => {
  console.log('=== API URL TEST ===');
  
  // Test cases
  const testCases = [
    { url: '/projects', expected: '/api/projects' },
    { url: '/projects/123', expected: '/api/projects/123' },
    { url: '/api/projects', expected: '/api/projects' },
    { url: '/api/projects/123', expected: '/api/projects/123' },
    { url: 'projects', expected: '/api/projects' },
    { url: 'projects/123', expected: '/api/projects/123' },
  ];
  
  // Run tests
  testCases.forEach(({ url, expected }) => {
    // Create a request config with the test URL
    const config = {
      url,
      method: 'GET',
      headers: {}
    };
    
    // Apply the request interceptor manually
    const interceptor = apiClient.interceptors.request.handlers[0].fulfilled;
    const result = interceptor(config);
    
    // Check if the URL was correctly transformed
    const passed = result.url === expected;
    
    console.log(
      `URL: "${url}" => "${result.url}" | Expected: "${expected}" | ${passed ? '✅ PASS' : '❌ FAIL'}`
    );
  });
  
  console.log('=== TEST COMPLETE ===');
};

// Run the test
testApiUrlHandling();

// Export the test function
export default testApiUrlHandling;
