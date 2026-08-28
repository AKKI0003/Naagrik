import { useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Dialog';
import { CATEGORY_META, SELECTABLE_CATEGORIES, type ReportCategory, type ReportModel } from '../../types/report';
import type { ReportsRepository } from '../../services/reportsRepository';
import type { ClassificationService, ClassificationResult } from '../../services/classificationService';

type Step = 'capture' | 'classifying' | 'confirm' | 'checkingDuplicate' | 'duplicateFound' | 'submitting' | 'done';

interface Props {
  initialLocation: { lat: number; lng: number };
  repository: ReportsRepository;
  classificationService: ClassificationService;
  uid: string;
  onClose: () => void;
}

/**
 * The core loop from the pitch, as an actual working flow:
 * Capture → Classify (stubbed until the AI service from the
 * architecture slide is deployed) → Confirm/correct category →
 * duplicate check → submit. Ported from the Flutter version's
 * NewReportSheet, which itself adapted spidertrack's AddPhotosSheet —
 * restructured here around browser APIs (file input with `capture`
 * for the camera, instead of image_picker).
 */
export function NewReportSheet({ initialLocation, repository, classificationService, uid, onClose }: Props) {
  const [step, setStep] = useState<Step>('capture');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [duplicates, setDuplicates] = useState<ReportModel[]>([]);
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  // Same photo similarity is already used to *find* duplicate candidates
  // (server-side, via /nearby-similar); this threshold decides whether
  // the top candidate is shown as "likely the same issue" copy or the
  // more cautious "an open report nearby" copy — a GPS-only match (no
  // embedding on either side) still surfaces, just without that claim.
  const LIKELY_SAME_THRESHOLD = 0.92;
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setStep('classifying');
    // Run in parallel — classification and embedding are independent
    // calls to the same service, no reason to serialize them.
    const [res, emb] = await Promise.all([
      classificationService.classify(file),
      classificationService.embed(file),
    ]);
    setEmbedding(emb);

    if (!res.passedSafetyFilter) {
      // Declined outright, no explanation — same "reject, don't explain
      // why" behavior discussed for this class of content.
      onClose();
      toast.error("This image can't be used.");
      return;
    }

    setResult(res);
    setSelectedCategory(res.predictedCategory === 'not_an_issue' ? null : res.predictedCategory);
    // Pre-fill with the AI caption, but this is just a starting
    // point — the textarea in ConfirmStep is always editable, and
    // nothing publishes until the user hits Confirm & Continue. Same
    // "human always has final say" rule as the category itself.
    setDescription(res.description ?? '');
    setStep('confirm');
  }

  async function confirmCategory() {
    if (!selectedCategory) return;
    setStep('checkingDuplicate');
    const nearby = await repository.findNearbyOpenReports(initialLocation.lat, initialLocation.lng, undefined, embedding);
    if (nearby.length > 0) {
      setDuplicates(nearby);
      setStep('duplicateFound');
    } else {
      await submit();
    }
  }

  async function confirmDuplicate(existing: ReportModel) {
    await repository.confirmAsDuplicate(existing.id);
    toast.success('Added your confirmation to an existing report.');
    onClose();
  }

  async function submit() {
    setStep('submitting');
    // NOTE: photo upload isn't wired up in this scaffold — photoUrl is
    // left null so the rest of the flow (model, repository, map,
    // dedup) can be built and demoed without the upload leg finished
    // first. See README for the storage options that fit the free
    // Node/Postgres backend (S3-compatible bucket, e.g. Backblaze B2
    // or Cloudflare R2 free tier).
    const report: Omit<ReportModel, 'id'> = {
      reporterId: uid,
      lat: initialLocation.lat,
      lng: initialLocation.lng,
      category: selectedCategory!,
      modelConfidence: result?.confidence ?? 0,
      userConfirmed: true,
      createdAt: Date.now(),
      status: 'open',
      upvotes: 0,
      flagCount: 0,
      photoUrl: null,
      photoObjectKey: null,
      embedding,
      description: description.trim() || null,
    };
    await repository.createReport(report);
    setStep('done');
    setTimeout(onClose, 700);
  }

  return (
    <Drawer.Root
      open
      onOpenChange={(isOpen) => {
        // Fires on backdrop click, Esc, and a real drag-down dismiss —
        // all three now correctly go through the same onClose path
        // that the manual `onClick={onClose}` overlay used to handle,
        // but with actual spring-physics drag instead of an all-or-
        // nothing click target.
        if (!isOpen) onClose();
      }}
      // While mid-flow (classifying/submitting), a stray drag shouldn't
      // silently discard the report — only the terminal/idle steps are
      // freely dismissible by dragging.
      dismissible={step === 'capture' || step === 'confirm' || step === 'duplicateFound' || step === 'done'}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[1100] bg-black/60" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[1100] mx-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-[24px] border-t border-cyanDark/40 bg-panel p-5 pb-8 shadow-panel outline-none sm:bottom-8 sm:top-8 sm:rounded-[24px] sm:border"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Report an issue</Drawer.Title>
          <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-mutedDark sm:hidden" />


        {step === 'capture' && (
          <div className="flex flex-col gap-3">
            <h2 className="text-[19px] font-bold text-white">Report an issue</h2>
            <p className="text-[13px] leading-relaxed text-muted">
              Photograph any public problem — pothole, garbage, broken light, waterlogging, or anything else.
            </p>
            <div className="mt-2 flex flex-col gap-2.5">
              <Button label="Take Photo" fullWidth onClick={() => cameraInputRef.current?.click()} />
              <Button label="Choose From Gallery" outlined fullWidth onClick={() => galleryInputRef.current?.click()} />
            </div>
            {/* `capture="environment"` opens the rear camera directly on
                mobile browsers that support it; falls back to a normal
                file picker everywhere else (including desktop). */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFileSelected(e.target.files?.[0])}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFileSelected(e.target.files?.[0])}
            />
          </div>
        )}

        {step === 'classifying' && <LoadingStep label="Checking your photo…" />}

        {step === 'confirm' && result && (
          <ConfirmStep
            photoPreview={photoPreview!}
            result={result}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            description={description}
            onDescriptionChange={setDescription}
            onConfirm={confirmCategory}
          />
        )}

        {step === 'checkingDuplicate' && <LoadingStep label="Checking nearby reports…" />}

        {step === 'duplicateFound' && duplicates.length > 0 && (
          <DuplicateStep
            existing={duplicates[0]}
            likelySame={(duplicates[0].similarity ?? 0) >= LIKELY_SAME_THRESHOLD}
            onConfirmDuplicate={() => confirmDuplicate(duplicates[0])}
            onSubmitAsNew={submit}
          />
        )}

        {step === 'submitting' && <LoadingStep label="Publishing your report…" />}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6FCF97" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="font-bold text-white">Report published</p>
          </div>
        )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function LoadingStep({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-cyan border-t-transparent" />
      <p className="text-[13px] text-muted">{label}</p>
    </div>
  );
}

function ConfirmStep({
  photoPreview,
  result,
  selected,
  onSelect,
  description,
  onDescriptionChange,
  onConfirm,
}: {
  photoPreview: string;
  result: ClassificationResult;
  selected: ReportCategory | null;
  onSelect: (c: ReportCategory) => void;
  description: string;
  onDescriptionChange: (d: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <img src={photoPreview} alt="Captured issue" className="h-44 w-full rounded-xl object-cover" />

      {result.needsManualReview && (
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: '#D9AF5266', backgroundColor: '#D9AF5214' }}>
          <p className="text-xs" style={{ color: '#D9AF52' }}>
            Not confident enough to guess — please pick the right category yourself.
          </p>
        </div>
      )}

      <h3 className="text-[15px] font-bold text-white">What kind of issue is this?</h3>
      <div className="flex flex-wrap gap-2">
        {SELECTABLE_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const isSelected = selected === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px]"
              style={{
                borderColor: isSelected ? meta.hex : '#5C6884',
                backgroundColor: isSelected ? `${meta.hex}2E` : '#0B1926',
                color: isSelected ? '#fff' : '#8B96AC',
                fontWeight: isSelected ? 700 : 400,
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.hex }} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[12px] font-medium text-muted">Description</label>
          {result.description && (
            <span className="text-[10.5px] font-semibold text-cyan/70">AI-suggested — edit freely</span>
          )}
        </div>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Briefly describe what's wrong (optional, but helps other people and moderators understand it faster)"
          rows={3}
          maxLength={280}
          className="w-full resize-none rounded-lg border border-cyanDark/40 bg-panelAlt px-3 py-2.5 text-[13px] text-white placeholder:text-mutedDark outline-none transition-colors focus:border-cyan"
        />
      </div>

      <Button label="Confirm & Continue" fullWidth disabled={!selected} onClick={onConfirm} />
    </div>
  );
}

function DuplicateStep({
  existing,
  likelySame,
  onConfirmDuplicate,
  onSubmitAsNew,
}: {
  existing: ReportModel;
  /** True when CLIP similarity crosses the "likely the same photo
   * subject" threshold — lets the copy be confident instead of vague
   * when the AI service actually backs the suggestion. */
  likelySame: boolean;
  onConfirmDuplicate: () => void;
  onSubmitAsNew: () => void;
}) {
  const meta = CATEGORY_META[existing.category];
  const ageDays = existing.createdAt ? Math.floor((Date.now() - existing.createdAt) / 86400000) : 0;
  const hasSimilarity = typeof existing.similarity === 'number' && existing.similarity > 0;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[17px] font-bold text-white">Is this the same issue?</h3>
      <p className="text-[13px] leading-relaxed text-muted">
        {likelySame
          ? `This photo looks like the same ${meta.label.toLowerCase()} issue as an open report nearby.`
          : `There's already an open ${meta.label.toLowerCase()} report nearby — ${existing.upvotes} ${existing.upvotes === 1 ? 'person has' : 'people have'} confirmed it.`}
      </p>
      <div className="flex items-center gap-3 rounded-[10px] border p-3" style={{ borderColor: '#2E93A6', backgroundColor: '#0B1926' }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold text-bg" style={{ backgroundColor: meta.hex }}>
          {meta.icon}
        </span>
        <span className="flex-1 font-semibold text-white">{meta.label}</span>
        {hasSimilarity && (
          <span
            className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
            style={{ color: likelySame ? '#6FCF97' : '#8B96AC', backgroundColor: likelySame ? '#6FCF9722' : 'transparent' }}
          >
            {Math.round((existing.similarity ?? 0) * 100)}% match
          </span>
        )}
        <span className="text-xs text-muted">{ageDays}d old</span>
      </div>
      <Button label="Yes, Same Issue — Confirm It" fullWidth onClick={onConfirmDuplicate} />
      <Button label="No, This Is Different" outlined fullWidth onClick={onSubmitAsNew} />
    </div>
  );
}
