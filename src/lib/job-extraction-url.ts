import { createHash } from "node:crypto";
import type { JobExtraction } from "./job-extraction";
import { extractJobListingFromMarkdown } from "./job-extraction";

export const DEFAULT_JOB_EXTRACTION_CACHE_TTL_SECONDS = 604800;

export type JobExtractionSource = {
  markdown_length: number;
  title?: string;
  status_code?: number;
};

export type JobExtractionCache = {
  hit: boolean;
  key: string;
  expires_in_seconds: number;
};

export type JobExtractionApiResponse = {
  url: string;
  cache: JobExtractionCache;
  source: JobExtractionSource;
  data: JobExtraction;
};

export type CachedJobExtraction = Omit<JobExtractionApiResponse, "cache"> & {
  cached_at: string;
};

export type JobExtractionCacheClient = {
  get<TData>(key: string): Promise<TData | null>;
  set<TData>(key: string, value: TData, options: { ex: number }): Promise<unknown>;
  ttl(key: string): Promise<number>;
};

export type FirecrawlScrapeResult = {
  markdown: string;
  title?: string;
  status_code?: number;
};

export type ProcessJobExtractionOptions = {
  rawUrl: string;
  cache: JobExtractionCacheClient;
  cacheTtlSeconds?: number;
  scrapeMarkdown?: (url: string) => Promise<FirecrawlScrapeResult>;
  extractMarkdown?: (markdown: string) => Promise<JobExtraction>;
};

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: unknown;
    metadata?: {
      title?: unknown;
      statusCode?: unknown;
    };
  };
  error?: unknown;
};

export class JobExtractionProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobExtractionProcessingError";
  }
}

export class InvalidJobListingUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidJobListingUrlError";
  }
}

export function isValidJobExtractionBearer(
  authorizationHeader: string | null,
  secret: string | undefined,
) {
  return Boolean(secret && authorizationHeader === `Bearer ${secret}`);
}

export function normalizeJobListingUrl(rawUrl: string) {
  const trimmedUrl = rawUrl.trim();
  let url: URL;

  try {
    url = new URL(trimmedUrl);
  } catch {
    throw new InvalidJobListingUrlError("URL must be a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidJobListingUrlError("URL must use http or https.");
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  return url.toString();
}

export function getJobExtractionCacheKey(normalizedUrl: string) {
  const digest = createHash("sha256").update(normalizedUrl).digest("hex");
  return `job-extraction:v1:${digest}`;
}

export function getJobExtractionCacheTtlSeconds() {
  const rawTtl = process.env.JOB_EXTRACTION_CACHE_TTL_SECONDS;

  if (!rawTtl) {
    return DEFAULT_JOB_EXTRACTION_CACHE_TTL_SECONDS;
  }

  const ttl = Number.parseInt(rawTtl, 10);

  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error("JOB_EXTRACTION_CACHE_TTL_SECONDS must be a positive integer.");
  }

  return ttl;
}

export async function processJobExtractionUrl({
  rawUrl,
  cache,
  cacheTtlSeconds = getJobExtractionCacheTtlSeconds(),
  scrapeMarkdown = scrapeJobListingMarkdown,
  extractMarkdown = extractJobListingFromMarkdown,
}: ProcessJobExtractionOptions): Promise<JobExtractionApiResponse> {
  const normalizedUrl = normalizeJobListingUrl(rawUrl);
  const cacheKey = getJobExtractionCacheKey(normalizedUrl);
  const cached = await cache.get<CachedJobExtraction>(cacheKey);

  if (cached) {
    const ttl = await cache.ttl(cacheKey);

    return {
      url: cached.url,
      source: cached.source,
      data: cached.data,
      cache: {
        hit: true,
        key: cacheKey,
        expires_in_seconds: ttl > 0 ? ttl : 0,
      },
    };
  }

  const scrapeResult = await scrapeMarkdown(normalizedUrl);
  const data = await extractMarkdown(scrapeResult.markdown);
  const responseValue: CachedJobExtraction = {
    url: normalizedUrl,
    source: {
      markdown_length: scrapeResult.markdown.length,
      ...(scrapeResult.title ? { title: scrapeResult.title } : {}),
      ...(scrapeResult.status_code ? { status_code: scrapeResult.status_code } : {}),
    },
    data,
    cached_at: new Date().toISOString(),
  };

  await cache.set(cacheKey, responseValue, { ex: cacheTtlSeconds });

  return {
    url: responseValue.url,
    source: responseValue.source,
    data: responseValue.data,
    cache: {
      hit: false,
      key: cacheKey,
      expires_in_seconds: cacheTtlSeconds,
    },
  };
}

export async function scrapeJobListingMarkdown(
  url: string,
): Promise<FirecrawlScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new JobExtractionProcessingError("Missing FIRECRAWL_API_KEY.");
  }

  let response: Response;

  try {
    response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
  } catch {
    throw new JobExtractionProcessingError("Firecrawl request failed.");
  }

  let payload: FirecrawlScrapeResponse;

  try {
    payload = (await response.json()) as FirecrawlScrapeResponse;
  } catch {
    throw new JobExtractionProcessingError(
      `Firecrawl returned non-JSON response with status ${response.status}.`,
    );
  }

  if (!response.ok || payload.success === false) {
    const detail = typeof payload.error === "string" ? `: ${payload.error}` : "";
    throw new JobExtractionProcessingError(
      `Firecrawl scrape failed with status ${response.status}${detail}`,
    );
  }

  const markdown = payload.data?.markdown;

  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    throw new JobExtractionProcessingError("Firecrawl response did not include markdown.");
  }

  const title = payload.data?.metadata?.title;
  const statusCode = payload.data?.metadata?.statusCode;

  return {
    markdown,
    ...(typeof title === "string" && title ? { title } : {}),
    ...(typeof statusCode === "number" ? { status_code: statusCode } : {}),
  };
}
