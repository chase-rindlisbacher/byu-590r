.PHONY: start start-dev start-prod stop clean build-frontend build-backend setup-backend migrate

# Start all services
start:
	@echo "Starting BYU 590R Monorepo..."
	@echo "Cleaning up any existing containers..."
	@$(MAKE) stop
	@echo "Checking Laravel backend configuration..."
	@$(MAKE) setup-backend
	@echo "Installing Laravel backend dependencies..."
	cd backend && composer install
	@echo "Starting Laravel backend with MySQL..."
	cd backend && docker compose up -d
	@echo "Waiting for database to be ready..."
	@sleep 15
	@echo "Running database migrations and seeding..."
	@$(MAKE) migrate
	@echo "Detecting environment..."
	@if [ -n "$$DEVELOPMENT_MODE" ] && [ "$$DEVELOPMENT_MODE" = "true" ]; then \
		echo "Development mode explicitly enabled - starting with hot reloading..."; \
		$(MAKE) start-dev; \
	elif [ -n "$$PRODUCTION_MODE" ] && [ "$$PRODUCTION_MODE" = "true" ]; then \
		echo "Production mode explicitly enabled - building static frontend..."; \
		$(MAKE) start-prod; \
	elif [ "$$(hostname)" = "localhost" ] || [ "$$(hostname)" = "$$(hostname -s)" ] || [ -z "$$HOSTNAME" ] || [ "$$HOSTNAME" = "localhost" ] || [ "$$(uname -s)" = "Darwin" ] || [ "$$(uname -s)" = "Linux" ]; then \
		echo "Localhost/development environment detected - starting with hot reloading..."; \
		$(MAKE) start-dev; \
	else \
		echo "Production environment detected - building static frontend..."; \
		$(MAKE) start-prod; \
	fi
	@echo "Finalizing Laravel setup..."
	@echo "Generating application key to ensure encryption is properly configured..."
	cd backend && docker compose exec -T app php artisan key:generate
	@echo "All processes completed successfully!"

# Start with hot reloading (development mode)
start-dev:
	@echo "Starting Angular development server with hot reloading..."
	@echo "Installing Angular dependencies..."
	cd web-app && npm install
	@echo "Frontend will be available at: http://localhost:4200"
	@echo "Backend API: http://localhost:8000"
	@echo "Database: localhost:3306"
	@echo ""
	@echo "Starting Angular dev server in background..."
	cd web-app && npm start &
	@echo "Development environment started with hot reloading!"
	@echo "Press Ctrl+C to stop all services"

# Start with static build (production mode)
start-prod:
	@echo "Building and starting Angular frontend..."
	@echo "Removing any existing frontend image to ensure fresh build..."
		docker rmi byu-590r-frontend || true
	cd web-app && docker build -t byu-590r-frontend . && docker run -d -p 3000:80 --name byu-590r-frontend byu-590r-frontend
	@echo "All services started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8000"
	@echo "Database: localhost:3306"

# Stop all services
stop:
	@echo "Stopping all services..."
	cd backend && docker compose down
	docker stop byu-590r-frontend || true
	docker rm byu-590r-frontend || true
	@echo "Stopping Angular dev server..."
	pkill -f "ng serve" || true
	pkill -f "npm start" || true
	@echo "All services stopped!"

# Clean up everything
clean: stop
	@echo "Cleaning up..."
	cd backend && docker compose down -v
	docker rmi byu-590r-frontend || true
	docker system prune -f
	@echo "Cleanup complete!"

# Build frontend only
build-frontend:
	@echo "Building Angular frontend..."
	cd web-app && npm run build

# Build backend only
build-backend:
	@echo "Building Laravel backend..."
	cd backend && docker compose build

# Setup Laravel backend
setup-backend:
	@if [ ! -f backend/.env ]; then \
		echo "No .env file found in backend directory."; \
		echo "Do you wish to create one? (y/n)"; \
		read -r response; \
		if [ "$$response" = "y" ] || [ "$$response" = "Y" ]; then \
			echo "Creating .env file from .env.example..."; \
			cp backend/.env.example backend/.env; \
			echo "Updating database configuration for Docker..."; \
			sed -i '' 's/DB_CONNECTION=sqlite/DB_CONNECTION=mysql/' backend/.env; \
			sed -i '' 's/# DB_HOST=127.0.0.1/DB_HOST=mysql/' backend/.env; \
			sed -i '' 's/# DB_PORT=3306/DB_PORT=3306/' backend/.env; \
			sed -i '' 's/# DB_DATABASE=laravel/DB_DATABASE=byu_590r_app/' backend/.env; \
			sed -i '' 's/# DB_USERNAME=root/DB_USERNAME=byu_user/' backend/.env; \
			sed -i '' 's/# DB_PASSWORD=/DB_PASSWORD=byu_password/' backend/.env; \
			echo ""; \
			echo "==============================================="; \
			echo "OpenAI API Key is OPTIONAL for this project"; \
			echo "==============================================="; \
			echo "Please enter your OpenAI API key (or press Enter to skip):"; \
			read -r openai_key; \
			if [ -n "$$openai_key" ]; then \
				echo "Adding OpenAI API key to .env file..."; \
				sed -i '' '/OPENAI_API_KEY=/d' backend/.env; \
				echo "OPENAI_API_KEY=$$openai_key" >> backend/.env; \
			else \
				echo "No OpenAI API key provided. You can add it later to backend/.env file:"; \
				echo "OPENAI_API_KEY=your_openai_api_key_here"; \
			fi; \
			echo ""; \
			echo "Generating Laravel application key..."; \
			cd backend && php artisan key:generate; \
			echo ".env file created successfully!"; \
		else \
			echo "Error: .env file is required. Please copy .env.example to .env and configure it."; \
			exit 1; \
		fi; \
	else \
		echo ".env file found. Checking if APP_KEY is set..."; \
		if ! grep -q "APP_KEY=base64:" backend/.env; then \
			echo "Generating application key..."; \
			cd backend && php artisan key:generate; \
		fi; \
	fi

# Run database migrations
migrate:
	@echo "Running database migrations..."
	@echo "Waiting for database connection..."
	@for i in $$(seq 1 30); do \
		if docker compose -f backend/docker-compose.yml exec -T app php artisan migrate:status >/dev/null 2>&1; then \
			echo "Database connection established!"; \
			break; \
		fi; \
		echo "Waiting for database... ($$i/30)"; \
		sleep 2; \
	done
	@echo "Running migrations and seeding..."
	cd backend && docker compose exec -T app php artisan migrate:fresh --seed

# Development mode (with live reload)
dev:
	@echo "Starting development environment..."
	cd backend && docker compose up -d
	@sleep 15
	@echo "Starting Angular dev server..."
	cd web-app && npm start

# Show logs
logs:
	docker compose -f backend/docker-compose.yml logs -f
	docker logs -f byu-590r-frontend

# Help
help:
	@echo "Available commands:"
	@echo "  start        - Start all services (auto-detects environment)"
	@echo "  start-dev    - Start with hot reloading (development mode)"
	@echo "  start-prod   - Start with static build (production mode)"
	@echo "  stop         - Stop all services"
	@echo "  clean        - Stop and clean up everything"
	@echo "  build-frontend - Build Angular frontend only"
	@echo "  build-backend  - Build Laravel backend only"
	@echo "  setup-backend - Setup Laravel backend (.env, key generation)"
	@echo "  migrate      - Run database migrations"
	@echo "  dev          - Start development environment (legacy)"
	@echo "  logs         - Show all service logs"
	@echo "  help         - Show this help message"
	@echo ""
	@echo "Environment Detection:"
	@echo "  - localhost: Uses hot reloading (port 4200)"
	@echo "  - production: Uses static build (port 3000)"
