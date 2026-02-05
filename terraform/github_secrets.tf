# Optional: sync Terraform outputs to GitHub Actions repository secrets.
# Set manage_github_secrets = true and github_token (PAT with repo Secrets write) to enable.
# See .github/README.md for where each secret comes from (A/B/C/Manual).

provider "github" {
  token = var.github_token
}

resource "github_actions_secret" "ec2_host" {
  count = var.manage_github_secrets ? 1 : 0

  repository      = var.github_repository
  secret_name     = "EC2_HOST"
  plaintext_value = aws_eip.byu_590r_eip.public_ip
}

resource "github_actions_secret" "s3_bucket" {
  count = var.manage_github_secrets ? 1 : 0

  repository      = var.github_repository
  secret_name     = "S3_BUCKET"
  plaintext_value = aws_s3_bucket.prod.id
}

resource "github_actions_secret" "s3_bucket_dev" {
  count = var.manage_github_secrets ? 1 : 0

  repository      = var.github_repository
  secret_name     = "S3_BUCKET_DEV"
  plaintext_value = aws_s3_bucket.dev.id
}

resource "github_actions_secret" "s3_bucket_prod" {
  count = var.manage_github_secrets ? 1 : 0

  repository      = var.github_repository
  secret_name     = "S3_BUCKET_PROD"
  plaintext_value = aws_s3_bucket.prod.id
}

resource "github_actions_secret" "instance_id" {
  count = var.manage_github_secrets ? 1 : 0

  repository      = var.github_repository
  secret_name     = "INSTANCE_ID"
  plaintext_value = aws_instance.byu_590r_server.id
}
