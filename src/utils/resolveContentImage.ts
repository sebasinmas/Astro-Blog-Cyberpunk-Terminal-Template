import type { ImageMetadata } from 'astro';

const allImages = import.meta.glob<{ default: ImageMetadata }>(
	'../assets/**/*.{png,jpg,jpeg,webp,gif}',
	{ eager: true },
);

/**
 * Resolves a remote URL or a local image path within `src/assets/`.
 */
export function resolveContentImage(
	src: string,
	defaultFolder: 'projects' | 'blog' = 'projects',
): string | ImageMetadata {
	const trimmed = src.trim();
	if (/^https?:\/\//i.test(trimmed)) return trimmed;

	const clean = trimmed.replace(/^\/+/, '');

	// Candidates to check
	const candidates = [
		`../assets/imgs/${defaultFolder}/${clean}`,
		`../assets/imgs/${clean}`,
		`../assets/${clean}`,
		`../assets/imgs/blog/${clean}`,
		`../assets/imgs/projects/${clean}`,
	];

	for (const key of candidates) {
		const mod = allImages[key] as { default: ImageMetadata } | undefined;
		if (mod?.default) return mod.default;
	}

	throw new Error(
		`resolveContentImage: no asset found for "${src}". Checked candidates: ${candidates.join(', ')}`,
	);
}

export function resolveProjectImage(src: string): string | ImageMetadata {
	return resolveContentImage(src, 'projects');
}

export function resolveBlogImage(src: string): string | ImageMetadata {
	return resolveContentImage(src, 'blog');
}
