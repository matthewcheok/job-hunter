import { GoogleGenAI, type Part } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_MODEL } from "@/lib/job-extraction";

export const DEFAULT_COVER_LETTER_PROMPT_PATH = path.join(
  process.cwd(),
  "prompts",
  "cover-letter.md",
);

export type CoverLetterApplication = {
  position: string;
  company_name: string;
  job_listing_url?: string | null;
  notes?: string;
  about_role?: string;
  about_company?: string;
  responsibilities?: string;
  requirements?: string;
  cover_letter?: string;
};

export type CoverLetterResume =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "pdf";
      data: Buffer | Uint8Array | ArrayBuffer;
      mimeType?: string;
    };

export type CoverLetterMode = "generate" | "concise" | "detailed" | "custom";

export type GenerateCoverLetterOptions = {
  application: CoverLetterApplication;
  resume: CoverLetterResume;
  mode?: CoverLetterMode;
  instruction?: string;
  existingCoverLetter?: string;
  paragraphIndex?: number;
  prompt?: string;
  promptPath?: string | URL;
  model?: string;
  apiKey?: string;
};

export async function generateCoverLetter({
  application,
  resume,
  mode = "generate",
  instruction,
  existingCoverLetter,
  paragraphIndex,
  prompt,
  promptPath = DEFAULT_COVER_LETTER_PROMPT_PATH,
  model = DEFAULT_MODEL,
  apiKey,
}: GenerateCoverLetterOptions) {
  const key = apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!key) {
    throw new Error(
      "Set GEMINI_API_KEY in .env or the environment before generating cover letters.",
    );
  }

  const resolvedPrompt = prompt ?? (await readFile(promptPath, "utf8"));
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: buildCoverLetterParts({
          application,
          existingCoverLetter,
          instruction,
          mode,
          paragraphIndex,
          resolvedPrompt,
          resume,
        }),
      },
    ],
    config: {
      temperature: mode === "generate" ? 0.45 : 0.25,
    },
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty cover letter.");
  }

  return omitSignOff(stripCodeFence(text));
}

function buildCoverLetterParts({
  application,
  existingCoverLetter,
  instruction,
  mode,
  paragraphIndex,
  resolvedPrompt,
  resume,
}: {
  application: CoverLetterApplication;
  existingCoverLetter?: string;
  instruction?: string;
  mode: CoverLetterMode;
  paragraphIndex?: number;
  resolvedPrompt: string;
  resume: CoverLetterResume;
}): Part[] {
  const parts: Part[] = [
    {
      text: [
        resolvedPrompt.trim(),
        "",
        `<task>${getTask(mode, instruction, paragraphIndex)}</task>`,
        "",
        `<job_application_json>${JSON.stringify(normalizeApplication(application), null, 2)}</job_application_json>`,
        existingCoverLetter
          ? `\n<existing_cover_letter>\n${existingCoverLetter.trim()}\n</existing_cover_letter>`
          : "",
      ].join("\n"),
    },
  ];

  if (resume.kind === "pdf") {
    parts.push({
      inlineData: {
        data: toBase64(resume.data),
        mimeType: resume.mimeType ?? "application/pdf",
      },
    });
  } else {
    parts.push({
      text: `<resume_text>\n${resume.text.trim()}\n</resume_text>`,
    });
  }

  return parts;
}

function getTask(
  mode: CoverLetterMode,
  instruction: string | undefined,
  paragraphIndex: number | undefined,
) {
  if (paragraphIndex !== undefined) {
    return [
      `Revise paragraph ${paragraphIndex + 1} of the existing cover letter.`,
      instruction ? `Instruction: ${instruction}` : "",
      "Return the full cover letter with only that paragraph changed.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  switch (mode) {
    case "concise":
      return "Make the existing cover letter more concise while preserving the strongest role-specific evidence. Return only the revised cover letter.";
    case "detailed":
      return "Make the existing cover letter more detailed and specific while keeping it suitable for a job application. Return only the revised cover letter.";
    case "custom":
      return `Refine the existing cover letter using this instruction: ${instruction ?? "Improve the cover letter."} Return only the revised cover letter.`;
    case "generate":
    default:
      return "Generate a new cover letter for this application. Return only the cover letter.";
  }
}

function normalizeApplication(application: CoverLetterApplication) {
  return {
    position: application.position,
    company_name: application.company_name,
    job_listing_url: application.job_listing_url ?? "",
    notes: application.notes ?? "",
    about_role: application.about_role ?? "",
    about_company: application.about_company ?? "",
    responsibilities: application.responsibilities ?? "",
    requirements: application.requirements ?? "",
  };
}

function toBase64(data: Buffer | Uint8Array | ArrayBuffer) {
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("base64");
  }

  return Buffer.from(data).toString("base64");
}

function stripCodeFence(text: string) {
  const fenced = /^```(?:text|markdown)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

function omitSignOff(text: string) {
  const lines = text.split(/\r?\n/);
  const signOffIndex = lines.findIndex((line) =>
    /^(best|best regards|kind regards|regards|sincerely|thank you|thanks),?$/i.test(
      line.trim(),
    ),
  );

  if (signOffIndex === -1) {
    return text.trim();
  }

  return lines.slice(0, signOffIndex).join("\n").trim();
}
