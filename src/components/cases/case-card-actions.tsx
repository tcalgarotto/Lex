"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function CaseCardActions({
  caseId,
  caseTitle,
  archived,
  onDone,
}: {
  caseId: string;
  caseTitle: string;
  archived: boolean;
  onDone?: () => void;
}) {
  const [openDelete, setOpenDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canDelete = useMemo(() => confirmText.trim() === "EXCLUIR", [confirmText]);

  async function archive() {
    await fetch(`/api/cases/${caseId}/archive`, { method: "POST" });
    onDone?.();
  }
  async function restore() {
    await fetch(`/api/cases/${caseId}/archive`, { method: "DELETE" });
    onDone?.();
  }
  async function hardDelete() {
    if (!canDelete) return;
    await fetch(`/api/cases/${caseId}/delete?confirm=1`, { method: "DELETE" });
    onDone?.();
    setOpenDelete(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ações do caso">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {archived ? (
            <DropdownMenuItem onClick={restore}>
              <ArchiveRestore className="mr-2 size-4" />
              Restaurar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={archive}>
              <Archive className="mr-2 size-4" />
              Arquivar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setOpenDelete(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Excluir definitivo…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir caso definitivamente</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Isso remove o caso e seus vínculos do sistema. Documentos vinculados ao caso também serão removidos
              (storage + índices) no melhor esforço.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Para confirmar, digite <span className="font-mono font-semibold">EXCLUIR</span>.
            </p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <p className="text-xs text-muted-foreground">Caso: “{caseTitle}”</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!canDelete} onClick={hardDelete}>
              Excluir definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

