import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase, BUCKETS } from "../config/supabase.js";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

export const uploadRouter = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "audio/mpeg",
      "audio/wav",
      "audio/webm",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

// POST /api/upload - Upload media file to Supabase
uploadRouter.post("/", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file uploaded" });
      return;
    }

    const projectId = req.body.projectId || "default";
    const fileId = uuidv4();
    const ext = req.file.originalname.split(".").pop() || "mp4";
    const filePath = `${projectId}/${fileId}.${ext}`;

    // Determine bucket based on file type
    const bucket = req.file.mimetype.startsWith("image/") ? BUCKETS.LAYERS : BUCKETS.MEDIA;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    res.json({
      success: true,
      data: {
        id: fileId,
        path: data.path,
        url: urlData.publicUrl,
        size: req.file.size,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/upload/url - Import from URL
uploadRouter.post("/url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      url: z.string().url(),
      projectId: z.string().optional().default("default"),
    }).parse(req.body);

    // Fetch the file from URL
    const response = await fetch(body.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const buffer = Buffer.from(await response.arrayBuffer());

    const fileId = uuidv4();
    const ext = contentType.split("/")[1] || "mp4";
    const filePath = `${body.projectId}/${fileId}.${ext}`;

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(BUCKETS.MEDIA)
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKETS.MEDIA)
      .getPublicUrl(filePath);

    res.json({
      success: true,
      data: {
        id: fileId,
        path: data.path,
        url: urlData.publicUrl,
        size: buffer.length,
        mimeType: contentType,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/upload/:fileId - Delete uploaded file
uploadRouter.delete("/:fileId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.params;
    const { projectId, bucket } = z.object({
      projectId: z.string(),
      bucket: z.enum(["media", "exports", "proxies", "layers"]).default("media"),
    }).parse(req.query);

    const bucketMap: Record<string, string> = {
      media: BUCKETS.MEDIA,
      exports: BUCKETS.EXPORTS,
      proxies: BUCKETS.PROXIES,
      layers: BUCKETS.LAYERS,
    };

    const { error } = await supabase.storage
      .from(bucketMap[bucket])
      .remove([`${projectId}/${fileId}`]);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/upload/signed-url - Get signed URL for direct upload
uploadRouter.get("/signed-url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = z.object({
      projectId: z.string(),
      filename: z.string(),
      contentType: z.string().optional().default("video/mp4"),
    }).parse(req.query);

    const fileId = uuidv4();
    const ext = query.filename.split(".").pop() || "mp4";
    const filePath = `${query.projectId}/${fileId}.${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKETS.MEDIA)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        fileId,
        uploadUrl: data.signedUrl,
        token: data.token,
        path: data.path,
      },
    });
  } catch (error) {
    next(error);
  }
});
