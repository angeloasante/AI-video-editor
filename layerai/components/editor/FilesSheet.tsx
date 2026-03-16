"use client";

import { useState, useRef, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  FileVideo, 
  FileImage, 
  FileAudio, 
  File, 
  Trash2,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { uploadFile, deleteFile, listFiles, MediaFile } from "@/lib/supabase";

interface FilesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileSelect: (file: MediaFile) => void;
  selectedFile?: MediaFile | null;
}

export function FilesSheet({ 
  open, 
  onOpenChange, 
  onFileSelect,
  selectedFile 
}: FilesSheetProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const uploadedFiles = await listFiles();
      setFiles(uploadedFiles);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load files when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      loadFiles();
    }
    onOpenChange(isOpen);
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadFile(file);
        if (uploaded) {
          setFiles((prev) => [...prev, uploaded]);
          // Auto-select the first uploaded file
          if (!selectedFile) {
            onFileSelect(uploaded);
          }
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: MediaFile) => {
    const success = await deleteFile(file.path);
    if (success) {
      setFiles((prev) => prev.filter((f) => f.path !== file.path));
      if (selectedFile?.path === file.path) {
        onFileSelect(files.find((f) => f.path !== file.path) || null as any);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  const getFileIcon = (type: MediaFile["type"]) => {
    switch (type) {
      case "video":
        return <FileVideo className="w-5 h-5 text-blue-400" />;
      case "image":
        return <FileImage className="w-5 h-5 text-green-400" />;
      case "audio":
        return <FileAudio className="w-5 h-5 text-purple-400" />;
      default:
        return <File className="w-5 h-5 text-neutral-400" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[400px] sm:w-[540px] bg-[#0f0f10] border-l border-neutral-800 p-0"
      >
        <SheetHeader className="p-6 pb-4 border-b border-neutral-800">
          <SheetTitle className="text-white">Files</SheetTitle>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Upload Area */}
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer
              ${dragActive 
                ? "border-blue-500 bg-blue-500/10" 
                : "border-neutral-700 hover:border-neutral-600 bg-neutral-900/50"
              }
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="video/*,image/*,audio/*"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            
            <div className="flex flex-col items-center justify-center text-center">
              {uploading ? (
                <>
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                  <p className="text-sm text-neutral-300">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-neutral-500 mb-3" />
                  <p className="text-sm text-neutral-300 mb-1">
                    Drag & drop files here
                  </p>
                  <p className="text-xs text-neutral-500">
                    or click to browse
                  </p>
                  <p className="text-xs text-neutral-600 mt-2">
                    Supports video, image, and audio files
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Files List */}
          <div>
            <h3 className="text-sm font-medium text-neutral-400 mb-3">
              Uploaded Files
            </h3>
            
            <ScrollArea className="h-[calc(100vh-350px)]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8">
                  <File className="w-10 h-10 text-neutral-700 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No files uploaded</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.path}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                        ${selectedFile?.path === file.path 
                          ? "bg-blue-500/20 border border-blue-500/50" 
                          : "bg-neutral-900 hover:bg-neutral-800 border border-transparent"
                        }
                      `}
                      onClick={() => onFileSelect(file)}
                    >
                      {getFileIcon(file.type)}
                      
                      <div className="flex-1 min-w-0 overflow-hidden max-w-[280px]">
                        <p className="text-sm text-neutral-200 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-neutral-500 capitalize">
                          {file.type}
                        </p>
                      </div>

                      {selectedFile?.path === file.path && (
                        <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
