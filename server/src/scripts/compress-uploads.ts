/**
 * Backfill: compress oversized images under uploads logos/ + players/
 * on both repo and disk roots. Idempotent.
 *
 *   npm run uploads:compress --workspace=server
 */
import fs from 'fs';
import path from 'path';
import { compressExistingUpload, isCompressSidecarName } from '../utils/imageCompress';
import { diskUploadsRoot, repoUploadsRoot, type UploadSubdir } from '../utils/uploadPaths';

const SUBDIRS: UploadSubdir[] = ['logos', 'players'];

function listImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !isCompressSidecarName(name))
    .filter((name) => /\.(jpe?g|png|webp|gif)$/i.test(name))
    .map((name) => path.join(dir, name));
}

function collectRoots(): string[] {
  const roots = [path.resolve(repoUploadsRoot())];
  try {
    const disk = path.resolve(diskUploadsRoot());
    if (disk !== roots[0]) roots.push(disk);
  } catch {
    // Production without disk: repo only.
  }
  return roots;
}

async function main(): Promise<void> {
  let compressed = 0;
  let skipped = 0;
  let kept = 0;

  for (const root of collectRoots()) {
    console.log(`Scanning ${root}`);
    for (const sub of SUBDIRS) {
      const dir = path.join(root, sub);
      for (const file of listImageFiles(dir)) {
        const result = await compressExistingUpload(file);
        const rel = path.relative(root, file);
        if (result.status === 'compressed') {
          compressed += 1;
          console.log(
            `  [OK] ${rel}: ${result.before} → ${result.after} bytes`
          );
        } else if (result.status === 'kept_original') {
          kept += 1;
          console.log(`  [KEEP] ${rel}: ${result.reason}`);
        } else {
          skipped += 1;
        }
      }
    }
  }

  console.log('--- compress-uploads done ---');
  console.log(`compressed: ${compressed}`);
  console.log(`skipped: ${skipped}`);
  console.log(`kept_original: ${kept}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
