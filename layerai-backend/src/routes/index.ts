import { Router } from "express";
import { healthRouter } from "./health.js";
import { generateRouter } from "./generate.js";
import { analyzeRouter } from "./analyze.js";
import { enhanceRouter } from "./enhance.js";
import { segmentRouter } from "./segment.js";
import { compositeRouter } from "./composite.js";
import { exportRouter } from "./export.js";
import { previewRouter } from "./preview.js";
import { transitionsRouter } from "./transitions.js";
import { sfxRouter } from "./sfx.js";
import { uploadRouter } from "./upload.js";
import { projectsRouter } from "./projects.js";
import { textRouter } from "./text.js";
import { aiRouter } from "./ai.js";

export const router = Router();

// Mount all routes
router.use("/health", healthRouter);
router.use("/ai", aiRouter);
router.use("/generate", generateRouter);
router.use("/analyze", analyzeRouter);
router.use("/enhance", enhanceRouter);
router.use("/segment", segmentRouter);
router.use("/composite", compositeRouter);
router.use("/export", exportRouter);
router.use("/preview", previewRouter);
router.use("/transitions", transitionsRouter);
router.use("/sfx", sfxRouter);
router.use("/upload", uploadRouter);
router.use("/projects", projectsRouter);
router.use("/text", textRouter);
