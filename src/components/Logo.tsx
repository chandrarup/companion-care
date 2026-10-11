const logoAsset = { url: "/companion-logo.jpg" };

type Props = {
  size?: number;
  className?: string;
  alt?: string;
};

/**
 * Companion Care brand mark — tree formed by two people with a heart at the center.
 * Use as a small icon next to the wordmark, or larger as a hero mark.
 */
export function Logo({ size = 28, className = "", alt = "Companion Care" }: Props) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain select-none rounded-md bg-white ${className}`}
      draggable={false}
    />
  );
}

export default Logo;