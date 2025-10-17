# BYU 590R Monorepo

A clean slate monorepo project with Laravel backend, Angular frontend, and MySQL database.

## Features

- **Laravel Backend**: RESTful API with MySQL database
- **Angular Frontend**: Modern web application with TypeScript
- **MySQL Database**: Relational database for data persistence
- **Docker Infrastructure**: Easy development and deployment

## Quick Start

1. **Start all services**:

   ```bash
   make start
   ```

2. **Access the application**:
   - Frontend: http://localhost:4200 (development) or http://localhost:3000 (production)
   - Backend API: http://localhost:8000
   - Database: localhost:3306

## Available Commands

- `make start` - Start all services (auto-detects environment)
- `make start-dev` - Start with hot reloading (development mode)
- `make start-prod` - Start with static build (production mode)
- `make stop` - Stop all services
- `make clean` - Stop and clean up everything
- `make help` - Show all available commands

## Project Structure

```
├── backend/          # Laravel API
├── web-app/          # Angular frontend
├── Makefile         # Development commands
└── README.md        # This file
```

## API Endpoints

- `GET /api/hello` - Hello World endpoint
- `GET /api/health` - Health check endpoint

## Development

The project uses Docker for containerized development. The Makefile provides convenient commands for common development tasks.

For more detailed information, run `make help` to see all available commands.
