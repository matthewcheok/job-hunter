import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_COVER_LETTER_PROMPT_PATH,
  type CoverLetterApplication,
  type CoverLetterMode,
  type CoverLetterResume,
  generateCoverLetter,
} from "../src/lib/cover-letter";
import { DEFAULT_MODEL } from "../src/lib/job-extraction";
import {
  getStringArg,
  loadEnvFile,
  parseArgs,
} from "./extraction-core";

async function main() {
  loadEnvFile(".env");

  const args = parseArgs(process.argv.slice(2));
  const model = getStringArg(args, "model", DEFAULT_MODEL);
  const promptPath = getStringArg(args, "prompt", DEFAULT_COVER_LETTER_PROMPT_PATH);
  const outputPath = getStringArg(args, "output");
  const mode = parseMode(getStringArg(args, "mode", "generate"));
  const instruction = getStringArg(args, "instruction");
  const existingCoverLetter = getStringArg(args, "existing-cover-letter");
  const paragraphIndex = parseParagraphIndex(getStringArg(args, "paragraph-index"));
  const application = await getApplication(args);
  const resume = await getResume(args);

  const coverLetter = await generateCoverLetter({
    application,
    existingCoverLetter: existingCoverLetter ?? application.cover_letter,
    instruction,
    mode,
    model,
    paragraphIndex,
    promptPath,
    resume,
  });

  if (outputPath) {
    await writeFile(outputPath, `${coverLetter}\n`, "utf8");
    console.log(`Wrote ${outputPath}`);
    return;
  }

  console.log(coverLetter);
}

async function getApplication(args: Map<string, string | true>) {
  const inlineApplication = getStringArg(args, "application");
  const applicationFile = getStringArg(args, "application-file");

  if (inlineApplication && applicationFile) {
    throw new Error("Use either --application or --application-file, not both.");
  }

  if (!inlineApplication && !applicationFile) {
    throw new Error(getUsage());
  }

  const rawJson = inlineApplication ?? (await readFile(applicationFile!, "utf8"));
  const parsed = parseJson(rawJson);

  return normalizeApplication(parsed);
}

async function getResume(args: Map<string, string | true>): Promise<CoverLetterResume> {
  const resumePdfPath = getStringArg(args, "resume-pdf");
  const resumeTextPath = getStringArg(args, "resume-text");
  const inlineResume = getStringArg(args, "resume");
  const provided = [resumePdfPath, resumeTextPath, inlineResume].filter(Boolean);

  if (provided.length !== 1) {
    throw new Error("Use exactly one of --resume-pdf, --resume-text, or --resume.");
  }

  if (resumePdfPath) {
    return {
      kind: "pdf",
      data: await readFile(resumePdfPath),
      mimeType: "application/pdf",
    };
  }

  return {
    kind: "text",
    text: inlineResume ?? (await readFile(resumeTextPath!, "utf8")),
  };
}

function normalizeApplication(value: unknown): CoverLetterApplication {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Application must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const position = getRequiredJsonString(record, "position");
  const companyName = getRequiredJsonString(record, "company_name");

  return {
    position,
    company_name: companyName,
    job_listing_url: getOptionalJsonString(record, "job_listing_url"),
    notes: getOptionalJsonString(record, "notes"),
    about_role: getOptionalJsonString(record, "about_role"),
    about_company: getOptionalJsonString(record, "about_company"),
    responsibilities: getOptionalJsonString(record, "responsibilities"),
    requirements: getOptionalJsonString(record, "requirements"),
    cover_letter: getOptionalJsonString(record, "cover_letter"),
  };
}

function getRequiredJsonString(record: Record<string, unknown>, key: string) {
  const value = getOptionalJsonString(record, key);

  if (!value) {
    throw new Error(`Application JSON must include "${key}".`);
  }

  return value;
}

function getOptionalJsonString(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Application field "${key}" must be a string.`);
  }

  return value.trim();
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Application JSON could not be parsed: ${message}`);
  }
}

function parseMode(value: string | undefined): CoverLetterMode {
  if (
    value === "generate" ||
    value === "concise" ||
    value === "detailed" ||
    value === "custom"
  ) {
    return value;
  }

  throw new Error("--mode must be generate, concise, detailed, or custom.");
}

function parseParagraphIndex(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const index = Number(value);

  if (!Number.isInteger(index) || index < 0) {
    throw new Error("--paragraph-index must be a zero-based positive integer.");
  }

  return index;
}

function getUsage() {
  return [
    "Usage:",
    "  npm run generate:cover-letter -- --resume-pdf resume.pdf --application-file application.json",
    "  npm run generate:cover-letter -- --resume-text resume.txt --application '{\"position\":\"Engineering Manager\",\"company_name\":\"Example Co\"}'",
    "  npm run generate:cover-letter -- --resume \"Resume text\" --application '{\"position\":\"Engineering Manager\",\"company_name\":\"Example Co\"}'",
    "",
    "Options:",
    "  --mode generate|concise|detailed|custom",
    "  --instruction \"Make it warmer\"",
    "  --existing-cover-letter \"...\"",
    "  --paragraph-index 0",
    `  --prompt ${path.relative(process.cwd(), DEFAULT_COVER_LETTER_PROMPT_PATH)}`,
    "  --output cover-letter.txt",
  ].join("\n");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
