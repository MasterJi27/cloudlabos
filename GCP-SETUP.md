# CloudLabOS Enterprise - Google Cloud Setup Guide

## Prerequisites

```bash
# Install gcloud CLI
brew install google-cloud-sdk

# Install kubectl
gcloud components install kubectl

# Install Terraform
brew install terraform

# Authenticate
gcloud auth login
gcloud auth application-default login
```

## Quick Deploy

### 1. Create Project
```bash
gcloud projects create cloudlabos-arcade --name="CloudLabOS Arcade"

# Set as active
export PROJECT_ID="cloudlabos-arcade"
gcloud config set project $PROJECT_ID
```

### 2. Enable APIs
```bash
# Enable required APIs
gcloud services enable \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### 3. Deploy Infrastructure
```bash
cd infrastructure/terraform/gcp

# Create terraform.tfvars
cat > terraform.tfvars << EOF
project_id     = "cloudlabos-arcade"
environment    = "production"
region         = "us-central1"
db_password    = "your-secure-password"
redis_password = "your-secure-redis-password"
jwt_secret     = "your-48-byte-jwt-secret"
encryption_key = "your-32-byte-encryption-key"
openrouter_api_key = "sk-or-v1-..."
EOF

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 4. Configure kubectl
```bash
gcloud container clusters get-credentials cloudlabos-production \
  --region us-central1 \
  --project cloudlabos-arcade
```

### 5. Deploy Applications
```bash
# Apply Kubernetes manifests
kubectl apply -f infrastructure/kubernetes/namespaces.yaml
kubectl apply -f infrastructure/kubernetes/gke/

# Or use Helm (recommended)
helm install cloudlabos ./infrastructure/helm/cloudlabos
```

### 6. Get External IP
```bash
kubectl get services -n cloudlabos
```

## GCP Services Used

| Service | Purpose | Tier |
|---------|---------|------|
| **GKE** | Kubernetes cluster | Standard |
| **Cloud SQL** | PostgreSQL database | Custom (2 vCPU, 8GB) |
| **Cloud Memorystore** | Redis cache | Standard (4GB) |
| **Secret Manager** | Secrets storage | Standard |
| **Cloud Storage** | Persistent storage | Standard |
| **Cloud Load Balancing** | Traffic distribution | Standard |
| **Cloud Logging** | Logs aggregation | Standard |
| **Cloud Monitoring** | Metrics & alerting | Standard |

## Architecture on GCP

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │   Cloud Load  │───▶│     GKE       │───▶│   Cloud SQL  │ │
│  │   Balancer    │    │   (Cluster)   │    │  (Postgres)  │ │
│  └──────────────┘    └───────┬────────┘    └─────────────┘ │
│                             │                               │
│  ┌──────────────┐    ┌──────┴────────┐    ┌─────────────┐ │
│  │   Cloud       │    │   Kubernetes   │    │  Cloud       │ │
│  │   Storage      │    │     Pods       │    │  Memorystore │ │
│  │  (Qdrant data) │    │   - API GW     │    │   (Redis)    │ │
│  └──────────────┘    │   - Agents      │    └─────────────┘ │
│                      │   - Workflow    │                     │
│                      │   - Browser     │                     │
│                      └─────────────────┘                     │
│                             │                               │
│                      ┌──────┴────────┐                      │
│                      │  Secret Mgr   │                      │
│                      │  (Secrets)     │                      │
│                      └───────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## GCP-Specific Features

### Workload Identity
```yaml
# Automatic IAM binding via service account annotation
annotations:
  iam.gke.io/gcp-service-account: cloudlabos@PROJECT_ID.iam.gserviceaccount.com
```

### Cloud SQL Auth Proxy (for local development)
```bash
# Download proxy
curl -o cloud_sql_proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy_linux_amd64

# Connect
./cloud_sql_proxy -instances=PROJECT:region:instance=tcp:5432
```

### Artifact Registry
```bash
# Configure Docker
gcloud auth configure-docker

# Push images
gcloud builds submit --tag us-docker.pkg.dev/$PROJECT_ID/cloudlabos/api-gateway:latest
```

## Cost Estimation (Monthly)

| Resource | Configuration | Estimated Cost |
|----------|---------------|----------------|
| GKE (Core) | 3 x e2-standard-4 | ~$150/month |
| GKE (Agents) | 2 x e2-standard-8 | ~$200/month |
| GKE (Browser) | 2 x e2-standard-4 | ~$150/month |
| Cloud SQL | 2 vCPU, 8GB RAM | ~$150/month |
| Cloud Memorystore | 4GB | ~$50/month |
| Cloud Storage | 50GB | ~$5/month |
| Load Balancing | Standard | ~$25/month |
| **Total** | | **~$730/month** |

## Monitoring

```bash
# View logs
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=cloudlabos"

# View metrics
gcloud monitoring dashboards list
```

## Troubleshooting

```bash
# Check pod status
kubectl get pods -n cloudlabos

# View pod logs
kubectl logs -n cloudlabos -l app=api-gateway

# Describe service
kubectl describe svc api-gateway -n cloudlabos

# Execute into pod
kubectl exec -it -n cloudlabos deployment/api-gateway -- /bin/sh
```

## Clean Up

```bash
# Delete GKE cluster (will also delete pods)
gcloud container clusters delete cloudlabos-production --region us-central1

# Delete Cloud SQL
gcloud sql instances delete cloudlabos-production-postgres

# Delete Redis
gcloud redis instances delete cloudlabos-production-redis

# Delete storage
gsutil rm -r gs://cloudlabos-arcade-cloudlabos-qdrant-production

# Delete secrets
gcloud secrets delete cloudlabos-production-secrets
```