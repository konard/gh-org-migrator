#!/usr/bin/env node

import { gitFlicifyRepositoryName } from "./lib.js";

// Test suite for lib.js functions
function runTests() {
  console.log("Running tests for lib.js...\n");

  // Test cases for gitFlicifyRepositoryName
  const testCases = [
    // Issue #5 specific case
    { input: "deepcase.github.io", expected: "deepcase-github-io", description: "GitHub Pages repository" },

    // Basic transformations
    { input: "my.project", expected: "my-project", description: "Dot to dash transformation" },
    { input: "test@v1.0", expected: "test-v1-0", description: "Special characters replacement" },

    // Edge cases
    { input: "123repo", expected: "123repo", description: "Numeric prefix should be preserved" },
    { input: "", expected: "unnamed-repo", description: "Empty string fallback" },
    { input: "---", expected: "---", description: "Existing dashes preserved" },

    // Valid hyphenated names must not collide with other repositories
    { input: "-repo-", expected: "-repo-", description: "Leading/trailing dashes preserved" },
    { input: "test---repo", expected: "test---repo", description: "Consecutive dashes preserved" },

    // Valid names (should not change)
    { input: "normal-repo", expected: "normal-repo", description: "Valid name unchanged" },
    { input: "repo_with_underscores", expected: "repo_with_underscores", description: "Underscores preserved" },
    { input: "123", expected: "123", description: "All numeric name preserved" },
    { input: "release42", expected: "release42", description: "Numeric suffix preserved" },
    { input: "Проект_123", expected: "Проект_123", description: "Cyrillic letters and digits preserved" },
    { input: "UPPERCASE-REPO", expected: "UPPERCASE-REPO", description: "Letter case preserved" },
    { input: "name..repo", expected: "name--repo", description: "Each unsupported character replaced without collapsing dashes" },
  ];

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    const result = gitFlicifyRepositoryName(testCase.input);
    const success = result === testCase.expected;

    if (success) {
      passed++;
      console.log(`✅ Test ${index + 1}: ${testCase.description}`);
    } else {
      failed++;
      console.log(`❌ Test ${index + 1}: ${testCase.description}`);
      console.log(`   Input: "${testCase.input}"`);
      console.log(`   Expected: "${testCase.expected}"`);
      console.log(`   Got: "${result}"`);
    }
  });

  console.log(`\n=== Test Summary ===`);
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("❌ Tests failed!");
    process.exit(1);
  } else {
    console.log("✅ All tests passed!");
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
