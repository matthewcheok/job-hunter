"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Check,
  Clipboard,
  FileUp,
  LoaderCircle,
  Minimize2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  generateCoverLetter,
  refineCoverLetter,
  updateCoverLetter,
  uploadResume,
} from "@/app/actions";
import {
  type ApplicationWithCurrentStatus,
  type UserResume,
} from "@/lib/types";

type StatusKind = "idle" | "working" | "success" | "error";

export function CoverLetterTab({
  application,
  resume,
}: {
  application: ApplicationWithCurrentStatus;
  resume: UserResume | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [coverLetter, setCoverLetter] = useState(application.cover_letter ?? "");
  const [lastSavedCoverLetter, setLastSavedCoverLetter] = useState(
    application.cover_letter ?? "",
  );
  const [resumeLabel, setResumeLabel] = useState(resume?.original_filename ?? "");
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<
    number | null
  >(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [conciseStatus, setConciseStatus] = useState<"idle" | "done">("idle");
  const [regenerateStatus, setRegenerateStatus] = useState<
    "idle" | "working" | "done"
  >("idle");
  const [isRefining, setIsRefining] = useState(false);
  const [status, setStatus] = useState<{
    kind: StatusKind;
    message: string;
  }>({ kind: "idle", message: "" });

  const hasResume = Boolean(resumeLabel);
  const paragraphs = splitParagraphs(coverLetter);
  const hasCoverLetter = coverLetter.trim().length > 0;

  function runAction(action: () => Promise<void>, workingMessage: string) {
    setStatus({ kind: "working", message: workingMessage });
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setIsRefining(false);
        setStatus({ kind: "error", message: getErrorMessage(error) });
      }
    });
  }

  function handleResumeUpload(file: File | undefined) {
    setIsDraggingResume(false);

    if (!file) {
      return;
    }

    runAction(async () => {
      const formData = new FormData();
      formData.set("resume", file);
      const result = await uploadResume(formData);
      setResumeLabel(result.original_filename);
      setStatus({ kind: "success", message: "Resume uploaded." });
      router.refresh();
    }, "Uploading resume...");
  }

  function handleGenerate() {
    runAction(async () => {
      setRegenerateStatus("working");
      const result = await generateCoverLetter(getCoverLetterFormData());
      applyGeneratedText(result.cover_letter);
      setRegenerateStatus("done");
      window.setTimeout(() => setRegenerateStatus("idle"), 1800);
    }, "Generating cover letter...");
  }

  function handlePreset(mode: "concise" | "detailed") {
    runAction(async () => {
      await saveManualText();
      const formData = getCoverLetterFormData();
      formData.set("mode", mode);
      const result = await refineCoverLetter(formData);
      applyGeneratedText(result.cover_letter);
      if (mode === "concise") {
        setConciseStatus("done");
        window.setTimeout(() => setConciseStatus("idle"), 1800);
      }
    }, mode === "concise" ? "Tightening the letter..." : "Adding detail...");
  }

  function handlePromptSubmit() {
    if (!prompt.trim()) {
      return;
    }

    runAction(
      async () => {
        setIsRefining(true);
        await saveManualText();
        const formData = getCoverLetterFormData();
        formData.set("mode", "custom");
        formData.set("instruction", prompt);
        if (selectedParagraphIndex !== null) {
          formData.set("paragraph_index", String(selectedParagraphIndex));
        }
        const result = await refineCoverLetter(formData);
        applyGeneratedText(result.cover_letter);
        setPrompt("");
        setSelectedParagraphIndex(null);
        setIsRefining(false);
      },
      selectedParagraphIndex === null
        ? "Refining cover letter..."
        : "Refining paragraph...",
    );
  }

  async function handleCopy() {
    if (!coverLetter.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setStatus({ kind: "error", message: "Unable to copy this browser tab." });
    }
  }

  async function saveManualText() {
    const next = coverLetter.trim();

    if (next === lastSavedCoverLetter) {
      return;
    }

    const formData = getCoverLetterFormData();
    formData.set("cover_letter", next);
    const result = await updateCoverLetter(formData);
    setCoverLetter(result.cover_letter);
    setLastSavedCoverLetter(result.cover_letter);
    setStatus({ kind: "success", message: "Cover letter saved." });
  }

  function applyGeneratedText(text: string) {
    setCoverLetter(text);
    setLastSavedCoverLetter(text);
    setStatus({ kind: "idle", message: "" });
    router.refresh();
  }

  function getCoverLetterFormData() {
    const formData = new FormData();
    formData.set("id", application.id);
    formData.set("cover_letter", coverLetter);
    return formData;
  }

  return (
    <>
      <div className="pane-content cover-letter-pane">
        <div
          className="resume-upload-row"
          data-dragging={isDraggingResume}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDraggingResume(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDraggingResume(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDraggingResume(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleResumeUpload(event.dataTransfer.files[0]);
          }}
        >
          <div>
            <p className="form-mode-copy">Resume</p>
            <p className="cover-letter-helper">
              {resumeLabel
                ? resumeLabel
                : "Upload a PDF resume to generate letters."}
            </p>
          </div>
          <input
            accept="application/pdf"
            className="sr-only"
            onChange={(event) =>
              handleResumeUpload(event.currentTarget.files?.[0])
            }
            ref={fileInputRef}
            type="file"
          />
          <button
            className="secondary-button icon-button-label"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {isPending && status.message.includes("Uploading") ? (
              <LoaderCircle
                aria-hidden="true"
                className="button-spinner"
                size={16}
              />
            ) : (
              <FileUp aria-hidden="true" size={16} />
            )}
            Upload PDF
          </button>
        </div>

        {status.message &&
        status.kind !== "success" &&
        !status.message.toLowerCase().includes("generating") &&
        !status.message.toLowerCase().includes("refining") ? (
          <p className="cover-letter-status" data-kind={status.kind}>
            {status.kind === "working" ? (
              <LoaderCircle
                aria-hidden="true"
                className="button-spinner"
                size={14}
              />
            ) : null}
            {status.message}
          </p>
        ) : null}

        {paragraphs.length > 0 ? (
          <div className="paragraph-refinement">
            <p className="form-mode-copy">Generated cover letter</p>
            <div className="paragraph-list">
              {paragraphs.map((paragraph, index) => (
                <button
                  aria-pressed={selectedParagraphIndex === index}
                  className="paragraph-button"
                  key={`${index}-${paragraph.slice(0, 18)}`}
                  onClick={() =>
                    setSelectedParagraphIndex((current) =>
                      current === index ? null : index,
                    )
                  }
                  type="button"
                >
                  {paragraph}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="cover-letter-empty-state">
            <div>
              <h3 className="font-bold text-lg">Ready to apply?</h3>
              <p>Create a personalized cover letter based on your real experience and skills.</p>
            </div>
            <button
              className="primary-button icon-button-label"
              disabled={!hasResume || isPending}
              onClick={handleGenerate}
              type="button"
            >
              {isPending && status.message.includes("Generating") ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="button-spinner"
                  size={16}
                />
              ) : (
                <Sparkles aria-hidden="true" size={16} />
              )}
              Generate
            </button>
          </div>
        )}
      </div>

      {hasCoverLetter ? (
        <div className="cover-letter-footer">
          <div className="cover-letter-footer-actions">
            <button
              className="cover-letter-pill-button"
              onClick={handleCopy}
              type="button"
            >
              {copyStatus === "copied" ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <Clipboard aria-hidden="true" size={15} />
              )}
              {copyStatus === "copied" ? "Copied" : "Copy"}
            </button>
            <button
              className="cover-letter-pill-button"
              disabled={!hasResume || isPending}
              onClick={() => handlePreset("concise")}
              type="button"
            >
              {conciseStatus === "done" ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <Minimize2 aria-hidden="true" size={15} />
              )}
              {conciseStatus === "done" ? "Shortened" : "Concise"}
            </button>
            <button
              className="cover-letter-pill-button"
              disabled={!hasResume || isPending}
              onClick={handleGenerate}
              type="button"
            >
              {regenerateStatus === "working" ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="button-spinner"
                  size={15}
                />
              ) : regenerateStatus === "done" ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <RotateCcw aria-hidden="true" size={15} />
              )}
              {regenerateStatus === "done" ? "Regenerated" : "Regenerate"}
            </button>
          </div>
          <div className="cover-letter-prompt-bar">
            <input
              onChange={(event) => setPrompt(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handlePromptSubmit();
                }
              }}
              placeholder={
                selectedParagraphIndex === null
                  ? "Refine the cover letter..."
                  : "Refine this paragraph..."
              }
              type="text"
              value={prompt}
            />
            <button
              className="primary-button"
              disabled={!hasResume || !prompt.trim() || isPending || isRefining}
              onClick={handlePromptSubmit}
              type="button"
            >
              {isRefining ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="button-spinner"
                  size={16}
                />
              ) : (
                <ArrowUp aria-hidden="true" size={16} />
              )}
              <span className="sr-only">Refine cover letter</span>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function splitParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
