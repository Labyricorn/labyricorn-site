# Requirements Document

## Introduction

The Kanban Board System enables interactive task management for each project through a drag-and-drop interface with three columns (TODO, DOING, DONE). Each project has one associated Kanban board containing cards that can be moved between columns, reordered within columns, and voted on by visitors. The system provides real-time visual feedback with cyberpunk-themed animations and supports both admin management and public voting interactions.

## Glossary

- **Kanban Board**: A visual task management board associated with a single project, containing cards organized in columns
- **Kanban Card**: A task item on a board with a title, status, vote count, and order position
- **Status**: The column a card belongs to: TODO, DOING, or DONE
- **Vote**: A public user action that increments a card's vote count to indicate interest or priority
- **Order**: An integer field determining the vertical position of a card within its status column
- **Drag-and-Drop**: User interaction allowing cards to be moved between columns or reordered within a column
- **Optimistic Update**: UI update that occurs immediately before server confirmation for responsive feel
- **Admin User**: A user with staff or superuser privileges who can create, edit, delete, and move cards
- **Public User**: Any user (authenticated or not) who can view boards and vote on cards (if voting is enabled)
- **Glow Effect**: Visual feedback (neon purple) applied to cards during drag operations
- **Vote Session**: A tracking mechanism using IP address or session ID to prevent duplicate votes
- **Rate Limiting**: Throttling mechanism to prevent vote spam and abuse
- **Archived Cards**: Cards in the DONE column that are hidden from default view to improve performance

## Requirements

### Requirement 1

**User Story:** As a system, I want each project to have exactly one Kanban board, so that task management is automatically available for all projects.

#### Acceptance Criteria

1. WHEN a project is created THEN the System SHALL automatically create an associated Kanban board
2. WHEN a project is deleted THEN the System SHALL cascade delete the associated Kanban board
3. WHEN querying a project THEN the System SHALL provide access to its Kanban board through a one-to-one relationship
4. THE System SHALL enforce that each project has at most one Kanban board

### Requirement 2

**User Story:** As an admin user, I want to create Kanban cards with titles, so that I can track tasks for a project.

#### Acceptance Criteria

1. WHEN an admin user submits a card creation request with a valid title THEN the System SHALL create a new Kanban card
2. WHEN creating a card THEN the System SHALL set the initial status to TODO
3. WHEN creating a card THEN the System SHALL set the initial vote count to 0
4. WHEN creating a card THEN the System SHALL set allow_voting to true by default
5. WHEN creating a card THEN the System SHALL assign an order value placing it at the end of the TODO column using select_for_update to prevent race conditions

### Requirement 3

**User Story:** As an admin user, I want to edit Kanban card titles, so that I can update task descriptions.

#### Acceptance Criteria

1. WHEN an admin user submits an update request with a new title THEN the System SHALL update the card's title
2. WHEN updating a card title THEN the System SHALL preserve the card's status, votes, and order
3. WHEN a card ID does not exist THEN the System SHALL return a 404 error

### Requirement 4

**User Story:** As an admin user, I want to delete Kanban cards, so that I can remove completed or irrelevant tasks.

#### Acceptance Criteria

1. WHEN an admin user deletes a card THEN the System SHALL remove the card from the database
2. WHEN deleting a card THEN the System SHALL reorder remaining cards in the same column to fill the gap
3. WHEN a card ID does not exist THEN the System SHALL return a 404 error

### Requirement 5

**User Story:** As an admin user, I want to move cards between columns, so that I can update task status.

#### Acceptance Criteria

1. WHEN an admin user moves a card to a different status THEN the System SHALL update the card's status field
2. WHEN moving a card to a new status THEN the System SHALL assign an order value based on the target position
3. WHEN moving a card THEN the System SHALL reorder other cards in both source and destination columns using database transactions
4. WHEN moving a card to DONE status THEN the System SHALL set a completed_at timestamp
5. WHEN the target status is invalid THEN the System SHALL return a 400 error with validation message
6. WHEN moving a card THEN the System SHALL use select_for_update to prevent concurrent reordering conflicts

### Requirement 6

**User Story:** As an admin user, I want to reorder cards within a column, so that I can prioritize tasks.

#### Acceptance Criteria

1. WHEN an admin user changes a card's position within its column THEN the System SHALL update the card's order value
2. WHEN reordering a card THEN the System SHALL adjust order values of other cards in the same column
3. WHEN the new position is out of bounds THEN the System SHALL place the card at the nearest valid position

### Requirement 7

**User Story:** As a public user, I want to vote on Kanban cards, so that I can indicate which tasks interest me.

#### Acceptance Criteria

1. WHEN a user votes on a card with voting enabled THEN the System SHALL increment the card's vote count by 1
2. WHEN a user votes on a card they have already voted on THEN the System SHALL return a 409 error indicating duplicate vote
3. WHEN a user votes on a card with voting disabled THEN the System SHALL return a 403 error
4. WHEN voting on a card THEN the System SHALL use atomic database operations to prevent race conditions
5. WHEN a card ID does not exist THEN the System SHALL return a 404 error
6. WHEN a user votes THEN the System SHALL record the vote with IP address hash and timestamp for duplicate prevention

### Requirement 8

**User Story:** As an admin user, I want to enable or disable voting on individual cards, so that I can control which tasks accept votes.

#### Acceptance Criteria

1. WHEN an admin user sets allow_voting to false THEN the System SHALL prevent further votes on that card
2. WHEN an admin user sets allow_voting to true THEN the System SHALL allow votes on that card
3. WHEN voting is disabled THEN the System SHALL preserve the existing vote count

### Requirement 18

**User Story:** As a public user, I want to remove my vote from a card, so that I can change my mind about task priority.

#### Acceptance Criteria

1. WHEN a user removes their vote from a card THEN the System SHALL decrement the card's vote count by 1
2. WHEN a user attempts to remove a vote they did not cast THEN the System SHALL return a 404 error
3. WHEN removing a vote THEN the System SHALL delete the vote record from the database
4. WHEN a card has voting disabled THEN the System SHALL prevent vote removal and return a 403 error

### Requirement 19

**User Story:** As a system administrator, I want vote spam prevention, so that the voting system cannot be abused.

#### Acceptance Criteria

1. WHEN a user attempts to vote more than 10 times per minute THEN the System SHALL return a 429 error with rate limit message
2. WHEN a user attempts to vote on the same card twice THEN the System SHALL return a 409 error
3. WHEN tracking votes THEN the System SHALL store IP address hash (not raw IP) for privacy
4. WHEN a vote record is older than 90 days THEN the System SHALL allow the same IP to vote again on the same card

### Requirement 9

**User Story:** As a public user, I want to view a project's Kanban board, so that I can see task progress.

#### Acceptance Criteria

1. WHEN a user requests a project's Kanban board THEN the System SHALL return cards grouped by status
2. WHEN returning TODO and DOING cards THEN the System SHALL return all cards in those columns
3. WHEN returning DONE cards THEN the System SHALL return only the 50 most recently completed cards by default
4. WHEN returning cards THEN the System SHALL order them by the order field within each status
5. WHEN a project has no cards THEN the System SHALL return empty arrays for each status
6. WHEN returning cards THEN the System SHALL include id, title, status, votes, allow_voting, order, and user_has_voted for each card

### Requirement 20

**User Story:** As a public user, I want to load more completed tasks, so that I can view the full project history.

#### Acceptance Criteria

1. WHEN a user requests archived DONE cards THEN the System SHALL return cards beyond the initial 50 limit
2. WHEN requesting archived cards THEN the System SHALL support pagination with offset and limit parameters
3. WHEN no more archived cards exist THEN the System SHALL return an empty array
4. WHEN returning archived cards THEN the System SHALL maintain ordering by completion date descending

### Requirement 10

**User Story:** As a developer, I want card data validated before storage, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN card data is submitted THEN the System SHALL validate that title is not empty and does not exceed 200 characters
2. WHEN card data is submitted THEN the System SHALL validate that status is one of TODO, DOING, or DONE
3. WHEN card data is submitted THEN the System SHALL validate that votes is a non-negative integer
4. WHEN card data is submitted THEN the System SHALL validate that order is a non-negative integer
5. WHEN card data is submitted THEN the System SHALL validate that allow_voting is a boolean value

### Requirement 11

**User Story:** As a frontend developer, I want to implement drag-and-drop with @dnd-kit, so that users can move cards intuitively.

#### Acceptance Criteria

1. WHEN a user drags a card THEN the System SHALL display a visual overlay with neon purple glow
2. WHEN a user drops a card in a new position THEN the System SHALL send the new status and position to the API
3. WHEN the API confirms the move THEN the System SHALL update the UI to reflect the new state
4. WHEN the API rejects the move THEN the System SHALL revert the card to its original position
5. WHILE dragging a card THEN the System SHALL show drop zones in valid columns
6. WHEN using a touch device THEN the System SHALL require press-and-hold before drag initiation to prevent scroll conflicts

### Requirement 12

**User Story:** As a public user, I want voting to feel responsive, so that the interface doesn't lag when I vote.

#### Acceptance Criteria

1. WHEN a user clicks the vote button THEN the System SHALL immediately increment the displayed vote count
2. WHEN the vote API call completes successfully THEN the System SHALL maintain the updated count
3. WHEN the vote API call fails THEN the System SHALL revert the vote count and display an error message
4. WHEN a card has voting disabled THEN the System SHALL display the vote button in a disabled state

### Requirement 13

**User Story:** As a developer, I want API endpoints to follow RESTful conventions, so that the API is predictable.

#### Acceptance Criteria

1. THE System SHALL expose a GET endpoint at /api/v1/projects/{slug}/kanban returning the board with cards (50 DONE limit)
2. THE System SHALL expose a GET endpoint at /api/v1/projects/{slug}/kanban/archived for loading more DONE cards
3. THE System SHALL expose a POST endpoint at /api/v1/kanban/cards for creating cards (admin only)
4. THE System SHALL expose a PATCH endpoint at /api/v1/kanban/cards/{id} for updating cards (admin only)
5. THE System SHALL expose a DELETE endpoint at /api/v1/kanban/cards/{id} for deleting cards (admin only)
6. THE System SHALL expose a PATCH endpoint at /api/v1/kanban/cards/{id}/move for moving/reordering cards (admin only)
7. THE System SHALL expose a POST endpoint at /api/v1/kanban/cards/{id}/vote for voting (public, rate limited)
8. THE System SHALL expose a DELETE endpoint at /api/v1/kanban/cards/{id}/vote for removing votes (public)

### Requirement 14

**User Story:** As a developer, I want proper error handling in API responses, so that clients can handle failures gracefully.

#### Acceptance Criteria

1. WHEN validation fails THEN the System SHALL return a 400 error with detailed validation messages
2. WHEN a resource is not found THEN the System SHALL return a 404 error with a descriptive message
3. WHEN an unauthenticated user attempts admin operations THEN the System SHALL return a 401 error
4. WHEN a non-admin user attempts admin operations THEN the System SHALL return a 403 error
5. WHEN voting on a card with voting disabled THEN the System SHALL return a 403 error with a descriptive message
6. WHEN a user exceeds the vote rate limit THEN the System SHALL return a 429 error with retry-after header
7. WHEN a user attempts to vote twice on the same card THEN the System SHALL return a 409 error

### Requirement 15

**User Story:** As a frontend developer, I want the Kanban board displayed as a tab on the project detail page, so that users can access it easily.

#### Acceptance Criteria

1. WHEN a user views a project detail page THEN the System SHALL display tabs for Overview, Devlogs, and Kanban
2. WHEN a user clicks the Kanban tab THEN the System SHALL fetch and display the project's Kanban board
3. WHEN the Kanban board loads THEN the System SHALL display three columns: TODO, DOING, DONE
4. WHEN cards are loading THEN the System SHALL display skeleton loaders in each column
5. WHEN the board has no cards THEN the System SHALL display an empty state message in each column
6. WHEN the DONE column has more than 50 cards THEN the System SHALL display a "Load More" button

### Requirement 21

**User Story:** As a user viewing a Kanban board, I want to see updates from other users, so that I have current information.

#### Acceptance Criteria

1. WHEN viewing a Kanban board THEN the System SHALL automatically refetch board data every 15 seconds
2. WHEN another user moves a card THEN the System SHALL update the display within 15 seconds
3. WHEN the user is actively dragging a card THEN the System SHALL pause automatic refetching to prevent conflicts
4. WHEN automatic refetch completes THEN the System SHALL preserve the user's scroll position

### Requirement 16

**User Story:** As a designer, I want the Kanban board styled with the cyberpunk theme, so that it matches the site aesthetic.

#### Acceptance Criteria

1. WHEN displaying the Kanban board THEN the System SHALL use the surface color (#1e293b) for column backgrounds
2. WHEN displaying cards THEN the System SHALL use the primary color (#a855f7) for card borders and accents
3. WHEN a card is being dragged THEN the System SHALL apply a neon purple glow effect
4. WHEN displaying vote counts THEN the System SHALL use the success color (#22c55e) for the vote icon
5. WHEN a card has voting disabled THEN the System SHALL display the vote button with reduced opacity

### Requirement 17

**User Story:** As a developer, I want TypeScript types generated from the API schema, so that frontend code has type safety.

#### Acceptance Criteria

1. WHEN the OpenAPI schema is generated THEN the System SHALL include KanbanCard and KanbanBoard schemas
2. WHEN TypeScript types are generated THEN the System SHALL create interfaces for KanbanCardSchema and KanbanBoardSchema
3. WHEN TypeScript types are generated THEN the System SHALL create interfaces for card move and vote requests
4. THE System SHALL include the Kanban models in the OpenAPI schema at /api/v1/openapi.json
