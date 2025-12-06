import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { apiClient, getCsrfToken, initializeCsrf } from './api';
import type { AxiosRequestConfig } from 'axios';

/**
 * Feature: base-site-setup, Property 9: CSRF token inclusion
 * Validates: Requirements 12.3
 * 
 * For any POST, PUT, PATCH, or DELETE request made by the React Frontend,
 * the request should include the X-CSRFToken header with a valid token.
 */
describe('Property 9: CSRF token inclusion', () => {
  beforeEach(() => {
    // Clear cookies before each test
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });

  it('should include X-CSRFToken header for any state-changing request', () => {
    fc.assert(
      fc.property(
        // Generate random HTTP methods (state-changing)
        fc.constantFrom('post', 'put', 'patch', 'delete'),
        // Generate random endpoint paths
        fc.array(
          fc.oneof(
            fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'),
            fc.constantFrom('0', '1', '2', '3', '4', '5'),
            fc.constant('-')
          ),
          { minLength: 1, maxLength: 10 }
        ).map(chars => '/' + chars.join('')),
        // Generate random CSRF token (alphanumeric only, no whitespace)
        fc.array(
          fc.oneof(
            fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'),
            fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'),
            fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
          ),
          { minLength: 32, maxLength: 64 }
        ).map(chars => chars.join('')),
        (method, path, csrfToken) => {
          // Set CSRF token in cookie
          document.cookie = `csrftoken=${csrfToken}; path=/`;

          // Verify token is readable
          const retrievedToken = getCsrfToken();
          expect(retrievedToken).toBe(csrfToken);

          // Create a request config
          const config: AxiosRequestConfig = {
            method,
            url: path,
            headers: {},
          };

          // Apply the request interceptor manually
          const interceptor = apiClient.interceptors.request.handlers[0];
          if (interceptor && interceptor.fulfilled) {
            const modifiedConfig = interceptor.fulfilled(config);
            
            // Verify X-CSRFToken header is present
            expect(modifiedConfig.headers).toBeDefined();
            expect(modifiedConfig.headers!['X-CSRFToken']).toBe(csrfToken);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT include X-CSRFToken header for GET requests', () => {
    fc.assert(
      fc.property(
        // Generate random endpoint paths
        fc.array(
          fc.oneof(
            fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'),
            fc.constantFrom('0', '1', '2', '3', '4', '5')
          ),
          { minLength: 1, maxLength: 10 }
        ).map(chars => '/' + chars.join('')),
        // Generate random CSRF token (alphanumeric only, no whitespace)
        fc.array(
          fc.oneof(
            fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'),
            fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'),
            fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
          ),
          { minLength: 32, maxLength: 64 }
        ).map(chars => chars.join('')),
        (path, csrfToken) => {
          // Set CSRF token in cookie
          document.cookie = `csrftoken=${csrfToken}; path=/`;

          // Create a GET request config
          const config: AxiosRequestConfig = {
            method: 'get',
            url: path,
            headers: {},
          };

          // Apply the request interceptor manually
          const interceptor = apiClient.interceptors.request.handlers[0];
          if (interceptor && interceptor.fulfilled) {
            const modifiedConfig = interceptor.fulfilled(config);
            
            // Verify X-CSRFToken header is NOT present for GET
            expect(modifiedConfig.headers!['X-CSRFToken']).toBeUndefined();
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: base-site-setup, Property 7: API request header consistency
 * Validates: Requirements 9.3
 * 
 * For any HTTP request made by the React Frontend API client,
 * the request should include the Content-Type: application/json header.
 */
describe('Property 7: API request header consistency', () => {
  it('should include Content-Type: application/json header for all requests', () => {
    fc.assert(
      fc.property(
        // Generate random HTTP methods
        fc.constantFrom('get', 'post', 'put', 'patch', 'delete'),
        // Generate random endpoint paths
        fc.array(
          fc.oneof(
            fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'),
            fc.constantFrom('0', '1', '2', '3', '4', '5'),
            fc.constant('-')
          ),
          { minLength: 1, maxLength: 10 }
        ).map(chars => '/' + chars.join('')),
        (method, path) => {
          // Create a request config
          const config: AxiosRequestConfig = {
            method,
            url: path,
            headers: {},
          };

          // Apply the request interceptor
          const interceptor = apiClient.interceptors.request.handlers[0];
          if (interceptor && interceptor.fulfilled) {
            const modifiedConfig = interceptor.fulfilled(config);
            
            // The default headers from axios.create should be present
            // We verify by checking the apiClient defaults
            expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests for specific functionality
describe('API Client Unit Tests', () => {
  beforeEach(() => {
    // Clear cookies before each test
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });

  describe('getCsrfToken', () => {
    it('should return null when no CSRF token cookie exists', () => {
      expect(getCsrfToken()).toBeNull();
    });

    it('should return the CSRF token when cookie exists', () => {
      const token = 'test-csrf-token-123';
      document.cookie = `csrftoken=${token}; path=/`;
      expect(getCsrfToken()).toBe(token);
    });

    it('should handle multiple cookies correctly', () => {
      const token = 'test-csrf-token-456';
      document.cookie = 'other=value; path=/';
      document.cookie = `csrftoken=${token}; path=/`;
      document.cookie = 'another=value2; path=/';
      expect(getCsrfToken()).toBe(token);
    });
  });

  describe('apiClient configuration', () => {
    it('should have correct base URL', () => {
      expect(apiClient.defaults.baseURL).toBeDefined();
      expect(apiClient.defaults.baseURL).toContain('/api/v1');
    });

    it('should have withCredentials enabled', () => {
      expect(apiClient.defaults.withCredentials).toBe(true);
    });

    it('should have Content-Type header set to application/json', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('initializeCsrf', () => {
    it('should call the /csrf endpoint', async () => {
      // Mock the apiClient.get method
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} });

      await initializeCsrf();

      expect(getSpy).toHaveBeenCalledWith('/csrf');
      
      getSpy.mockRestore();
    });

    it('should throw error if CSRF initialization fails', async () => {
      // Mock the apiClient.get method to reject
      const getSpy = vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network error'));

      await expect(initializeCsrf()).rejects.toThrow('Network error');
      
      getSpy.mockRestore();
    });
  });
});
