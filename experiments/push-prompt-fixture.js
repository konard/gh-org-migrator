// Only offline CLI tests preload this fixture. Real Git commands still run.
import fs from "node:fs";
import inquirer from "inquirer";

const answers = JSON.parse(process.env.PUSH_TEST_ANSWERS || "[]");
inquirer.prompt = async ([question]) => {
  if (!answers.length) throw new Error(`Unexpected prompt: ${question.message}`);
  const answer = answers.shift();
  fs.appendFileSync(process.env.PUSH_TEST_PROMPTS, `${JSON.stringify({ question, answer })}\n`);
  return { [question.name]: answer };
};
