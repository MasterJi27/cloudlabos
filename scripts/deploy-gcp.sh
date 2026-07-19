#!/bin/bash
# CloudLabOS - Deploy to GCP with Terraform
# Usage: ./deploy-gcp.sh [project_id] [environment]

set -euo pipefail

PROJECT_ID="${1:-}"
ENVIRONMENT="${2:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/../infrastructure/terraform/gcp"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

if [ -z "$PROJECT_ID" ]; then
  error "Usage: $0 <project_id> [environment]"
fi

echo "============================================"
echo "  CloudLabOS GCP Deployment"
echo "  Project: ${PROJECT_ID}"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"

# Check prerequisites
command -v terraform >/dev/null 2>&1 || error "terraform not found"
command -v gcloud >/dev/null 2>&1 || error "gcloud not found"
command -v kubectl >/dev/null 2>&1 || error "kubectl not found"

# Authenticate
log "Authenticating with GCP..."
gcloud auth application-default login 2>/dev/null || true
gcloud config set project "$PROJECT_ID"

# Enable required APIs
log "Enabling required GCP APIs..."
gcloud services enable \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  servicenetworking.googleapis.com \
  --project="$PROJECT_ID"

# Check for terraform.tfvars
if [ ! -f "${TF_DIR}/terraform.tfvars" ]; then
  warn "terraform.tfvars not found!"
  warn "Copy terraform.tfvars.example to terraform.tfvars and fill in values:"
  warn "  cp ${TF_DIR}/terraform.tfvars.example ${TF_DIR}/terraform.tfvars"
  warn "  nano ${TF_DIR}/terraform.tfvars"
  exit 1
fi

# Initialize Terraform
log "Initializing Terraform..."
cd "$TF_DIR"
terraform init -upgrade

# Plan
log "Planning infrastructure..."
terraform plan \
  -var="project_id=${PROJECT_ID}" \
  -var="environment=${ENVIRONMENT}" \
  -out=tfplan

# Apply
log "Applying infrastructure..."
read -p "Apply Terraform plan? (yes/no): " CONFIRM
if [ "$CONFIRM" = "yes" ]; then
  terraform apply tfplan
else
  warn "Aborted."
  exit 0
fi

# Get cluster credentials
CLUSTER_NAME=$(terraform output -raw cluster_name)
REGION=$(terraform output -raw gke_context | grep -oP 'us-\w+')
log "Getting GKE cluster credentials..."
gcloud container clusters get-credentials "$CLUSTER_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID"

# Apply Kubernetes manifests
log "Applying Kubernetes manifests..."
cd "${SCRIPT_DIR}"
./deploy.sh "$ENVIRONMENT"

log "GCP deployment complete!"
echo ""
log "GKE context: $(kubectl config current-context)"
log "Services: kubectl get svc -n cloudlabos"
log "Pods: kubectl get pods -n cloudlabos"
