import { mkdir, readFile, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_MODEL,
  type JobExtraction,
  extractJobListingFromMarkdown,
} from "../src/lib/job-extraction";
import {
  normalizeJobListingUrl,
  scrapeJobListingMarkdown,
} from "../src/lib/job-extraction-url";

export { DEFAULT_MODEL, type JobExtraction };
export const DEFAULT_PROMPT_PATH = "prompts/job-extraction.md";

export type ExtractJobOptions = {
  inputPath: string;
  promptPath?: string | URL;
  model?: string;
  apiKey?: string;
};

export type ExtractJobUrlOptions = {
  url: string;
  promptPath?: string | URL;
  model?: string;
  apiKey?: string;
};

export async function extractJobListing({
  inputPath,
  promptPath = DEFAULT_PROMPT_PATH,
  model = DEFAULT_MODEL,
  apiKey,
}: ExtractJobOptions): Promise<JobExtraction> {
  loadEnvFile(".env");

  const markdown = await readFile(inputPath, "utf8");

  return extractJobListingFromMarkdown(markdown, {
    apiKey,
    model,
    promptPath,
  });
}

export async function extractJobListingFromUrl({
  url,
  promptPath = DEFAULT_PROMPT_PATH,
  model = DEFAULT_MODEL,
  apiKey,
}: ExtractJobUrlOptions): Promise<JobExtraction> {
  loadEnvFile(".env");

  const scrapeResult = await scrapeJobListingMarkdown(normalizeJobListingUrl(url));

  return extractJobListingFromMarkdown(scrapeResult.markdown, {
    apiKey,
    model,
    promptPath,
  });
}

export async function writeJsonFile(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function parseArgs(argv: string[]) {
  const args = new Map<string, string | true>();
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }

    args.set(key, next);
    index += 1;
  }

  if (positional.length > 1) {
    throw new Error(`Unexpected arguments: ${positional.join(", ")}`);
  }

  if (positional.length === 1 && !args.has("url") && !args.has("input")) {
    args.set("url", positional[0]);
  }

  return args;
}

export function getStringArg(
  args: Map<string, string | true>,
  key: string,
  fallback?: string,
) {
  const value = args.get(key);

  if (value === true) {
    throw new Error(`--${key} requires a value.`);
  }

  return value ?? fallback;
}

export function loadEnvFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);

      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;

      if (process.env[key]) {
        continue;
      }

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      throw error;
    }
  }
}
