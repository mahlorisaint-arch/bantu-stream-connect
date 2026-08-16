// Video transcoding worker for Bantu Stream Connect.
//
// Receives a webhook from the Postgres trigger (mirrors the shape used by
// supabase/functions/sync-resend-contact: {type, table, record}) whenever a
// new video Content row is inserted. Downloads the raw upload from R2,
// transcodes it into a real multivariant HLS output (required for the
// existing Quality/Data Saver menu on both web and mobile - see
// C:\Users\User\.claude\plans\compiled-twirling-dream.md), uploads the
// result back to R2, and updates the Content row so the existing player
// code picks it up via the hls_manifest_url fallback path that already
// exists on both platforms - no player code changes needed.
const express = require("express");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");
const { execFile } = require("child_process");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || "bantu-connect-storage";
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE_URL || "https://assets.bantustreamconnect.com";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Fast, low, then medium ladder - only renditions <= source height are
// actually produced (see buildRenditionLadder), so a 480p source only ever
// gets a single rendition rather than being upscaled.
const RENDITION_LADDER = [
  { name: "480p", height: 480, videoBitrate: "1400k", audioBitrate: "96k" },
  { name: "720p", height: 720, videoBitrate: "2800k", audioBitrate: "128k" },
  { name: "1080p", height: 1080, videoBitrate: "5000k", audioBitrate: "128k" },
];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function probeVideo(filePath) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] || {};
  return {
    width: stream.width || 0,
    height: stream.height || 0,
    duration: parseFloat(data.format?.duration || "0"),
  };
}

function buildRenditionLadder(sourceHeight) {
  const included = RENDITION_LADDER.filter((r) => r.height <= sourceHeight);
  // Very low-resolution sources (below the lowest rung) still get exactly
  // one rendition at their own native height rather than being upscaled.
  if (included.length === 0) {
    return [{ name: "source", height: sourceHeight, videoBitrate: "1000k", audioBitrate: "96k" }];
  }
  return included;
}

async function transcodeRendition(inputPath, outDir, rendition, aspectRatio) {
  const renditionDir = path.join(outDir, rendition.name);
  await fs.mkdir(renditionDir, { recursive: true });
  const width = Math.round((rendition.height * aspectRatio) / 2) * 2;
  const playlistPath = path.join(renditionDir, "playlist.m3u8");
  await run("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vf", `scale=${width}:${rendition.height}`,
    "-c:v", "libx264", "-preset", "veryfast", "-b:v", rendition.videoBitrate,
    "-c:a", "aac", "-b:a", rendition.audioBitrate,
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_segment_filename", path.join(renditionDir, "seg_%03d.ts"),
    playlistPath,
  ]);
  const bandwidth = (parseInt(rendition.videoBitrate) + parseInt(rendition.audioBitrate)) * 1000;
  return { ...rendition, width, bandwidth, dir: renditionDir };
}

async function buildMasterPlaylist(outDir, renditions) {
  const lines = ["#EXTM3U"];
  for (const r of renditions) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.width}x${r.height}`);
    lines.push(`${r.name}/playlist.m3u8`);
  }
  const masterPath = path.join(outDir, "master.m3u8");
  await fs.writeFile(masterPath, lines.join("\n") + "\n");
  return masterPath;
}

async function extractThumbnail(inputPath, outDir, duration) {
  const timestamp = Math.min(5, Math.max(0.5, duration * 0.1));
  const thumbPath = path.join(outDir, "thumbnail.jpg");
  await run("ffmpeg", ["-y", "-ss", String(timestamp), "-i", inputPath, "-frames:v", "1", "-q:v", "3", thumbPath]);
  return thumbPath;
}

async function uploadDirToR2(localDir, r2Prefix) {
  const entries = await fs.readdir(localDir, { withFileTypes: true, recursive: true });
  const files = entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) => {
      const localPath = path.join(entry.path || localDir, entry.name);
      const relative = path.relative(localDir, localPath).split(path.sep).join("/");
      return { localPath, key: `${r2Prefix}/${relative}`, relative };
    });

  // Building this array via .map(async ...) - not a for-loop with an await
  // before each push - matters: it creates every upload promise in the
  // same synchronous tick, so Promise.all subscribes to all of them
  // immediately. Pushing promises into an array across a loop that awaits
  // in between (the previous version's fs.readFile before each push) can
  // leave an early-rejecting promise briefly unobserved, which crashed the
  // entire process on a real R2 permission error - one job's failure took
  // down every other in-flight job with it.
  await Promise.all(
    files.map(async (f) => {
      const body = await fs.readFile(f.localPath);
      const contentType = f.relative.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : f.relative.endsWith(".ts")
        ? "video/mp2t"
        : f.relative.endsWith(".jpg")
        ? "image/jpeg"
        : "application/octet-stream";
      return s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: f.key, Body: body, ContentType: contentType }));
    })
  );
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download source video: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

async function processVideo(content) {
  const contentId = content.id;
  const jobDir = path.join("/tmp/transcode-jobs", String(contentId), crypto.randomUUID());
  await fs.mkdir(jobDir, { recursive: true });

  try {
    console.log(`[${contentId}] downloading source: ${content.file_url}`);
    const inputExt = path.extname(new URL(content.file_url).pathname) || ".mp4";
    const inputPath = path.join(jobDir, `input${inputExt}`);
    await downloadFile(content.file_url, inputPath);

    console.log(`[${contentId}] probing source`);
    const { width, height, duration } = await probeVideo(inputPath);
    if (!height) throw new Error("Could not determine source video resolution");
    const aspectRatio = width / height;

    const ladder = buildRenditionLadder(height);
    console.log(`[${contentId}] transcoding ${ladder.length} rendition(s): ${ladder.map((r) => r.name).join(", ")}`);

    const outDir = path.join(jobDir, "output");
    await fs.mkdir(outDir, { recursive: true });
    const producedRenditions = [];
    for (const rendition of ladder) {
      producedRenditions.push(await transcodeRendition(inputPath, outDir, rendition, aspectRatio));
    }
    await buildMasterPlaylist(outDir, producedRenditions);
    await extractThumbnail(inputPath, outDir, duration);

    const r2Prefix = `content-video-hls/${contentId}`;
    console.log(`[${contentId}] uploading output to R2 (${r2Prefix})`);
    await uploadDirToR2(outDir, r2Prefix);

    const hlsManifestUrl = `${R2_PUBLIC_BASE}/${r2Prefix}/master.m3u8`;
    const thumbnailUrl = content.thumbnail_url || `${R2_PUBLIC_BASE}/${r2Prefix}/thumbnail.jpg`;

    const { error } = await supabase
      .from("Content")
      .update({
        streaming_provider: "cloudflare_r2",
        hls_manifest_url: hlsManifestUrl,
        thumbnail_url: thumbnailUrl,
        duration: Math.round(duration),
        processing_status: "ready",
      })
      .eq("id", contentId);
    if (error) throw error;

    console.log(`[${contentId}] done - ${hlsManifestUrl}`);
  } catch (err) {
    console.error(`[${contentId}] FAILED:`, err.stderr || err.message || err);
    await supabase.from("Content").update({ processing_status: "failed" }).eq("id", contentId);
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

const app = express();
app.use(express.json());

app.post("/transcode", (req, res) => {
  if (WEBHOOK_SECRET && req.headers["x-webhook-secret"] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const record = req.body?.record;
  if (!record?.id || !record?.file_url) {
    return res.status(400).json({ error: "missing record.id or record.file_url" });
  }
  // Respond immediately - transcoding takes real minutes, and the trigger
  // that calls this doesn't wait for a meaningful response either way.
  res.status(202).json({ status: "queued", contentId: record.id });
  // processVideo already wraps its own body in try/catch, but this belt-
  // and-suspenders .catch on the fire-and-forget call itself is what
  // actually stops a bug there from becoming a process-wide crash - see
  // the unhandledRejection handler below for why this matters concretely.
  processVideo(record).catch((err) => console.error(`[${record.id}] uncaught in processVideo:`, err));
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// One job's bug should never take down every other in-flight job. Real,
// confirmed incident: an R2 permission error during upload crashed the
// entire process (Node's default behavior for an unhandled rejection),
// which killed whatever else was running at the time too - systemd
// restarted the service, but the failed job was left stuck in
// processing_status='queued' forever with no record of what happened.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (process kept running):", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (process kept running):", err);
});

app.listen(PORT, () => console.log(`Transcoder listening on :${PORT}`));
