"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import ReportModal, { type ReportTargetType } from "./ReportModal";

interface Props {
  targetType: ReportTargetType;
  targetTitle?: string;
  reporterEmail?: string;
  reporterName?: string;
  label?: string;
  className?: string;
}

export default function ReportButton({
  targetType, targetTitle, reporterEmail, reporterName,
  label, className,
}: Props) {
  const [open, setOpen] = useState(false);

  const defaultLabel =
    targetType === "property" ? "Reportar este anuncio" :
    targetType === "user" ? "Reportar a este usuario" :
    targetType === "app" ? "Reportar un problema" :
    "Contactar a Beel";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "inline-flex items-center gap-1.5 text-body-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline transition-colors"}
      >
        <Flag size={13} />
        {label ?? defaultLabel}
      </button>

      <ReportModal
        open={open}
        onClose={() => setOpen(false)}
        targetType={targetType}
        targetTitle={targetTitle}
        reporterEmail={reporterEmail}
        reporterName={reporterName}
      />
    </>
  );
}
