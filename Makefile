.PHONY: help logs shell test lint migrate seed build-images proto k8s-deploy k8s-cleanup tf-init tf-plan tf-apply tf-destroy deploy-gcp

help:
	@echo "CloudLabOS Enterprise - Make Commands"
	@echo "====================================="
	@echo ""
	@echo "  Local Development:"
	@echo "    make dev                    - Start all services locally"
	@echo "    make logs service=<svc>     - Tail logs for a service"
	@echo "    make shell service=<svc>    - Open shell in container"
	@echo "    make test                   - Run all tests"
	@echo "    make lint                   - Run linting"
	@echo "    make migrate                - Run database migrations"
	@echo "    make seed                   - Seed test data"
	@echo "    make build-images           - Build Docker images"
	@echo ""
	@echo "  Kubernetes:"
	@echo "    make k8s-deploy ENV=<env>   - Deploy to Kubernetes"
	@echo "    make k8s-status             - Show K8s resource status"
	@echo "    make k8s-logs svc=<svc>     - Tail K8s pod logs"
	@echo "    make k8s-cleanup            - Remove all K8s resources"
	@echo ""
	@echo "  Terraform (GCP):"
	@echo "    make tf-init                - Initialize Terraform"
	@echo "    make tf-plan                - Plan infrastructure changes"
	@echo "    make tf-apply               - Apply infrastructure changes"
	@echo "    make tf-destroy             - Destroy infrastructure"
	@echo ""
	@echo "  Full Deploy:"
	@echo "    make deploy-gcp PROJECT=<id> ENV=<env> - Full GCP deploy"

logs:
	@docker compose logs -f $(service)

shell:
	@docker compose exec $(service) /bin/sh

test:
	@echo "Running tests..."
	@cd apps/api-gateway && python -m pytest tests/ -v 2>/dev/null || true
	@cd apps/browser-service && python -m pytest tests/ -v 2>/dev/null || true
	@cd apps/workflow-engine && python -m pytest tests/ -v 2>/dev/null || true
	@cd apps/agent-service && python -m pytest tests/ -v 2>/dev/null || true
	@cd apps/memory-service && python -m pytest tests/ -v 2>/dev/null || true

lint:
	@echo "Running linters..."
	@cd apps/web && npm run lint 2>/dev/null || true
	@cd apps/api-gateway && python -m ruff check . 2>/dev/null || true

migrate:
	@echo "Running migrations..."
	@docker compose exec postgres psql -U cloudlabos -d cloudlabos -f /docker-entrypoint-initdb.d/init.sql || true

seed:
	@echo "Seeding test data..."
	@docker compose exec api-gateway python -m scripts.seed 2>/dev/null || echo "Seed script not found"

build-images:
	@docker compose build --parallel

proto:
	@echo "Generating gRPC stubs..."
	@python -m grpc_tools.protoc -Ipackages/proto --python_out=packages/proto --grpc_python_out=packages/proto packages/proto/*.proto

# ============================================
# Kubernetes
# ============================================

k8s-deploy:
	@echo "Deploying to Kubernetes..."
	@chmod +x scripts/deploy.sh && ./scripts/deploy.sh $(ENV)

k8s-status:
	@echo "=== Pods ==="
	@kubectl get pods -n cloudlabos -o wide 2>/dev/null || true
	@echo ""
	@echo "=== Services ==="
	@kubectl get svc -n cloudlabos 2>/dev/null || true
	@echo ""
	@echo "=== Ingress ==="
	@kubectl get ingress -n cloudlabos 2>/dev/null || true
	@echo ""
	@echo "=== HPAs ==="
	@kubectl get hpa -n cloudlabos 2>/dev/null || true
	@echo ""
	@echo "=== Monitoring ==="
	@kubectl get pods -n cloudlabos-monitoring 2>/dev/null || true

k8s-logs:
	@kubectl logs -f -l app=$(svc) -n cloudlabos --all-containers=true

k8s-cleanup:
	@chmod +x scripts/cleanup.sh && ./scripts/cleanup.sh

# ============================================
# Terraform (GCP)
# ============================================

tf-init:
	@cd infrastructure/terraform/gcp && terraform init -upgrade

tf-plan:
	@cd infrastructure/terraform/gcp && terraform plan -out=tfplan

tf-apply:
	@cd infrastructure/terraform/gcp && terraform apply tfplan

tf-destroy:
	@cd infrastructure/terraform/gcp && terraform destroy

# ============================================
# Full Deploy
# ============================================

deploy-gcp:
	@chmod +x scripts/deploy-gcp.sh && ./scripts/deploy-gcp.sh $(PROJECT) $(ENV)

# ============================================
# Utility
# ============================================

clean:
	@docker compose down -v
	@rm -rf */node_modules */dist .next

dev:
	@docker compose up -d
	@echo "CloudLabOS running at http://localhost"
	@echo "Grafana at http://localhost:3001"
	@echo "Prometheus at http://localhost:9090"
