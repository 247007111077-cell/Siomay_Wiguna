import { useState } from 'react';
import { Utensils } from 'lucide-react';

export const WIGUNA_HERO_IMAGE = '/src/assets/images/wiguna_siomay_showcase_1795356124901.jpg';

export const CATEGORY_IMAGES = {
  protein: '/src/assets/images/bahan_protein_segar_1795356125319.jpg',
  sayur: '/src/assets/images/bahan_sayur_tahu_1795356125487.jpg',
  telurPangsit: '/src/assets/images/bahan_telur_pangsit_1795356125137.jpg',
  gudangPh: '/src/assets/images/bahan_bumbu_gudang_1795356125129.jpg',
} as const;

export function getIngredientImage(nama: string): string {
  const lower = nama.toLowerCase();
  if (lower.includes('ikan') || lower.includes('daging')) {
    return CATEGORY_IMAGES.protein;
  }
  if (
    lower.includes('tahu') ||
    lower.includes('kentang') ||
    lower.includes('kol') ||
    lower.includes('pare')
  ) {
    return CATEGORY_IMAGES.sayur;
  }
  if (lower.includes('telur') || lower.includes('kulit')) {
    return CATEGORY_IMAGES.telurPangsit;
  }
  return CATEGORY_IMAGES.gudangPh;
}

interface IngredientThumbProps {
  nama: string;
  size?: 'sm' | 'md';
}

export function IngredientThumb({ nama, size = 'sm' }: IngredientThumbProps) {
  const [imgError, setImgError] = useState(false);
  const dims = size === 'md' ? 'h-11 w-11' : 'h-9 w-9';

  if (imgError) {
    return (
      <div
        className={`flex ${dims} shrink-0 items-center justify-center rounded-lg border border-[#E6DDD2] bg-[#FAF7F2] text-[#C24E2B]`}
        aria-hidden="true"
      >
        <Utensils className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={getIngredientImage(nama)}
      alt={`Ilustrasi bahan baku ${nama}`}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`${dims} shrink-0 rounded-lg border border-[#E6DDD2] object-cover`}
    />
  );
}
