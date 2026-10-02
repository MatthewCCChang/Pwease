import type { Bindings } from '../env';

// No public bucket, signing keys, upload routes, or reads are implemented yet.
export function getProofBucket(env: Pick<Bindings, 'PROOF_IMAGES'>): R2Bucket {
  if (!env.PROOF_IMAGES) throw new Error('The PROOF_IMAGES R2 binding is not configured.');
  return env.PROOF_IMAGES;
}
