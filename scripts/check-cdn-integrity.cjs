const { createHash } = require('node:crypto');
const { readFile } = require('node:fs/promises');

const layouts = ['_layouts/default.html', '_layouts/admin.html'];

async function main() {
  const assets = [];

  for (const layout of layouts) {
    const html = await readFile(layout, 'utf8');

    for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      const integrity = tag.match(/\bintegrity=["']([^"']+)["']/i)?.[1];
      if (!integrity) continue;

      const url = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
      if (!url || !/^sha384-[A-Za-z0-9+/]{64}$/.test(integrity)) {
        throw new Error(`Invalid integrity-pinned asset in ${layout}: ${tag}`);
      }

      assets.push({ layout, url, integrity });
    }
  }

  if (assets.length === 0) {
    throw new Error('No integrity-pinned CDN assets found.');
  }

  for (const { layout, url, integrity } of assets) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} from ${layout}: HTTP ${response.status}`);
    }

    const content = Buffer.from(await response.arrayBuffer());
    const actual = `sha384-${createHash('sha384').update(content).digest('base64')}`;
    if (actual !== integrity) {
      throw new Error(`SHA-384 mismatch for ${url} in ${layout}: expected ${integrity}, got ${actual}`);
    }

    console.log(`Verified ${url}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
