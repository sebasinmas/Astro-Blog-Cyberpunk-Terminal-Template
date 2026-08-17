import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

export interface OgImageOptions {
	badge?: string;
	title: string;
	description?: string;
	author?: string;
	date?: string;
	readingTime?: string;
	tags?: readonly string[];
	imagePath?: string;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
			currentLine = (currentLine + ' ' + word).trim();
		} else {
			if (currentLine) lines.push(currentLine);
			currentLine = word;
			if (lines.length >= maxLines - 1) {
				break;
			}
		}
	}
	if (currentLine && lines.length < maxLines) {
		lines.push(currentLine);
	}
	if (lines.length === maxLines && words.length > 0 && lines.join(' ') !== text) {
		const last = lines[lines.length - 1];
		if (!last.endsWith('…') && !last.endsWith('...')) {
			lines[lines.length - 1] =
				last.length > maxCharsPerLine - 3 ? last.slice(0, maxCharsPerLine - 3) + '…' : last + '…';
		}
	}
	return lines;
}

async function getBase64Image(filePath?: string): Promise<{ mime: string; base64: string } | null> {
	if (!filePath) return null;
	try {
		const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
		if (!fs.existsSync(resolvedPath)) {
			return null;
		}
		// Convert any image format (WebP, JPG, PNG) to PNG buffer for librsvg compatibility in SVG
		const pngBuffer = await sharp(resolvedPath).resize(400, 400, { fit: 'cover' }).png().toBuffer();
		return { mime: 'image/png', base64: pngBuffer.toString('base64') };
	} catch {
		return null;
	}
}

export async function generateOgImage(options: OgImageOptions): Promise<Buffer> {
	const sideImageData = await getBase64Image(options.imagePath);

	const maxTitleChars = sideImageData ? 22 : 34;
	const maxDescChars = sideImageData ? 38 : 55;

	const badge = escapeXml(options.badge ?? 'SYS_ARCHIVE // PORTFOLIO');
	const titleLines = wrapText(options.title, maxTitleChars, 3);
	const descLines = options.description ? wrapText(options.description, maxDescChars, 2) : [];
	const author = escapeXml(options.author ?? 'SebaSinMas');
	const date = options.date ? escapeXml(options.date) : null;
	const readingTime = options.readingTime ? escapeXml(options.readingTime) : null;
	const tags = (options.tags ?? []).slice(0, sideImageData ? 3 : 4).map((t) => escapeXml(t.startsWith('#') ? t : `#${t}`));

	const titleSvg = titleLines
		.map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : '1.2em'}">${escapeXml(line)}</tspan>`)
		.join('');

	const descSvg = descLines
		.map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : '1.4em'}">${escapeXml(line)}</tspan>`)
		.join('');

	const tagsSvg = tags
		.map(
			(tag, i) => `
			<g transform="translate(${80 + i * 150}, 0)">
				<rect x="0" y="0" width="148" height="44" fill="#0d1520" stroke="#39ff14" stroke-opacity="0.4" stroke-width="1.5" />
				<text x="69" y="28" font-family="monospace" font-size="18" fill="#39ff14" text-anchor="middle" font-weight="600">${tag}</text>
			</g>`,
		)
		.join('');

	const metaItems: string[] = [];
	if (date) metaItems.push(date);
	if (readingTime) metaItems.push(`⏱ ${readingTime}`);
	metaItems.push(`BY ${author}`);

	const metaSvg = metaItems
		.map((item, idx) => {
			const xPos = 80 + idx * 160;
			return `<text x="${xPos}" y="500" font-family="monospace" font-size="15" fill="#8fa398" letter-spacing="1">${escapeXml(item)}</text>`;
		})
		.join('');

	const sideImageSvg = sideImageData
		? `
		<!-- Side Image Frame -->
		<g transform="translate(780, 140)">
			<rect x="-10" y="-10" width="340" height="340" fill="#090e15" stroke="#05d9e8" stroke-width="2" stroke-opacity="0.5"/>
			<rect x="-16" y="-16" width="352" height="352" fill="none" stroke="#39ff14" stroke-width="1" stroke-opacity="0.25"/>
			<!-- Image Element -->
			<image href="data:${sideImageData.mime};base64,${sideImageData.base64}" x="0" y="0" width="320" height="320" preserveAspectRatio="xMidYMid slice" />
			<!-- Scanline effect overlay on image -->
			<rect x="0" y="0" width="320" height="320" fill="none" stroke="#05d9e8" stroke-width="1" stroke-opacity="0.4"/>
			<!-- Label below image -->
			<rect x="40" y="335" width="240" height="24" fill="#04070a" stroke="#05d9e8" stroke-width="1" stroke-opacity="0.6"/>
			<text x="160" y="351" font-family="monospace" font-size="11" font-weight="700" fill="#05d9e8" text-anchor="middle" letter-spacing="2">IMG // SYS_ATTACHED</text>
		</g>`
		: '';

	const svg = `
	<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
		<defs>
			<radialGradient id="bgGlow" cx="50%" cy="0%" r="90%">
				<stop offset="0%" stop-color="#05d9e8" stop-opacity="0.18" />
				<stop offset="60%" stop-color="#04070a" stop-opacity="0.95" />
				<stop offset="100%" stop-color="#020508" stop-opacity="1" />
			</radialGradient>
			<linearGradient id="cyanLine" x1="0%" y1="0%" x2="100%" y2="0%">
				<stop offset="0%" stop-color="#05d9e8" stop-opacity="0.8" />
				<stop offset="50%" stop-color="#39ff14" stop-opacity="0.7" />
				<stop offset="100%" stop-color="#05d9e8" stop-opacity="0.2" />
			</linearGradient>
			<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
				<path d="M 40 0 L 0 0 0 40" fill="none" stroke="#05d9e8" stroke-opacity="0.04" stroke-width="1"/>
			</pattern>
		</defs>

		<!-- Base Background -->
		<rect width="1200" height="630" fill="#04070a"/>
		<rect width="1200" height="630" fill="url(#bgGlow)"/>
		<rect width="1200" height="630" fill="url(#grid)"/>

		<!-- Outer Border Frame -->
		<rect x="30" y="30" width="1140" height="570" fill="none" stroke="#05d9e8" stroke-opacity="0.35" stroke-width="2"/>
		<rect x="36" y="36" width="1128" height="558" fill="none" stroke="#39ff14" stroke-opacity="0.15" stroke-width="1"/>

		<!-- Corner Bracket Accents -->
		<path d="M 30 60 L 30 30 L 60 30" fill="none" stroke="#05d9e8" stroke-width="4"/>
		<path d="M 1170 60 L 1170 30 L 1140 30" fill="none" stroke="#05d9e8" stroke-width="4"/>
		<path d="M 30 570 L 30 600 L 60 600" fill="none" stroke="#05d9e8" stroke-width="4"/>
		<path d="M 1170 570 L 1170 600 L 1140 600" fill="none" stroke="#05d9e8" stroke-width="4"/>

		<!-- Top Header Bar -->
		<g transform="translate(80, 85)">
			<!-- Badge -->
			<rect x="0" y="0" width="${badge.length * 9.5 + 24}" height="28" fill="#0d1520" stroke="#39ff14" stroke-opacity="0.6" stroke-width="1.5"/>
			<circle cx="12" cy="14" r="4" fill="#39ff14"/>
			<text x="24" y="19" font-family="monospace" font-size="13" font-weight="700" fill="#39ff14" letter-spacing="1.5">${badge}</text>

			<!-- Prompt -->
			<text x="${badge.length * 9.5 + 45}" y="19" font-family="monospace" font-size="14" fill="#05d9e8" letter-spacing="1">&gt; sebasinmas.site</text>
		</g>

		<!-- Divider line -->
		<line x1="80" y1="125" x2="1120" y2="125" stroke="url(#cyanLine)" stroke-width="2"/>

		<!-- Article / Page Title -->
		<text x="80" y="200" font-family="monospace, sans-serif" font-size="${sideImageData ? '46' : '52'}" font-weight="bold" fill="#f0fdf4" letter-spacing="0.5">
			${titleSvg}
		</text>

		<!-- Description -->
		${descLines.length > 0
			? `<text x="80" y="${sideImageData ? '365' : '380'}" font-family="monospace, sans-serif" font-size="20" fill="#8fa398" letter-spacing="0.5">${descSvg}</text>`
			: ''
		}

		<!-- Tags Section -->
		${tags.length > 0 ? `<g transform="translate(0, ${sideImageData ? '415' : '430'})">${tagsSvg}</g>` : ''}

		<!-- Meta Section -->
		${metaSvg}

		<!-- Side Image (if provided) -->
		${sideImageSvg}

		<!-- Bottom Brand Watermark -->
		<g transform="translate(${sideImageData ? '480' : '920'}, 545)">
			<rect x="-15" y="-18" width="190" height="38" fill="#090e15" stroke="#05d9e8" stroke-opacity="0.4" stroke-width="1.5"/>
			<text x="80" y="6" font-family="monospace" font-size="16" font-weight="bold" fill="#05d9e8" letter-spacing="2" text-anchor="middle">SebaSinMas</text>
		</g>
	</svg>`;

	return await sharp(Buffer.from(svg))
		.png({
			compressionLevel: 9,
			palette: true,
			quality: 90,
			effort: 7,
		})
		.toBuffer();
}
