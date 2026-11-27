'use client';

import { errorMessage, useAdminReviewDocumentMutation, useAdminSellerDocumentsQuery, useAdminVerifySellerMutation } from '@marketbd/api-client';
import { SELLER_DOCUMENT_INFO, type SellerDocumentView } from '@marketbd/shared';
import { Badge, Button, DocumentStatusBadge, EmptyState, fmtDate, Modal, Skeleton, useDocumentPreview } from '@marketbd/ui';
import { BadgeCheck, Eye, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

function Row({ sellerId, doc, onView }: { sellerId: string; doc: SellerDocumentView; onView: () => void }) {
  const [review, { isLoading }] = useAdminReviewDocumentMutation();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const decide = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      await review({ sellerId, id: doc.id, status, note: status === 'REJECTED' ? note : undefined }).unwrap();
      toast.success(status === 'APPROVED' ? 'Approved' : 'Rejected; the seller was told why');
      setRejecting(false);
      setNote('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{SELLER_DOCUMENT_INFO[doc.type].label}</p>
          <p className="text-xs text-ink-500">
            {doc.mimeType === 'application/pdf' ? 'PDF' : 'Photo'} · uploaded {fmtDate(doc.createdAt)}
            {doc.reviewedAt && ` · reviewed ${fmtDate(doc.reviewedAt)}`}
          </p>
        </div>
        <DocumentStatusBadge status={doc.status} />
        <Button size="sm" variant="ghost" onClick={onView}>
          <Eye className="size-4" /> View
        </Button>
        {doc.status !== 'APPROVED' && (
          <Button size="sm" loading={isLoading && !rejecting} onClick={() => void decide('APPROVED')}>
            Approve
          </Button>
        )}
        {doc.status !== 'REJECTED' && !rejecting && (
          <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        )}
      </div>
      {doc.status === 'REJECTED' && doc.note && <p className="mt-1 text-xs text-red-700">Reason sent: {doc.note}</p>}
      {rejecting && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="input h-9 flex-1" autoFocus placeholder="Reason, e.g. photo is blurry" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="danger" loading={isLoading} disabled={note.trim().length < 3} onClick={() => void decide('REJECTED')}>
            Send
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

/** Admin → Sellers: check a shop's documents and set the "Verified seller" badge. */
export function SellerDocumentsReview({ sellerId, shopName, onClose }: { sellerId: string; shopName: string; onClose: () => void }) {
  const { data, isLoading } = useAdminSellerDocumentsQuery(sellerId);
  const [verify, { isLoading: saving }] = useAdminVerifySellerMutation();
  const { show, preview } = useDocumentPreview(sellerId);

  const setVerified = async (verified: boolean) => {
    try {
      await verify({ sellerId, verified }).unwrap();
      toast.success(verified ? `${shopName} is now verified` : 'Verification removed');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={`Documents · ${shopName}`} size="lg">
      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 p-3 text-sm">
            {data.verifiedAt ? (
              <>
                <BadgeCheck className="size-5 text-green-700" />
                <span className="flex-1">Verified since {fmtDate(data.verifiedAt)}</span>
                <Button size="sm" variant="ghost" loading={saving} onClick={() => void setVerified(false)}>
                  Remove badge
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1">
                  {data.missing.length ? (
                    <>Waiting for: {data.missing.map((t) => SELLER_DOCUMENT_INFO[t].label).join(', ')}</>
                  ) : (
                    <>Approve both NID sides, then mark the shop as verified.</>
                  )}
                </span>
                <Button size="sm" loading={saving} onClick={() => void setVerified(true)}>
                  <BadgeCheck className="size-4" /> Mark verified
                </Button>
              </>
            )}
          </div>
          {data.documents.length === 0 ? (
            <EmptyState icon={<FileText />} title="No documents yet" text="The seller has not uploaded anything." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.documents.map((d) => (
                <Row key={d.id} sellerId={sellerId} doc={d} onView={() => void show(d)} />
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-500">
            <Badge>Private</Badge> These files are not public. Opening one is allowed only for admins with the Sellers section.
          </p>
        </div>
      )}
      {preview}
    </Modal>
  );
}
