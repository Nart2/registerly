/**
 * Cloudflare R2 Upload Service
 *
 * Provides file upload, deletion, and URL generation for Cloudflare R2
 * using the S3-compatible API via fetch (no external SDK dependency).
 */

import crypto from "crypto";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface R2Config {
  accountId: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  publicUrl: string;
}

function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY;
  const secretKey = process.env.R2_SECRET_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKey || !secretKey || !bucketName || !publicUrl) {
    return null;
  }

  return { accountId, accessKey, secretKey, bucketName, publicUrl };
}

function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const ext = originalFilename.includes(".")
    ? originalFilename.slice(originalFilename.lastIndexOf("."))
    : "";
  return `${timestamp}-${random}${ext}`;
}

/**
 * Sign a request for Cloudflare R2 using AWS Signature V4.
 */
function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Buffer | null,
  config: R2Config,
): Record<string, string> {
  const parsedUrl = new URL(url);
  const datetime = new Date()
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .slice(0, 15)
    .concat("Z");
  const date = datetime.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const scope = `${date}/${region}/${service}/aws4_request`;

  const payloadHash = crypto
    .createHash("sha256")
    .update(body ?? "")
    .digest("hex");

  const signedHeaders: Record<string, string> = {
    ...headers,
    host: parsedUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": datetime,
  };

  const sortedHeaderKeys = Object.keys(signedHeaders).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k.toLowerCase()}:${signedHeaders[k].trim()}`)
    .join("\n");
  const signedHeadersList = sortedHeaderKeys
    .map((k) => k.toLowerCase())
    .join(";");

  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    parsedUrl.search.slice(1),
    canonicalHeaders + "\n",
    signedHeadersList,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    scope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const signingKey = [region, service, "aws4_request"].reduce(
    (key, msg) => crypto.createHmac("sha256", key).update(msg).digest(),
    Buffer.from(`AWS4${config.secretKey}`),
  );

  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeadersList}, Signature=${signature}`;

  return {
    ...signedHeaders,
    Authorization: authorization,
  };
}

/**
 * Upload a file to Cloudflare R2.
 *
 * @param buffer - The file contents as a Buffer
 * @param filename - Original filename (used for extension extraction)
 * @param contentType - MIME type of the file
 * @returns The public URL of the uploaded file
 * @throws Error if the file type is not allowed or exceeds the size limit
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(
      `File type "${contentType}" is not allowed. Accepted types: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
    );
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File size ${(buffer.length / (1024 * 1024)).toFixed(1)}MB exceeds the maximum allowed size of 10MB.`,
    );
  }

  const config = getR2Config();
  if (!config) {
    console.warn(
      "[upload.server] R2 environment variables not configured. Returning placeholder URL.",
    );
    return `https://placeholder.example.com/uploads/${generateUniqueFilename(filename)}`;
  }

  const key = generateUniqueFilename(filename);
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${key}`;

  const headers: Record<string, string> = {
    "content-type": contentType,
    "content-length": String(buffer.length),
  };

  const signedHeaders = signRequest("PUT", endpoint, headers, buffer, config);

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: signedHeaders,
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `R2 upload failed (${response.status}): ${text}`,
    );
  }

  return `${config.publicUrl.replace(/\/$/, "")}/${key}`;
}

/**
 * Delete a file from Cloudflare R2.
 *
 * @param key - The object key (filename) to delete
 */
export async function deleteFile(key: string): Promise<void> {
  // Validate key format to prevent path traversal
  if (!/^[\w.-]+$/.test(key)) {
    throw new Error("Invalid file key format");
  }

  const config = getR2Config();
  if (!config) {
    console.warn(
      "[upload.server] R2 environment variables not configured. Skipping delete.",
    );
    return;
  }

  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${key}`;

  const signedHeaders = signRequest("DELETE", endpoint, {}, null, config);

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: signedHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `R2 delete failed (${response.status}): ${text}`,
    );
  }
}

/**
 * Get the public URL for a given object key.
 *
 * @param key - The object key (filename)
 * @returns The public URL string
 */
export function getUploadUrl(key: string): string {
  const config = getR2Config();
  if (!config) {
    return `https://placeholder.example.com/uploads/${key}`;
  }
  return `${config.publicUrl.replace(/\/$/, "")}/${key}`;
}
