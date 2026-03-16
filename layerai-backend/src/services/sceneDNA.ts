import { GeminiService, SceneDNA } from "./gemini.js";
import { dbService } from "./supabase.js";
import { supabase } from "../config/supabase.js";
import { analyzeVideo as visionAnalyze, VisionAnalysis } from "./visionIntelligence.js";

export interface EditHistoryEntry {
  timestamp: number;
  action: string;
  parameters: Record<string, unknown>;
  promptUsed?: string;
}

export interface EnhancedSceneDNA extends SceneDNA {
  editHistory: EditHistoryEntry[];
  generatedAssets: Array<{
    id: string;
    type: "video" | "image" | "audio";
    prompt: string;
    url: string;
    timestamp: number;
  }>;
  characterProfiles: Array<{
    id: string;
    name: string;
    referenceImages: string[];
    description: string;
  }>;
  styleLock: {
    enabled: boolean;
    lockedProperties: string[];
  };
}

export class SceneDNAService {
  private gemini = new GeminiService();

  /**
   * Get Scene DNA for a project (checks scene_dna table first, falls back to projects.scene_dna)
   */
  async get(projectId: string): Promise<EnhancedSceneDNA | null> {
    // Check dedicated scene_dna table first (used by frontend)
    const { data: sceneDnaRow } = await supabase
      .from("scene_dna")
      .select("dna")
      .eq("project_id", projectId)
      .single();

    if (sceneDnaRow?.dna) {
      return sceneDnaRow.dna as EnhancedSceneDNA;
    }

    // Fall back to projects.scene_dna column (used by backend generateFromVideo)
    const project = await dbService.getProject(projectId);
    return (project.scene_dna as EnhancedSceneDNA) || null;
  }

  /**
   * Generate initial Scene DNA from a video.
   * Runs Gemini vision analysis + Google Cloud Video Intelligence API in parallel.
   * Vision Intelligence catches fine-grained details (labels, objects, OCR text,
   * logos, person attributes, shot boundaries) that Gemini's general analysis misses.
   */
  async generateFromVideo(
    videoUrl: string,
    projectId: string
  ): Promise<EnhancedSceneDNA> {
    // Run Gemini + Vision Intelligence in parallel for speed
    const [baseDna, visionResult] = await Promise.allSettled([
      this.gemini.analyzeVideo({ videoUrl, analysisType: "sceneDna" }),
      visionAnalyze(videoUrl),
    ]);

    if (baseDna.status === "rejected") {
      throw new Error(`Gemini video analysis failed: ${baseDna.reason}`);
    }

    const dna = baseDna.value;

    // Merge Vision Intelligence results into SceneDNA
    if (visionResult.status === "fulfilled") {
      dna.visionIntelligence = this.mergeVisionData(visionResult.value);
      console.log(
        `[SceneDNA] Vision Intelligence enriched: ${dna.visionIntelligence.sceneLabels.length} labels, ` +
        `${dna.visionIntelligence.trackedObjects.length} objects, ` +
        `${dna.visionIntelligence.shotBoundaries.length} shots, ` +
        `${dna.visionIntelligence.onScreenText.length} text, ` +
        `${dna.visionIntelligence.personAttributes.length} person attributes`
      );

      // Enrich base DNA objects with Vision Intelligence detections
      const existingObjects = new Set(dna.objects.map((o) => o.toLowerCase()));
      for (const obj of dna.visionIntelligence.trackedObjects) {
        if (!existingObjects.has(obj.entity.toLowerCase())) {
          dna.objects.push(obj.entity);
          existingObjects.add(obj.entity.toLowerCase());
        }
      }

      // Enrich scene labels into the theme/mood if they're informative
      const highConfLabels = dna.visionIntelligence.sceneLabels
        .filter((l) => l.confidence > 0.8)
        .map((l) => l.label);
      if (highConfLabels.length > 0 && !dna.theme.includes("(")) {
        dna.theme = `${dna.theme} (${highConfLabels.slice(0, 3).join(", ")})`;
      }
    } else {
      console.warn(
        `[SceneDNA] Vision Intelligence failed (non-fatal): ${visionResult.reason}`
      );
    }

    // Enhance with empty tracking arrays
    const enhancedDna: EnhancedSceneDNA = {
      ...dna,
      editHistory: [],
      generatedAssets: [],
      characterProfiles: dna.characters.map((c, i) => ({
        id: `char_${i}`,
        name: `Character ${i + 1}`,
        referenceImages: [],
        description: c.description,
      })),
      styleLock: {
        enabled: false,
        lockedProperties: [],
      },
    };

    // Get user_id from the project for the scene_dna table
    const project = await dbService.getProject(projectId);

    // Save to both projects.scene_dna and scene_dna table
    await dbService.updateProject(projectId, { scene_dna: enhancedDna });
    await supabase.from("scene_dna").upsert(
      { project_id: projectId, user_id: project.user_id, dna: enhancedDna },
      { onConflict: "project_id" }
    );

    return enhancedDna;
  }

  /**
   * Convert raw Vision Intelligence API output into the compact SceneDNA format.
   * Deduplicates, filters low-confidence, and keeps only the most relevant data.
   */
  private mergeVisionData(
    vision: VisionAnalysis
  ): NonNullable<SceneDNA["visionIntelligence"]> {
    // Deduplicate and sort labels by confidence
    const labelMap = new Map<string, number>();
    for (const l of vision.sceneLabels) {
      const existing = labelMap.get(l.label) || 0;
      labelMap.set(l.label, Math.max(existing, l.confidence));
    }
    const sceneLabels = Array.from(labelMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([label, confidence]) => ({ label, confidence: Math.round(confidence * 100) / 100 }));

    // Deduplicate tracked objects
    const objMap = new Map<string, number>();
    for (const o of vision.objectTracking) {
      const existing = objMap.get(o.entity) || 0;
      objMap.set(o.entity, Math.max(existing, o.confidence));
    }
    const trackedObjects = Array.from(objMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([entity, confidence]) => ({ entity, confidence: Math.round(confidence * 100) / 100 }));

    // Unique on-screen text
    const textSet = new Set<string>();
    for (const t of vision.detectedText) {
      textSet.add(t.text.trim());
    }

    // Unique logos
    const logoSet = new Set<string>();
    for (const l of vision.detectedLogos) {
      logoSet.add(l.logo);
    }

    // Collect unique person attributes
    const attrSet = new Set<string>();
    for (const p of vision.personDetection) {
      for (const a of p.attributes) {
        attrSet.add(a);
      }
    }

    return {
      sceneLabels,
      trackedObjects,
      shotBoundaries: vision.shotChanges,
      onScreenText: Array.from(textSet),
      logos: Array.from(logoSet),
      personAttributes: Array.from(attrSet).slice(0, 20),
      analyzedAt: Date.now(),
    };
  }

  /**
   * Update Scene DNA with a new edit action
   */
  async recordEdit(
    projectId: string,
    action: string,
    parameters: Record<string, unknown>,
    promptUsed?: string
  ): Promise<EnhancedSceneDNA> {
    const project = await dbService.getProject(projectId);
    const sceneDna = project.scene_dna as EnhancedSceneDNA;

    if (!sceneDna) {
      throw new Error("Project has no Scene DNA");
    }

    // Add to edit history
    sceneDna.editHistory.push({
      timestamp: Date.now(),
      action,
      parameters,
      promptUsed,
    });

    // Keep last 100 edits
    if (sceneDna.editHistory.length > 100) {
      sceneDna.editHistory = sceneDna.editHistory.slice(-100);
    }

    await dbService.updateProject(projectId, { scene_dna: sceneDna });

    return sceneDna;
  }

  /**
   * Record a generated asset
   */
  async recordGeneratedAsset(
    projectId: string,
    asset: {
      id: string;
      type: "video" | "image" | "audio";
      prompt: string;
      url: string;
    }
  ): Promise<EnhancedSceneDNA> {
    const project = await dbService.getProject(projectId);
    const sceneDna = project.scene_dna as EnhancedSceneDNA;

    if (!sceneDna) {
      throw new Error("Project has no Scene DNA");
    }

    sceneDna.generatedAssets.push({
      ...asset,
      timestamp: Date.now(),
    });

    await dbService.updateProject(projectId, { scene_dna: sceneDna });

    return sceneDna;
  }

  /**
   * Add or update a character profile
   */
  async updateCharacterProfile(
    projectId: string,
    characterId: string,
    updates: Partial<EnhancedSceneDNA["characterProfiles"][0]>
  ): Promise<EnhancedSceneDNA> {
    const project = await dbService.getProject(projectId);
    const sceneDna = project.scene_dna as EnhancedSceneDNA;

    if (!sceneDna) {
      throw new Error("Project has no Scene DNA");
    }

    const charIndex = sceneDna.characterProfiles.findIndex(
      (c) => c.id === characterId
    );

    if (charIndex >= 0) {
      sceneDna.characterProfiles[charIndex] = {
        ...sceneDna.characterProfiles[charIndex],
        ...updates,
      };
    } else {
      sceneDna.characterProfiles.push({
        id: characterId,
        name: updates.name || "New Character",
        referenceImages: updates.referenceImages || [],
        description: updates.description || "",
      });
    }

    await dbService.updateProject(projectId, { scene_dna: sceneDna });

    return sceneDna;
  }

  /**
   * Toggle style lock
   */
  async setStyleLock(
    projectId: string,
    enabled: boolean,
    properties?: string[]
  ): Promise<EnhancedSceneDNA> {
    const project = await dbService.getProject(projectId);
    const sceneDna = project.scene_dna as EnhancedSceneDNA;

    if (!sceneDna) {
      throw new Error("Project has no Scene DNA");
    }

    sceneDna.styleLock = {
      enabled,
      lockedProperties: properties || sceneDna.styleLock.lockedProperties,
    };

    await dbService.updateProject(projectId, { scene_dna: sceneDna });

    return sceneDna;
  }

  /**
   * Generate context-aware prompt enhancement
   */
  async enhancePromptWithContext(
    projectId: string,
    prompt: string
  ): Promise<string> {
    const project = await dbService.getProject(projectId);
    const sceneDna = project.scene_dna as EnhancedSceneDNA | null;

    if (!sceneDna) {
      // No Scene DNA, use basic enhancement
      return this.gemini.enhancePrompt({ prompt });
    }

    // Build context from Scene DNA
    const context: Partial<SceneDNA> = {
      theme: sceneDna.theme,
      mood: sceneDna.mood,
      colorPalette: sceneDna.colorPalette,
      lighting: sceneDna.lighting,
    };

    // If style lock is enabled, emphasize locked properties
    if (sceneDna.styleLock.enabled) {
      for (const prop of sceneDna.styleLock.lockedProperties) {
        if (prop in sceneDna) {
          (context as Record<string, unknown>)[prop] = (sceneDna as unknown as Record<string, unknown>)[prop];
        }
      }
    }

    return this.gemini.enhancePrompt({
      prompt,
      sceneDna: context,
    });
  }

  /**
   * Get Scene DNA summary for display
   */
  async getSummary(projectId: string): Promise<{
    hasSceneDNA: boolean;
    theme?: string;
    mood?: string;
    editCount: number;
    assetCount: number;
    characterCount: number;
    styleLocked: boolean;
  }> {
    const project = await dbService.getProject(projectId);
    const sceneDna = project.scene_dna as EnhancedSceneDNA | null;

    if (!sceneDna) {
      return {
        hasSceneDNA: false,
        editCount: 0,
        assetCount: 0,
        characterCount: 0,
        styleLocked: false,
      };
    }

    return {
      hasSceneDNA: true,
      theme: sceneDna.theme,
      mood: sceneDna.mood,
      editCount: sceneDna.editHistory?.length || 0,
      assetCount: sceneDna.generatedAssets?.length || 0,
      characterCount: sceneDna.characterProfiles?.length || 0,
      styleLocked: sceneDna.styleLock?.enabled || false,
    };
  }
}

export const sceneDNAService = new SceneDNAService();
