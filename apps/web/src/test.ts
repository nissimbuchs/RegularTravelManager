// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// Mock global process object for test environment
(globalThis as any).process = {
  env: {
    NODE_ENV: 'test'
  }
};

// Mock AWS Amplify for tests - using Jasmine spies since we're in Jasmine environment
beforeAll(() => {
  // Mock console to reduce noise in tests
  spyOn(console, 'warn').and.stub();
  spyOn(console, 'error').and.stub();
});

declare const require: {
  context(path: string, deep?: boolean, filter?: RegExp): {
    keys(): string[];
    <T>(id: string): T;
  };
};

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Then we find all the tests.
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().forEach(context);