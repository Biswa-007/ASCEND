"""
Tests for authentication endpoints:
  POST /auth/register
  POST /auth/login
  GET  /auth/me
"""
import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        response = await client.post("/auth/register", json={
            "email": "newuser@example.com",
            "password": "password123",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert "id" in data
        assert "created_at" in data
        assert "password_hash" not in data  # Never expose hash

    async def test_register_duplicate_email(self, client: AsyncClient, registered_user: dict):
        response = await client.post("/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
        })
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"].lower()

    async def test_register_invalid_email(self, client: AsyncClient):
        response = await client.post("/auth/register", json={
            "email": "not-an-email",
            "password": "password123",
        })
        assert response.status_code == 422

    async def test_register_short_password(self, client: AsyncClient):
        response = await client.post("/auth/register", json={
            "email": "short@example.com",
            "password": "abc",
        })
        assert response.status_code == 422

    async def test_register_missing_fields(self, client: AsyncClient):
        response = await client.post("/auth/register", json={"email": "a@b.com"})
        assert response.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient, registered_user: dict):
        response = await client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "securepassword123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, registered_user: dict):
        response = await client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword",
        })
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        response = await client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "password123",
        })
        assert response.status_code == 401


class TestGetMe:
    async def test_get_me_success(self, client: AsyncClient, registered_user: dict, auth_headers: dict):
        response = await client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    async def test_get_me_no_token(self, client: AsyncClient):
        response = await client.get("/auth/me")
        assert response.status_code == 403  # HTTPBearer returns 403 for missing credentials

    async def test_get_me_invalid_token(self, client: AsyncClient):
        response = await client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert response.status_code == 401
