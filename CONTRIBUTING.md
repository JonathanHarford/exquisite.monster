# Contributing to exquisite.monster

Thank you for your interest in contributing to exquisite.monster! We welcome contributions from everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please create a GitHub Issue with the following information:
- A clear descriptive title.
- Steps to reproduce the bug.
- Expected behavior.
- Actual behavior.
- Screenshots (if applicable).

### Suggesting Enhancements

If you have an idea for a new feature or improvement, please create a GitHub Issue to discuss it before starting work.

### Pull Requests

1.  **Fork the repository** to your own GitHub account.
2.  **Clone the project** to your local machine.
3.  **Create a new branch** for your feature or bug fix:
    ```bash
    git checkout -b feature/amazing-feature
    ```
4.  **Make your changes**. Ensure you follow the coding style and conventions.
5.  **Run tests** to ensure your changes don't break anything:
    ```bash
    npm run test:unit
    npm run test:e2e
    ```
6.  **Commit your changes** with descriptive commit messages.
7.  **Push your branch** to your fork:
    ```bash
    git push origin feature/amazing-feature
    ```
8.  **Open a Pull Request** against the `main` branch of the original repository.

## Development Setup

Please refer to the [README.md](../README.md) for detailed instructions on setting up the development environment.

## Coding Standards

- We use **TypeScript** for type safety.
- We use **Prettier** for code formatting. Run `npm run format` before committing.
- We use **ESLint** for linting. Run `npm run lint` to check for issues.
- We follow a **Clean Architecture** pattern (Use Cases, Services, Repositories). See `AGENT.md` for architectural details.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
