![License](https://img.shields.io/badge/license-MIT-blue.svg)

**exquisite.monster** is a digital adaptation of the popular party game "Eat Poop You Cat" (also known as Telephone Pictionary). It is a multiplayer game where a concept mutates as turns alternate between the drawing of a caption and the captioning of a drawing.

[Play here!](https://exquisite.monster/)

## Features

- **Multiplayer Gameplay**: Play with strangers in a turn-based format.
- **Party Mode (Beta)**: Organize private games with friends.
- **Flexible Configuration**: Customize turn limits, timeouts, and content settings (e.g., "lewd" mode).
- **Rich Interaction**: Upload drawings from photos or apps, or (if you must) draw using a built-in canvas.
- **Moderation**: Community flagging system to keep the environment safe.
- **Social**: Follow players, mark favorite games, and leave comments.
- **Notifications**: Real-time alerts via server-sent events for turn updates and game completions.
- **Responsive Design**: Mobile friendly, of course!

![exquisite.monster gallery screenshot](/static/img/exmo-gallery.png)

## Tech Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/)
- **Language**: TypeScript
- **Database**: PostgreSQL (via [Supabase](https://supabase.com/))
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Background Jobs**: BullMQ & Redis
- **Styling**: Tailwind CSS & Flowbite
- **Testing**: Vitest (Unit & Integration) & Playwright (E2E)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (or npm)
- [Docker](https://www.docker.com/) (required for local Supabase and Redis)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A [Clerk](https://clerk.com/) account for authentication

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JonathanHarford/exquisite.monster.git
    cd exquisite.monster
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
    You will need to fill in the required environment variables in `.env`, specifically for Clerk (`PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and your database and redis connection strings.

4.  **Initialize Database:**
    Apply migrations and seed initial data:
    ```bash
    npx prisma migrate dev
    npx prisma db seed
    ```

5.  **Run the Application:**
    Start the development server:
    ```bash
    npm run dev
    ```

    The application should now be running at `http://localhost:5173`.

## Testing

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Architecture

This project follows a Clean Architecture pattern:
- **Routes** (`src/routes/`): SvelteKit pages and endpoints.
- **Use Cases** (`src/lib/server/usecases/`): Business logic orchestration.
- **Services** (`src/lib/server/services/`): Domain-specific operations.
- **Database** (`src/lib/server/database/`): Data access abstraction.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

![exquisite.monster sketch screenshot](/static/img/exmo-skvetchy.png)
![exquisite.monster upload screenshot](/static/img/exmo-upload.png)
