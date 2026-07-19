#!/bin/bash
# CloudLabOS - Deploy to Kubernetes
# Usage: ./deploy.sh [environment]
#   environment: staging (default) or production

set -euo pipefail

ENVIRONMENT="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="${SCRIPT_DIR}/kubernetes/base"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  CloudLabOS Kubernetes Deployment"
echo "  Environment: ${ENVIRONMENT}"
echo "============================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Prerequisites check
log "Checking prerequisites..."

command -v kubectl >/dev/null 2>&1 || error "kubectl not found. Install: https://kubernetes.io/docs/tasks/tools/"
command -v helm >/dev/null 2>&1 || error "helm not found. Install: https://helm.sh/docs/intro/install/"

# Check cluster connection
kubectl cluster-info >/dev/null 2>&1 || error "Cannot connect to Kubernetes cluster. Check kubeconfig."

log "Connected to cluster: $(kubectl config current-context)"

# ============================================
# Step 1: Build Docker images
# ============================================
log "Building Docker images..."

IMAGES=(
  "cloudlabos/api-gateway"
  "cloudlabos/agent-service"
  "cloudlabos/workflow-engine"
  "cloudlabos/memory-service"
  "cloudlabos/browser-service"
  "cloudlabos/research-service"
  "cloudlabos/frontend"
)

for image in "${IMAGES[@]}"; do
  service=$(echo "$image" | cut -d'/' -f2)
  dockerfile="${PROJECT_ROOT}/apps/${service}/Dockerfile"
  if [ -f "$dockerfile" ]; then
    log "Building ${image}:latest..."
    docker build -t "${image}:latest" -f "$dockerfile" "${PROJECT_ROOT}" 2>/dev/null || \
      warn "Failed to build ${image} - using existing image"
  else
    warn "No Dockerfile found for ${service}, skipping"
  fi
done

# For GKE, push to Container Registry
if kubectl config current-context | grep -q "gke_"; then
  log "GKE detected - pushing images to Container Registry..."
  PROJECT_ID=$(kubectl config current-context | grep -oP 'gke_\K[^_]+')
  for image in "${IMAGES[@]}"; do
    service=$(echo "$image" | cut -d'/' -f2)
    gcr_image="gcr.io/${PROJECT_ID}/${service}"
    docker tag "${image}:latest" "${gcr_image}:latest"
    docker push "${gcr_image}:latest" 2>/dev/null || warn "Failed to push ${gcr_image}"
  done
fi

# ============================================
# Step 2: Install NGINX Ingress Controller
# ============================================
log "Installing NGINX Ingress Controller..."

kubectl get namespace ingress-nginx >/dev/null 2>&1 || \
  kubectl create namespace ingress-nginx

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --set controller.replicaCount=2 \
  --set controller.metrics.enabled=true \
  --set controller.config.use-forwarded-headers="true" \
  --wait --timeout 300s

# ============================================
# Step 3: Create namespaces
# ============================================
log "Creating namespaces..."

kubectl apply -f "${BASE_DIR}/namespace.yaml"

# ============================================
# Step 4: Create secrets
# ============================================
log "Applying secrets..."

kubectl apply -f "${BASE_DIR}/secrets.yaml"

# ============================================
# Step 5: Create service account
# ============================================
log "Creating service account..."

# Replace PROJECT_ID placeholder
SA_MANIFEST="${BASE_DIR}/service-account.yaml"
if kubectl config current-context | grep -q "gke_"; then
  PROJECT_ID=$(kubectl config current-context | grep -oP 'gke_\K[^_]+')
  sed "s/PROJECT_ID/${PROJECT_ID}/g" "$SA_MANIFEST" | kubectl apply -f -
else
  # Remove the annotation for non-GKE clusters
  grep -v "iam.gke.io" "$SA_MANIFEST" | kubectl apply -f -
fi

# ============================================
# Step 6: Deploy PostgreSQL (for non-managed DB)
# ============================================
if ! kubectl config current-context | grep -q "gke_"; then
  log "Deploying PostgreSQL..."
  cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: cloudlabos
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: cloudlabos
            - name: POSTGRES_USER
              value: cloudlabos
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: cloudlabos-secrets
                  key: database-url
                  # Fallback - extract password from URL or use a separate secret
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 2Gi
      volumes:
        - name: postgres-data
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: cloudlabos
spec:
  type: ClusterIP
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
EOF

  log "Deploying Redis..."
  cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: cloudlabos
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          command: ["redis-server", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
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
  name: redis
  namespace: cloudlabos
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
EOF
fi

# ============================================
# Step 7: Deploy application services
# ============================================
log "Deploying application services..."

kubectl apply -f "${BASE_DIR}/api-gateway.yaml"
kubectl apply -f "${BASE_DIR}/agent-service.yaml"
kubectl apply -f "${BASE_DIR}/workflow-engine.yaml"
kubectl apply -f "${BASE_DIR}/memory-service.yaml"
kubectl apply -f "${BASE_DIR}/browser-service.yaml"
kubectl apply -f "${BASE_DIR}/research-service.yaml"
kubectl apply -f "${BASE_DIR}/frontend.yaml"
kubectl apply -f "${BASE_DIR}/qdrant.yaml"

# ============================================
# Step 8: Deploy Ingress
# ============================================
log "Deploying Ingress..."

kubectl apply -f "${BASE_DIR}/ingress.yaml"

# ============================================
# Step 9: Deploy Prometheus
# ============================================
log "Deploying Prometheus..."

kubectl apply -f "${BASE_DIR}/prometheus.yaml"

# ============================================
# Step 10: Deploy Grafana
# ============================================
log "Deploying Grafana..."

kubectl apply -f "${BASE_DIR}/grafana.yaml"

# Create dashboard ConfigMap from files
DASHBOARDS_DIR="${BASE_DIR}/dashboards"
if [ -d "$DASHBOARDS_DIR" ]; then
  kubectl create configmap grafana-dashboards \
    --from-file="${DASHBOARDS_DIR}" \
    -n cloudlabos-monitoring \
    --dry-run=client -o yaml | kubectl apply -f -
fi

# ============================================
# Step 11: Wait for rollout
# ============================================
log "Waiting for deployments to roll out..."

DEPLOYMENTS=(
  "cloudlabos/api-gateway"
  "cloudlabos/agent-service"
  "cloudlabos/workflow-engine"
  "cloudlabos/memory-service"
  "cloudlabos/browser-service"
  "cloudlabos/research-service"
  "cloudlabos/frontend"
  "cloudlabos-monitoring/prometheus"
  "cloudlabos-monitoring/grafana"
)

for deploy in "${DEPLOYMENTS[@]}"; do
  namespace=$(echo "$deploy" | cut -d'/' -f1)
  name=$(echo "$deploy" | cut -d'/' -f2)
  log "Rolling out ${name}..."
  kubectl rollout status deployment/"$name" -n "$namespace" --timeout=300s 2>/dev/null || \
    warn "Timeout waiting for ${name} to roll out"
done

# ============================================
# Step 12: Print status
# ============================================
echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""

log "Pods:"
kubectl get pods -n cloudlabos -o wide
echo ""
kubectl get pods -n cloudlabos-monitoring -o wide
echo ""

log "Services:"
kubectl get svc -n cloudlabos
echo ""

log "Ingress:"
kubectl get ingress -n cloudlabos
echo ""

log "HPAs:"
kubectl get hpa -n cloudlabos
echo ""

# Get external IP
EXTERNAL_IP=$(kubectl get ingress cloudlabos-ingress -n cloudlabos -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
if [ -n "$EXTERNAL_IP" ]; then
  log "Access CloudLabOS at: http://${EXTERNAL_IP}"
else
  log "Ingress external IP pending. Check with: kubectl get ingress -n cloudlabos"
  log "Or use port-forward: kubectl port-forward svc/frontend 3000 -n cloudlabos"
fi

echo ""
log "Grafana (port-forward): kubectl port-forward svc/grafana 3001:3000 -n cloudlabos-monitoring"
log "Prometheus (port-forward): kubectl port-forward svc/prometheus 9090:9090 -n cloudlabos-monitoring"
echo ""
log "Done!"
