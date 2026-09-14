import { useRef } from 'react';
import styles from './MediaStep.module.css';

export interface PreviewImage {
  name: string;
  url: string;
  file: File;
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
      next.push({ name: file.name, url: URL.createObjectURL(file), file });
      if (next.length >= 15) break;
    }
    onChange(next.slice(0, 15));
  };

  const removeAt = (index: number) => {
    const removed = images[index];
    if (removed) URL.revokeObjectURL(removed.url);
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h3 className={styles.heading}>Зураг</h3>
      <p className={styles.lead}>
        Ранк, скин болон инвенторийн нотолгоо болох зургуудыг оруулна уу. Нийт 15 хүртэлх скриншот оруулах боломжтой — нууц үгээ хэзээ ч бүү харуул.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Скриншот зураг оруулах"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {images.length > 0 && (
        <div className={styles.grid}>
          {images.map((img, i) => (
            <div key={`${img.name}-${i}`} className={styles.cell}>
              <img src={img.url} alt={`Скриншот ${i + 1}`} className={styles.thumb} />
              {i === 0 && <span className={styles.coverBadge}>Үндсэн зураг</span>}
              <button type="button" className={styles.removeBtn} aria-label={`Скриншот ${i + 1}-ийг устгах`} onClick={() => removeAt(i)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < 15 && (
        <button type="button" className={styles.uploadBtn} onClick={() => inputRef.current?.click()}>
          + Зураг нэмэх ({images.length}/15)
        </button>
      )}

      <p className={styles.note}>
        * Хамгийн эхэнд оруулсан зураг нь таны зарын үндсэн нүүр зураг болно.
      </p>
    </div>
  );
}