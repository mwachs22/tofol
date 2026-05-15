import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** POST /api/images — return a presigned R2 upload URL */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const body = await request.json().catch(() => null);
  const contentType: string = body?.contentType ?? "image/jpeg";
  const size: number = body?.size ?? 0;

  if (!ALLOWED_TYPES.has(contentType)) {
    return problem(400, "Bad Request", `Content type "${contentType}" is not allowed.`);
  }
  if (size > MAX_BYTES) {
    return problem(413, "Payload Too Large", "Image must be smaller than 10 MB.");
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME ?? "tofol-images";
  const publicUrl = process.env.R2_PUBLIC_URL ?? "";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return problem(503, "Not configured", "Image storage is not configured for this deployment.");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const ext = contentType.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  const key = `uploads/${user.id}/${randomBytes(8).toString("hex")}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  return NextResponse.json({
    uploadUrl,
    publicUrl: `${publicUrl}/${key}`,
  });
}
