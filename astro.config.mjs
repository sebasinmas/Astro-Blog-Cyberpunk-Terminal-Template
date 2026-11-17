// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import cspHardening from './integrations/csp-hardening.mjs';

// https://astro.build/config
export default defineConfig({
	build: {
		// Sin <style> inline: el CSP del servidor usa style-src 'self' (sin 'unsafe-inline').
		inlineStylesheets: 'never',
	},
	vite: {
		plugins: [tailwindcss()],
		build: {
			// Nada de data: URIs (los sprites pequeños se incrustaban en el JS):
			// el CSP del servidor usa img-src 'self' y no permite data:.
			assetsInlineLimit: 0,
		},
	},
	image: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'images.unsplash.com',
				pathname: '/**',
			},
		],
	},
	site: 'https://sebasinmas.site',
	// cspHardening debe ir al final: procesa el HTML ya generado por el resto.
	integrations: [mdx(), sitemap(), cspHardening()],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
