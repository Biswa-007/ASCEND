"""
Tests for project endpoints:
  GET    /projects
  POST   /projects
  GET    /projects/{id}
  PATCH  /projects/{id}
  DELETE /projects/{id}
"""
import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio

PROJECT_PAYLOAD = {
    "name": "My Test App",
    "repo_url": "https://github.com/example/my-test-app",
}


class TestCreateProject:
    async def test_create_project_success(self, client: AsyncClient, auth_headers: dict):
        response = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Test App"
        assert data["repo_url"] == "https://github.com/example/my-test-app"
        assert "id" in data
        assert "user_id" in data

    async def test_create_project_non_github_url(self, client: AsyncClient, auth_headers: dict):
        response = await client.post("/projects", json={
            "name": "My App",
            "repo_url": "https://gitlab.com/user/repo",
        }, headers=auth_headers)
        assert response.status_code == 422

    async def test_create_project_requires_auth(self, client: AsyncClient):
        response = await client.post("/projects", json=PROJECT_PAYLOAD)
        assert response.status_code == 403


class TestListProjects:
    async def test_list_projects_empty(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/projects", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_list_projects_with_data(self, client: AsyncClient, auth_headers: dict):
        # Create a project first
        await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        response = await client.get("/projects", headers=auth_headers)
        assert response.status_code == 200
        projects = response.json()
        assert len(projects) >= 1

    async def test_list_projects_requires_auth(self, client: AsyncClient):
        response = await client.get("/projects")
        assert response.status_code == 403


class TestGetProject:
    async def test_get_project_success(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        project_id = create_resp.json()["id"]

        response = await client.get(f"/projects/{project_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == project_id

    async def test_get_project_not_found(self, client: AsyncClient, auth_headers: dict):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(f"/projects/{fake_id}", headers=auth_headers)
        assert response.status_code == 404


class TestUpdateProject:
    async def test_update_project_name(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        project_id = create_resp.json()["id"]

        response = await client.patch(
            f"/projects/{project_id}",
            json={"name": "Updated Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"


class TestDeleteProject:
    async def test_delete_project_success(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        project_id = create_resp.json()["id"]

        response = await client.delete(f"/projects/{project_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify gone
        get_resp = await client.get(f"/projects/{project_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    async def test_delete_project_not_found(self, client: AsyncClient, auth_headers: dict):
        fake_id = "00000000-0000-0000-0000-000000000001"
        response = await client.delete(f"/projects/{fake_id}", headers=auth_headers)
        assert response.status_code == 404
