#!/bin/bash
set -e

# Load environment variables if .env file exists
if [ -f "$(dirname "$0")/.env" ]; then
    source "$(dirname "$0")/.env"
fi

# Fix GitHub Actions IAM permissions for ECR access
# This script adds the necessary ECR permissions to the github-actions-deploy user

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if AWS CLI is configured
check_aws_cli() {
    log_info "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "AWS CLI is configured"
}

# Get AWS account ID
get_account_id() {
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    log_info "AWS Account ID: $ACCOUNT_ID"
}

# Create IAM policy for ECR access
create_ecr_policy() {
    log_info "Creating IAM policy for ECR access..."
    
    # Create the policy document
    cat > ecr-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload"
            ],
            "Resource": "arn:aws:ecr:${AWS_REGION:-us-west-1}:${ACCOUNT_ID}:repository/${PROJECT_NAME:-byu-590r}-*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:CreateRepository",
                "ecr:DescribeRepositories"
            ],
            "Resource": "arn:aws:ecr:${AWS_REGION:-us-west-1}:${ACCOUNT_ID}:repository/${PROJECT_NAME:-byu-590r}-*"
        }
    ]
}
EOF
    
    # Create the policy
    POLICY_ARN=$(aws iam create-policy \
        --policy-name GitHubActionsECRPolicy \
        --policy-document file://ecr-policy.json \
        --description "Policy for GitHub Actions to access ECR repositories" \
        --query 'Policy.Arn' \
        --output text 2>/dev/null || echo "arn:aws:iam::${ACCOUNT_ID}:policy/GitHubActionsECRPolicy")
    
    log_success "Policy ready: $POLICY_ARN"
    
    # Clean up policy file
    rm -f ecr-policy.json
    
    echo "$POLICY_ARN"
}

# Attach policy to user
attach_policy_to_user() {
    local POLICY_ARN="$1"
    local USER_NAME="github-actions-deploy"
    
    log_info "Attaching policy to user: $USER_NAME"
    
    # Check if user exists
    if ! aws iam get-user --user-name "$USER_NAME" &> /dev/null; then
        log_error "User $USER_NAME does not exist. Please create the user first."
        log_info "You can create the user with:"
        log_info "aws iam create-user --user-name $USER_NAME"
        exit 1
    fi
    
    # Attach the policy
    aws iam attach-user-policy \
        --user-name "$USER_NAME" \
        --policy-arn "$POLICY_ARN"
    
    log_success "Policy attached to user: $USER_NAME"
}

# Create ECR repositories if they don't exist
create_ecr_repositories() {
    log_info "Creating ECR repositories if they don't exist..."
    
    # Get AWS region (default to us-west-1)
    AWS_REGION=${AWS_REGION:-us-west-1}
    
    # Create backend repository
    aws ecr create-repository \
        --repository-name ${PROJECT_NAME:-byu-590r}-backend \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true \
        2>/dev/null || log_info "Backend repository already exists"
    
    # Create frontend repository
    aws ecr create-repository \
        --repository-name ${PROJECT_NAME:-byu-590r}-frontend \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true \
        2>/dev/null || log_info "Frontend repository already exists"
    
    log_success "ECR repositories are ready"
}

# Main function
main() {
    log_info "Starting GitHub Actions IAM permissions fix..."
    
    check_aws_cli
    get_account_id
    
    log_info "Creating IAM policy for ECR access..."
    POLICY_ARN=$(create_ecr_policy)
    attach_policy_to_user "$POLICY_ARN"
    create_ecr_repositories
    
    log_success "GitHub Actions IAM permissions have been fixed!"
    log_info "The github-actions-deploy user now has the necessary ECR permissions."
    log_info "You can now run your GitHub Actions workflow successfully."
}

# Run main function
main "$@"
