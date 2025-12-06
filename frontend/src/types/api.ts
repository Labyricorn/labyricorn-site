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
    "/api/v1/projects/{slug}/kanban": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Kanban Board
         * @description Get Kanban board for a project with cards grouped by status (50 DONE limit).
         *
         *     Returns all TODO and DOING cards, but only the 50 most recently completed
         *     DONE cards. Includes user_has_voted flag for each card based on IP hash.
         *
         *     Path Parameters:
         *     - slug: URL-friendly project identifier
         *
         *     Returns:
         *     - 200: Kanban board with cards grouped by status
         *     - 404: Project not found
         */
        get: operations["api_kanban_views_get_kanban_board"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/kanban/cards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create Card
         * @description Create a new Kanban card (admin only).
         *
         *     Creates a card with default values: votes=0, allow_voting=True, and order
         *     at the end of the target column. The status defaults to TODO if not specified.
         *
         *     Request Body:
         *     - board_id: ID of the Kanban board
         *     - title: Card title (1-200 characters)
         *     - status: Card status (TODO, DOING, or DONE) - defaults to TODO
         *
         *     Returns:
         *     - 200: Created card with user_has_voted flag
         *     - 400: Validation error (invalid board_id, title, or status)
         *     - 401: Unauthenticated user
         *     - 403: Non-admin user
         *     - 404: Board not found
         */
        post: operations["api_kanban_views_create_card"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/kanban/cards/{card_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Card
         * @description Delete a Kanban card (admin only).
         *
         *     Deletes a card and reorders remaining cards in the same column to fill the gap.
         *     Uses a database transaction to ensure atomic operation.
         *
         *     Path Parameters:
         *     - card_id: ID of the card to delete
         *
         *     Returns:
         *     - 200: Success response with {"success": True}
         *     - 401: Unauthenticated user
         *     - 403: Non-admin user
         *     - 404: Card not found
         */
        delete: operations["api_kanban_views_delete_card"];
        options?: never;
        head?: never;
        /**
         * Update Card
         * @description Update a Kanban card (admin only).
         *
         *     Updates the title and/or allow_voting fields of a card. All other fields
         *     (status, votes, order, completed_at) are preserved. At least one field
         *     must be provided in the request.
         *
         *     Path Parameters:
         *     - card_id: ID of the card to update
         *
         *     Request Body:
         *     - title: New card title (1-200 characters) - optional
         *     - allow_voting: Enable/disable voting on the card - optional
         *
         *     Returns:
         *     - 200: Updated card with user_has_voted flag
         *     - 400: Validation error (invalid title or allow_voting)
         *     - 401: Unauthenticated user
         *     - 403: Non-admin user
         *     - 404: Card not found
         */
        patch: operations["api_kanban_views_update_card"];
        trace?: never;
    };
    "/api/v1/projects/{slug}/kanban/archived": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Archived Cards
         * @description Get archived DONE cards with pagination.
         *
         *     Returns DONE cards beyond the initial 50 limit shown in the main board view.
         *     Supports pagination with offset and limit parameters. Cards are ordered by
         *     completion date descending (most recent first).
         *
         *     Path Parameters:
         *     - slug: URL-friendly project identifier
         *
         *     Query Parameters:
         *     - offset: Number of cards to skip (default: 0)
         *     - limit: Maximum number of cards to return (default: 50)
         *
         *     Returns:
         *     - 200: Paginated list of archived DONE cards
         *     - 404: Project not found
         */
        get: operations["api_kanban_views_get_archived_cards"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/kanban/cards/{card_id}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Move Card
         * @description Move or reorder a Kanban card (admin only).
         *
         *     Moves a card to a new status and/or position within a column. The order
         *     value is clamped to the valid range if out of bounds. When moving to DONE
         *     status, sets completed_at timestamp. When moving from DONE to another status,
         *     clears completed_at.
         *
         *     Path Parameters:
         *     - card_id: ID of the card to move
         *
         *     Request Body:
         *     - status: Target status (TODO, DOING, or DONE)
         *     - order: Target position within the column (0-indexed, non-negative)
         *
         *     Returns:
         *     - 200: Moved card with user_has_voted flag
         *     - 400: Validation error (invalid status or order)
         *     - 401: Unauthenticated user
         *     - 403: Non-admin user
         *     - 404: Card not found
         */
        patch: operations["api_kanban_views_move_card"];
        trace?: never;
    };
    "/api/v1/kanban/cards/{card_id}/vote": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Vote Card
         * @description Vote on a Kanban card (public endpoint with rate limiting).
         *
         *     Increments the vote count for a card and records the vote to prevent
         *     duplicates. Rate limited to 10 votes per minute per IP address.
         *
         *     Path Parameters:
         *     - card_id: ID of the card to vote on
         *
         *     Returns:
         *     - 200: Vote recorded successfully with updated vote count
         *     - 403: Voting is disabled for this card
         *     - 404: Card not found
         *     - 409: User has already voted on this card
         *     - 429: Rate limit exceeded (10 votes per minute)
         *
         *     Rate Limiting:
         *     - Maximum 10 votes per minute per IP address
         *     - Returns 429 with retry-after header when exceeded
         *
         *     Duplicate Prevention:
         *     - Uses IP address hash to track votes
         *     - Returns 409 if user has already voted on this card
         */
        post: operations["api_kanban_views_vote_card"];
        /**
         * Remove Vote
         * @description Remove vote from a Kanban card (public endpoint).
         *
         *     Decrements the vote count for a card and removes the vote record.
         *     Only works if the user has previously voted on this card.
         *
         *     Path Parameters:
         *     - card_id: ID of the card to remove vote from
         *
         *     Returns:
         *     - 200: Vote removed successfully with updated vote count
         *     - 403: Voting is disabled for this card
         *     - 404: Card not found or user has not voted on this card
         *
         *     Vote Removal:
         *     - Uses IP address hash to identify the vote to remove
         *     - Returns 404 if user has not voted on this card
         *     - Returns 403 if voting is disabled for this card
         */
        delete: operations["api_kanban_views_remove_vote"];
        options?: never;
        head?: never;
        patch?: never;
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
        /**
         * KanbanBoardSchema
         * @description Schema for complete Kanban board with cards grouped by status.
         *
         *     Returns all TODO and DOING cards, but only the 50 most recent
         *     DONE cards. The has_more_done flag indicates if there are
         *     additional archived DONE cards available.
         */
        KanbanBoardSchema: {
            /** Id */
            id: number;
            /** Project Id */
            project_id: number;
            /** Todo Cards */
            todo_cards: components["schemas"]["KanbanCardSchema"][];
            /** Doing Cards */
            doing_cards: components["schemas"]["KanbanCardSchema"][];
            /** Done Cards */
            done_cards: components["schemas"]["KanbanCardSchema"][];
            /** Has More Done */
            has_more_done: boolean;
        };
        /**
         * KanbanCardSchema
         * @description Schema for Kanban card in API responses.
         *
         *     Includes user_has_voted flag to indicate if the current user
         *     has voted on this card (based on IP hash).
         */
        KanbanCardSchema: {
            /** Id */
            id: number;
            /** Title */
            title: string;
            /** Status */
            status: string;
            /** Votes */
            votes: number;
            /** Allow Voting */
            allow_voting: boolean;
            /** Order */
            order: number;
            /** User Has Voted */
            user_has_voted: boolean;
            /** Completed At */
            completed_at?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * CardCreateSchema
         * @description Schema for creating a new Kanban card.
         *
         *     Requires board_id and title. Status defaults to TODO if not specified.
         *     Only accessible to admin users.
         */
        CardCreateSchema: {
            /** Board Id */
            board_id: number;
            /** Title */
            title: string;
            /**
             * Status
             * @default TODO
             */
            status: string;
        };
        /**
         * CardUpdateSchema
         * @description Schema for updating an existing Kanban card.
         *
         *     All fields are optional to support partial updates.
         *     Only accessible to admin users.
         */
        CardUpdateSchema: {
            /** Title */
            title?: string | null;
            /** Allow Voting */
            allow_voting?: boolean | null;
        };
        /**
         * ArchivedCardsSchema
         * @description Schema for paginated archived DONE cards.
         *
         *     Used for loading additional completed cards beyond the initial 50.
         *     Includes pagination metadata to support infinite scroll.
         */
        ArchivedCardsSchema: {
            /** Cards */
            cards: components["schemas"]["KanbanCardSchema"][];
            /** Has More */
            has_more: boolean;
            /** Total Count */
            total_count: number;
        };
        /**
         * CardMoveSchema
         * @description Schema for moving or reordering a Kanban card.
         *
         *     Requires both status and order. The order will be clamped
         *     to valid range if out of bounds.
         *     Only accessible to admin users.
         */
        CardMoveSchema: {
            /** Status */
            status: string;
            /** Order */
            order: number;
        };
        /**
         * VoteResponseSchema
         * @description Schema for vote operation responses.
         *
         *     Returns the card ID, updated vote count, and whether the
         *     current user has voted on the card.
         */
        VoteResponseSchema: {
            /** Id */
            id: number;
            /** Votes */
            votes: number;
            /** User Has Voted */
            user_has_voted: boolean;
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
    api_kanban_views_get_kanban_board: {
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
                    "application/json": components["schemas"]["KanbanBoardSchema"];
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
    api_kanban_views_create_card: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CardCreateSchema"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KanbanCardSchema"];
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
    api_kanban_views_delete_card: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                card_id: number;
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
    api_kanban_views_update_card: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                card_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CardUpdateSchema"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KanbanCardSchema"];
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
    api_kanban_views_get_archived_cards: {
        parameters: {
            query?: {
                offset?: number;
                limit?: number;
            };
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
                    "application/json": components["schemas"]["ArchivedCardsSchema"];
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
    api_kanban_views_move_card: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                card_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CardMoveSchema"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KanbanCardSchema"];
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
    api_kanban_views_vote_card: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                card_id: number;
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
                    "application/json": components["schemas"]["VoteResponseSchema"];
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
            /** @description Conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorSchema"];
                };
            };
        };
    };
    api_kanban_views_remove_vote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                card_id: number;
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
                    "application/json": components["schemas"]["VoteResponseSchema"];
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
