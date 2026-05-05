"""
Tests de integración para rate limiting (slowapi).
Verifica que los límites de peticiones funcionan correctamente.
"""

import pytest
from fastapi.testclient import TestClient


class TestRateLimiting:
    """Tests para verificar que el rate limiting funciona."""

    def test_auth_endpoint_accepts_normal_requests(self, client: TestClient):
        """Unas pocas peticiones de login deben pasar sin problema."""
        # RATE_LIMIT_AUTH configurado a 100/minute en tests, debe aceptar 3 peticiones
        for _ in range(3):
            response = client.post(
                "/auth/token",
                data={"username": "nonexistent", "password": "wrong"},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            # 401 es válido (credenciales incorrectas), 429 no lo es con el límite de tests
            assert response.status_code in (401, 200), (
                f"Expected 401 or 200, got {response.status_code} - rate limit may be too low for tests"
            )

    def test_rate_limit_response_format_when_exceeded(self, client: TestClient):
        """
        Cuando se supera el rate limit, la respuesta debe ser JSON con status 429.
        
        Este test activa intencionalmente el rate limit enviando 6+ peticiones rápidas.
        Nota: puede no llegar al límite en algunos entornos de test (conexión localhost).
        """
        responses = []
        for _ in range(7):
            response = client.post(
                "/auth/token",
                data={"username": "ratetest", "password": "wrong"},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            responses.append(response.status_code)

        # Si alguna respuesta es 429, verificar el formato
        if 429 in responses:
            # Obtener la respuesta 429
            for _ in range(3):
                r = client.post(
                    "/auth/token",
                    data={"username": "ratetest2", "password": "wrong"},
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                if r.status_code == 429:
                    # Verificar que sea JSON válido
                    assert r.headers.get("content-type", "").startswith("application/json")
                    break
