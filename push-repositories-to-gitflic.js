#!/usr/bin/env node

import axios from "axios";
import path from "path";
import { config } from "dotenv";
import { gitFlicifyRepositoryName, readJSON, sleep } from "./lib.js";

config();

const { GITFLIC_ACCESS_TOKEN, SOURCE_ORGANIZATION, TARGET_ORGANIZATION } = process.env;

if (!GITFLIC_ACCESS_TOKEN || !SOURCE_ORGANIZATION || !TARGET_ORGANIZATION) {
  console.error(
    "GITFLIC_ACCESS_TOKEN, SOURCE_ORGANIZATION, and TARGET_ORGANIZATION must be set in the .env file.",
  );
  process.exit(1);
}

const GITFLIC_API_URL = "https://api.gitflic.ru";

const INPUT_DIR = path.join(process.cwd(), "data", SOURCE_ORGANIZATION);

const defaultIntervalMs = 60000;
const checkRepositoryIntervalMs = 3000;

async function repositoryExists(repositoryName) {
  const updatedName = gitFlicifyRepositoryName(repositoryName);
  try {
    const response = await axios.get(
      `${GITFLIC_API_URL}/project/${TARGET_ORGANIZATION}/${updatedName}`,
      {
        headers: { Authorization: `token ${GITFLIC_ACCESS_TOKEN}` },
      }
    );
    await sleep(checkRepositoryIntervalMs);
    const repository = response.data;
    return repository.alias === updatedName;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false;
    } else {
      console.error(
        `Error checking repository ${updatedName}: ${error.message}`,
      );
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      process.exit(1);
    }
  }
}

async function createRepository(repo) {
  const updatedName = gitFlicifyRepositoryName(repo.name);
  const payload = {
    ownerAlias: TARGET_ORGANIZATION,
    ownerAliasType: "COMPANY",
    title: updatedName,
    alias: updatedName,
    isPrivate: repo.private,
    description: repo.description,
    language: repo.language,
  };
  try {
    console.log(
      `Creating repository ${updatedName} in organization ${TARGET_ORGANIZATION} on GitFlic...`,
    );
    if (process.env.GITFLIC_DEBUG === "1") {
      console.error("Request Payload:");
      console.error(JSON.stringify(payload, null, 2));
    }
    const response = await axios.post(
      `${GITFLIC_API_URL}/project`,
      payload,
      {
        headers: {
          Authorization: `token ${GITFLIC_ACCESS_TOKEN}`,
        },
      }
    );
    console.log(`Repository ${updatedName} in organization ${TARGET_ORGANIZATION} on GitFlic is created.`);
    await sleep(defaultIntervalMs);
    return response.data;
  } catch (error) {
    console.error(`Error creating repository ${updatedName}: ${error.message}`);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }

    process.exit(1);
  }
}

async function main() {
  try {
    const repoFilePath = path.join(INPUT_DIR, "org.repos.json");
    const repos = readJSON(repoFilePath);
    for (const repo of repos) {
      const repositoryName = repo.name;
      const exists = await repositoryExists(repositoryName);
      if (!exists) {
        await createRepository(repo);
      } else {
        console.log(
          `Repository ${repositoryName} already exists on GitFlic. Skipping creation.`,
        );
      }
    }
    console.log(
      `Repositories creation completed. All repositories are created in the ${TARGET_ORGANIZATION} organization on GitFlic.`,
    );
  } catch (error) {
    console.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();
