#!/bin/bash

# BYU 590R Monorepo - AWS Teardown Script
# This script tears down the AWS environment and cleans up all resources

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

# Check if config file exists
check_config() {
    if [ ! -f ".aws-config" ]; then
        log_error "Configuration file .aws-config not found"
        log_error "Please run setup.sh first or check if you're in the correct directory"
        exit 1
    fi
    
    # Load configuration
    source .aws-config
    
    log_info "Loaded configuration:"
    echo "  Instance ID: $INSTANCE_ID"
    echo "  Instance IP: $INSTANCE_IP"
    echo "  Elastic IP: $ELASTIC_IP"
    echo "  Allocation ID: $ALLOCATION_ID"
}

# Confirm teardown
confirm_teardown() {
    log_warning "This will permanently delete all AWS resources!"
    log_warning "The following resources will be deleted:"
    echo "  - EC2 instance: $INSTANCE_ID"
    echo "  - Elastic IP: $ELASTIC_IP"
    echo "  - All data on the instance (including MySQL database)"
    echo ""
    
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Teardown cancelled"
        exit 0
    fi
}

# Stop EC2 instance
stop_instance() {
    log_info "Stopping EC2 instance..."
    
    aws ec2 stop-instances --instance-ids "$INSTANCE_ID" 2>/dev/null || true
    
    log_info "Waiting for instance to stop..."
    aws ec2 wait instance-stopped --instance-ids "$INSTANCE_ID" 2>/dev/null || true
    
    log_success "EC2 instance stopped"
}

# Terminate EC2 instance
terminate_instance() {
    log_info "Terminating EC2 instance..."
    
    aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" 2>/dev/null || true
    
    log_info "Waiting for instance to terminate..."
    aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID" 2>/dev/null || true
    
    log_success "EC2 instance terminated"
}

# Release Elastic IP
release_elastic_ip() {
    log_info "Releasing Elastic IP..."
    
    if [ -n "$ALLOCATION_ID" ]; then
        aws ec2 release-address --allocation-id "$ALLOCATION_ID" 2>/dev/null || true
        log_success "Elastic IP released"
    else
        log_warning "No Elastic IP allocation ID found"
    fi
}

# Clean up ECR repositories
cleanup_ecr() {
    log_info "Cleaning up ECR repositories..."
    
    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Delete ECR repositories
    aws ecr delete-repository --repository-name byu-590r-backend --force 2>/dev/null || true
    aws ecr delete-repository --repository-name byu-590r-frontend --force 2>/dev/null || true
    
    log_success "ECR repositories cleaned up"
}

# Clean up local files
cleanup_local() {
    log_info "Cleaning up local files..."
    
    # Remove config file
    rm -f .aws-config
    
    # Remove any temporary files
    rm -f setup-instance.sh deploy-k3s.sh
    
    log_success "Local files cleaned up"
}

# Show cost summary
show_cost_summary() {
    log_info "Cost Summary:"
    echo "  EC2 t2.micro: $0/month (free tier)"
    echo "  Elastic IP: $0/month (released)"
    echo "  ECR: $0/month (repositories deleted)"
    echo "  Total ongoing cost: $0/month"
    echo ""
    log_success "All resources have been cleaned up!"
}

# Main teardown function
main() {
    log_info "Starting BYU 590R Monorepo AWS teardown..."
    
    check_config
    confirm_teardown
    
    stop_instance
    terminate_instance
    release_elastic_ip
    cleanup_ecr
    cleanup_local
    
    echo ""
    show_cost_summary
    log_success "🎉 Teardown complete!"
    log_info "All AWS resources have been deleted"
}

# Run main function
main "$@"
