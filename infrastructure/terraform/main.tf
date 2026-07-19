# CloudLabOS Enterprise - Terraform Configuration

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  backend "s3" {
    bucket = "cloudlabos-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "CloudLabOS"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ============================================
# VPC and Networking
# ============================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "cloudlabos-${var.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true

  tags = var.common_tags
}

# ============================================
# EKS Cluster
# ============================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "cloudlabos-${var.environment}"
  cluster_version = "1.30"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Enable managed node groups
  eks_managed_node_groups = {
    core = {
      name           = "core"
      instance_types = ["m5.xlarge"]
      min_size       = 2
      max_size       = 6
      desired_size   = 3
      labels         = { role = "core" }
      tags = {
        "k8s.io/cluster-autoscaler/enabled" = "true"
        "k8s.io/cluster-autoscaler/cloudlabos-${var.environment}" = "owned"
      }
    }

    agents = {
      name           = "agents"
      instance_types = ["c5.2xlarge"]
      min_size       = 1
      max_size       = 10
      desired_size   = 2
      labels         = { role = "agents" }
      taints         = [{ key = "role", value = "agents", effect = "NoSchedule" }]
      tags = {
        "k8s.io/cluster-autoscaler/enabled" = "true"
        "k8s.io/cluster-autoscaler/cloudlabos-${var.environment}" = "owned"
      }
    }

    browser = {
      name           = "browser"
      instance_types = ["m5.2xlarge"]
      min_size       = 1
      max_size       = 8
      desired_size   = 2
      labels         = { role = "browser" }
      tags = {
        "k8s.io/cluster-autoscaler/enabled" = "true"
        "k8s.io/cluster-autoscaler/cloudlabos-${var.environment}" = "owned"
      }
    }
  }

  tags = var.common_tags
}

# ============================================
# RDS PostgreSQL
# ============================================

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "cloudlabos-${var.environment}-postgres"

  engine               = "postgres"
  engine_version       = "16.1"
  family               = "postgres16"
  instance_class       = var.db_instance_class
  allocated_storage    = 100
  max_allocated_storage = 500

  db_name  = "cloudlabos"
  username = "cloudlabos"
  password = var.db_password

  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnets
  security_groups    = [aws_security_group.rds.id]

  backup_retention_period = var.environment == "production" ? 7 : 1
  deletion_protection     = var.environment == "production"

  tags = var.common_tags
}

# ============================================
# ElastiCache Redis
# ============================================

resource "aws_elasticache_subnet_group" "redis" {
  name       = "cloudlabos-${var.environment}-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "cloudlabos-${var.environment}"
  engine                    = "redis"
  engine_version            = "7.1"
  node_type                 = var.redis_node_type
  number_cache_clusters     = var.environment == "production" ? 2 : 1
  port                      = 6379
  at_rest_encryption        = true
  transit_encryption        = true
  auth_token_enabled         = true
  automatic_failover_enabled = var.environment == "production"

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  lifecycle {
    prevent_destroy = var.environment == "production"
  }

  tags = var.common_tags
}

# ============================================
# Secrets Manager
# ============================================

resource "aws_secretsmanager_secret" "cloudlabos" {
  name                    = "cloudlabos/${var.environment}/secrets"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

resource "aws_secretsmanager_secret_version" "cloudlabos" {
  secret_id = aws_secretsmanager_secret.cloudlabos.id

  secret_string = jsonencode({
    database-url      = "postgresql://cloudlabos:${var.db_password}@${module.rds.instance_endpoint}/cloudlabos"
    redis-url         = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
    jwt-secret        = var.jwt_secret
    encryption-key    = var.encryption_key
    openrouter-api-key = var.openrouter_api_key
  })
}

# ============================================
# Security Groups
# ============================================

resource "aws_security_group" "rds" {
  name        = "cloudlabos-${var.environment}-rds"
  description = "RDS security group for CloudLabOS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr]
  }

  tags = var.common_tags
}

resource "aws_security_group" "redis" {
  name        = "cloudlabos-${var.environment}-redis"
  description = "Redis security group for CloudLabOS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr]
  }

  tags = var.common_tags
}

# ============================================
# Outputs
# ============================================

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "database_endpoint" {
  value = module.rds.instance_endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}