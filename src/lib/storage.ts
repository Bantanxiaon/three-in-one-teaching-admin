import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function getStorageClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

export async function createPresignedUpload(key: string, contentType: string) {
  const client = getStorageClient();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) throw new Error("Storage is not configured.");
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  return { uploadUrl, publicUrl: publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${key}` : key };
}

export async function uploadObject(input: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}) {
  const client = getStorageClient();
  const bucket = process.env.S3_BUCKET;

  if (!client || !bucket) {
    throw new Error("Storage is not configured.");
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ACL: process.env.S3_PUBLIC_ACL === "true" ? "public-read" : undefined
    })
  );

  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  return publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${input.key}` : input.key;
}
