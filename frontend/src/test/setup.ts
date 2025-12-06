import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock react-responsive-masonry to avoid test environment issues
vi.mock('react-responsive-masonry', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  Masonry: ({ children }: { children: React.ReactNode }) => children,
  ResponsiveMasonry: ({ children }: { children: React.ReactNode }) => children,
}));
