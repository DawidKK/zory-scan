/** Znak aplikacji: trzy paski w kolorach z logo. */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0F0F10" />
      <rect x="14" y="14" width="10" height="36" rx="3" fill="#D83C32" />
      <rect x="27" y="14" width="10" height="36" rx="3" fill="#EDAD42" />
      <rect x="40" y="14" width="10" height="36" rx="3" fill="#85C8CC" />
    </svg>
  );
}
