import fs from "fs";

export const readJSON = (filePath) => {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } else {
    throw new Error(`File not found: ${filePath}`);
  }
};

export const sleep = async (ms) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

export const gitFlicifyRepositoryName = (repositoryName) => {
  // Preserve valid characters, including digits and existing hyphens. Collapsing
  // or trimming hyphens can silently merge distinct source repositories.
  const cleanName = repositoryName.replaceAll(/[^a-zа-я0-9_-]/gi, "-");
  return cleanName || "unnamed-repo";
};
