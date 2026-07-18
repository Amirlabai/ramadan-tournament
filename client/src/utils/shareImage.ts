import { toBlob } from 'html-to-image';

export type ShareImageResult = 'shared' | 'downloaded' | 'ready' | 'cancelled';

type ShareImageOptions = {
  filename: string;
  title: string;
  text: string;
};

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1920;
const IMAGE_SETTLE_MS = 4_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function raf2(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function imageNeedsWait(image: HTMLImageElement): boolean {
  return !image.complete || image.naturalWidth === 0;
}

function waitOneImagePass(image: HTMLImageElement, timeoutMs: number): Promise<void> {
  if (!imageNeedsWait(image)) {
    return image.decode().catch(() => undefined);
  }
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      resolve();
    };
    const onLoad = () => {
      void image.decode().catch(() => undefined).finally(finish);
    };
    const onError = () => finish();
    const timer = window.setTimeout(finish, timeoutMs);
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
  });
}

/**
 * Wait until every img is complete with a non-zero naturalWidth, or the
 * deadline hits. Re-runs after error so in-place `onError` src swaps
 * (SharePlayerHead) can settle before capture.
 */
async function waitForImages(node: HTMLElement): Promise<void> {
  const deadline = Date.now() + IMAGE_SETTLE_MS;
  while (Date.now() < deadline) {
    const images = Array.from(node.querySelectorAll('img'));
    const pending = images.filter(imageNeedsWait);
    if (pending.length === 0) {
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
      return;
    }
    const slice = Math.max(200, Math.ceil((deadline - Date.now()) / pending.length));
    await Promise.all(pending.map((image) => waitOneImagePass(image, slice)));
    await raf2();
  }
}

async function tryFetchAsDataUrl(src: string): Promise<string | null> {
  const modes: RequestCredentials[] = ['omit', 'include'];
  for (const credentials of modes) {
    try {
      const response = await fetch(src, { credentials, mode: 'cors', cache: 'force-cache' });
      if (!response.ok) continue;
      return await blobToDataUrl(await response.blob());
    } catch {
      // Try the next credentials mode; html-to-image may still embed CORS assets.
    }
  }
  return null;
}

async function inlineImages(node: HTMLElement): Promise<() => void> {
  const images = Array.from(node.querySelectorAll('img'));
  const originals = images.map((image) => ({
    image,
    src: image.getAttribute('src'),
    srcset: image.getAttribute('srcset'),
    crossOrigin: image.getAttribute('crossorigin'),
  }));

  await Promise.all(
    originals.map(async ({ image, src }) => {
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;
      const dataUrl = await tryFetchAsDataUrl(src);
      if (dataUrl) {
        image.removeAttribute('srcset');
        image.removeAttribute('crossorigin');
        image.src = dataUrl;
        return;
      }
      // Last chance for html-to-image canvas path on CORS-enabled hosts.
      image.crossOrigin = 'anonymous';
    })
  );

  await waitForImages(node);

  return () => {
    originals.forEach(({ image, src, srcset, crossOrigin }) => {
      if (src == null) image.removeAttribute('src');
      else image.setAttribute('src', src);
      if (srcset == null) image.removeAttribute('srcset');
      else image.setAttribute('srcset', srcset);
      if (crossOrigin == null) image.removeAttribute('crossorigin');
      else image.setAttribute('crossorigin', crossOrigin);
    });
  };
}

function fitShareContent(node: HTMLElement): () => void {
  const card = node.querySelector<HTMLElement>('.share-card');
  if (!card) return () => undefined;

  const previous = {
    transform: card.style.transform,
    transformOrigin: card.style.transformOrigin,
  };
  card.style.transform = '';
  card.style.transformOrigin = 'top center';

  const content = node.querySelector<HTMLElement>('.share-frame__content');
  const available = content?.clientHeight || node.clientHeight;
  const needed = card.scrollHeight;
  if (available > 0 && needed > available) {
    const scale = Math.max(0.55, available / needed);
    card.style.transform = `scale(${scale})`;
  }

  return () => {
    card.style.transform = previous.transform;
    card.style.transformOrigin = previous.transformOrigin;
  };
}

export async function renderShareImage(
  node: HTMLElement,
  filename: string
): Promise<File> {
  await document.fonts?.ready;
  await waitForImages(node);
  const restoreImages = await inlineImages(node);
  const restoreFit = fitShareContent(node);

  try {
    await raf2();
    const blob = await toBlob(node, {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: '#296912',
      // The live frame is parked off-viewport (fixed, left: -12000px). Reset
      // positioning on the clone so the capture is not shifted out of view.
      style: {
        position: 'static',
        left: '0',
        top: '0',
        margin: '0',
      },
    });
    if (!blob) throw new Error('PNG rendering returned an empty image');
    return new File([blob], filename, { type: 'image/png' });
  } finally {
    restoreFit();
    restoreImages();
  }
}

export function isMobileShareContext(): boolean {
  if (typeof window === 'undefined') return false;
  // Prefer paper-plane on phones/tablets and narrow viewports. Touch-only
  // checks miss DevTools device mode and some in-app browsers.
  return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
}

function canShareFile(file: File): boolean {
  return (
    isMobileShareContext() &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function sharePreparedImage(
  file: File,
  options: ShareImageOptions
): Promise<ShareImageResult> {
  if (!canShareFile(file)) {
    downloadFile(file);
    return 'downloaded';
  }

  try {
    await navigator.share({
      files: [file],
      title: options.title,
      text: options.text,
    });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'ready';
    }
    throw error;
  }
}
