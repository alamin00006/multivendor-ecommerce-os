'use client';

import { errorMessage, useMyDocumentsQuery, useOpenDocumentMutation, useRemoveDocumentMutation, useUploadDocumentMutation } from '@marketbd/api-client';
import { SELLER_DOCUMENT_INFO, SELLER_DOCUMENT_TYPES, SELLER_DOCUMENT_UPLOAD, type SellerDocumentType, type SellerDocumentView } from '@marketbd/shared';
import { BadgeCheck, Eye, FileText, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, ErrorState, Modal, Skeleton } from '../primitives';

const STATUS: Record<SellerDocumentView['status'], { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'In review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Not accepted', tone: 'danger' },
};

export function DocumentStatusBadge({ status }: { status: SellerDocumentView['status'] }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

/** Shows one private document (image or PDF) from an object URL; frees the URL on close. */
export function DocumentPreview({ title, url, mimeType, onClose }: { title: string; url: string | null; mimeType: string; onClose: () => void }) {
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <Modal open={url !== null} onClose={onClose} title={title} size="xl">
      {url &&
        (mimeType === 'application/pdf' ? (
          <iframe src={url} title={title} className="h-[70vh] w-full rounded border border-ink-100" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="mx-auto max-h-[70vh] rounded" />
        ))}
    </Modal>
  );
}

/** Hook: opens a document (own or, with sellerId, a shop's as admin) in a preview. */
export function useDocumentPreview(sellerId?: string) {
  const [open] = useOpenDocumentMutation();
  const [state, setState] = useState<{ title: string; url: string; mimeType: string } | null>(null);
  const show = async (doc: SellerDocumentView) => {
    try {
      const url = await open({ id: doc.id, sellerId }).unwrap();
      setState({ title: SELLER_DOCUMENT_INFO[doc.type].label, url, mimeType: doc.mimeType });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const preview = <DocumentPreview title={state?.title ?? ''} url={state?.url ?? null} mimeType={state?.mimeType ?? ''} onClose={() => setState(null)} />;
  return { show, preview };
}

function DocumentCard({ type, doc, locked, onView }: { type: SellerDocumentType; doc: SellerDocumentView | undefined; locked: boolean; onView: (d: SellerDocumentView) => void }) {
  const info = SELLER_DOCUMENT_INFO[type];
  const input = useRef<HTMLInputElement>(null);
  const [upload, { isLoading }] = useUploadDocumentMutation();
  const [remove] = useRemoveDocumentMutation();
  const canChange = !(locked && doc?.status === 'APPROVED');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > SELLER_DOCUMENT_UPLOAD.maxBytes) return void toast.error('The file is larger than 5 MB');
    const body = new FormData();
    body.append('file', file);
    try {
      await upload({ type, file: body }).unwrap();
      toast.success('Uploaded. We will review it soon.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-ink-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {info.label} {info.required && <span className="text-xs font-normal text-red-600">Required</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">{info.hint}</p>
        </div>
        {doc && <DocumentStatusBadge status={doc.status} />}
      </div>
      {doc?.status === 'REJECTED' && doc.note && <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{doc.note}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {doc && (
          <Button size="sm" variant="ghost" onClick={() => onView(doc)}>
            <Eye className="size-4" /> View
          </Button>
        )}
        {canChange && (
          <>
            <input ref={input} type="file" accept={SELLER_DOCUMENT_UPLOAD.mimeTypes.join(',')} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
            <Button size="sm" variant={doc ? 'ghost' : 'primary'} loading={isLoading} onClick={() => input.current?.click()}>
              <Upload className="size-4" /> {doc ? 'Replace' : 'Upload'}
            </Button>
          </>
        )}
        {doc && doc.status !== 'APPROVED' && (
          <Button size="sm" variant="ghost" aria-label={`Remove ${info.label}`} onClick={() => void remove(doc.id).unwrap().catch((e: unknown) => toast.error(errorMessage(e)))}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** The shop's verification papers: upload, replace, see review status. */
export function SellerDocumentsManager() {
  const { data, isLoading, isError, refetch } = useMyDocumentsQuery();
  const { show, preview } = useDocumentPreview();
  if (isError) return <ErrorState message="Could not load your documents." onRetry={() => void refetch()} />;
  if (isLoading || !data) return <Skeleton className="h-64" />;
  const byType = new Map(data.documents.map((d) => [d.type, d]));
  return (
    <div className="space-y-4">
      {data.verifiedAt ? (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <BadgeCheck className="size-5 shrink-0" /> Your shop is verified. Shoppers see a “Verified seller” badge.
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
          <FileText className="mt-0.5 size-5 shrink-0" />
          <span>
            Upload the owner’s National ID (both sides) to get the <b>Verified seller</b> badge. Photos or PDF, up to 5 MB. Only our verification team can see these files.
            {data.missing.length > 0 && <> Still needed: {data.missing.map((t) => SELLER_DOCUMENT_INFO[t].label).join(', ')}.</>}
          </span>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {SELLER_DOCUMENT_TYPES.map((t) => (
          <DocumentCard key={t} type={t} doc={byType.get(t)} locked={Boolean(data.verifiedAt)} onView={(d) => void show(d)} />
        ))}
      </div>
      {preview}
    </div>
  );
}
