import type { APIRoute } from 'astro';
import { type CollectionEntry, getCollection } from 'astro:content';
import { generateOgImage } from '../../../utils/ogImageGenerator';

export async function getStaticPaths() {
	const projects = await getCollection('projects');
	return projects.map((project: CollectionEntry<'projects'>) => ({
		params: { slug: project.id },
		props: project,
	}));
}

export const GET: APIRoute = async ({ props }) => {
	const project = props as CollectionEntry<'projects'>;

	const pngBuffer = await generateOgImage({
		badge: 'SYS_PROJECT // ARCHIVE',
		title: project.data.title,
		description: project.data.description,
		author: 'SebaSinMas',
		tags: project.data.tags ?? ['Project', 'Dev'],
	});

	return new Response(new Uint8Array(pngBuffer), {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
