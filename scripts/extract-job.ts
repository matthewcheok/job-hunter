import {
  DEFAULT_MODEL,
  DEFAULT_PROMPT_PATH,
  extractJobListing,
  extractJobListingFromUrl,
  getStringArg,
  parseArgs,
  writeJsonFile,
} from "./extraction-core";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = getStringArg(args, "input");
  const url = getStringArg(args, "url");
  const outputPath = getStringArg(args, "output");
  const model = getStringArg(args, "model", DEFAULT_MODEL);
  const promptPath = getStringArg(args, "prompt", DEFAULT_PROMPT_PATH);

  if (inputPath && url) {
    throw new Error("Use either --input or --url, not both.");
  }

  if (!inputPath && !url) {
    throw new Error(
      [
        "Usage:",
        "  npm run extract:job -- --input mocks/listing-1.md [--output extracted/listing-1.json]",
        "  npm run extract:job -- --url https://example.com/jobs/123 [--output extracted/listing-1.json]",
        "  npm run extract:job -- https://example.com/jobs/123",
      ].join("\n"),
    );
  }

  const extraction = inputPath
    ? await extractJobListing({
        inputPath,
        model,
        promptPath,
      })
    : await extractJobListingFromUrl({
        url: url!,
        model,
        promptPath,
      });

  if (outputPath) {
    await writeJsonFile(outputPath, extraction);
    console.log(`Wrote ${outputPath}`);
    return;
  }

  console.log(JSON.stringify(extraction, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
