import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../config/supabase.js";

export const projectsRouter = Router();

const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "21:9"]).default("16:9"),
  frameRate: z.number().min(24).max(60).default(30),
  resolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
});

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["video", "audio", "overlay"]),
  clips: z.array(z.object({
    id: z.string(),
    start: z.number(),
    end: z.number(),
    source: z.string(),
    name: z.string().optional(),
  })),
});

const timelineSchema = z.object({
  tracks: z.array(trackSchema),
  duration: z.number(),
});

// POST /api/projects - Create new project
projectsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = projectSchema.parse(req.body);

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: body.name,
        description: body.description,
        settings: {
          aspectRatio: body.aspectRatio,
          frameRate: body.frameRate,
          resolution: body.resolution,
        },
        timeline: {
          tracks: [],
          duration: 0,
        },
        scene_dna: null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects - List all projects
projectsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = z.object({
      limit: z.coerce.number().min(1).max(100).default(20),
      offset: z.coerce.number().min(0).default(0),
    }).parse(req.query);

    const { data, error, count } = await supabase
      .from("projects")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        projects: data,
        total: count,
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Get project by ID
projectsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id - Update project
projectsRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = projectSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.aspectRatio || body.frameRate || body.resolution) {
      // Merge with existing settings
      const { data: existing } = await supabase
        .from("projects")
        .select("settings")
        .eq("id", id)
        .single();

      updateData.settings = {
        ...existing?.settings,
        ...(body.aspectRatio && { aspectRatio: body.aspectRatio }),
        ...(body.frameRate && { frameRate: body.frameRate }),
        ...(body.resolution && { resolution: body.resolution }),
      };
    }

    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id/timeline - Update project timeline
projectsRouter.put("/:id/timeline", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = timelineSchema.parse(req.body);

    const { data, error } = await supabase
      .from("projects")
      .update({ timeline: body })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id/scene-dna - Update project Scene DNA
projectsRouter.put("/:id/scene-dna", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sceneDna = req.body; // Scene DNA is a complex object, accept as-is

    const { data, error } = await supabase
      .from("projects")
      .update({ scene_dna: sceneDna })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id - Delete project
projectsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

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

// POST /api/projects/:id/duplicate - Duplicate a project
projectsRouter.post("/:id/duplicate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get original project
    const { data: original, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !original) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }

    // Create duplicate
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: `${original.name} (Copy)`,
        description: original.description,
        settings: original.settings,
        timeline: original.timeline,
        scene_dna: original.scene_dna,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});
