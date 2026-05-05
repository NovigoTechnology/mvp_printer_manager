"""
Tests de integración para endpoints core de la API.
Cubre: health checks, autenticación, rate limiting y endpoints básicos.
"""

import pytest
from fastapi.testclient import TestClient


# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

class TestHealthEndpoints:
    """Tests para endpoints de health check."""

    def test_basic_health_returns_200(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200

    def test_basic_health_returns_healthy_status(self, client: TestClient):
        data = client.get("/health").json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

    def test_detailed_health_returns_200(self, client: TestClient):
        response = client.get("/health/detailed")
        assert response.status_code == 200

    def test_detailed_health_structure(self, client: TestClient):
        data = client.get("/health/detailed").json()
        assert "status" in data
        assert "timestamp" in data
        assert "version" in data
        assert "services" in data

    def test_detailed_health_has_service_checks(self, client: TestClient):
        services = client.get("/health/detailed").json()["services"]
        assert "database" in services
        assert "redis" in services
        assert "scheduler" in services

    def test_detailed_health_database_connected(self, client: TestClient):
        services = client.get("/health/detailed").json()["services"]
        assert services["database"]["status"] == "connected"

    def test_detailed_health_scheduler_running(self, client: TestClient):
        services = client.get("/health/detailed").json()["services"]
        assert services["scheduler"]["status"] == "running"
        assert isinstance(services["scheduler"]["job_count"], int)

    def test_root_endpoint(self, client: TestClient):
        data = client.get("/").json()
        assert "message" in data
        assert "version" in data


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

class TestAuthEndpoints:
    """Tests para flujo de autenticación JWT."""

    def test_login_with_valid_credentials(self, client: TestClient, test_user):
        response = client.post(
            "/auth/token",
            data={"username": "testuser", "password": "testpassword123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200

    def test_login_returns_access_token(self, client: TestClient, test_user):
        response = client.post(
            "/auth/token",
            data={"username": "testuser", "password": "testpassword123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"

    def test_login_with_invalid_password_returns_401(self, client: TestClient, test_user):
        response = client.post(
            "/auth/token",
            data={"username": "testuser", "password": "wrongpassword"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 401

    def test_login_with_nonexistent_user_returns_401(self, client: TestClient):
        response = client.post(
            "/auth/token",
            data={"username": "noexiste", "password": "whatever"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 401

    def test_login_error_does_not_leak_user_info(self, client: TestClient):
        """Verifica que el error no revela si el usuario existe o no."""
        response = client.post(
            "/auth/token",
            data={"username": "noexiste", "password": "wrongpass"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        # El mensaje debe ser genérico, no revelar "usuario no encontrado" vs "contraseña incorrecta"
        error_detail = response.json().get("detail", "")
        assert "not found" not in error_detail.lower()
        assert "does not exist" not in error_detail.lower()

    def test_get_current_user_with_valid_token(self, client: TestClient, auth_headers):
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200

    def test_get_current_user_without_token_returns_401(self, client: TestClient):
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_get_current_user_with_invalid_token_returns_401(self, client: TestClient):
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert response.status_code == 401

    def test_authenticated_user_data(self, client: TestClient, auth_headers, test_user):
        data = client.get("/auth/me", headers=auth_headers).json()
        assert data["username"] == "testuser"
        assert "hashed_password" not in data  # No exponer contraseña hasheada


# ============================================================================
# PROTECTED ENDPOINTS - ACCESS CONTROL
# ============================================================================

class TestAccessControl:
    """Tests para verificar que endpoints protegidos requieren autenticación."""

    # Endpoints que sí requieren autenticación en esta aplicación
    PROTECTED_ENDPOINTS = [
        ("GET", "/auth/me"),
        ("GET", "/auth/users"),
    ]

    @pytest.mark.parametrize("method,endpoint", PROTECTED_ENDPOINTS)
    def test_protected_endpoint_requires_auth(self, client: TestClient, method, endpoint):
        """Endpoints protegidos deben devolver 401 sin token."""
        response = getattr(client, method.lower())(endpoint)
        assert response.status_code == 401, (
            f"{method} {endpoint} should return 401 without token, got {response.status_code}"
        )

    def test_printers_list_with_auth(self, client: TestClient, auth_headers):
        response = client.get("/printers", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_incidents_list_with_auth(self, client: TestClient, auth_headers):
        response = client.get("/incidents", headers=auth_headers)
        assert response.status_code == 200


# ============================================================================
# PROMETHEUS METRICS
# ============================================================================

class TestPrometheusMetrics:
    """Tests para verificar que el endpoint de métricas Prometheus funciona."""

    def test_metrics_endpoint_returns_200(self, client: TestClient):
        response = client.get("/metrics")
        assert response.status_code == 200

    def test_metrics_content_type_is_prometheus(self, client: TestClient):
        response = client.get("/metrics")
        assert "text/plain" in response.headers.get("content-type", "")

    def test_metrics_contains_http_requests(self, client: TestClient):
        # Hacer una petición para generar métricas
        client.get("/health")
        response = client.get("/metrics")
        # Prometheus incluye métricas de peticiones HTTP
        assert "http_requests" in response.text or "http_request" in response.text


# ============================================================================
# API RESPONSE FORMAT
# ============================================================================

class TestAPIResponseFormat:
    """Tests para verificar el formato de respuestas de la API."""

    def test_health_response_is_json(self, client: TestClient):
        response = client.get("/health")
        assert response.headers["content-type"].startswith("application/json")

    def test_404_returns_json(self, client: TestClient):
        response = client.get("/endpoint-que-no-existe")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_401_returns_json_detail(self, client: TestClient):
        # auth/me requiere token
        response = client.get("/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
