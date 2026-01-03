#!/bin/bash

# BYU 590R Monorepo - AWS Teardown Script
# This script tears down the AWS environment and cleans up all resources

set -e

# Disable pager for AWS CLI to prevent requiring 'q' to continue
export AWS_PAGER=""

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

# Check if config file exists or find project resources
check_config() {
    if [ -f "../.server-config" ]; then
        # Load configuration from file, filtering out any log output or color codes
        # Only source lines that look like valid variable assignments
        while IFS= read -r line || [ -n "$line" ]; do
            # Skip empty lines, comments, and lines that don't look like variable assignments
            if [[ -n "$line" ]] && [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ "$line" =~ ^[A-Z_][A-Z0-9_]*= ]]; then
                # Remove any ANSI color codes before evaluating
                clean_line=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/\033\[[0-9;]*m//g')
                eval "$clean_line" 2>/dev/null || true
            fi
        done < ../.server-config
        
        log_info "Loaded configuration from .server-config:"
        if [ -n "$INSTANCE_ID" ]; then
            echo "  Instance ID: $INSTANCE_ID"
        fi
        if [ -n "$INSTANCE_IP" ]; then
            echo "  Instance IP: $INSTANCE_IP"
        fi
        if [ -n "$ALLOCATION_ID" ]; then
            echo "  Allocation ID: $ALLOCATION_ID"
        fi
        if [ -n "$ELASTIC_IP" ]; then
            echo "  Elastic IP: $ELASTIC_IP"
        fi
        if [ -n "$S3_BUCKET" ]; then
            echo "  S3 Bucket: $S3_BUCKET"
        fi
        if [ -n "$S3_BUCKET_DEV" ]; then
            echo "  S3 Bucket (DEV): $S3_BUCKET_DEV"
        fi
        if [ -n "$S3_BUCKET_PROD" ]; then
            echo "  S3 Bucket (PROD): $S3_BUCKET_PROD"
        fi
    else
        log_warning "Configuration file ../.server-config not found"
        log_info "Searching for BYU 590R project resources..."
        
        # Find project instances
        EXISTING_INSTANCES=$(aws ec2 describe-instances \
            --filters "Name=tag:Name,Values=byu-590r-server" "Name=instance-state-name,Values=running,pending,stopped" \
            --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]' \
            --output text)
        
        if [ -n "$EXISTING_INSTANCES" ]; then
            log_warning "Found existing BYU 590R instances:"
            echo "$EXISTING_INSTANCES" | while read instance_id ip state; do
                echo "  Instance: $instance_id (IP: $ip, State: $state)"
            done
            
            # Get the first instance ID for cleanup
            INSTANCE_ID=$(echo "$EXISTING_INSTANCES" | head -n1 | awk '{print $1}')
            INSTANCE_IP=$(echo "$EXISTING_INSTANCES" | head -n1 | awk '{print $2}')
        else
            log_info "No existing BYU 590R instances found"
        fi
        
                # Find project S3 buckets by tags
                log_info "Searching for BYU 590R S3 buckets by tags..."
                EXISTING_BUCKETS=""
                
                # Get all buckets and check their tags
                ALL_BUCKETS=$(aws s3api list-buckets --query 'Buckets[].Name' --output text)
                
                for bucket in $ALL_BUCKETS; do
                    # Check if bucket has BYU 590R tags
                    BUCKET_TAGS=$(aws s3api get-bucket-tagging --bucket "$bucket" 2>/dev/null || echo "")
                    if echo "$BUCKET_TAGS" | grep -q "byu-590r"; then
                        EXISTING_BUCKETS="$EXISTING_BUCKETS $bucket"
                    fi
                done
                
                if [ -n "$EXISTING_BUCKETS" ]; then
                    log_warning "Found existing BYU 590R S3 buckets:"
                    for bucket in $EXISTING_BUCKETS; do
                        echo "  Bucket: $bucket"
                    done
                    
                    # Use the first bucket for cleanup
                    S3_BUCKET=$(echo "$EXISTING_BUCKETS" | awk '{print $1}')
                else
                    log_info "No existing BYU 590R S3 buckets found"
                fi
        
        # Find project Elastic IPs
        EXISTING_EIPS=$(aws ec2 describe-addresses --filters "Name=tag:Project,Values=590r" --query 'Addresses[*].[AllocationId,PublicIp]' --output text)
        
        if [ -n "$EXISTING_EIPS" ]; then
            log_warning "Found existing BYU 590R Elastic IPs:"
            echo "$EXISTING_EIPS" | while read allocation_id public_ip; do
                echo "  Elastic IP: $public_ip (Allocation: $allocation_id)"
            done
            
            # Use the first Elastic IP for cleanup
            ALLOCATION_ID=$(echo "$EXISTING_EIPS" | head -n1 | awk '{print $1}')
            ELASTIC_IP=$(echo "$EXISTING_EIPS" | head -n1 | awk '{print $2}')
        else
            log_info "No existing BYU 590R Elastic IPs found"
        fi
    fi
}

# Confirm teardown
confirm_teardown() {
    log_warning "This will permanently delete all BYU 590R AWS resources!"
    log_warning "The following resources will be deleted:"
    
    # Show all instances that will be deleted
    INSTANCES=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=byu-590r-server" "Name=instance-state-name,Values=running,pending,stopped" \
        --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' \
        --output text)
    
    if [ -n "$INSTANCES" ]; then
        echo "  - EC2 instances:"
        echo "$INSTANCES" | while read instance_id state; do
            echo "    * $instance_id (State: $state)"
        done
    fi
    
    # Show Elastic IPs that will be released
    ELASTIC_IPS=$(aws ec2 describe-addresses --filters "Name=tag:Project,Values=590r" --query 'Addresses[*].[AllocationId,PublicIp]' --output text)
    if [ -n "$ELASTIC_IPS" ]; then
        echo "  - Elastic IPs:"
        echo "$ELASTIC_IPS" | while read allocation_id public_ip; do
            echo "    * $public_ip (Allocation: $allocation_id)"
        done
    fi
    # Show S3 buckets that will be deleted
    ALL_BUCKETS=$(aws s3api list-buckets --query 'Buckets[].Name' --output text)
    BYU_BUCKETS=""
    
    for bucket in $ALL_BUCKETS; do
        BUCKET_TAGS=$(aws s3api get-bucket-tagging --bucket "$bucket" 2>/dev/null || echo "")
        if echo "$BUCKET_TAGS" | grep -q "byu-590r"; then
            BYU_BUCKETS="$BYU_BUCKETS $bucket"
        fi
    done
    
    if [ -n "$BYU_BUCKETS" ]; then
        echo "  - S3 buckets (and all contents):"
        for bucket in $BYU_BUCKETS; do
            echo "    * $bucket"
        done
    fi
    echo "  - All data on instances (including MySQL database)"
    echo ""
    
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Teardown cancelled"
        exit 0
    fi
}

# Stop all EC2 instances
stop_instances() {
    log_info "Finding all BYU 590R instances..."
    
    # Get all instances with byu-590r-server tag
    INSTANCES=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=byu-590r-server" "Name=instance-state-name,Values=running,pending" \
        --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' \
        --output text)
    
    if [ -n "$INSTANCES" ]; then
        log_info "Found BYU 590R instances to stop:"
        echo "$INSTANCES" | while read instance_id state; do
            echo "  Instance: $instance_id (State: $state)"
        done
        
        # Extract instance IDs
        INSTANCE_IDS=$(echo "$INSTANCES" | awk '{print $1}' | tr '\n' ' ')
        
        log_info "Stopping all BYU 590R instances..."
        aws ec2 stop-instances --instance-ids $INSTANCE_IDS 2>/dev/null || true
        
        log_info "Waiting for all instances to stop..."
        for instance_id in $INSTANCE_IDS; do
            aws ec2 wait instance-stopped --instance-ids "$instance_id" 2>/dev/null || true
        done
        
        log_success "All EC2 instances stopped"
    else
        log_info "No running BYU 590R instances found"
    fi
}

# Terminate all EC2 instances
terminate_instances() {
    log_info "Finding all BYU 590R instances to terminate..."
    
    # Get all instances with byu-590r-server tag (including stopped ones)
    INSTANCES=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=byu-590r-server" "Name=instance-state-name,Values=running,pending,stopped" \
        --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' \
        --output text)
    
    if [ -n "$INSTANCES" ]; then
        log_info "Found BYU 590R instances to terminate:"
        echo "$INSTANCES" | while read instance_id state; do
            echo "  Instance: $instance_id (State: $state)"
        done
        
        # Extract instance IDs
        INSTANCE_IDS=$(echo "$INSTANCES" | awk '{print $1}' | tr '\n' ' ')
        
        # Disassociate all Elastic IPs first
        log_info "Disassociating all Elastic IPs..."
        aws ec2 describe-addresses --filters "Name=tag:Project,Values=590r" --query 'Addresses[*].[AllocationId,AssociationId]' --output text | while read allocation_id association_id; do
            if [ -n "$association_id" ] && [ "$association_id" != "None" ]; then
                aws ec2 disassociate-address --association-id "$association_id" 2>/dev/null || true
                log_info "Disassociated Elastic IP: $allocation_id"
            fi
        done
        
        log_info "Terminating all BYU 590R instances..."
        aws ec2 terminate-instances --instance-ids $INSTANCE_IDS 2>/dev/null || true
        
        log_info "Waiting for all instances to terminate..."
        for instance_id in $INSTANCE_IDS; do
            aws ec2 wait instance-terminated --instance-ids "$instance_id" 2>/dev/null || true
        done
        
        log_success "All EC2 instances terminated"
    else
        log_info "No BYU 590R instances found to terminate"
    fi
}

# Delete security groups with 590r tag
delete_security_groups() {
    log_info "Finding security groups with 590r tag to delete..."
    
    # Get all security groups with Project=590r tag
    SECURITY_GROUPS=$(aws ec2 describe-security-groups \
        --filters "Name=tag:Project,Values=590r" \
        --query 'SecurityGroups[*].[GroupId,GroupName]' \
        --output text)
    
    if [ -n "$SECURITY_GROUPS" ]; then
        log_info "Found security groups with 590r tag to delete:"
        echo "$SECURITY_GROUPS" | while read group_id group_name; do
            echo "  Security Group: $group_id ($group_name)"
        done
        
        # Extract security group IDs
        SG_IDS=$(echo "$SECURITY_GROUPS" | awk '{print $1}' | tr '\n' ' ')
        
        log_info "Deleting security groups..."
        for sg_id in $SG_IDS; do
            # Try to delete the security group
            if aws ec2 delete-security-group --group-id "$sg_id" 2>/dev/null; then
                log_success "Deleted security group: $sg_id"
            else
                log_warning "Could not delete security group $sg_id (may be in use or have dependencies)"
            fi
        done
        
        log_success "Security group cleanup completed"
    else
        log_info "No security groups with 590r tag found to delete"
    fi
}

# Release all Elastic IPs tagged with Project=590r
release_elastic_ip() {
    log_info "Finding all BYU 590R Elastic IPs to release..."
    
    # Find all Elastic IPs tagged with Project=590r
    ELASTIC_IPS=$(aws ec2 describe-addresses \
        --filters "Name=tag:Project,Values=590r" \
        --query 'Addresses[*].[AllocationId,PublicIp,AssociationId]' \
        --output text)
    
    if [ -n "$ELASTIC_IPS" ]; then
        log_info "Found BYU 590R Elastic IPs to release:"
        echo "$ELASTIC_IPS" | while read allocation_id public_ip association_id; do
            echo "  Elastic IP: $public_ip (Allocation: $allocation_id)"
            
            # Disassociate if still associated
            if [ -n "$association_id" ] && [ "$association_id" != "None" ]; then
                log_info "Disassociating Elastic IP: $allocation_id"
                aws ec2 disassociate-address --association-id "$association_id" 2>/dev/null || true
            fi
            
            # Release the Elastic IP
            log_info "Releasing Elastic IP: $allocation_id"
            if aws ec2 release-address --allocation-id "$allocation_id" 2>/dev/null; then
                log_success "Released Elastic IP: $allocation_id ($public_ip)"
            else
                log_warning "Could not release Elastic IP: $allocation_id (may already be released)"
            fi
        done
        
        log_success "All Elastic IP cleanup completed"
    else
        log_info "No BYU 590R Elastic IPs found to release"
    fi
}

# Delete all S3 buckets (both dev and prod)
delete_s3_buckets() {
    log_info "Finding all BYU 590R S3 buckets (dev and prod)..."
    
    # Get all buckets and check their tags
    ALL_BUCKETS=$(aws s3api list-buckets --query 'Buckets[].Name' --output text)
    BYU_BUCKETS=""
    
    for bucket in $ALL_BUCKETS; do
        # Check if bucket has BYU 590R tags
        BUCKET_TAGS=$(aws s3api get-bucket-tagging --bucket "$bucket" 2>/dev/null || echo "")
        if echo "$BUCKET_TAGS" | grep -q "byu-590r"; then
            BYU_BUCKETS="$BYU_BUCKETS $bucket"
        fi
    done
    
    if [ -n "$BYU_BUCKETS" ]; then
        log_info "Found BYU 590R S3 buckets to delete (both dev and prod):"
        for bucket in $BYU_BUCKETS; do
            echo "  Bucket: $bucket"
        done
        
        # Delete each bucket
        for bucket in $BYU_BUCKETS; do
            log_info "Deleting S3 bucket: $bucket"
            
            # Check if bucket exists
            if aws s3api head-bucket --bucket "$bucket" 2>/dev/null; then
                log_info "Emptying bucket: $bucket"
                
                # Delete all object versions (for versioned buckets)
                aws s3api list-object-versions --bucket "$bucket" --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json > /tmp/versions.json 2>/dev/null || echo '{"Objects":[]}' > /tmp/versions.json
                if [ "$(cat /tmp/versions.json | jq '.Objects | length')" -gt 0 ]; then
                    aws s3api delete-objects --bucket "$bucket" --delete file:///tmp/versions.json 2>/dev/null || true
                fi
                
                # Delete all delete markers
                aws s3api list-object-versions --bucket "$bucket" --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json > /tmp/markers.json 2>/dev/null || echo '{"Objects":[]}' > /tmp/markers.json
                if [ "$(cat /tmp/markers.json | jq '.Objects | length')" -gt 0 ]; then
                    aws s3api delete-objects --bucket "$bucket" --delete file:///tmp/markers.json 2>/dev/null || true
                fi
                
                # Delete all objects (non-versioned)
                aws s3 rm s3://"$bucket" --recursive 2>/dev/null || true
                
                # Delete the bucket
                aws s3api delete-bucket --bucket "$bucket" 2>/dev/null || true
                
                log_success "S3 bucket '$bucket' deleted successfully"
            else
                log_info "S3 bucket '$bucket' does not exist or already deleted"
            fi
        done
        
        # Clean up temporary files
        rm -f /tmp/versions.json /tmp/markers.json
    else
        log_info "No BYU 590R S3 buckets found to delete"
    fi
}

# Clean up ECR repositories (if any exist)
cleanup_ecr() {
    log_info "Checking for ECR repositories to clean up..."
    
    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Delete ECR repositories if they exist
    aws ecr delete-repository --repository-name byu-590r-backend --force 2>/dev/null || log_info "No backend ECR repository found"
    aws ecr delete-repository --repository-name byu-590r-frontend --force 2>/dev/null || log_info "No frontend ECR repository found"
    
    log_success "ECR cleanup completed"
}

# Clean up local files
cleanup_local() {
    log_info "Cleaning up local files..."
    
    # Remove config file
    rm -f .server-config
    
    # Remove any temporary files
    rm -f setup-server.sh nginx-config laravel-service
    
    log_success "Local files cleaned up"
}

# Show cost summary
show_cost_summary() {
    log_info "Cost Summary:"
    echo "  EC2 t2.micro: $0/month (free tier)"
    echo "  Elastic IP: $0/month (released)"
    echo "  S3 bucket: $0/month (deleted)"
    echo "  ECR: $0/month (repositories deleted)"
    echo "  Total ongoing cost: $0/month"
    echo ""
    log_success "All resources have been cleaned up!"
}

# Clean up configuration file
cleanup_config() {
    log_info "Cleaning up configuration file..."
    
    if [ -f "../.server-config" ]; then
        rm -f ../.server-config
        log_success "Configuration file ../.server-config deleted"
    else
        log_info "No configuration file to clean up"
    fi
}

# Main teardown function
main() {
    log_info "Starting BYU 590R Monorepo AWS teardown..."
    
    check_config
    confirm_teardown
    
    stop_instances
    terminate_instances
    delete_security_groups
    release_elastic_ip
    delete_s3_buckets
    cleanup_ecr
    cleanup_local
    cleanup_config
    
    echo ""
    show_cost_summary
    log_success "🎉 Teardown complete!"
    log_info "All AWS resources have been deleted"
}

# Run main function
main "$@"
