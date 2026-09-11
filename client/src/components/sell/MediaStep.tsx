import { useRef } from 'react';
import styles from './MediaStep.module.css';

export interface PreviewImage {
  name: string;
  url: string;
}

interface MediaStepProps {
  images: PreviewImage[];
  onChange: (images: PreviewImage[]) => void;
}

export function MediaStep({ images, onChange }: MediaStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...images];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      next.push({ name: file.name, url: URL.createObjectURL(file) });
      if (next.length >= 8) break;
    }
    onChange(next.slice(0, 8));
  };

  const removeAt = (index: number) => {
    const removed = images[index];
    if (removed) URL.revokeObjectURL(removed.url);
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h3 className={styles.heading}>Media</h3>
      <p className={styles.lead}>Show proof of rank, skins and inventory. Up to 8 screenshots — never include passwords.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Upload screenshots"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {images.length > 0 && (
        <div className={styles.grid}>
          {images.map((img, i) => (
            <div key={`${img.name}-${i}`} className={styles.cell}>
              <img src={img.url} alt={`Screenshot ${i + 1}`} className={styles.thumb} />
              <button type="button" className={styles.removeBtn} aria-label={`Remove screenshot ${i + 1}`} onClick={() => removeAt(i)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < 8 && (
        <button type="button" className={styles.uploadBtn} onClick={() => inputRef.current?.click()}>
          + Add screenshots ({images.length}/8)
        </button>
      )}
    </div>
  );
}
