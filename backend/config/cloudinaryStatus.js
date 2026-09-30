/**
 * Cloudinary readiness check.
 *
 * `.env` in this repo was copied from `.env.example`, so the CLOUDINARY_*
 * variables are present but hold the placeholder text "your-cloud-name" and
 * friends. Merely testing that the variables are non-empty is not enough: the
 * server would report itself as ready and then fail every upload with
 * "cloud_name is disabled" from deep inside the SDK.
 */

const REQUIRED = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

const PLACEHOLDER_PATTERNS = [
  /^your[-_]/i,
  /^changeme/i,
  /^replace/i,
  /^placeholder/i,
  /^xxx+$/i,
  /^todo$/i,
  /^example/i,
];

function looksLikePlaceholder(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v));
}

/**
 * @returns {{ready: boolean, missing: string[], placeholder: string[]}}
 *   `missing` and `placeholder` name the variables that need attention, so the
 *   admin panel can say exactly what is wrong instead of failing on click.
 */
function cloudinaryStatus(env = process.env) {
  const missing = [];
  const placeholder = [];

  for (const key of REQUIRED) {
    const raw = env[key];
    if (raw === undefined || String(raw).trim() === '') {
      missing.push(key);
    } else if (looksLikePlaceholder(raw)) {
      placeholder.push(key);
    }
  }

  return {
    ready: missing.length === 0 && placeholder.length === 0,
    missing,
    placeholder,
  };
}

function isCloudinaryConfigured(env = process.env) {
  return cloudinaryStatus(env).ready;
}

module.exports = { cloudinaryStatus, isCloudinaryConfigured, looksLikePlaceholder, REQUIRED };
