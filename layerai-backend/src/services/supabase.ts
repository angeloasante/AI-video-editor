import { supabase, BUCKETS } from "../config/supabase.js";
import { v4 as uuidv4 } from "uuid";

export interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
}

export interface FileMetadata {
  id: string;
  path: string;
  url: string;
  size: number;
  contentType: string;
}

export class SupabaseStorageService {
  async uploadFile(
    bucket: string,
    projectId: string,
    file: Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<FileMetadata> {
    const fileId = uuidv4();
    const ext = filename.split(".").pop() || "bin";
    const filePath = `${projectId}/${fileId}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: options.contentType || "application/octet-stream",
        upsert: options.upsert || false,
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      id: fileId,
      path: data.path,
      url: urlData.publicUrl,
      size: file.length,
      contentType: options.contentType || "application/octet-stream",
    };
  }

  async uploadFromUrl(
    bucket: string,
    projectId: string,
    sourceUrl: string,
    filename?: string
  ): Promise<FileMetadata> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "video/mp4";
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = contentType.split("/")[1] || "mp4";
    const name = filename || `file.${ext}`;

    return this.uploadFile(bucket, projectId, buffer, name, { contentType });
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      throw error;
    }
  }

  async listFiles(bucket: string, folder: string): Promise<FileMetadata[]> {
    const { data, error } = await supabase.storage.from(bucket).list(folder);

    if (error) {
      throw error;
    }

    return (data || []).map((file) => {
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(`${folder}/${file.name}`);

      return {
        id: file.id,
        path: `${folder}/${file.name}`,
        url: urlData.publicUrl,
        size: file.metadata?.size || 0,
        contentType: file.metadata?.mimetype || "application/octet-stream",
      };
    });
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  }

  async getSignedUploadUrl(bucket: string, path: string): Promise<{
    url: string;
    token: string;
  }> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      throw error;
    }

    return {
      url: data.signedUrl,
      token: data.token,
    };
  }

  async moveFile(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<void> {
    const { error } = await supabase.storage.from(bucket).move(fromPath, toPath);
    if (error) {
      throw error;
    }
  }

  async copyFile(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<void> {
    const { error } = await supabase.storage.from(bucket).copy(fromPath, toPath);
    if (error) {
      throw error;
    }
  }
}

export class SupabaseDBService {
  async getProject(projectId: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateProject(projectId: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createJob(jobData: {
    projectId: string;
    type: string;
    status: string;
    input: Record<string, unknown>;
  }) {
    const { data, error } = await supabase
      .from("jobs")
      .insert(jobData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateJob(jobId: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getJob(jobId: string) {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) throw error;
    return data;
  }
}

export const storageService = new SupabaseStorageService();
export const dbService = new SupabaseDBService();
