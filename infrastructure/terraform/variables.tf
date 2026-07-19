# Terraform Variables

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_password" {
  description = "RDS password"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for credentials"
  type        = string
  sensitive   = true
}

variable "openrouter_api_key" {
  description = "OpenRouter API key"
  type        = string
  sensitive   = true
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {
    Project     = "CloudLabOS"
    ManagedBy   = "Terraform"
  }
}