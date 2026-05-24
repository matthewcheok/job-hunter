import assert from "node:assert/strict";
import type { JobExtraction } from "../src/lib/job-extraction";
import {
  JobExtractionProcessingError,
  type CachedJobExtraction,
  type JobExtractionCacheClient,
  getJobExtractionCacheKey,
  isValidJobExtractionBearer,
  normalizeJobListingUrl,
  processJobExtractionUrl,
  scrapeJobListingMarkdown,
} from "../src/lib/job-extraction-url";

const sampleExtraction: JobExtraction = {
  position: "Engineering Manager",
  company_name: "Example Co",
  about_role: "Lead the engineering team.",
  about_company: "Example Co builds useful software.",
  responsibilities: "Coach engineers and deliver projects.",
  requirements: "Engineering management experience.",
  notes: "Remote; salary not listed.",
};

class FakeCache implements JobExtractionCacheClient {
  getCalls = 0;
  setCalls = 0;
  ttlCalls = 0;
  lastSet:
    | {
        key: string;
        value: unknown;
        options: { ex: number };
      }
    | undefined;

  constructor(
    private readonly storedValue: CachedJobExtraction | null = null,
    private readonly ttlValue = 604800,
  ) {}

  async get<TData>() {
    this.getCalls += 1;
    return this.storedValue as TData | null;
  }

  async set<TData>(key: string, value: TData, options: { ex: number }) {
    this.setCalls += 1;
    this.lastSet = { key, value, options };
    return "OK";
  }

  async ttl() {
    this.ttlCalls += 1;
    return this.ttlValue;
  }
}

async function testUrlNormalization() {
  assert.equal(
    normalizeJobListingUrl(" HTTPS://Example.com:443/jobs/123#apply "),
    "https://example.com/jobs/123",
  );

  assert.throws(() => normalizeJobListingUrl("ftp://example.com/job"));
  assert.throws(() => normalizeJobListingUrl("not a url"));
}

async function testBearerAuth() {
  assert.equal(isValidJobExtractionBearer("Bearer secret", "secret"), true);
  assert.equal(isValidJobExtractionBearer("Bearer nope", "secret"), false);
  assert.equal(isValidJobExtractionBearer(null, "secret"), false);
  assert.equal(isValidJobExtractionBearer("Bearer secret", undefined), false);
}

async function testCacheHitSkipsPaidWork() {
  const normalizedUrl = "https://example.com/jobs/123";
  const cacheKey = getJobExtractionCacheKey(normalizedUrl);
  const cache = new FakeCache(
    {
      url: normalizedUrl,
      source: { markdown_length: 42, title: "Example role", status_code: 200 },
      data: sampleExtraction,
      cached_at: "2026-05-24T00:00:00.000Z",
    },
    123,
  );
  const result = await processJobExtractionUrl({
    rawUrl: `${normalizedUrl}#apply`,
    cache,
    scrapeMarkdown: async () => {
      throw new Error("scrape should not be called on cache hit");
    },
    extractMarkdown: async () => {
      throw new Error("extract should not be called on cache hit");
    },
  });

  assert.equal(result.cache.hit, true);
  assert.equal(result.cache.key, cacheKey);
  assert.equal(result.cache.expires_in_seconds, 123);
  assert.equal(cache.getCalls, 1);
  assert.equal(cache.ttlCalls, 1);
  assert.equal(cache.setCalls, 0);
  assert.deepEqual(result.data, sampleExtraction);
  assert.equal("cached_at" in result, false);
}

async function testCacheMissStoresExtraction() {
  const cache = new FakeCache(null);
  let scrapedUrl = "";
  let extractedMarkdown = "";
  const result = await processJobExtractionUrl({
    rawUrl: "https://Example.com/jobs/456#details",
    cache,
    cacheTtlSeconds: 99,
    scrapeMarkdown: async (url) => {
      scrapedUrl = url;
      return {
        markdown: "# Engineering Manager\n\nLead the team.",
        title: "Engineering Manager",
        status_code: 200,
      };
    },
    extractMarkdown: async (markdown) => {
      extractedMarkdown = markdown;
      return sampleExtraction;
    },
  });

  assert.equal(scrapedUrl, "https://example.com/jobs/456");
  assert.equal(extractedMarkdown, "# Engineering Manager\n\nLead the team.");
  assert.equal(result.cache.hit, false);
  assert.equal(result.cache.expires_in_seconds, 99);
  assert.equal(result.source.markdown_length, 37);
  assert.equal(result.source.title, "Engineering Manager");
  assert.equal(result.source.status_code, 200);
  assert.equal(cache.setCalls, 1);
  assert.equal(cache.lastSet?.options.ex, 99);
}

async function testFirecrawlWithoutMarkdownFails() {
  const originalApiKey = process.env.FIRECRAWL_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    () => scrapeJobListingMarkdown("https://example.com/jobs/123"),
    JobExtractionProcessingError,
  );

  globalThis.fetch = originalFetch;

  if (originalApiKey === undefined) {
    delete process.env.FIRECRAWL_API_KEY;
  } else {
    process.env.FIRECRAWL_API_KEY = originalApiKey;
  }
}

async function main() {
  await testUrlNormalization();
  await testBearerAuth();
  await testCacheHitSkipsPaidWork();
  await testCacheMissStoresExtraction();
  await testFirecrawlWithoutMarkdownFails();
  console.log("Job extraction API checks passed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
