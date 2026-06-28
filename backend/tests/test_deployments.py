"""
Tests for deployment endpoints:
  POST /projects/{id}/deployments
  GET  /projects/{id}/deployments
  GET  /deployments/{id}
  POST /deployments/{id}/stop
"""
import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio

PROJECT_PAYLOAD = {
    "name": "Deploy Test App",
    "repo_url": "https://github.com/example/deploy-test",
}


class TestCreateDeployment:
    async def _create_project(self, client: AsyncClient, auth_headers: dict) -> str:
        resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        assert resp.status_code == 201
        return resp.json()["id"]

    async def test_create_deployment_success(self, client: AsyncClient, auth_headers: dict):
        project_id = await self._create_project(client, auth_headers)
        response = await client.post(
            f"/projects/{project_id}/deployments",
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == project_id
        assert data["status"] == "pending"
        assert "id" in data
        assert "created_at" in data

    async def test_create_deployment_project_not_found(self, client: AsyncClient, auth_headers: dict):
        fake_id = "00000000-0000-0000-0000-000000000099"
        response = await client.post(
            f"/projects/{fake_id}/deployments",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_create_deployment_requires_auth(self, client: AsyncClient, auth_headers: dict):
        project_id = await self._create_project(client, auth_headers)
        response = await client.post(f"/projects/{project_id}/deployments")
        assert response.status_code == 403


class TestListDeployments:
    async def test_list_deployments(self, client: AsyncClient, auth_headers: dict):
        # Create project + deployment
        proj_resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        project_id = proj_resp.json()["id"]
        await client.post(f"/projects/{project_id}/deployments", headers=auth_headers)

        response = await client.get(f"/projects/{project_id}/deployments", headers=auth_headers)
        assert response.status_code == 200
        deployments = response.json()
        assert len(deployments) >= 1
        assert deployments[0]["project_id"] == project_id


class TestGetDeployment:
    async def test_get_deployment_success(self, client: AsyncClient, auth_headers: dict):
        proj_resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        project_id = proj_resp.json()["id"]
        dep_resp = await client.post(f"/projects/{project_id}/deployments", headers=auth_headers)
        deployment_id = dep_resp.json()["id"]

        response = await client.get(f"/deployments/{deployment_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == deployment_id

    async def test_get_deployment_not_found(self, client: AsyncClient, auth_headers: dict):
        fake_id = "00000000-0000-0000-0000-000000000088"
        response = await client.get(f"/deployments/{fake_id}", headers=auth_headers)
        assert response.status_code == 404


class TestStopDeployment:
    async def test_stop_deployment_success(self, client: AsyncClient, auth_headers: dict):
        proj_resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        project_id = proj_resp.json()["id"]
        dep_resp = await client.post(f"/projects/{project_id}/deployments", headers=auth_headers)
        deployment_id = dep_resp.json()["id"]

        stop_resp = await client.post(f"/deployments/{deployment_id}/stop", headers=auth_headers)
        assert stop_resp.status_code == 204

        # Verify status changed
        get_resp = await client.get(f"/deployments/{deployment_id}", headers=auth_headers)
        assert get_resp.json()["status"] == "stopped"
        assert get_resp.json()["finished_at"] is not None

    async def test_stop_already_stopped(self, client: AsyncClient, auth_headers: dict):
        proj_resp = await client.post("/projects", json=PROJECT_PAYLOAD, headers=auth_headers)
        project_id = proj_resp.json()["id"]
        dep_resp = await client.post(f"/projects/{project_id}/deployments", headers=auth_headers)
        deployment_id = dep_resp.json()["id"]

        # Stop once
        await client.post(f"/deployments/{deployment_id}/stop", headers=auth_headers)
        # Stop again → should fail
        stop_resp = await client.post(f"/deployments/{deployment_id}/stop", headers=auth_headers)
        assert stop_resp.status_code == 400
