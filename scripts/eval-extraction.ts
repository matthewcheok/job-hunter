import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MODEL,
  DEFAULT_PROMPT_PATH,
  type JobExtraction,
  extractJobListing,
  getStringArg,
  parseArgs,
  writeJsonFile,
} from "./extraction-core";

type ProseField = Exclude<keyof JobExtraction, "position" | "company_name">;

type Fixture = {
  expected: JobExtraction;
  checks?: Partial<Record<ProseField, string[]>>;
  blocked_phrases?: string[];
};

type FieldScore = {
  field: keyof JobExtraction;
  passed: boolean;
  score: number;
  details: string[];
};

const proseFields: ProseField[] = [
  "about_role",
  "about_company",
  "responsibilities",
  "requirements",
  "notes",
];

const globalBlockedPhrases = [
  "related jobs",
  "latest tech jobs",
  "apply for this job",
  "244 results found",
  "first name",
  "last name",
  "phone",
  "country",
  "search all jobs",
  "back to top",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mocksDir = getStringArg(args, "mocks", "mocks")!;
  const fixturesDir = getStringArg(args, "fixtures", "eval/fixtures")!;
  const saveActualDir = getStringArg(args, "save-actual");
  const model = getStringArg(args, "model", DEFAULT_MODEL)!;
  const promptPath = getStringArg(args, "prompt", DEFAULT_PROMPT_PATH)!;
  const files = (await readdir(mocksDir))
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No markdown files found in ${mocksDir}.`);
  }

  let totalScore = 0;
  let totalPossible = 0;
  let failures = 0;

  for (const file of files) {
    const inputPath = path.join(mocksDir, file);
    const fixturePath = path.join(fixturesDir, file.replace(/\.md$/, ".json"));
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
    const actual = await extractJobListing({ inputPath, model, promptPath });
    const scores = scoreExtraction(actual, fixture);
    const suiteScore = scores.reduce((sum, score) => sum + score.score, 0);
    const suitePossible = scores.length;
    const suitePassed = scores.every((score) => score.passed);

    totalScore += suiteScore;
    totalPossible += suitePossible;

    if (!suitePassed) {
      failures += 1;
    }

    if (saveActualDir) {
      await writeJsonFile(
        path.join(saveActualDir, file.replace(/\.md$/, ".json")),
        actual,
      );
    }

    printSuiteResult(file, actual, fixture.expected, scores, suiteScore, suitePossible);
  }

  const percent = Math.round((totalScore / totalPossible) * 100);
  console.log(`\nOverall: ${totalScore.toFixed(2)} / ${totalPossible} (${percent}%)`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

function scoreExtraction(actual: JobExtraction, fixture: Fixture): FieldScore[] {
  const blockedPhrases = [...globalBlockedPhrases, ...(fixture.blocked_phrases ?? [])];

  return [
    scoreExactField("position", actual.position, fixture.expected.position),
    scoreExactField("company_name", actual.company_name, fixture.expected.company_name),
    ...proseFields.map((field) =>
      scoreProseField(
        field,
        actual[field],
        fixture.expected[field],
        fixture.checks?.[field] ?? [],
        blockedPhrases,
      ),
    ),
  ];
}

function scoreExactField(
  field: keyof JobExtraction,
  actual: string,
  expected: string,
): FieldScore {
  const passed = normalize(actual) === normalize(expected);

  return {
    field,
    passed,
    score: passed ? 1 : 0,
    details: passed ? [] : [`expected "${expected}", got "${actual}"`],
  };
}

function scoreProseField(
  field: ProseField,
  actual: string,
  expected: string,
  requiredPhrases: string[],
  blockedPhrases: string[],
): FieldScore {
  const details: string[] = [];
  let score = 0;
  const expectedPresent = expected.trim().length > 0;

  if (!expectedPresent && actual.trim().length > 0) {
    details.push("expected empty text");
  } else if (expectedPresent && actual.trim().length === 0) {
    details.push("expected non-empty text");
  } else {
    score += 0.35;
  }

  const normalizedActual = normalize(actual);
  const missingRequired = requiredPhrases.filter(
    (phrase) => !normalizedActual.includes(normalize(phrase)),
  );

  if (requiredPhrases.length > 0) {
    score += 0.45 * ((requiredPhrases.length - missingRequired.length) / requiredPhrases.length);
  } else {
    score += 0.45;
  }

  if (missingRequired.length > 0) {
    details.push(`missing required phrase(s): ${missingRequired.join(", ")}`);
  }

  const contamination = blockedPhrases.filter((phrase) =>
    normalizedActual.includes(normalize(phrase)),
  );

  if (contamination.length === 0) {
    score += 0.2;
  } else {
    details.push(`contains blocked phrase(s): ${contamination.join(", ")}`);
  }

  const roundedScore = Math.round(score * 100) / 100;

  return {
    field,
    passed: roundedScore >= 0.8,
    score: roundedScore,
    details,
  };
}

function printSuiteResult(
  file: string,
  actual: JobExtraction,
  expected: JobExtraction,
  scores: FieldScore[],
  suiteScore: number,
  suitePossible: number,
) {
  const status = scores.every((score) => score.passed) ? "PASS" : "FAIL";

  console.log(`\n${status} ${file}: ${suiteScore.toFixed(2)} / ${suitePossible}`);

  for (const score of scores) {
    const marker = score.passed ? "ok" : "!!";
    console.log(`  ${marker} ${score.field}: ${score.score.toFixed(2)}`);

    if (!score.passed) {
      for (const detail of score.details) {
        console.log(`     ${detail}`);
      }

      console.log(`     expected: ${preview(expected[score.field])}`);
      console.log(`     actual:   ${preview(actual[score.field])}`);
    }
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function preview(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
