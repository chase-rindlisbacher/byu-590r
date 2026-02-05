#!/bin/bash
# BYU 590R Monorepo - Terraform Teardown Then Re-apply
# Destroys all Terraform-managed resources, then applies again (clean re-run).
# Equivalent to: run teardown.sh, then run setup-ec2-server.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Optional: skip confirmation for destroy/apply (e.g. in CI)
AUTO_APPROVE=""
if [ "${1:-}" = "--auto-approve" ] || [ "${1:-}" = "-y" ]; then
  AUTO_APPROVE="-auto-approve"
fi

echo "[INFO] Teardown: destroying all Terraform-managed resources..."
terraform destroy $AUTO_APPROVE

echo "[INFO] Re-apply: creating infrastructure again..."
terraform apply $AUTO_APPROVE

echo "[SUCCESS] Teardown and re-apply complete."
terraform output summary
