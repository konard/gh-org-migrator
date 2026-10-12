// Preloaded only by offline CLI tests; no requests reach the GitFlic service.
import assert from "node:assert/strict";
import fs from "node:fs";
import axios from "axios";

const requests = [];
const projects = new Map();
const scenario = process.env.GITFLIC_TEST_SCENARIO;
const originalSetTimeout = globalThis.setTimeout;

// Skip the CLI's production throttling while retaining other timer behavior.
globalThis.setTimeout = (callback, delay, ...args) =>
  originalSetTimeout(callback, [3000, 30000, 60000].includes(delay) ? 0 : delay, ...args);

axios.defaults.adapter = async (config) => {
  assert.equal(config.headers.get("Authorization"), "token fixture-access-token");
  const payload = config.data ? JSON.parse(config.data) : undefined;
  requests.push({ method: config.method, url: config.url, ...(payload && { payload }) });
  fs.writeFileSync(process.env.GITFLIC_TEST_REQUESTS, JSON.stringify(requests));

  const respond = (status, data) => {
    const response = { status, data, statusText: String(status), config, headers: {} };
    if (!config.validateStatus(status)) {
      const error = new axios.AxiosError(
        `Request failed with status code ${status}`,
        axios.AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response,
      );
      if (scenario === "response-only-404" && status === 404) delete error.status;
      throw error;
    }
    return response;
  };

  if (scenario === "network-error") {
    throw new axios.AxiosError("Fixture network failure", axios.AxiosError.ERR_NETWORK, config);
  }

  if (config.method === "get") {
    assert.ok(config.url.startsWith("https://api.gitflic.ru/project/link-foundation/"));
    if (scenario === "lookup-forbidden") {
      return respond(403, { detail: "Fixture access denied" });
    }
    if (scenario === "existing") {
      return respond(200, { alias: process.env.GITFLIC_TEST_EXISTING_ALIAS });
    }
    const alias = config.url.split("/").at(-1);
    if (projects.has(alias)) return respond(200, projects.get(alias));
    return respond(404, { detail: "Project not found" });
  }

  assert.equal(config.method, "post");
  assert.equal(config.url, "https://api.gitflic.ru/project");
  // GitFlic's documented name/alias character set, not a live server replica:
  // https://docs.gitflic.ru/latest/en/project/project_create/
  const validName = /^[a-zа-яё0-9_-]+$/i;
  if (!validName.test(payload.title) || !validName.test(payload.alias)) {
    return respond(422, { detail: "Title and alias contain unsupported characters" });
  }
  if (scenario === "creation-validation") {
    return respond(422, { detail: "Fixture validation failure", field: "ownerAlias" });
  }
  const project = { ...payload, id: `fixture-project-${projects.size}` };
  projects.set(payload.alias, project);
  return respond(200, project);
};
