import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: () =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.string().optional(),
			tags: z.array(z.string()).optional(),
		}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
	schema: () =>
		z.object({
			title: z.string(),
			description: z.string(),
			tags: z.array(z.string()),
			/** Tarjeta y hero por defecto: URL remota o ruta bajo `src/assets/imgs/projects/`. */
			image: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			/** Banner distinto al thumbnail de tarjeta (mismas reglas que `image`). */
			heroImage: z.string().optional(),
			order: z.number().default(0),
		}),
});

export const collections = { blog, projects };
