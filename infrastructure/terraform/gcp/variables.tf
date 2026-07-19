# GCP Variables

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment (staging, production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "db_password" {
  description = "Cloud SQL password for cloudlabos user"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 16
    error_message = "Database password must be at least 16 characters."
  }
}

variable "redis_auth_string" {
  description = "Cloud Memorystore Redis AUTH string"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.redis_auth_string) >= 16
    error_message = "Redis auth string must be at least 16 characters."
  }
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "JWT secret must be at least 32 characters."
  }
}

variable "encryption_key" {
  description = "AES-256 encryption key for credential storage"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.encryption_key) >= 32
    error_message = "Encryption key must be at least 32 characters."
  }
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for LLM access"
  type        = string
  sensitive   = true
}

variable "common_labels" {
  description = "Common labels for all resources"
  type        = map(string)
  default = {
    project     = "cloudlabos"
    managed-by  = "terraform"
    environment = "staging"
  }
}
