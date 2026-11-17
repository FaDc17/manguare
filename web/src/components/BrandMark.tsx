export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="brand-mark"
    >
      <rect width="64" height="64" rx="15" fill="#12372a" />
      <circle cx="32" cy="31" r="24" fill="none" stroke="#f6f1e6" strokeOpacity="0.12" strokeWidth="2" />
      <path
        d="M32 12c-8.7 0-15.75 6.925-15.75 15.475 0 11.3 15.75 24.4 15.75 24.4s15.75-13.1 15.75-24.4C47.75 18.925 40.7 12 32 12Z"
        fill="#fbf6e9"
      />
      <path d="M32 19.5v11.6" stroke="#c2410c" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="37.9" r="2.3" fill="#c2410c" />
    </svg>
  );
}
