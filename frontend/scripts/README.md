# TypeScript Type Generation from OpenAPI

This directory contains scripts for generating TypeScript types from the Django backend's OpenAPI schema.

## Usage

### Generate Types

To generate TypeScript types from the backend API:

```bash
npm run gen:types
```

This will:
1. Fetch the OpenAPI schema from `http://localhost:8000/api/v1/openapi.json`
2. Generate TypeScript types using `openapi-typescript`
3. Save the types to `src/types/api.ts`

### Prerequisites

- The Django backend must be running on `http://localhost:8000`
- The backend must expose the OpenAPI schema at `/api/v1/openapi.json`

### Configuration

The API base URL can be configured via the `VITE_API_BASE_URL` environment variable:

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1 npm run gen:types
```

## Generated Types

The generated `src/types/api.ts` file includes:

- **paths**: All API endpoint paths with their HTTP methods
- **components**: Schema definitions for request/response bodies
- **operations**: Detailed operation types for each endpoint

## Using Generated Types

Import types from the generated file:

```typescript
import type { LoginRequest, LoginResponse, UserResponse } from '../types/api';
```

The API client in `src/services/api.ts` uses these types to provide type-safe API calls.

## Regenerating Types

Run `npm run gen:types` whenever the backend API changes to keep frontend types in sync.
