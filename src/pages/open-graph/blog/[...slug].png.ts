import type { APIRoute } from 'astro';
import { type CollectionEntry, getCollection } from 'astro:content';
import { generateOgImage } from '../../../utils/ogImageGenerator';

export async function getStaticPaths() {
	const posts = await getCollection('blog');
	return posts.map((post: CollectionEntry<'blog'>) => ({
		params: { slug: post.id },
		props: post,
	}));
}

export const GET: APIRoute = async ({ props }) => {
	const post = props as CollectionEntry<'blog'>;
	const words = post.body ? post.body.trim().split(/\s+/).filter(Boolean).length : 0;
	const readingMin = Math.max(1, Math.ceil(words / 200));

	const formattedDate = post.data.pubDate.toLocaleDateString('es-ES', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});

	const relImage = post.data.image ?? post.data.heroImage;
	const imagePath = relImage ? `src/assets/imgs/blog/${relImage}` : undefined;

	const pngBuffer = await generateOgImage({
		badge: 'SYS_LOG // ENTRY',
		title: post.data.title,
		description: post.data.description,
		author: 'SebaSinMas',
		date: formattedDate,
		readingTime: `${readingMin} min`,
		tags: post.data.tags ?? ['Bitacora', 'Linux', 'Dev'],
		imagePath,
	});

	return new Response(new Uint8Array(pngBuffer), {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
