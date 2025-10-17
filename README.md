# BYU 590R Monorepo

A student-friendly monorepo project with Laravel backend, Angular frontend, and AWS deployment.

## Features

- **Laravel Backend**: RESTful API with local MySQL
- **Angular Frontend**: Modern web application with TypeScript
- **AWS Infrastructure**: K3s on EC2, local MySQL
- **Static IP Access**: Elastic IP for consistent access
- **Cost Optimized**: ~$0-2/month with free tier usage

## Quick Start

### Local Development

1. **Start all services**:

   ```bash
   make start
   ```

2. **Access the application**:
   - Frontend: http://localhost:4200 (development)
   - Backend API: http://localhost:8000
   - Database: localhost:3306

### AWS Deployment

1. **Quick setup with automated script**:

   ```bash
   make aws-setup
   ```

   This script will:

   - Ask for your AWS credentials and configuration
   - Create EC2 instance with MySQL and K3s
   - Build and deploy your application
   - Provide you with access URLs

2. **Manual setup** (if you prefer step-by-step):

   ```bash
   # See ULTRA_CHEAP_SETUP.md for detailed instructions
   ```

3. **Access your application**:

   - Frontend: `http://YOUR_ELASTIC_IP:30080`
   - Backend API: `http://YOUR_ELASTIC_IP:30081/api`

4. **Clean up when done**:
   ```bash
   make aws-teardown
   ```

## Available Commands

### Local Development

- `make start` - Start local development environment
- `make build-images` - Build Docker images for deployment
- `make help` - Show all available commands

### AWS Deployment

- `make aws-setup` - Automated AWS setup (EC2 + K3s + MySQL)
- `make aws-teardown` - Clean up all AWS resources

## Project Structure

```
├── backend/          # Laravel API
├── web-app/          # Angular frontend
├── devops/           # AWS deployment configurations
│   ├── jsonnet/      # Kubernetes manifests
│   ├── setup.sh      # Automated AWS setup script
│   └── teardown.sh   # AWS cleanup script
├── ULTRA_CHEAP_SETUP.md # Manual setup guide
└── Makefile         # Development commands
```

## API Endpoints

- `GET /api/hello` - Hello World endpoint
- `GET /api/health` - Health check endpoint

## Documentation

- **[ULTRA_CHEAP_SETUP.md](ULTRA_CHEAP_SETUP.md)** - Complete ultra-cheap setup guide (~$0-2/month)
- **[COST_OPTIONS.md](COST_OPTIONS.md)** - Compare different Kubernetes deployment options

## Learning Objectives

This project teaches:

- Kubernetes deployments (K3s on EC2)
- Database management (MySQL installation and configuration)
- AWS managed services (EC2, ECR)
- Infrastructure as Code with Jsonnet
- CI/CD with GitHub Actions
- Container orchestration and scaling

Perfect for learning modern DevOps practices at minimal cost!
