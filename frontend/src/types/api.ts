export type paths = {
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health Check
         * @description Health check endpoint returning status and version
         */
        get: operations["api_urls_health_check"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Csrf Token
         * @description Endpoint to set CSRF cookie for SPA
         */
        get: operations["api_urls_get_csrf_token"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Api Login
         * @description API-based login endpoint for React frontend
         *     Validates credentials and creates authenticated session
         *
         *     Note: CSRF protection is enforced by Django middleware for this endpoint
         */
        post: operations["api_urls_api_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Api Logout
         * @description API-based logout endpoint
         *     Destroys the current authenticated session
         *
         *     Note: CSRF protection is enforced by Django middleware for this endpoint
         */
        post: operations["api_urls_api_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Current User
         * @description Get current authenticated user information
         *     Returns user data if authenticated, 401 if not
         */
        get: operations["api_urls_current_user"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Projects
         * @description Return paginated projects ordered by creation date (newest first).
         *
         *     Query Parameters:
         *     - page: Page number (default: 1)
         *     - page_size: Number of items per page (default: 20)
         *
         *     Returns:
         *     - items: List of projects
         *     - meta: Pagination metadata (total_count, page, page_size, total_pages)
         */
        get: operations["api_views_list_projects"];
        put?: never;
        /**
         * Create Project
         * @description Create a new project (admin only).
         *
         *     Accepts multipart/form-data with:
         *     - title: string (required)
         *     - description: string (required)
         *     - repo_url: string (optional)
         *     - tech_stack: comma-separated string (optional, e.g., "React,Django,PostgreSQL")
         *     - hero_image: file (optional)
         *
         *     Returns:
         *     - 201: Created project data
         *     - 400: Validation error
         *     - 401: Authentication required
         *     - 403: Admin privileges required
         */
        post: operations["api_views_create_project"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Project
         * @description Return a single project by slug.
         *
         *     Path Parameters:
         *     - slug: URL-friendly project identifier
         *
         *     Returns:
         *     - 200: Project data
         *     - 404: Project not found
         */
        get: operations["api_views_get_project"];
        put?: never;
        post?: never;
        /**
         * Delete Project
         * @description Delete a project (admin only).
         *
         *     Path Parameters:
         *     - slug: URL-friendly project identifier
         *
         *     Returns:
         *     - 200: Success confirmation
         *     - 401: Authentication required
         *     - 403: Admin privileges required
         *     - 404: Project not found
         */
        delete: operations["api_views_delete_project"];
        options?: never;
        head?: never;
        /**
         * Update Project
         * @description Update an existing project (admin only).
         *
         *     Accepts multipart/form-data with optional fields.
         *     Set remove_image=true to delete the hero image.
         *
         *     Path Parameters:
         *     - slug: URL-friendly project identifier
         *
         *     Form Parameters (all optional):
         *     - title: string
         *     - description: string
         *     - repo_url: string
         *     - tech_stack: comma-separated string
         *     - hero_image: file
         *     - remove_image: boolean (default: false)
         *
         *     Returns:
         *     - 200: Updated project data
         *     - 400: Validation error
         *     - 401: Authentication required
         *     - 403: Admin privileges required
         *     - 404: Project not found
         */
        patch: operations["api_views_update_project"];
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        /** LoginResponse */
        LoginResponse: {
            /** Id */
            id: number;
            /** Username */
            username: string;
            /** Email */
            email: string;
        };
        /** ErrorResponse */
        ErrorResponse: {
            /** Detail */
            detail: string;
        };
        /** LoginRequest */
        LoginRequest: {
            /** Username */
            username: string;
            /** Password */
            password: string;
        };
        /** UserResponse */
        UserResponse: {
            /** Id */
            id: number;
            /** Username */
            username: string;
            /** Email */
            email: string;
        };
        /**
         * HeroImageSchema
         * @description Schema for hero image with dimensions for layout stability.
         *
         *     Includes URL and dimensions to prevent Cumulative Layout Shift (CLS)
         *     by allowing the frontend to reserve space before the image loads.
         */
        HeroImageSchema: {
            /** Url */
            url?: string | null;
            /** Width */
            width?: number | null;
            /** Height */
            height?: number | null;
        };
        /**
         * PaginationMeta
         * @description Pagination metadata for list responses.
         *
         *     Provides clients with information needed to implement
         *     pagination controls and understand the full dataset size.
         */
        PaginationMeta: {
            /** Total Count */
            total_count: number;
            /** Page */
            page: number;
            /** Page Size */
            page_size: number;
            /** Total Pages */
            total_pages: number;
        };
        /**
         * ProjectListResponse
         * @description Response schema for paginated project list endpoint.
         *
         *     Combines project items with pagination metadata to provide
         *     a complete view of the dataset.
         */
        ProjectListResponse: {
            /** Items */
            items: components["schemas"]["ProjectSchema"][];
            meta: components["schemas"]["PaginationMeta"];
        };
        /**
         * ProjectSchema
         * @description Complete project schema for API responses.
         *
         *     Used for both list and detail endpoints to ensure consistent
         *     response structure across the API.
         */
        ProjectSchema: {
            /** Id */
            id: number;
            /** Title */
            title: string;
            /** Slug */
            slug: string;
            /** Description */
            description: string;
            /** Repo Url */
            repo_url?: string | null;
            /** Tech Stack */
            tech_stack: string[];
            hero_image: components["schemas"]["HeroImageSchema"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /**
         * ErrorSchema
         * @description Standard error response schema.
         *
         *     Provides consistent error formatting across all API endpoints.
         *     The errors field contains field-specific validation errors when applicable.
         */
        ErrorSchema: {
            /** Detail */
            detail: string;
            /** Errors */
            errors?: {
                [key: string]: unknown;
            } | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
    api_urls_health_check: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    api_urls_get_csrf_token: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    api_urls_api_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    api_urls_api_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    api_urls_current_user: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    api_views_list_projects: {
        parameters: {
            query?: {
                page?: number;
                page_size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectListResponse"];
                };
            };
        };
    };
    api_views_create_project: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Title */
                    title: string;
                    /** Description */
                    description: string;
                    /** Repo Url */
                    repo_url?: string | null;
                    /**
                     * Tech Stack
                     * @default
                     */
                    tech_stack?: string;
                    /** Hero Image */
                    hero_image?: string | null;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectSchema"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
        };
    };
    api_views_get_project: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectSchema"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
        };
    };
    api_views_delete_project: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
        };
    };
    api_views_update_project: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Title */
                    title?: string | null;
                    /** Description */
                    description?: string | null;
                    /** Repo Url */
                    repo_url?: string | null;
                    /** Tech Stack */
                    tech_stack?: string | null;
                    /**
                     * Remove Image
                     * @default false
                     */
                    remove_image?: boolean;
                    /** Hero Image */
                    hero_image?: string | null;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectSchema"];
                };
            };
            /** @description Bad Request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
        };
    };
}
