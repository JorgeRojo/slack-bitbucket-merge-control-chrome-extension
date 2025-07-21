import { describe, test, expect } from 'vitest';

describe('Content Script Structure', () => {
  test('should have proper encapsulation pattern', () => {
    // Read the content script file to verify structure
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/content.js'),
      'utf8',
    );

    // Verify that the script uses encapsulation pattern
    expect(contentScript).toContain('BitbucketMergeController');
    expect(contentScript).toContain('(() => {');
    expect(contentScript).toContain('let mergeButtonObserver = null;');

    // Verify that mergeButtonObserver is not a global variable
    expect(contentScript).not.toMatch(/^let mergeButtonObserver/m);
    expect(contentScript).not.toMatch(/^var mergeButtonObserver/m);
  });

  test('should initialize the controller', () => {
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/content.js'),
      'utf8',
    );

    // Verify that the controller is initialized
    expect(contentScript).toContain('BitbucketMergeController.init()');
  });

  test('should have all required functions encapsulated', () => {
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/content.js'),
      'utf8',
    );

    // Verify that key functions are present and encapsulated
    expect(contentScript).toContain('function disableMergeButton');
    expect(contentScript).toContain('function enableMergeButton');
    expect(contentScript).toContain('function applyMergeButtonLogic');
    expect(contentScript).toContain('function observeMergeButton');
    expect(contentScript).toContain('function handleRuntimeMessage');
  });
});
