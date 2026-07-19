# CloudLabOS Enterprise - Google Cloud Platform Terraform

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  backend "gcs" {
    bucket = "cloudlabos-terraform-state"
    prefix = "gcp"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Kubernetes provider configured from GKE cluster data
data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://${module.gke.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(module.gke.cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = "https://${module.gke.endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(module.gke.cluster_ca_certificate)
  }
}

# ============================================
# Network & VPC
# ============================================

module "vpc" {
  source  = "terraform-google-modules/network/google"
  version = "~> 9.0"

  name                    = "cloudlabos-${var.environment}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"

  subnets = [
    {
      name                     = "private"
      ip_cidr_range            = "10.0.1.0/24"
      region                   = var.region
      stack_type               = "IPV4_ONLY"
      description              = "Private subnet for CloudLabOS workloads"
      private_ip_google_access = true
    },
    {
      name                     = "public"
      ip_cidr_range            = "10.0.2.0/24"
      region                   = var.region
      stack_type               = "IPV4_ONLY"
      description              = "Public subnet for load balancers"
      private_ip_google_access = false
    },
  ]

  secondary_ranges = {
    private = [
      {
        range_name    = "pods"
        ip_cidr_range = "10.4.0.0/14"
      },
      {
        range_name    = "services"
        ip_cidr_range = "10.8.0.0/20"
      },
    ]
  }
}

# Cloud NAT for private nodes to reach the internet
resource "google_compute_router" "router" {
  name    = "cloudlabos-${var.environment}-router"
  region  = var.region
  network = module.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "cloudlabos-${var.environment}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# ============================================
# GKE Cluster
# ============================================

module "gke" {
  source  = "terraform-google-modules/kubernetes-engine/google"
  version = "~> 29.0"

  name               = "cloudlabos-${var.environment}"
  location           = var.region
  network            = module.vpc.name
  subnetwork         = module.vpc.subnets["private"].name
  networking_mode    = "VPC_NATIVE"
  cluster_ipv4_cidr  = "10.4.0.0/14"
  services_ipv4_cidr = "10.8.0.0/20"

  release_channel                = "REGULAR"
  enable_horizontal_pod_autoscaling = true
  enable_vertical_pod_autoscaling   = true
  remove_default_node_pool         = true
  initial_node_count               = 1

  workload_identity_config = "${var.project_id}.svc.id.goog"

  node_pools = [
    {
      name           = "core"
      machine_type   = "e2-standard-4"
      min_count      = 2
      max_count      = 6
      disk_size_gb   = 100
      disk_type      = "pd-ssd"
      auto_repair    = true
      auto_upgrade   = true
    },
    {
      name           = "agents"
      machine_type   = "e2-standard-8"
      min_count      = 1
      max_count      = 10
      disk_size_gb   = 100
      disk_type      = "pd-ssd"
      auto_repair    = true
      auto_upgrade   = true
      taints = [
        {
          key    = "role"
          value  = "agents"
          effect = "NO_SCHEDULE"
        }
      ]
    },
    {
      name           = "browser"
      machine_type   = "e2-standard-4"
      min_count      = 1
      max_count      = 8
      disk_size_gb   = 100
      disk_type      = "pd-ssd"
      auto_repair    = true
      auto_upgrade   = true
      taints = [
        {
          key    = "role"
          value  = "browser"
          effect = "NO_SCHEDULE"
        }
      ]
    },
  ]

  node_pools_oauth_scopes = {
    all = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
  }
}

# ============================================
# Cloud SQL (PostgreSQL)
# ============================================

resource "google_sql_database_instance" "postgres" {
  name                = "cloudlabos-${var.environment}-postgres"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = var.environment == "production"

  settings {
    tier              = var.environment == "production" ? "db-custom-4-16384" : "db-custom-2-8192"
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"

    backup_configuration {
      enabled          = true
      point_in_time_recovery_enabled = true
      start_time       = "03:00"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = module.vpc.id
      require_ssl     = true
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "uuid-ossp"
    }

    maintenance_window {
      day  = 7
      hour = 3
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  depends_on = [google_service_networking_connection.private_ip]
}

resource "google_compute_global_address" "private_ip_range" {
  name          = "cloudlabos-${var.environment}-db-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = module.vpc.id
}

resource "google_service_networking_connection" "private_ip" {
  network                 = module.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

resource "google_sql_database" "cloudlabos" {
  name     = "cloudlabos"
  instance = google_sql_database_instance.postgres.name
  charset  = "UTF8"
}

resource "google_sql_user" "cloudlabos" {
  name     = "cloudlabos"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# ============================================
# Cloud Memorystore (Redis)
# ============================================

resource "google_redis_instance" "redis" {
  name           = "cloudlabos-${var.environment}-redis"
  region         = var.region
  tier           = "STANDARD_HA"
  memory_size_gb = var.environment == "production" ? 4 : 1

  location_id         = var.region
  alternative_location_id = var.environment == "production" ? "${var.region}-b" : null

  persistence_config {
    rdb_enabled           = true
    rdb_snapshot_period   = "TWENTY_FOUR_HOURS"
  }

  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  authorized_network = module.vpc.id

  redis_version = "REDIS_7_0"

  labels = var.common_labels
}

# ============================================
# GCS Bucket for Qdrant data
# ============================================

resource "google_storage_bucket" "qdrant_data" {
  name          = "${var.project_id}-cloudlabos-qdrant-${var.environment}"
  location      = var.region
  storage_class = "STANDARD"
  force_destroy = var.environment != "production"

  uniform_bucket_level_access = true

  versioning {
    enabled = false
  }

  labels = var.common_labels

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 30
    }
  }
}

# ============================================
# Secret Manager
# ============================================

resource "google_secret_manager_secret" "db_password" {
  secret_id = "cloudlabos-${var.environment}-db-password"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.common_labels
}

resource "google_secret_manager_secret_version" "db_password" {
  secret = google_secret_manager_secret.db_password.id

  secret_data = var.db_password
}

resource "google_secret_manager_secret" "redis_auth" {
  secret_id = "cloudlabos-${var.environment}-redis-auth"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.common_labels
}

resource "google_secret_manager_secret_version" "redis_auth" {
  secret = google_secret_manager_secret.redis_auth.id

  secret_data = var.redis_auth_string
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "cloudlabos-${var.environment}-jwt-secret"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.common_labels
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret = google_secret_manager_secret.jwt_secret.id

  secret_data = var.jwt_secret
}

resource "google_secret_manager_secret" "encryption_key" {
  secret_id = "cloudlabos-${var.environment}-encryption-key"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.common_labels
}

resource "google_secret_manager_secret_version" "encryption_key" {
  secret = google_secret_manager_secret.encryption_key.id

  secret_data = var.encryption_key
}

resource "google_secret_manager_secret" "openrouter_api_key" {
  secret_id = "cloudlabos-${var.environment}-openrouter-api-key"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.common_labels
}

resource "google_secret_manager_secret_version" "openrouter_api_key" {
  secret = google_secret_manager_secret.openrouter_api_key.id

  secret_data = var.openrouter_api_key
}

# ============================================
# Service Account & IAM (Workload Identity)
# ============================================

resource "google_service_account" "cloudlabos" {
  project      = var.project_id
  account_id   = "cloudlabos-${var.environment}"
  display_name = "CloudLabOS Service Account"
  description  = "Service account for CloudLabOS Kubernetes workloads"
}

resource "google_project_iam_member" "workload_identity_user" {
  project = var.project_id
  role    = "roles/iam.workloadIdentityUser"
  member  = "serviceAccount:${google_service_account.cloudlabos.email}"
}

resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudlabos.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloudlabos.email}"
}

resource "google_project_iam_member" "storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.cloudlabos.email}"
}

resource "google_project_iam_member" "monitoring_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.cloudlabos.email}"
}

resource "google_project_iam_member" "logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloudlabos.email}"
}

# ============================================
# Kubernetes Namespace
# ============================================

resource "kubernetes_namespace" "cloudlabos" {
  metadata {
    name = "cloudlabos"
    labels = {
      name        = "cloudlabos"
      environment = var.environment
    }
  }

  depends_on = [module.gke]
}

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "cloudlabos-monitoring"
    labels = {
      name        = "cloudlabos-monitoring"
      environment = var.environment
    }
  }

  depends_on = [module.gke]
}

# ============================================
# Kubernetes Secrets (from Terraform values)
# ============================================

resource "kubernetes_secret" "cloudlabos_secrets" {
  metadata {
    name      = "cloudlabos-secrets"
    namespace = kubernetes_namespace.cloudlabos.metadata[0].name
  }

  data = {
    "database-url"       = "postgresql://cloudlabos:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/cloudlabos?sslmode=require"
    "redis-url"          = "rediss://:${var.redis_auth_string}@${google_redis_instance.redis.host}:6379"
    "qdrant-url"         = "http://qdrant-service:6333"
    "jwt-secret"         = var.jwt_secret
    "encryption-key"     = var.encryption_key
    "openrouter-api-key" = var.openrouter_api_key
  }

  depends_on = [kubernetes_namespace.cloudlabos]
}

# ============================================
# Outputs
# ============================================

output "cluster_name" {
  value = module.gke.cluster_name
}

output "cluster_endpoint" {
  value = module.gke.endpoint
}

output "cluster_ca_certificate" {
  value     = module.gke.cluster_ca_certificate
  sensitive = true
}

output "database_host" {
  value = google_sql_database_instance.postgres.private_ip_address
}

output "database_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "redis_host" {
  value = google_redis_instance.redis.host
}

output "redis_port" {
  value = google_redis_instance.redis.port
}

output "service_account_email" {
  value = google_service_account.cloudlabos.email
}

output "gke_context" {
  value = "gke_${var.project_id}_${var.region}_${module.gke.cluster_name}"
}
