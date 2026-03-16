// eslint-disable-next-line @typescript-eslint/no-var-requires
const videoIntelligence = require("@google-cloud/video-intelligence");

/**
 * Google Cloud Video Intelligence API service.
 * Runs deep analysis on videos to extract labels, objects, shot changes,
 * text (OCR), logos, and person detection — data that enriches SceneDNA
 * far beyond what Gemini's general vision captures.
 *
 * Supports two credential modes:
 *  - GOOGLE_APPLICATION_CREDENTIALS — path to a service account JSON file (local dev)
 *  - GOOGLE_CREDENTIALS_JSON — inline JSON string of the service account key (Railway/cloud)
 */

const { VideoIntelligenceServiceClient } = videoIntelligence.v1 || videoIntelligence;
const Feature = videoIntelligence.protos?.google?.cloud?.videointelligence?.v1?.Feature
  || videoIntelligence.v1?.protos?.google?.cloud?.videointelligence?.v1?.Feature;

// Lazy-init client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

function getClient() {
  if (!client) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credJson = process.env.GOOGLE_CREDENTIALS_JSON;

    if (credJson) {
      // Railway / cloud: credentials provided as inline JSON string
      try {
        const credentials = JSON.parse(credJson);
        client = new VideoIntelligenceServiceClient({ credentials });
        console.log("[VisionIntelligence] Client initialized with inline credentials.");
      } catch (e) {
        throw new Error(`Failed to parse GOOGLE_CREDENTIALS_JSON: ${e}`);
      }
    } else if (credPath) {
      // Local dev: credentials file path
      client = new VideoIntelligenceServiceClient({ keyFilename: credPath });
      console.log("[VisionIntelligence] Client initialized with service account file.");
    } else {
      throw new Error(
        "Neither GOOGLE_APPLICATION_CREDENTIALS nor GOOGLE_CREDENTIALS_JSON is set. Vision Intelligence features are disabled."
      );
    }
  }
  return client;
}

/** Structured output from Vision Intelligence analysis */
export interface VisionAnalysis {
  /** Scene-level labels (e.g. "beach", "sunset", "urban") */
  sceneLabels: Array<{
    label: string;
    confidence: number;
    segments: Array<{ startTime: number; endTime: number }>;
  }>;
  /** Object tracking across frames (e.g. "car", "person", "dog") */
  objectTracking: Array<{
    entity: string;
    confidence: number;
    frames: Array<{
      time: number;
      boundingBox: { left: number; top: number; right: number; bottom: number };
    }>;
  }>;
  /** Shot/cut boundaries detected */
  shotChanges: Array<{
    startTime: number;
    endTime: number;
  }>;
  /** On-screen text detected via OCR */
  detectedText: Array<{
    text: string;
    confidence: number;
    segments: Array<{ startTime: number; endTime: number }>;
  }>;
  /** Logos detected (brand logos, etc.) */
  detectedLogos: Array<{
    logo: string;
    confidence: number;
    segments: Array<{ startTime: number; endTime: number }>;
  }>;
  /** Person detection with attributes */
  personDetection: Array<{
    trackId: number;
    attributes: string[];
    segments: Array<{ startTime: number; endTime: number }>;
  }>;
}

/** Convert protobuf Duration to seconds */
function durationToSeconds(
  duration: { seconds?: number | Long | string | null; nanos?: number | null } | null | undefined
): number {
  if (!duration) return 0;
  const seconds = typeof duration.seconds === "number"
    ? duration.seconds
    : Number(duration.seconds || 0);
  const nanos = duration.nanos || 0;
  return seconds + nanos / 1e9;
}

type Long = { toNumber(): number };

// --- Serial queue to avoid rate-limiting (1 request at a time, retry on 429/RESOURCE_EXHAUSTED) ---
let pendingQueue: Array<{ resolve: (v: VisionAnalysis) => void; reject: (e: Error) => void; url: string }> = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || pendingQueue.length === 0) return;
  isProcessing = true;

  while (pendingQueue.length > 0) {
    const item = pendingQueue.shift()!;
    try {
      const result = await _analyzeVideo(item.url);
      item.resolve(result);
    } catch (err) {
      item.reject(err as Error);
    }
    // Small delay between requests to stay under quota
    if (pendingQueue.length > 0) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  isProcessing = false;
}

/**
 * Analyze a video using Google Cloud Video Intelligence API.
 * Queued serially to avoid rate-limiting.
 */
export function analyzeVideo(videoUrl: string): Promise<VisionAnalysis> {
  return new Promise((resolve, reject) => {
    pendingQueue.push({ resolve, reject, url: videoUrl });
    processQueue();
  });
}

/** Internal: actual analysis call with retry on RESOURCE_EXHAUSTED */
async function _analyzeVideo(videoUrl: string, retries = 2): Promise<VisionAnalysis> {
  try {
    return await _doAnalyze(videoUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (retries > 0 && msg.includes("RESOURCE_EXHAUSTED")) {
      const delay = (3 - retries) * 15000; // 15s, 30s
      console.log(`[VisionIntelligence] Rate limited, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      return _analyzeVideo(videoUrl, retries - 1);
    }
    throw err;
  }
}

async function _doAnalyze(videoUrl: string): Promise<VisionAnalysis> {
  const vc = getClient();

  console.log(`[VisionIntelligence] Starting analysis of: ${videoUrl.slice(0, 80)}...`);

  // Determine input: GCS URI or fetch bytes for HTTP URLs
  let inputUri: string | undefined;
  let inputContent: string | undefined;

  if (videoUrl.startsWith("gs://")) {
    inputUri = videoUrl;
  } else {
    // Download video and send as base64 content
    console.log("[VisionIntelligence] Downloading video for inline analysis...");
    const resp = await fetch(videoUrl);
    if (!resp.ok) throw new Error(`Failed to download video: ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    inputContent = Buffer.from(buffer).toString("base64");
    console.log(`[VisionIntelligence] Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`);
  }

  const features = [
    Feature.LABEL_DETECTION,
    Feature.SHOT_CHANGE_DETECTION,
    Feature.OBJECT_TRACKING,
    Feature.TEXT_DETECTION,
    Feature.LOGO_RECOGNITION,
    Feature.PERSON_DETECTION,
  ];

  const request: Record<string, unknown> = {
    features,
    videoContext: {
      labelDetectionConfig: {
        labelDetectionMode: "SHOT_AND_FRAME_MODE",
        stationaryCamera: false,
      },
      objectTrackingConfig: {},
      textDetectionConfig: {
        languageHints: ["en"],
      },
      personDetectionConfig: {
        includeBoundingBoxes: false,
        includeAttributes: true,
        includePoseLandmarks: false,
      },
    },
  };

  if (inputUri) {
    request.inputUri = inputUri;
  } else {
    request.inputContent = inputContent;
  }

  // annotateVideo returns a long-running operation — await completion
  const [operation] = await vc.annotateVideo(request as Parameters<typeof vc.annotateVideo>[0]);
  console.log("[VisionIntelligence] Annotation started, waiting for results...");

  const [result] = await operation.promise();
  const annotation = result.annotationResults?.[0];

  if (!annotation) {
    throw new Error("No annotation results returned from Video Intelligence API");
  }

  console.log("[VisionIntelligence] Annotation complete, parsing results...");

  // --- Parse scene labels ---
  const sceneLabels: VisionAnalysis["sceneLabels"] = [];
  for (const label of annotation.segmentLabelAnnotations || []) {
    const name = label.entity?.description || "unknown";
    const topSegment = label.segments?.[0];
    const confidence = topSegment?.confidence || 0;
    if (confidence < 0.5) continue; // Skip low-confidence labels

    sceneLabels.push({
      label: name,
      confidence,
      segments: (label.segments || []).map(// eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({
        startTime: durationToSeconds(s.segment?.startTimeOffset),
        endTime: durationToSeconds(s.segment?.endTimeOffset),
      })),
    });
  }

  // --- Parse object tracking ---
  const objectTracking: VisionAnalysis["objectTracking"] = [];
  for (const obj of annotation.objectAnnotations || []) {
    const entity = obj.entity?.description || "unknown";
    const confidence = obj.confidence || 0;
    if (confidence < 0.5) continue;

    const frames: VisionAnalysis["objectTracking"][0]["frames"] = [];
    // Sample up to 10 frames per object to keep payload manageable
    const allFrames = obj.frames || [];
    const step = Math.max(1, Math.floor(allFrames.length / 10));
    for (let i = 0; i < allFrames.length; i += step) {
      const f = allFrames[i];
      const box = f.normalizedBoundingBox;
      frames.push({
        time: durationToSeconds(f.timeOffset),
        boundingBox: {
          left: box?.left || 0,
          top: box?.top || 0,
          right: box?.right || 0,
          bottom: box?.bottom || 0,
        },
      });
    }

    objectTracking.push({ entity, confidence, frames });
  }

  // --- Parse shot changes ---
  const shotChanges: VisionAnalysis["shotChanges"] = (annotation.shotAnnotations || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (shot: any) => ({
      startTime: durationToSeconds(shot.startTimeOffset),
      endTime: durationToSeconds(shot.endTimeOffset),
    })
  );

  // --- Parse text detection ---
  const detectedText: VisionAnalysis["detectedText"] = [];
  for (const text of annotation.textAnnotations || []) {
    const content = text.text || "";
    if (!content.trim()) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segments = (text.segments || []).map((s: any) => ({
      startTime: durationToSeconds(s.segment?.startTimeOffset),
      endTime: durationToSeconds(s.segment?.endTimeOffset),
    }));
    const confidence = text.segments?.[0]?.confidence || 0;
    if (confidence < 0.5) continue;

    detectedText.push({ text: content, confidence, segments });
  }

  // --- Parse logo detection ---
  const detectedLogos: VisionAnalysis["detectedLogos"] = [];
  for (const logo of annotation.logoRecognitionAnnotations || []) {
    const name = logo.entity?.description || "unknown";
    const tracks = logo.tracks || [];
    const confidence = tracks[0]?.confidence || 0;

    const segments: Array<{ startTime: number; endTime: number }> = [];
    for (const track of tracks) {
      const seg = track.segment;
      if (seg) {
        segments.push({
          startTime: durationToSeconds(seg.startTimeOffset),
          endTime: durationToSeconds(seg.endTimeOffset),
        });
      }
    }

    detectedLogos.push({ logo: name, confidence, segments });
  }

  // --- Parse person detection ---
  const personDetection: VisionAnalysis["personDetection"] = [];
  for (const person of annotation.personDetectionAnnotations || []) {
    for (const track of person.tracks || []) {
      const attributes: string[] = [];
      // Collect detected attributes from timestamped objects
      for (const tsObj of track.timestampedObjects || []) {
        for (const attr of tsObj.attributes || []) {
          const attrName = attr.name || "";
          const attrValue = attr.value || "";
          const attrConfidence = attr.confidence || 0;
          if (attrConfidence > 0.5 && attrName && attrValue) {
            const desc = `${attrName}: ${attrValue}`;
            if (!attributes.includes(desc)) attributes.push(desc);
          }
        }
      }

      const seg = track.segment;
      personDetection.push({
        trackId: personDetection.length,
        attributes,
        segments: seg
          ? [{
              startTime: durationToSeconds(seg.startTimeOffset),
              endTime: durationToSeconds(seg.endTimeOffset),
            }]
          : [],
      });
    }
  }

  console.log(
    `[VisionIntelligence] Results: ${sceneLabels.length} labels, ${objectTracking.length} objects, ` +
    `${shotChanges.length} shots, ${detectedText.length} text, ${detectedLogos.length} logos, ` +
    `${personDetection.length} persons`
  );

  return {
    sceneLabels,
    objectTracking,
    shotChanges,
    detectedText,
    detectedLogos,
    personDetection,
  };
}
