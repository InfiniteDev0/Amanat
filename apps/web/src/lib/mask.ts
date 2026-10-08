import type { CSSProperties } from 'react';

/**
 * An image used as a mask: only its shape shows, filled with the element's
 * background. That lets one icon file be grey at rest and a gradient when
 * active, instead of whatever colours are baked into the file.
 */
export function maskStyle(src: string): CSSProperties {
  const image = `url("${src}")`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  };
}
