"use client";

import { useEffect, useId, useRef, type SyntheticEvent } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

export interface DeleteModuleDialogProps {
  open: boolean;
  moduleTitle: string;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteModuleDialog({
  open,
  moduleTitle,
  deleting = false,
  onClose,
  onConfirm,
}: DeleteModuleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => cancelButtonRef.current?.focus());
      return;
    }

    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (deleting) {
      event.preventDefault();
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="delete-module-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={deleting}
      onCancel={handleCancel}
      onClose={() => {
        if (open && !deleting) onClose();
      }}
    >
      <div className="delete-module-dialog-content">
        <span className="delete-module-dialog-icon" aria-hidden="true">
          <Trash2 size={22} />
        </span>
        <div>
          <h2 id={titleId}>Delete “{moduleTitle}”?</h2>
          <p id={descriptionId}>
            This permanently removes the private draft, lesson content, scenarios,
            questions, and its uploaded cover image. This action cannot be undone.
          </p>
        </div>
      </div>

      <div className="delete-module-dialog-actions">
        <button
          ref={cancelButtonRef}
          className="button button-secondary"
          type="button"
          onClick={onClose}
          disabled={deleting}
        >
          Cancel
        </button>
        <button
          className="button delete-module-confirm"
          type="button"
          onClick={() => void onConfirm()}
          disabled={deleting}
        >
          {deleting ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}
          {deleting ? "Deleting…" : "Delete draft"}
        </button>
      </div>
    </dialog>
  );
}
