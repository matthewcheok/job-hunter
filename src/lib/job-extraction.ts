import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_PROMPT_PATH = path.join(
  process.cwd(),
  "prompts",
  "job-extraction.md",
);

export type JobExtraction = {
  position: string;
  company_name: string;
  about_role: string;
  about_company: string;
  responsibilities: string;
  requirements: string;
  notes: string;
};

export type ExtractJobMarkdownOptions = {
  prompt?: string;
  promptPath?: string | URL;
  model?: string;
  apiKey?: string;
};

export const jobExtractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    position: {
      type: "string",
      description: "Primary job title for the listing.",
    },
    company_name: {
      type: "string",
      description: "Company hiring for the primary job listing.",
    },
    about_role: {
      type: "string",
      description: "Role summary or job description for the primary job.",
    },
    about_company: {
      type: "string",
      description:
        "Company background, mission, product, market, team, or funding information.",
    },
    responsibilities: {
      type: "string",
      description:
        "Responsibilities, ownership areas, day-to-day duties, and expected outcomes. Prefer markdown bullets with one responsibility per line.",
    },
    requirements: {
      type: "string",
      description:
        "Required and preferred qualifications, experience, skills, tools, and languages. Prefer markdown bullets with one requirement per line.",
    },
    notes: {
      type: "string",
      description:
        "Compact miscellaneous facts such as location, remote policy, salary, benefits, employment type, hours, visa support, caveats, and uncertainty.",
    },
  },
  required: [
    "position",
    "company_name",
    "about_role",
    "about_company",
    "responsibilities",
    "requirements",
    "notes",
  ],
} as const;

const extractionFields = [
  "position",
  "company_name",
  "about_role",
  "about_company",
  "responsibilities",
  "requirements",
  "notes",
] as const;

export async function extractJobListingFromMarkdown(
  markdown: string,
  {
    prompt,
    promptPath = DEFAULT_PROMPT_PATH,
    model = DEFAULT_MODEL,
    apiKey,
  }: ExtractJobMarkdownOptions = {},
): Promise<JobExtraction> {
  const key = apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!key) {
    throw new Error(
      "Set GEMINI_API_KEY in .env or the environment before running extraction.",
    );
  }

  const resolvedPrompt = prompt ?? (await readFile(promptPath, "utf8"));
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${resolvedPrompt.trim()}\n\n<job_listing_markdown>\n${markdown}\n</job_listing_markdown>`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: jobExtractionSchema,
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return normalizeExtraction(parseExtractionJson(text));
}

export function parseExtractionJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);

    if (fenced) {
      return JSON.parse(fenced[1]);
    }

    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 240)}`);
  }
}

export function normalizeExtraction(value: unknown): JobExtraction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Extraction response must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const normalized = {} as JobExtraction;

  for (const field of extractionFields) {
    const rawValue = record[field];

    if (typeof rawValue !== "string") {
      throw new Error(`Extraction field "${field}" must be a string.`);
    }

    normalized[field] = rawValue.trim();
  }

  return normalized;
}
