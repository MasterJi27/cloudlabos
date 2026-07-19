#!/bin/bash
# CloudLabOS - Cleanup Kubernetes deployment
# Usage: ./cleanup.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo "============================================"
echo "  CloudLabOS Cleanup"
echo "============================================"

read -p "This will DELETE all CloudLabOS resources. Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  log "Aborted."
  exit 0
fi

log "Removing application services..."
kubectl delete namespace cloudlabos --ignore-not-found
kubectl delete namespace cloudlabos-monitoring --ignore-not-found

log "Removing Ingress Controller..."
helm uninstall ingress-nginx -n ingress-nginx 2>/dev/null || true
kubectl delete namespace ingress-nginx --ignore-not-found

log "Removing cluster roles..."
kubectl delete clusterrole prometheus --ignore-not-found
kubectl delete clusterrolebinding prometheus --ignore-not-found

log "Cleanup complete."
