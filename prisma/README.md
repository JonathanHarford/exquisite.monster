# Prisma Seed Structure

This directory contains the modular database seeding system for the EPYC project.

## Files

### Main Seed File

- **`seed.ts`** - Main entry point that orchestrates all seeding operations

### Modular Seed Files

- **`seedPlayers.ts`** - Handles player creation including test players and admin setup
- **`seedCopyText.ts`** - Manages copy text/content seeding
- **`seedGames.ts`** - Creates example games with their turns

### Data Files (YAML)

- **`data/players.yaml`** - Test player data
- **`data/copytext.yaml`** - Copy text content
- **`data/games.yaml`** - Game configuration data with embedded turns
- **`data/defaultConfig.yaml`** - Default game configuration values

### Other Files

- **`clear-games.ts`** - Utility to clear all games while preserving default config

## Usage

### Running the Full Seed

```bash
npm run db:seed
```

### YAML Data Format

#### players.yaml

```yaml
players:
  - id: rashid
    username: Rashid
    imageUrl: /img/x/rashid.png
    isAdmin: false
```

#### copytext.yaml

```yaml
copytext:
  - key: home.whatis
    lang: en
    value: |
      What is ${process.env.PUBLIC_SITE_TITLE}?

      ${process.env.PUBLIC_SITE_TITLE} is an online adaptation...
```

#### games.yaml

```yaml
games:
  - gameId: 28F
    minTurns: 2
    maxTurns: 12
    writingTimeout: 120000
    drawingTimeout: 300000
    gameTimeout: 86400000
    turns:
      - orderIndex: 0
        player: Rashid
        content: 'The micro-surgeons found the troublesome thought...'
        isDrawing: false
      - orderIndex: 1
        player: jonathan
        content: 28F-02.jpg
        isDrawing: true
```

#### defaultConfig.yaml

```yaml
defaultConfig:
  minTurns: 8
  maxTurns: null
  writingTimeout: 600000 # 10 minutes
  drawingTimeout: 86400000 # 24 hours
  gameTimeout: 604800000 # 7 days
```

## Architecture

The seed system is designed to be:

1. **Modular** - Each data type has its own seeder
2. **Data-driven** - Uses YAML files for easy editing and structure
3. **Idempotent** - Can be run multiple times safely
4. **Environment-aware** - Handles environment variables in content

## Adding New Data

### To add new players:

1. Add entries to `data/players.yaml` under the `players` array
2. The seeder will automatically create them

### To add new copy text:

1. Add entries to `data/copytext.yaml` under the `copytext` array
2. Use `${process.env.VARIABLE_NAME}` for environment variable substitution
3. Use `|` for multiline content that preserves line breaks

### To add new games:

1. Add game config to `data/games.yaml` under the `games` array
2. Include the `turns` array within each game object
3. Ensure turn orderIndex values are sequential starting from 0
4. Use comments to organize games for readability

## Dependencies

The seed system requires:

- `js-yaml` - Professional YAML parsing library
- Clerk API access for admin user creation
- Environment variables: `CLERK_SECRET_KEY`, `ADMIN_EMAIL`, `PUBLIC_SITE_TITLE`
- Prisma client and database connection

## Technical Details

### YAML Parsing

Uses the `js-yaml` library for parsing structured data files. YAML provides several advantages over CSV:

- **Human-readable** - Easy to read and edit
- **Hierarchical structure** - Natural nesting and organization
- **Multiline support** - Native support for multiline strings using `|` and `>`
- **Type safety** - Automatic type inference (strings, numbers, booleans)
- **Comments** - Supports inline comments for documentation

### YAML Features Used:

- **Literal blocks** (`|`) - Preserves line breaks for multiline content
- **Folded blocks** (`>`) - Converts line breaks to spaces
- **Arrays** - Clean list syntax with `-` prefix
- **Objects** - Key-value pairs with proper indentation
- **Environment variable substitution** - In copy text values
