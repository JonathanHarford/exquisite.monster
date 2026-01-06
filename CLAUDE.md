## Development Commands

### Core Development

- `npm run dev` - Start development server with host binding
- `npm run build` - Build for production (uses max memory allocation)
- `npm run preview` - Preview production build

### Code Quality

- `npm run lint` - Run prettier and eslint checks
- `npm run format` - Format code with prettier NEVER RUN THIS EXCEPT AS ITS OWN COMMIT
- `npm run check` - Type check with svelte-check
- `npm run check:watch` - Type check in watch mode

### Testing

- `npm test` - Run all tests (unit + integration + e2e)
- `npm run test:unit` - Run true unit tests (no database required)
- `npm run test:unit:watch` - Run unit tests in watch mode
- `npm run test:integration` - Run integration tests (requires test database)
- `npm run test:integration:watch` - Run integration tests in watch mode
- `npm run test:e2e` - Run e2e tests with Playwright
- `npm run coverage` - Generate test coverage report

### Database Operations

- `npm run db:seed` - Seed database with initial data (creates admin user and game config)
- `npm run db:clear-games` - Clear all games from database
- `npm run db:migrate` - Apply database migrations
- `npx prisma db push` - Push schema changes without creating migration file
- `npx prisma migrate reset` - Reset database to latest migration

### Redis Queue Management

- `npm run redis:up` - Start Redis with docker-compose
- `npm run redis:down` - Stop Redis containers
- `npm run redis:logs` - View Redis logs

## Architecture Overview

This is a **turn-based drawing/writing game application** built with SvelteKit that follows clean architecture principles:

### Layered Architecture

- **Routes** (`src/routes/`) - SvelteKit pages and API endpoints
- **Use Cases** (`src/lib/server/usecases/`) - Business logic orchestration
- **Services** (`src/lib/server/services/`) - Domain-specific operations
- **Database Layer** (`src/lib/server/database/`) - Data access abstraction

### Key Architectural Patterns

#### Use Case Pattern

- `GameUseCases.ts` - Core game logic, turn management, expiration handling
- `FlagUseCases.ts` - Content moderation workflows
- `AdminUseCases.ts` - Administrative operations
- `PartyUseCases.ts` - Tournament/season management (formerly SeasonUseCases)

#### Service Layer

- `gameService.ts` - Game queries and operations
- `playerService.ts` - Player management and authentication
- `emailService.ts` - Multi-provider email (Brevo/Inbucket)
- `notificationService.ts` - In-app notifications
- `flagService.ts` - Content moderation

#### Queue-Based Background Processing

- **Location**: `src/lib/server/queues/`
- **Technology**: BullMQ with Redis
- `emailQueue.ts` - Asynchronous email delivery
- `expirationQueue.ts` - Game/turn timeout management

### Data Flow

```
Route → Use Case → Service → Database Adapter → Prisma → Supabase
```

### External Integrations

- **Clerk.js** - Authentication and user management
- **Supabase** - PostgreSQL database and storage
- **Redis** - Queue management and caching
- **Brevo** - Production email delivery
- **Sentry** - Error monitoring
- **Sharp** - Image processing
- **Skvetchy** - Drawing/SVG manipulation

### Domain Model

Core entities defined in `src/lib/types/domain.ts`:

- **Game** - Container for turns with expiration and completion tracking
- **Turn** - Individual drawing/writing submission with status management
- **Player** - User profiles with admin capabilities and moderation
- **Season** - Tournament-style game groupings
- **TurnFlag** - Content moderation system

## Development Guidelines

### Working with Data

1. **Always use Use Cases** for complex business logic involving multiple services
2. **Use Services directly** for simple CRUD operations from routes
3. **Domain types** for all data transfer between layers (never expose Prisma types to frontend)
4. **Transform Prisma to domain types** using helper functions in `domain.ts`
5. **Avoid `any` like the plague** - use proper types or `unknown` for truly dynamic values

### Adding New Features

1. Define domain types in `src/lib/types/domain.ts`
2. Create/update services for data operations
3. Add use cases for complex business logic
4. Create route handlers with proper error handling
5. Add tests in appropriate directories:
   - `tests/unit/` for isolated unit tests
   - `tests/integration/` for database-driven tests
   - `tests/e2e/` for full browser tests

### Error Handling

- Use try/catch blocks in all async operations
- Log errors with Winston logger
- Never expose internal errors to frontend
- Services should gracefully degrade when external dependencies fail

### Database Schema Changes

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --create-only` to generate migration
3. Edit migration SQL if needed
4. Run `npx prisma migrate dev` to apply
5. Update domain types and transformation functions
6. Update seed data if necessary

### Queue Operations

- Use `expirationQueue` for time-based game logic
- Use `emailQueue` for all email sending to prevent blocking
- Monitor queue health via `/api/health/queues` endpoint
- Queues gracefully handle Redis connection failures

### Testing Strategy

- **Unit tests** (`tests/unit/`): Fast, isolated testing with no database dependencies
  - Test pure functions, utilities, schemas, and component logic
  - No database connection required
  - Mock all external dependencies (Redis, queues, database)
  - Run in parallel for fast feedback
- **Integration tests** (`tests/integration/`): Database-driven testing of business logic
  - Test use cases, services, and database operations
  - Require test database (DATABASE_URL_TEST)
  - Run sequentially to avoid database conflicts
  - Mock external services (Redis, queues, email) but use real database
- **E2E tests** (`tests/e2e/`): Full browser testing using Playwright
  - Test complete user workflows
  - Use development/test database
- Always test happy path and error conditions
- Integration tests are the old "unit" tests that required a database

### Security Considerations

- All routes protected by Clerk authentication middleware
- Admin-only routes check `player.isAdmin` flag
- Content moderation system for user-generated content
- Rate limiting and input validation on all endpoints

## Common Development Tasks

### Setting Up New Environment

1. `cp .env.example .env` and configure values
2. `supabase start` (requires Supabase CLI)
3. `npm install`
4. `npx prisma migrate dev`
5. `npm run db:seed`
6. `npm run redis:up`

### Debugging Issues

- Check logs in `logs/application.log`
- Monitor queue status at `/api/health/queues`
- Use Sentry for production error tracking
- Database connection issues often resolved by restarting Supabase
- $derived() does not take a function, it takes a value

### Performance Optimization

- Heavy operations moved to background queues
- Use Prisma includes for efficient data fetching
- Image optimization handled by Sharp
- Conditional requests with proper cache headers

# Important Notes

- You can't do a redirect inside a try/catch block!
