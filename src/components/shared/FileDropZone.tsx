import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Loader2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FileDropZoneProps = {
  label: string;
  accept: string;
  selectedFile: File | null;
  onFileSelected: (file: File | null) => void;
  validateFile?: (file: File) => string | null;
  existingFileName?: string | null;
  disabled?: boolean;
  uploading?: boolean;
  uploadingHint?: string;
  compact?: boolean;
  idleTitle?: string;
  idleSub?: string;
  ariaLabel?: string;
  /** Mostra asterisco e destaque se obrigatório e ainda sem ficheiro. */
  required?: boolean;
  /** Erro de validação externa (ex.: campo obrigatório por preencher). */
  showRequiredHint?: boolean;
};

export function FileDropZone({
  label,
  accept,
  selectedFile,
  onFileSelected,
  validateFile,
  existingFileName,
  disabled,
  uploading,
  uploadingHint,
  compact,
  idleTitle,
  idleSub,
  ariaLabel,
  required,
  showRequiredHint,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const applyChosenFile = useCallback(
    (file: File | null) => {
      if (!file) {
        onFileSelected(null);
        return;
      }
      const err = validateFile?.(file);
      if (err) {
        toast.error(err);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected, validateFile],
  );

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploading) return;
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) {
      try {
        e.dataTransfer.dropEffect = 'copy';
      } catch {
        /* ignore */
      }
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (disabled || uploading) return;
    applyChosenFile(e.dataTransfer.files?.[0] ?? null);
  }

  const blocked = Boolean(disabled || uploading);
  const missingRequired = Boolean(required && !selectedFile && !existingFileName?.trim());
  const showErrorState = missingRequired && showRequiredHint;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        disabled={blocked}
        onChange={(ev: ChangeEvent<HTMLInputElement>) => {
          applyChosenFile(ev.target.files?.[0] ?? null);
          ev.target.value = '';
        }}
      />
      <div
        role="button"
        tabIndex={blocked ? -1 : 0}
        aria-disabled={blocked}
        aria-label={ariaLabel ?? `Área para largar ou escolher ficheiro: ${label}`}
        className={cn(
          'w-full rounded-xl border-2 border-dashed text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'flex flex-col items-center justify-center gap-1.5',
          compact ? 'min-h-[112px] p-4' : 'min-h-[140px] p-6',
          !blocked && 'cursor-pointer',
          blocked && 'pointer-events-none opacity-70',
          isDragging && !blocked ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted/20 hover:bg-muted/35',
          showErrorState && 'border-destructive/50 bg-destructive/5',
        )}
        onClick={() => {
          if (!blocked) inputRef.current?.click();
        }}
        onKeyDown={e => {
          if (blocked) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <div className="text-sm font-medium text-center">A enviar…</div>
            {uploadingHint ? (
              <div className="text-xs text-muted-foreground text-center max-w-[240px]">{uploadingHint}</div>
            ) : null}
            {selectedFile ? (
              <div className="mt-0.5 text-xs font-medium text-foreground truncate max-w-full px-1 text-center">
                {selectedFile.name}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <UploadCloud
              className={cn(compact ? 'h-7 w-7' : 'h-9 w-9', isDragging ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden
            />
            <div className="text-sm font-medium text-center">
              {isDragging ? 'Largue o ficheiro aqui' : (idleTitle ?? 'Arraste o ficheiro para aqui')}
            </div>
            <div className={cn('text-muted-foreground text-center px-1', compact ? 'text-[11px] max-w-[200px]' : 'text-xs max-w-[280px]')}>
              {idleSub ?? 'ou clique para seleccionar'}
            </div>
          </>
        )}
      </div>
      {selectedFile && !uploading ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs">
          <span className="min-w-0 truncate font-medium">{selectedFile.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={blocked}
            aria-label="Remover ficheiro seleccionado"
            onClick={e => {
              e.stopPropagation();
              onFileSelected(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
      {!selectedFile && existingFileName?.trim() ? (
        <p className="text-xs text-muted-foreground">
          Ficheiro actual: <span className="font-medium text-foreground">{existingFileName}</span> — substitua ao
          largar ou seleccionar outro
        </p>
      ) : null}
      {showErrorState ? (
        <p className="text-xs text-destructive">Este anexo é obrigatório.</p>
      ) : null}
    </div>
  );
}
