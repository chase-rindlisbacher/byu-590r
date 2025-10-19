# BYU 590R Monorepo

Laravel backend + Angular frontend with AWS EC2 deployment.

**Requirements:**

- AWS subscription required
- GitHub Teams subscription recommended for full functionality

**Local Development Requirements:**

- Docker & Docker Compose
- Node.js 18+ (for Angular development)
- Make (for running commands)
- AWS CLI (for EC2 deployment)

## Quick Start

### 1. Setup EC2 Server

```bash
cd devops/bash
chmod +x setup-ec2-server.sh
./setup-ec2-server.sh
```

### 2. Configure GitHub Actions

**Copy the generated values from the setup script output** and add these secrets to your GitHub repository:

- `EC2_HOST`: Your EC2 public IP address (from setup script output)
- `S3_BUCKET`: Your unique S3 bucket name (from setup script output)
- `EC2_SSH_PRIVATE_KEY`: Contents of your SSH private key for server access
- `DB_DATABASE`: Database name for the Laravel application
- `DB_USERNAME`: Database username for MySQL connection
- `DB_PASSWORD`: Database password for MySQL connection
- `APP_DEBUG`: Laravel debug mode setting (true/false)
- `OPENAI_API_KEY`: OpenAI API key for AI features (optional)
- `AWS_ACCESS_KEY_ID`: AWS access key for AWS services
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for AWS services
- `AWS_REGION`: AWS region for AWS services

#### AWS IAM Setup

1. **Create IAM User**:

   - Go to AWS Console → IAM → Users → Create User
   - Username: `byu-590r-deploy`
   - Attach policies directly

2. **Required Policies**:

   ```json
   {
   	"Version": "2012-10-17",
   	"Statement": [
   		{
   			"Effect": "Allow",
   			"Action": [
   				"ec2:RunInstances",
   				"ec2:TerminateInstances",
   				"ec2:DescribeInstances",
   				"ec2:DescribeImages",
   				"ec2:DescribeSecurityGroups",
   				"ec2:AuthorizeSecurityGroupIngress",
   				"ec2:AllocateAddress",
   				"ec2:AssociateAddress",
   				"ec2:DescribeAddresses",
   				"ec2:CreateTags",
   				"ec2:DescribeTags"
   			],
   			"Resource": "*"
   		},
   		{
   			"Effect": "Allow",
   			"Action": [
   				"s3:CreateBucket",
   				"s3:DeleteBucket",
   				"s3:ListBucket",
   				"s3:GetBucketLocation",
   				"s3:GetBucketAcl",
   				"s3:PutBucketAcl",
   				"s3:PutBucketPublicAccessBlock",
   				"s3:GetBucketPublicAccessBlock",
   				"s3:PutObject",
   				"s3:GetObject",
   				"s3:DeleteObject",
   				"s3:PutObjectAcl",
   				"s3:GetObjectAcl"
   			],
   			"Resource": ["arn:aws:s3:::byu-590r-*", "arn:aws:s3:::byu-590r-*/*"]
   		}
   	]
   }
   ```

3. **Generate Access Keys**:

   - Go to IAM → Users → `byu-590r-deploy` → Security credentials
   - Create access key → Command Line Interface (CLI)
   - Download CSV file

4. **Configure Local AWS CLI**:

   ```bash
   aws configure
   # Enter Access Key ID, Secret Access Key, Region (us-west-1), Output format (json)
   ```

5. **Add to GitHub Secrets**:
   - Repository → Settings → Secrets and variables → Actions
   - Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from CSV file
   - **Important**: Also add `EC2_HOST` and `S3_BUCKET` values from setup script output

#### OpenAI API Setup (Optional)

1. **Create OpenAI Account**:

   - Go to [platform.openai.com](https://platform.openai.com)
   - Sign up or log in to your account

2. **Add Credits/Billing**:

   - Go to Billing → Payment methods
   - Add a credit card or purchase credits
   - Minimum: $5 credit for testing
   - Recommended: $10-20 for development

3. **Generate API Key**:

   - Go to API Keys section in your OpenAI dashboard
   - Click "Create new secret key"
   - Name: `byu-590r-project`
   - Copy the key (starts with `sk-`)

4. **Add to GitHub Secrets**:

   - Repository → Settings → Secrets and variables → Actions
   - Add `OPENAI_API_KEY` with your generated key

5. **Add to Local Environment** (optional):
   ```bash
   # Add to backend/.env file
   OPENAI_API_KEY=sk-your-key-here
   ```

### 3. Deploy

Push to `main` branch - GitHub Actions will auto-deploy.

### 4. Verify Deployment

- **Frontend**: `http://YOUR_EC2_IP`
- **Backend API**: `http://YOUR_EC2_IP:4444/api/hello`
- **Health Check**: `http://YOUR_EC2_IP:4444/api/health`
- **S3 Test**: `http://YOUR_EC2_IP:4444/api/test-s3`

### 5. Cleanup

```bash
cd devops/bash
./teardown.sh
```

## Local Development

### Setup Environment

1. **Copy environment file**:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Configure database settings** (optional - Docker handles this):

   ```bash
   # Edit backend/.env if needed
   DB_CONNECTION=mysql
   DB_HOST=mysql
   DB_PORT=3306
   DB_DATABASE=byu_590r_app
   DB_USERNAME=byu_user
   DB_PASSWORD=byu_password
   ```

3. **Start development environment**:
   ```bash
   make start
   ```

- Frontend: http://localhost:4200
- Backend API: http://localhost:8000

## Credits

This project was created for educational purposes for BYU IS 590R course - John Christiansen. 10/2025. All Rights Reserved
