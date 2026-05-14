"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseUploadErrorResponseText } from "@/lib/storage/upload-error-message";

export function DocumentDropzone({
 processId,
 onUploaded,
}: {
 processId: string;
 onUploaded?: (documentId: string) => void;
}) {
 const [uploading, setUploading] = useState(false);

 const onDrop = useCallback(
 async (files: File[]) => {
 const file = files[0];
 if (!file) return;
 setUploading(true);
 const fd = new FormData();
 fd.append("file", file);
 fd.append("processId", processId);
 try {
 const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
 if (!res.ok) throw new Error(parseUploadErrorResponseText(await res.text()));
 const data = (await res.json()) as { documentId: string; status: string };
 toast.success(`Documento enviado (${data.status}). Indexação em background.`);
 onUploaded?.(data.documentId);
 } catch (e) {
 toast.error(e instanceof Error ? e.message : "Falha no upload");
 } finally {
 setUploading(false);
 }
 },
 [processId, onUploaded],
 );

 const { getRootProps, getInputProps, isDragActive } = useDropzone({
 onDrop,
 multiple: false,
 disabled: uploading,
 });

 return (
 <div
 {...getRootProps()}
 className={cn("flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-[color:var(--surface-overlay)] px-6 py-10 transition-colors hover:border-violet-500/40 hover:bg-[color:var(--surface-overlay-strong)]",
 isDragActive && "border-violet-500/60 bg-violet-500/5",
 uploading && "pointer-events-none opacity-60",
 )}
 >
 <input {...getInputProps()} />
 <Upload className="mb-2 size-8 text-violet-400" />
 <p className="text-sm text-muted-foreground">
 Arraste PDF, DOCX ou TXT — OCR automático quando necessário.
 </p>
 </div>
 );
}
