import { vi } from 'vitest';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock environment variables
process.env.DB_PATH = ':memory:';
process.env.PORT = '3000';

// Increase timeout for async operations
vi.setConfig({ testTimeout: 10000 });