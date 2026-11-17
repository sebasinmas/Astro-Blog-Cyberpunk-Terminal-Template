// @ts-check
/**
 * Post-build: deja el HTML compatible con un CSP estricto (sin 'unsafe-inline') y agrega SRI.
 *
 *  1. <script> inline        → archivo /_astro/inline.<hash>.js
 *  2. style="..." (atributo) → clase .s-<hash> en /_astro/inline-styles.<hash>.css
 *     (con !important, para conservar la precedencia que tenía el estilo inline)
 *  3. integrity="sha384-…"   → <script src>, <link rel=stylesheet|modulepreload> locales
 *  4. Guardia: si queda <style>, <script> inline, on*= o javascript: → el build falla.
 *
 * Esto sirve para el contenido de markdown (tablas, bloques de código de Shiki) y para
 * futuros componentes, sin tener que acordarse de evitar estilos inline a mano.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = (/** @type {string | Buffer} */ data, algo = 'sha256') => createHash(algo).update(data);
const short = (/** @type {string} */ s) => sha(s).digest('hex').slice(0, 8);

const decode = (/** @type {string} */ s) =>
	s
		.replace(/&quot;|&#34;|&#x22;/gi, '"')
		.replace(/&#39;|&#x27;/gi, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

/** Divide declaraciones CSS por `;` ignorando los que están dentro de paréntesis o comillas. */
function splitDeclarations(/** @type {string} */ css) {
	const out = [];
	let cur = '';
	let depth = 0;
	let quote = '';
	for (const ch of css) {
		if (quote) {
			if (ch === quote) quote = '';
		} else if (ch === '"' || ch === "'") quote = ch;
		else if (ch === '(') depth++;
		else if (ch === ')') depth--;
		else if (ch === ';' && depth === 0) {
			if (cur.trim()) out.push(cur.trim());
			cur = '';
			continue;
		}
		cur += ch;
	}
	if (cur.trim()) out.push(cur.trim());
	return out;
}

/** @param {string} dir */
async function walk(dir) {
	/** @type {string[]} */
	const files = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(p)));
		else files.push(p);
	}
	return files;
}

const TAG_RE =
	/<([a-zA-Z][\w:-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const INLINE_SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

export default function cspHardening() {
	return {
		name: 'csp-hardening',
		hooks: {
			'astro:build:done': async (/** @type {{ dir: URL }} */ { dir }) => {
				const root = fileURLToPath(dir);
				const assets = join(root, '_astro');
				await mkdir(assets, { recursive: true });

				const htmlFiles = (await walk(root)).filter((f) => f.endsWith('.html'));

				/** @type {Map<string, string>} clase → declaraciones */
				const rules = new Map();
				/** @type {Map<string, string>} ruta pública → contenido de los scripts extraídos */
				const extracted = new Map();

				/** @type {Map<string, string>} */
				const pages = new Map();

				// Paso 1 y 2: extraer scripts inline y convertir style="" en clases.
				for (const file of htmlFiles) {
					let html = await readFile(file, 'utf8');

					html = html.replace(INLINE_SCRIPT_RE, (match, attrs, body) => {
						if (/\bsrc\s*=/.test(attrs) || !body.trim()) return match;
						const type = /\btype\s*=\s*["']?([^"'\s>]+)/.exec(attrs)?.[1] ?? '';
						// JSON-LD, importmap, etc. no son ejecutables: el CSP no los bloquea.
						if (type && type !== 'module' && type !== 'text/javascript') return match;
						const name = `inline.${short(body)}.js`;
						extracted.set(name, body);
						const cleanAttrs = attrs.replace(/\bis:inline\b/, '');
						return `<script${cleanAttrs} src="/_astro/${name}"></script>`;
					});

					html = html.replace(TAG_RE, (tag, name, attrs, selfClose) => {
						const m = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attrs);
						if (!m) return tag;
						const decls = splitDeclarations(decode(m[1] ?? m[2] ?? ''))
							.map((d) => (/!important\s*$/i.test(d) ? d : `${d} !important`))
							.join(';');
						if (!decls) return `<${name}${attrs.replace(m[0], '')}${selfClose}>`;
						const cls = `s-${short(decls)}`;
						rules.set(cls, decls);
						let next = attrs.replace(m[0], '');
						const c = /\sclass\s*=\s*"([^"]*)"/.exec(next);
						next = c
							? next.replace(c[0], ` class="${c[1] ? `${c[1]} ` : ''}${cls}"`)
							: `${next} class="${cls}"`;
						return `<${name}${next}${selfClose}>`;
					});

					pages.set(file, html);
				}

				for (const [name, body] of extracted) await writeFile(join(assets, name), body);

				let stylesPath = '';
				if (rules.size) {
					const css = [...rules].map(([cls, decls]) => `.${cls}{${decls}}`).join('\n');
					stylesPath = `/_astro/inline-styles.${short(css)}.css`;
					await writeFile(join(root, stylesPath), css);
				}

				// Enlazar la hoja de estilos generada solo en las páginas que usan sus clases.
				if (stylesPath) {
					for (const [file, html] of pages) {
						if (/\bclass="[^"]*\bs-[0-9a-f]{8}\b/.test(html)) {
							pages.set(file, html.replace('</head>', `<link rel="stylesheet" href="${stylesPath}"></head>`));
						}
					}
				}

				// Paso 3 (SRI) y paso 4 (guardia).
				const problems = [];
				const integrityCache = new Map();
				const integrityFor = async (/** @type {string} */ path) => {
					if (!integrityCache.has(path)) {
						integrityCache.set(path, `sha384-${sha(await readFile(path), 'sha384').digest('base64')}`);
					}
					return integrityCache.get(path);
				};

				for (const [file, html0] of pages) {
					let html = html0;
					/** @type {Array<[string, string]>} */
					const swaps = [];
					for (const m of html.matchAll(TAG_RE)) {
						const [tag, name, attrs, selfClose] = m;
						const lower = String(name).toLowerCase();
						const urlAttr =
							lower === 'script'
								? 'src'
								: lower === 'link' && /\brel\s*=\s*["']?(stylesheet|modulepreload)/i.test(attrs)
									? 'href'
									: '';
						if (!urlAttr || /\bintegrity\s*=/.test(attrs)) continue;
						const u = new RegExp(`\\s${urlAttr}\\s*=\\s*"([^"]+)"`).exec(attrs);
						const ref = u?.[1]?.split(/[?#]/)[0];
						if (!ref || !ref.startsWith('/') || ref.startsWith('//')) continue;
						const path = join(root, decodeURIComponent(ref));
						if (!existsSync(path)) continue;
						swaps.push([tag, `<${name}${attrs} integrity="${await integrityFor(path)}"${selfClose}>`]);
					}
					for (const [from, to] of swaps) html = html.replace(from, to);

					const rel = file.slice(root.length);
					if (/<style\b/i.test(html)) problems.push(`${rel}: <style> inline`);
					for (const m of html.matchAll(INLINE_SCRIPT_RE)) {
						const type = /\btype\s*=\s*["']?([^"'\s>]+)/.exec(m[1])?.[1] ?? '';
						if (!/\bsrc\s*=/.test(m[1]) && m[2].trim() && (!type || type === 'module'))
							problems.push(`${rel}: <script> inline`);
					}
					if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(html)) problems.push(`${rel}: handler on*=`);
					if (/\shref\s*=\s*["']javascript:/i.test(html)) problems.push(`${rel}: href="javascript:"`);
					await writeFile(file, html);
				}

				if (problems.length) {
					throw new Error(`csp-hardening: quedó contenido incompatible con CSP estricto:\n  ${problems.join('\n  ')}`);
				}
				console.log(
					`[csp-hardening] ${extracted.size} script(s) extraído(s), ${rules.size} regla(s) de estilo, SRI en ${integrityCache.size} recurso(s).`,
				);
			},
		},
	};
}
