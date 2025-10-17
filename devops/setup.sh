#!/bin/bash

# BYU 590R Monorepo - AWS Setup Script
# This script sets up the ultra-cheap AWS environment with EC2 + K3s + local MySQL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install AWS CLI first."
        echo "Install instructions: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl first."
        echo "Install instructions: https://kubernetes.io/docs/tasks/tools/install-kubectl/"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker first."
        echo "Install instructions: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get user inputs
get_user_inputs() {
    log_info "Getting configuration inputs..."
    
    # AWS Region
    read -p "Enter AWS region (default: us-east-1): " AWS_REGION
    AWS_REGION=${AWS_REGION:-us-east-1}
    
    # Key pair name
    read -p "Enter your EC2 key pair name: " KEY_NAME
    if [ -z "$KEY_NAME" ]; then
        log_error "Key pair name is required"
        exit 1
    fi
    
    # Security group
    read -p "Enter your security group ID (e.g., sg-12345678): " SECURITY_GROUP
    if [ -z "$SECURITY_GROUP" ]; then
        log_error "Security group ID is required"
        exit 1
    fi
    
    # Database password
    read -s -p "Enter MySQL password for 'byu_user': " DB_PASSWORD
    echo
    if [ -z "$DB_PASSWORD" ]; then
        log_error "Database password is required"
        exit 1
    fi
    
    # Project name
    read -p "Enter project name (default: byu-590r): " PROJECT_NAME
    PROJECT_NAME=${PROJECT_NAME:-byu-590r}
    
    log_success "Configuration inputs collected"
}

# Configure AWS credentials
configure_aws_credentials() {
    log_info "Configuring AWS credentials..."
    
    # Check if AWS is already configured
    if aws sts get-caller-identity &> /dev/null; then
        log_success "AWS credentials already configured"
        return
    fi
    
    log_warning "AWS credentials not configured. Please configure them now:"
    aws configure
    
    # Verify credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials configuration failed"
        exit 1
    fi
    
    log_success "AWS credentials configured successfully"
}

# Create EC2 instance
create_ec2_instance() {
    log_info "Creating EC2 instance..."
    
    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Create EC2 instance
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id ami-0c02fb55956c7d316 \
        --instance-type t2.micro \
        --key-name "$KEY_NAME" \
        --security-group-ids "$SECURITY_GROUP" \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$PROJECT_NAME-k8s}]" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    echo "INSTANCE_ID=$INSTANCE_ID" > .aws-config
    
    log_info "Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
    
    # Get instance IP
    INSTANCE_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    echo "INSTANCE_IP=$INSTANCE_IP" >> .aws-config
    
    log_success "EC2 instance created: $INSTANCE_ID ($INSTANCE_IP)"
}

# Allocate Elastic IP
allocate_elastic_ip() {
    log_info "Allocating Elastic IP..."
    
    # Allocate Elastic IP
    ALLOCATION_ID=$(aws ec2 allocate-address \
        --domain vpc \
        --region "$AWS_REGION" \
        --query 'AllocationId' \
        --output text)
    
    ELASTIC_IP=$(aws ec2 describe-addresses \
        --allocation-ids "$ALLOCATION_ID" \
        --query 'Addresses[0].PublicIp' \
        --output text)
    
    echo "ALLOCATION_ID=$ALLOCATION_ID" >> .aws-config
    echo "ELASTIC_IP=$ELASTIC_IP" >> .aws-config
    
    # Associate Elastic IP with instance
    aws ec2 associate-address \
        --instance-id "$INSTANCE_ID" \
        --allocation-id "$ALLOCATION_ID"
    
    log_success "Elastic IP allocated and associated: $ELASTIC_IP"
}

# Setup EC2 instance
setup_ec2_instance() {
    log_info "Setting up EC2 instance with MySQL and K3s..."
    
    # Create setup script
    cat > setup-instance.sh << 'EOF'
#!/bin/bash
set -e

# Update system
sudo apt update && sudo apt upgrade -y

# Install MySQL
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql

# Create database and user
sudo mysql -u root << 'MYSQL_EOF'
CREATE DATABASE byu_590r_app;
CREATE USER 'byu_user'@'localhost' IDENTIFIED BY 'DB_PASSWORD_PLACEHOLDER';
GRANT ALL PRIVILEGES ON byu_590r_app.* TO 'byu_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
MYSQL_EOF

# Install Docker
sudo apt install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# Install k3s
curl -sfL https://get.k3s.io | sh -

# Setup kubectl
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown ubuntu:ubuntu ~/.kube/config

echo "Setup complete!"
EOF
    
    # Replace password placeholder
    sed -i "s/DB_PASSWORD_PLACEHOLDER/$DB_PASSWORD/g" setup-instance.sh
    
    # Copy and run setup script
    scp -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no setup-instance.sh ubuntu@"$INSTANCE_IP":~/
    ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$INSTANCE_IP" "chmod +x setup-instance.sh && ./setup-instance.sh"
    
    # Clean up
    rm setup-instance.sh
    
    log_success "EC2 instance setup complete"
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Login to ECR
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID".dkr.ecr."$AWS_REGION".amazonaws.com
    
    # Create ECR repositories if they don't exist
    aws ecr create-repository --repository-name "$PROJECT_NAME"-backend --region "$AWS_REGION" 2>/dev/null || true
    aws ecr create-repository --repository-name "$PROJECT_NAME"-frontend --region "$AWS_REGION" 2>/dev/null || true
    
    # Build and push backend
    log_info "Building backend image..."
    cd backend
    docker build -t "$ACCOUNT_ID".dkr.ecr."$AWS_REGION".amazonaws.com/"$PROJECT_NAME"-backend:latest .
    docker push "$ACCOUNT_ID".dkr.ecr."$AWS_REGION".amazonaws.com/"$PROJECT_NAME"-backend:latest
    cd ..
    
    # Build and push frontend
    log_info "Building frontend image..."
    cd web-app
    docker build -t "$ACCOUNT_ID".dkr.ecr."$AWS_REGION".amazonaws.com/"$PROJECT_NAME"-frontend:latest .
    docker push "$ACCOUNT_ID".dkr.ecr."$AWS_REGION".amazonaws.com/"$PROJECT_NAME"-frontend:latest
    cd ..
    
    log_success "Docker images built and pushed"
}

# Deploy to K3s
deploy_to_k3s() {
    log_info "Deploying to K3s..."
    
    # Create deployment script
    cat > deploy-k3s.sh << EOF
#!/bin/bash
set -e

# Create namespace
kubectl create namespace $PROJECT_NAME || true

# Create secrets
kubectl create secret generic aws-secrets \\
  --from-literal=DB_HOST="localhost" \\
  --from-literal=DB_DATABASE="byu_590r_app" \\
  --from-literal=DB_USERNAME="byu_user" \\
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \\
  --from-literal=AWS_ACCESS_KEY_ID="$(aws configure get aws_access_key_id)" \\
  --from-literal=AWS_SECRET_ACCESS_KEY="$(aws configure get aws_secret_access_key)" \\
  --from-literal=APP_URL="http://$ELASTIC_IP:30080" \\
  --from-literal=API_URL="http://$ELASTIC_IP:30081/api" \\
  -n $PROJECT_NAME || true

# Deploy backend
kubectl apply -f - << 'BACKEND_EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: $PROJECT_NAME
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      hostNetwork: true
      containers:
      - name: backend
        image: $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: APP_ENV
          value: "production"
        - name: APP_DEBUG
          value: "false"
        - name: DB_CONNECTION
          value: "mysql"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: aws-secrets
              key: DB_HOST
        - name: DB_DATABASE
          valueFrom:
            secretKeyRef:
              name: aws-secrets
              key: DB_DATABASE
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: aws-secrets
              key: DB_USERNAME
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: aws-secrets
              key: DB_PASSWORD
        - name: CACHE_DRIVER
          value: "file"
        - name: SESSION_DRIVER
          value: "file"
        - name: QUEUE_CONNECTION
          value: "sync"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: backend-nodeport
  namespace: $PROJECT_NAME
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
    nodePort: 30081
  type: NodePort
BACKEND_EOF

# Deploy frontend
kubectl apply -f - << 'FRONTEND_EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: $PROJECT_NAME
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-frontend:latest
        ports:
        - containerPort: 80
        env:
        - name: API_URL
          valueFrom:
            secretKeyRef:
              name: aws-secrets
              key: API_URL
        - name: ENVIRONMENT
          value: "production"
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-nodeport
  namespace: $PROJECT_NAME
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080
  type: NodePort
FRONTEND_EOF

# Wait for deployments
kubectl wait --for=condition=available --timeout=300s deployment/backend -n $PROJECT_NAME
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n $PROJECT_NAME

# Run migrations
kubectl exec -it deployment/backend -n $PROJECT_NAME -- php artisan migrate:fresh --seed

echo "Deployment complete!"
EOF
    
    # Copy and run deployment script
    scp -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no deploy-k3s.sh ubuntu@"$INSTANCE_IP":~/
    ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$INSTANCE_IP" "chmod +x deploy-k3s.sh && ./deploy-k3s.sh"
    
    # Clean up
    rm deploy-k3s.sh
    
    log_success "Deployment to K3s complete"
}

# Main setup function
main() {
    log_info "Starting BYU 590R Monorepo AWS setup..."
    
    check_prerequisites
    get_user_inputs
    configure_aws_credentials
    create_ec2_instance
    allocate_elastic_ip
    setup_ec2_instance
    build_and_push_images
    deploy_to_k3s
    
    echo ""
    log_success "🎉 Setup complete!"
    echo ""
    log_info "Your application is now available at:"
    echo "  Frontend: http://$ELASTIC_IP:30080"
    echo "  Backend API: http://$ELASTIC_IP:30081/api"
    echo ""
    log_info "Test endpoints:"
    echo "  curl http://$ELASTIC_IP:30080"
    echo "  curl http://$ELASTIC_IP:30081/api/hello"
    echo "  curl http://$ELASTIC_IP:30081/api/health"
    echo ""
    log_info "Configuration saved to: .aws-config"
    log_info "To tear down: ./teardown.sh"
}

# Run main function
main "$@"
