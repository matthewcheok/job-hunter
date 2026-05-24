import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import {
  InvalidJobListingUrlError,
  JobExtractionProcessingError,
  isValidJobExtractionBearer,
  processJobExtractionUrl,
} from "@/lib/job-extraction-url";

export const runtime = "nodejs";

type JobExtractionRequestBody = {
  url?: unknown;
};

export async function POST(request: Request) {
  const secret = process.env.JOB_EXTRACTION_API_SECRET;

  if (!secret) {
    return jsonError("Job extraction API is not configured.", 503);
  }

  if (!isValidJobExtractionBearer(request.headers.get("authorization"), secret)) {
    return jsonError("Unauthorized.", 401);
  }

  let body: JobExtractionRequestBody;

  try {
    body = (await request.json()) as JobExtractionRequestBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return jsonError("Request body must include a url string.", 400);
  }

  let redis: Redis;

  try {
    redis = Redis.fromEnv();
  } catch {
    return jsonError("Redis cache is not configured.", 503);
  }

  try {
    const result = await processJobExtractionUrl({
      rawUrl: body.url,
      cache: redis,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidJobListingUrlError) {
      return jsonError("Request body must include a valid http or https URL.", 400);
    }

    if (error instanceof JobExtractionProcessingError) {
      return jsonError(error.message, 502);
    }

    const message = error instanceof Error ? error.message : "Extraction failed.";

    if (isRedisError(message)) {
      return jsonError("Redis cache is unavailable.", 503);
    }

    return jsonError(message, 502);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isRedisError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("upstash") ||
    normalized.includes("redis") ||
    normalized.includes("fetch failed")
  );
}
