import type { ImageMetadata } from 'astro';

const projectImages = import.meta.glob<{ default: ImageMetadata }>(
	'../assets/imgs/projects/**/*.{png,jpg,jpeg,webp,gif}',
	{ eager: true },
);

/**
 * Remote URL as-is, or path relative to `src/assets/imgs/projects/` (e.g. `mentorher/hero.png`).
 */
export function resolveProjectImage(src: string): string | ImageMetadata {
	const trimmed = src.trim();
	if (/^https?:\/\//i.test(trimmed)) return trimmed;

	const clean = trimmed.replace(/^\/+/, '');
	const key = `../assets/imgs/projects/${clean}`;
	const mod = projectImages[key] as { default: ImageMetadata } | undefined;
	if (!mod?.default) {
		throw new Error(
			`resolveProjectImage: no asset at ${key}. Check frontmatter path relative to src/assets/imgs/projects/.`,
		);
	}
	return mod.default;
}
