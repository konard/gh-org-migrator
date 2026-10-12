#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Syntax checking needs neither credentials nor execution of the migration CLI.
execFileSync(process.execPath, [
  "--check", fileURLToPath(new URL("../push-code-commits.js", import.meta.url)),
], { stdio: "inherit" });
console.log("push-code-commits.js syntax check passed. Run npm test to verify behavior.");
