'use client';

import { errorMessage, useUploadImageMutation } from '@marketbd/api-client';
import { UPLOADS, type UploadFolder } from '@marketbd/shared';
import { ImagePlus, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '../primitives';

/** Uploads images to /uploads/image and returns their public URLs. */
export function useImageUpload(folder: UploadFolder) {
  const [upload, state] = useUploadImageMutation();
  const uploadFiles = async (files: FileList | File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (!(UPLOADS.allowedImageMimeTypes as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG, WebP or AVIF`);
        continue;
      }
      if (file.size > UPLOADS.maxImageBytes) {
        toast.error(`${file.name}: larger than 5 MB`);
        continue;
      }
      const body = new FormData();
      body.append('file', file);
      try {
        urls.push((await upload({ folder, file: body }).unwrap()).url);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    }
    return urls;
  };
  return { uploadFiles, uploading: state.isLoading };
}

/** Multi-image picker with reorder-by-removal and upload. */
export function ImageListField({
  value,
  onChange,
  folder,
  max = 10,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  folder: UploadFolder;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { uploadFiles, uploading } = useImageUpload(folder);
  return (
    <div className="flex flex-wrap gap-3">
      {value.map((url, i) => (
        <div key={url} className="relative size-24 overflow-hidden rounded-lg border border-ink-100">
          <Image src={url} alt="" fill sizes="96px" className="object-cover" />
          {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-primary-700 py-0.5 text-center text-[10px] text-white">Cover</span>}
          <button
            type="button"
            onClick={() => onChange(value.filter((u) => u !== url))}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
            aria-label="Remove image"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className={cn('flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-ink-200 text-xs text-ink-500 hover:border-primary-500')}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          Upload
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept={UPLOADS.allowedImageMimeTypes.join(',')}
        multiple={max > 1}
        hidden
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          const urls = await uploadFiles(e.target.files);
          onChange([...value, ...urls].slice(0, max));
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Single image field (logo, banner, icon). */
export function ImageField({ value, onChange, folder }: { value: string | null | undefined; onChange: (url: string | null) => void; folder: UploadFolder }) {
  return <ImageListField value={value ? [value] : []} onChange={(urls) => onChange(urls[0] ?? null)} folder={folder} max={1} />;
}
