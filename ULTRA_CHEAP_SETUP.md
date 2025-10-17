# Ultra-Cheap AWS Setup (Under $2/month)

This guide sets up a single-node Kubernetes cluster on AWS free tier EC2 with MySQL running locally on the same instance.

## 🎯 Architecture

- **Frontend**: Angular on K3s (1 replica)
- **Backend**: Laravel on K3s (1 replica)
- **Database**: MySQL running directly on EC2 instance
- **Cache**: File-based caching (no external cache needed)
- **Static IP**: Elastic IP for consistent access
- **Direct Access**: NodePort services

## 💰 Cost Breakdown (~$0-2/month)

- **EC2 t2.micro**: **$0/month** (free tier - 750 hours/month for 12 months)
- **Elastic IP**: $3.65/month (when not attached)
- **ECR**: $1/month (storage only)
- **Total**: **~$0-2/month** (mostly free for first year!)

## 🚀 Quick Setup (25 minutes)

### 1. Prerequisites

```bash
# Install required tools
brew install awscli kubectl  # macOS
# or
sudo apt install awscli kubectl  # Ubuntu

# Configure AWS CLI
aws configure
```

### 2. Create Free Tier EC2 Instance

```bash
# Set variables
export AWS_REGION="us-east-1"
export INSTANCE_TYPE="t2.micro"  # Free tier eligible
export KEY_NAME="your-key-pair"
export SECURITY_GROUP="your-security-group"

# Create EC2 instance (free tier)
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SECURITY_GROUP \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=byu-590r-k8s}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get instance IP
INSTANCE_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Instance IP: $INSTANCE_IP"
```

### 3. Install MySQL and Kubernetes on EC2

```bash
# SSH into the instance
ssh -i your-key.pem ubuntu@$INSTANCE_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Install MySQL
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql

# Secure MySQL installation
sudo mysql_secure_installation
# Set root password, remove anonymous users, etc.

# Create database and user
sudo mysql -u root -p << EOF
CREATE DATABASE byu_590r_app;
CREATE USER 'byu_user'@'localhost' IDENTIFIED BY 'YourPassword123!';
GRANT ALL PRIVILEGES ON byu_590r_app.* TO 'byu_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF

# Install Docker
sudo apt install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# Install k3s (lightweight Kubernetes)
curl -sfL https://get.k3s.io | sh -

# Setup kubectl
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown ubuntu:ubuntu ~/.kube/config

# Test cluster
kubectl get nodes

echo "MySQL and K3s cluster are ready!"
```

### 4. Allocate Elastic IP

```bash
# Allocate Elastic IP
ALLOCATION_ID=$(aws ec2 allocate-address \
  --domain vpc \
  --region $AWS_REGION \
  --query 'AllocationId' \
  --output text)

ELASTIC_IP=$(aws ec2 describe-addresses \
  --allocation-ids $ALLOCATION_ID \
  --query 'Addresses[0].PublicIp' \
  --output text)

echo "Elastic IP: $ELASTIC_IP"

# Associate Elastic IP with instance
aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id $ALLOCATION_ID

echo "Elastic IP associated with instance"
```

### 5. Build and Push Images

```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push backend
cd backend
docker build -t $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/byu-590r-backend:latest .
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/byu-590r-backend:latest

# Build and push frontend
cd ../web-app
docker build -t $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/byu-590r-frontend:latest .
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/byu-590r-frontend:latest
```

### 6. Deploy to K3s

```bash
# SSH back into the instance
ssh -i your-key.pem ubuntu@$INSTANCE_IP

# Create namespace
kubectl create namespace byu-590r

# Create secrets for local MySQL
kubectl create secret generic aws-secrets \
  --from-literal=DB_HOST="localhost" \
  --from-literal=DB_DATABASE="byu_590r_app" \
  --from-literal=DB_USERNAME="byu_user" \
  --from-literal=DB_PASSWORD="YourPassword123!" \
  --from-literal=AWS_ACCESS_KEY_ID="$(aws configure get aws_access_key_id)" \
  --from-literal=AWS_SECRET_ACCESS_KEY="$(aws configure get aws_secret_access_key)" \
  --from-literal=APP_URL="http://$ELASTIC_IP:30080" \
  --from-literal=API_URL="http://$ELASTIC_IP:30081/api" \
  -n byu-590r

# Deploy backend with host networking for MySQL access
kubectl apply -f - << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: byu-590r
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
      hostNetwork: true  # Allow access to localhost MySQL
      containers:
      - name: backend
        image: $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/byu-590r-backend:latest
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
  name: backend
  namespace: byu-590r
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: backend-nodeport
  namespace: byu-590r
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
    nodePort: 30081
  type: NodePort
EOF

# Deploy frontend
kubectl apply -f - << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: byu-590r
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
        image: $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/byu-590r-frontend:latest
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
  name: frontend
  namespace: byu-590r
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-nodeport
  namespace: byu-590r
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080
  type: NodePort
EOF

# Wait for deployments
kubectl wait --for=condition=available --timeout=300s deployment/backend -n byu-590r
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n byu-590r

echo "Deployment complete!"
```

### 7. Run Database Migrations

```bash
# Run Laravel migrations
kubectl exec -it deployment/backend -n byu-590r -- php artisan migrate:fresh --seed

echo "Database migrations completed!"
```

## 🔧 Access Your Application

Once deployed, your application will be available at:

- **Frontend**: `http://YOUR_ELASTIC_IP:30080`
- **Backend API**: `http://YOUR_ELASTIC_IP:30081/api`

### Test Endpoints

```bash
# Test frontend
curl http://YOUR_ELASTIC_IP:30080

# Test backend
curl http://YOUR_ELASTIC_IP:30081/api/hello
curl http://YOUR_ELASTIC_IP:30081/api/health
```

## 💡 Cost Optimization Tips

1. **Free Tier**: EC2 is free for 12 months
2. **No RDS**: MySQL runs locally, saving $15/month
3. **Stop When Not Used**:

   ```bash
   # Stop EC2 instance
   aws ec2 stop-instances --instance-ids $INSTANCE_ID

   # Start EC2 instance
   aws ec2 start-instances --instance-ids $INSTANCE_ID
   ```

## 🛠️ Common Commands

```bash
# Check deployment status
kubectl get all -n byu-590r

# View logs
kubectl logs -f deployment/backend -n byu-590r
kubectl logs -f deployment/frontend -n byu-590r

# Access MySQL directly
sudo mysql -u byu_user -p byu_590r_app

# Scale manually
kubectl scale deployment backend --replicas=2 -n byu-590r
```

## 🚨 Troubleshooting

### MySQL Connection Issues

```bash
# Check MySQL status
sudo systemctl status mysql

# Check MySQL logs
sudo tail -f /var/log/mysql/error.log

# Test MySQL connection
mysql -u byu_user -p -h localhost byu_590r_app
```

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n byu-590r

# Check pod logs
kubectl describe pod <pod-name> -n byu-590r
kubectl logs <pod-name> -n byu-590r
```

## 📚 Learning Objectives

After completing this setup, students will understand:

1. **K3s**: Lightweight Kubernetes distribution
2. **Pod Management**: Deployments, Services, NodePort
3. **Database Management**: MySQL installation and configuration
4. **AWS Integration**: EC2, ECR
5. **Infrastructure as Code**: Kubernetes manifests
6. **Security**: Secrets management, MySQL security
7. **Troubleshooting**: Cluster, pod, and database debugging

## 🎉 Benefits of This Setup

- **💰 Ultra-Cheap**: Under $2/month (mostly free)
- **🎓 Educational**: Teaches database management + Kubernetes
- **⚡ Fast**: Quick setup and deployment
- **🔧 Simple**: Easy to understand and debug
- **📈 Scalable**: Can upgrade to larger instances later
- **🗄️ Complete**: Full stack on single instance

This setup provides excellent learning experience at minimal cost with everything running on a single EC2 instance!
