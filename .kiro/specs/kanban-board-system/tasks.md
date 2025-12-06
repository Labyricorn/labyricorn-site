# Implementation Plan

- [x] 1. Set up backend models and database schema





  - Create KanbanBoard model with OneToOne relationship to Project
  - Create KanbanCard model with all fields (title, status, votes, allow_voting, order, completed_at)
  - Create CardVote model for vote tracking with IP hash
  - Add database indexes for performance
  - Create and run migrations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1-2.5, 7.6, 19.3_

- [x] 1.1 Write property test for automatic board creation


  - **Property 1: Automatic board creation**
  - **Validates: Requirements 1.1, 1.3**

- [x] 1.2 Write property test for cascade deletion


  - **Property 2: Cascade deletion**
  - **Validates: Requirements 1.2**

- [x] 1.3 Write property test for one board per project constraint


  - **Property 3: One board per project**
  - **Validates: Requirements 1.4**

- [x] 2. Implement signal for automatic board creation




  - Create post_save signal handler for Project model
  - Register signal in apps.py ready() method
  - Ensure board is created only on project creation (not updates)
  - _Requirements: 1.1_

- [x] 3. Implement card ordering and reordering logic





  - Add save() method to set initial order at end of column
  - Implement move_to() method for card repositioning
  - Handle order recalculation for same-column and cross-column moves
  - Use database transactions for atomic operations
  - Set completed_at timestamp when moving to DONE
  - _Requirements: 2.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

- [x] 3.1 Write property test for order recalculation during moves


  - **Property 8: Order recalculation during moves**
  - **Validates: Requirements 5.3, 6.1, 6.2**

- [x] 3.2 Write property test for position boundary clamping


  - **Property 10: Position boundary clamping**
  - **Validates: Requirements 6.3**

- [x] 3.3 Write property test for completed timestamp


  - **Property 42: Completed timestamp**
  - **Validates: Requirements 5.4**

- [x] 4. Implement voting system with duplicate prevention





  - Add increment_vote() method with IP hash parameter
  - Add decrement_vote() method for vote removal
  - Add has_user_voted() method for checking vote status
  - Create CardVote records on vote
  - Use atomic operations to prevent race conditions
  - Implement IP hashing with SHA-256
  - Add cleanup_old_votes() class method for 90-day expiration
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 18.1, 18.2, 18.3, 18.4, 19.2, 19.3, 19.4_

- [x] 4.1 Write property test for vote increment


  - **Property 11: Vote increment**
  - **Validates: Requirements 7.1, 7.3**

- [x] 4.2 Write property test for duplicate vote prevention

  - **Property 32: Duplicate vote prevention**
  - **Validates: Requirements 7.2, 19.2**

- [x] 4.3 Write property test for vote removal

  - **Property 28: Vote removal**
  - **Validates: Requirements 18.1, 18.3**

- [x] 4.4 Write property test for IP hash privacy

  - **Property 33: IP hash privacy**
  - **Validates: Requirements 19.3**

- [x] 4.5 Write property test for vote record expiration

  - **Property 34: Vote record expiration**
  - **Validates: Requirements 19.4**

- [x] 5. Register models in Django admin





  - Register KanbanBoard with inline display
  - Register KanbanCard with list display and filters
  - Register CardVote with read-only fields
  - Add search and filter capabilities
  - _Requirements: N/A (admin convenience)_

- [x] 6. Create Django Ninja schemas





  - Create KanbanCardSchema with user_has_voted field
  - Create KanbanBoardSchema with has_more_done field
  - Create ArchivedCardsSchema for pagination
  - Create CardCreateSchema, CardUpdateSchema, CardMoveSchema
  - Create VoteResponseSchema with user_has_voted
  - Create ErrorSchema for consistent error responses
  - _Requirements: 9.4, 9.6, 13.1, 13.2, 17.1, 17.2, 17.3_

- [x] 7. Implement rate limiting utility





  - Create check_rate_limit() function using Django cache
  - Set limit to 10 votes per minute per IP hash
  - Return 429 error with retry-after header when exceeded
  - Configure cache backend in settings
  - _Requirements: 19.1, 14.6_

- [x] 7.1 Write property test for rate limiting enforcement


  - **Property 31: Rate limiting enforcement**
  - **Validates: Requirements 19.1, 14.6**

- [x] 8. Implement API endpoint: GET /projects/{slug}/kanban





  - Extract and hash client IP address
  - Fetch all TODO and DOING cards
  - Fetch only 50 most recent DONE cards ordered by completed_at
  - Add user_has_voted flag to each card
  - Return has_more_done flag
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 13.1_

- [x] 8.1 Write property test for DONE card limit


  - **Property 35: DONE card limit**
  - **Validates: Requirements 9.3**

- [x] 8.2 Write property test for user vote status


  - **Property 36: User vote status**
  - **Validates: Requirements 9.6**

- [x] 9. Implement API endpoint: GET /projects/{slug}/kanban/archived





  - Support offset and limit query parameters
  - Fetch DONE cards with pagination
  - Order by completed_at descending
  - Return has_more flag and total_count
  - Add user_has_voted flag to each card
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 13.2_

- [x] 9.1 Write property test for archived cards pagination


  - **Property 37: Archived cards pagination**
  - **Validates: Requirements 20.1, 20.2**

- [x] 9.2 Write property test for archived cards ordering


  - **Property 38: Archived cards ordering**
  - **Validates: Requirements 20.4**

- [x] 10. Implement API endpoint: POST /kanban/cards (admin only)





  - Validate board_id and title
  - Create card with default values
  - Add user_has_voted flag to response
  - Return 400 for validation errors
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.1, 13.3_

- [x] 10.1 Write property test for card creation with defaults


  - **Property 4: Card creation with defaults**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 11. Implement API endpoint: PATCH /kanban/cards/{id} (admin only)




  - Update title and/or allow_voting
  - Preserve other fields
  - Add user_has_voted flag to response
  - Return 404 if card not found
  - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.2, 8.3, 13.4_

- [x] 11.1 Write property test for title update preservation

  - **Property 5: Title update preservation**
  - **Validates: Requirements 3.1, 3.2**

- [x] 11.2 Write property test for voting control toggle

  - **Property 13: Voting control toggle**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 12. Implement API endpoint: DELETE /kanban/cards/{id} (admin only)





  - Delete card in transaction
  - Reorder remaining cards in column
  - Return success response
  - Return 404 if card not found
  - _Requirements: 4.1, 4.2, 4.3, 13.5_

- [x] 12.1 Write property test for card deletion and reordering


  - **Property 6: Card deletion and reordering**
  - **Validates: Requirements 4.1, 4.2**

- [x] 13. Implement API endpoint: PATCH /kanban/cards/{id}/move (admin only)





  - Validate status is TODO/DOING/DONE
  - Clamp order to valid range
  - Call card.move_to() method
  - Add user_has_voted flag to response
  - Return 400 for invalid status
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 10.2, 13.6_

- [x] 13.1 Write property test for status change during move


  - **Property 7: Status change during move**
  - **Validates: Requirements 5.1, 5.2**

- [x] 13.2 Write property test for invalid status rejection

  - **Property 9: Invalid status rejection**
  - **Validates: Requirements 5.5, 10.2**

- [x] 14. Implement API endpoint: POST /kanban/cards/{id}/vote





  - Extract and hash client IP
  - Check rate limit (10 per minute)
  - Call card.increment_vote() with IP hash
  - Return vote count and user_has_voted=true
  - Return 403 if voting disabled
  - Return 409 if already voted
  - Return 429 if rate limit exceeded
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 13.7, 14.5, 14.6, 14.7, 19.1, 19.2_

- [x] 14.1 Write property test for voting rejection for disabled cards


  - **Property 12: Voting rejection for disabled cards**
  - **Validates: Requirements 7.2, 14.5**

- [x] 15. Implement API endpoint: DELETE /kanban/cards/{id}/vote





  - Extract and hash client IP
  - Call card.decrement_vote() with IP hash
  - Return vote count and user_has_voted=false
  - Return 403 if voting disabled
  - Return 404 if user hasn't voted
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 13.8_

- [x] 15.1 Write property test for vote removal rejection


  - **Property 29: Vote removal rejection for non-voters**
  - **Validates: Requirements 18.2**

- [x] 15.2 Write property test for vote removal disabled state


  - **Property 30: Vote removal disabled state**
  - **Validates: Requirements 18.4**

- [x] 16. Implement validation error handling





  - Add title length validation (1-200 chars)
  - Add status enum validation
  - Add non-negative integer validation for votes and order
  - Add boolean validation for allow_voting
  - Return 400 with detailed error messages
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 14.1_

- [x] 16.1 Write property test for title validation


  - **Property 16: Title validation**
  - **Validates: Requirements 10.1**

- [x] 16.2 Write property test for votes validation


  - **Property 17: Votes validation**
  - **Validates: Requirements 10.3**

- [x] 16.3 Write property test for order validation


  - **Property 18: Order validation**
  - **Validates: Requirements 10.4**

- [x] 16.4 Write property test for boolean validation


  - **Property 19: Boolean validation**
  - **Validates: Requirements 10.5**

- [x] 17. Implement authentication and authorization





  - Add admin_required auth to POST, PATCH, DELETE endpoints (except vote)
  - Return 401 for unauthenticated requests
  - Return 403 for non-admin authenticated requests
  - Keep vote endpoints public
  - _Requirements: 14.3, 14.4_

- [x] 17.1 Write property test for authentication error handling


  - **Property 26: Authentication error handling**
  - **Validates: Requirements 14.3**

- [x] 17.2 Write property test for authorization error handling


  - **Property 27: Authorization error handling**
  - **Validates: Requirements 14.4**

- [x] 18. Add Kanban router to Django Ninja API





  - Import and register kanban router
  - Ensure OpenAPI schema includes Kanban endpoints
  - Test API documentation at /api/v1/docs
  - _Requirements: 13.1-13.8, 17.4_

- [x] 19. Create management command for vote cleanup





  - Create cleanup_old_votes command
  - Call CardVote.cleanup_old_votes()
  - Log deleted count
  - Document cron setup in deployment notes
  - _Requirements: 19.4_

- [x] 20. Checkpoint - Ensure all backend tests pass





  - Ensure all tests pass, ask the user if questions arise.
  - Do a git commit and push to GitHub.
  - _Requirements: N/A (backend testing)

- [x] 21. Install frontend dependencies




  - Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
  - Install @heroicons/react
  - Verify package.json is updated
  - _Requirements: 11.1_

- [x] 22. Generate TypeScript types from OpenAPI schema




  - Run type generation script
  - Verify KanbanCardSchema and KanbanBoardSchema types
  - Verify ArchivedCardsSchema types
  - Verify request/response types for all endpoints
  - _Requirements: 17.1, 17.2, 17.3_

- [x] 23. Create useKanbanBoard hook with auto-refresh






  - Implement query with 15-second stale time
  - Add refetchInterval for auto-refresh
  - Pause refetch when isDragging is true
  - Return query object with data and loading states
  - _Requirements: 9.1, 21.1, 21.2, 21.3_

- [x] 23.1 Write property test for auto-refresh interval


  - **Property 40: Auto-refresh interval**
  - **Validates: Requirements 21.1, 21.2**

- [x] 23.2 Write property test for drag pause auto-refresh


  - **Property 41: Drag pause auto-refresh**
  - **Validates: Requirements 21.3**

- [x] 24. Create useArchivedCards hook




  - Implement infinite query with pagination
  - Support offset and limit parameters
  - Implement getNextPageParam for infinite scroll
  - Return pages array and fetchNextPage function
  - _Requirements: 20.1, 20.2, 20.3_

- [x] 25. Create useVoteCard hook with optimistic updates





  - Implement mutation with POST to /kanban/cards/{id}/vote
  - Optimistically increment votes and set user_has_voted=true
  - Revert on error with appropriate error messages
  - Handle 429 rate limit errors
  - Handle 409 duplicate vote errors
  - Invalidate queries on success
  - _Requirements: 12.1, 12.2, 12.3, 14.6, 14.7_

- [x] 25.1 Write property test for optimistic voting updates


  - **Property 22: Optimistic voting updates**
  - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 26. Create useRemoveVote hook




  - Implement mutation with DELETE to /kanban/cards/{id}/vote
  - Optimistically decrement votes and set user_has_voted=false
  - Revert on error with appropriate error messages
  - Handle 404 not voted errors
  - Invalidate queries on success
  - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 27. Create useMoveCard hook




  - Implement mutation with PATCH to /kanban/cards/{id}/move
  - Send status and order in request body
  - Invalidate kanban query on success
  - Handle validation errors
  - _Requirements: 11.2, 11.3, 11.4_

- [x] 28. Create KanbanCard component




  - Implement useSortable for drag-and-drop
  - Display card title and vote count
  - Show filled heart icon if user_has_voted, outline otherwise
  - Handle vote/remove vote on click
  - Disable voting if allow_voting is false
  - Show appropriate cursor (grab/not-allowed)
  - Add tooltip for vote button
  - _Requirements: 11.1, 12.1, 12.4, 16.2, 16.3, 16.4_

- [x] 28.1 Write property test for vote button disabled state

  - **Property 23: Vote button disabled state**
  - **Validates: Requirements 12.4**

- [x] 29. Create KanbanColumn component




  - Implement useDroppable for drop zone
  - Use SortableContext for card list
  - Display column title
  - Render empty state when no cards
  - Add Load More button for DONE column if has_more
  - Handle loading state for Load More
  - _Requirements: 15.3, 15.5, 15.6, 20.1_

- [x] 30. Create KanbanBoard component





  - Implement DndContext with closestCorners collision
  - Track isDragging state
  - Handle drag start and drag end events
  - Render three columns (TODO, DOING, DONE)
  - Render DragOverlay with active card
  - Pass isDragging to useKanbanBoard hook
  - Wire up vote, remove vote, and move handlers
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 21.3_

- [x] 30.1 Write property test for drag-drop API integration


  - **Property 20: Drag-drop API integration**
  - **Validates: Requirements 11.2, 11.3**

- [x] 30.2 Write property test for drag-drop error handling


  - **Property 21: Drag-drop error handling**
  - **Validates: Requirements 11.4**

- [x] 31. Add Kanban tab to ProjectDetailPage




  - Add "Kanban" tab to tab list
  - Fetch board data when tab is active
  - Display loading skeletons while loading
  - Render KanbanBoard component with data
  - Pass isAdmin prop based on user auth
  - Handle archived cards loading
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 32. Apply cyberpunk theme styling





  - Use surface color (#1e293b) for column backgrounds
  - Use primary color (#a855f7) for card borders
  - Apply neon purple glow during drag
  - Use success color (#22c55e) for vote icons
  - Reduce opacity for disabled vote buttons
  - Add hover effects and transitions
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 33. Implement touch device support




  - Configure @dnd-kit sensors for touch
  - Add press-and-hold delay before drag
  - Test on mobile devices
  - _Requirements: 11.6_

- [-] 34. Final checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
  - commit to git and push to github
  - _Requirements: N/A (backend testing)

- [ ] 35. Manual testing and polish
  - Test drag-and-drop on desktop and mobile
  - Test voting and vote removal
  - Test rate limiting (10 votes in 60 seconds)
  - Test archived cards pagination
  - Test auto-refresh behavior
  - Verify error messages are user-friendly
  - Check responsive design
  - Verify cyberpunk theme consistency
