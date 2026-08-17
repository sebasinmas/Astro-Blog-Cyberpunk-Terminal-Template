import type { APIRoute } from 'astro';
import { generateOgImage } from '../../utils/ogImageGenerator';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../consts';

export const GET: APIRoute = async () => {
	const pngBuffer = await generateOgImage({
		badge: 'SYS_PORTFOLIO // ROOT',
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		author: 'SebaSinMas',
		tags: ['Software', 'Astro', 'TypeScript', 'Linux'],
		imagePath: 'src/assets/pfp.jpg',
	});

	return new Response(new Uint8Array(pngBuffer), {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
};
