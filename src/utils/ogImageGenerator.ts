import sharp from 'sharp';

export interface OgImageOptions {
	badge?: string;
	title: string;
	description?: string;
	author?: string;
	date?: string;
	readingTime?: string;
	tags?: readonly string[];
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
			lines[lines.length - 1] = last.length > maxCharsPerLine - 3 ? last.slice(0, maxCharsPerLine - 3) + '…' : last + '…';
		}
	}
	return lines;
}

export async function generateOgImage(options: OgImageOptions): Promise<Buffer> {
	const badge = escapeXml(options.badge ?? 'SYS_ARCHIVE // PORTFOLIO');
	const titleLines = wrapText(options.title, 34, 3);
	const descLines = options.description ? wrapText(options.description, 55, 2) : [];
	const author = escapeXml(options.author ?? 'SebaSinMas');
	const date = options.date ? escapeXml(options.date) : null;
	const readingTime = options.readingTime ? escapeXml(options.readingTime) : null;
	const tags = (options.tags ?? []).slice(0, 4).map((t) => escapeXml(t.startsWith('#') ? t : `#${t}`));

	const titleSvg = titleLines
		.map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : '1.2em'}">${escapeXml(line)}</tspan>`)
		.join('');

	const descSvg = descLines
		.map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : '1.4em'}">${escapeXml(line)}</tspan>`)
		.join('');

	const tagsSvg = tags
		.map(
			(tag, i) => `
			<g transform="translate(${80 + i * 160}, 0)">
				<rect x="0" y="0" width="145" height="34" fill="#0d1520" stroke="#39ff14" stroke-opacity="0.4" stroke-width="1.5" />
				<text x="72" y="22" font-family="monospace" font-size="14" fill="#39ff14" text-anchor="middle" font-weight="600">${tag}</text>
			</g>`,
		)
		.join('');

	const metaItems: string[] = [];
	if (date) metaItems.push(`<span>${date}</span>`);
	if (readingTime) metaItems.push(`<span>⏱ ${readingTime}</span>`);
	metaItems.push(`<span>BY ${author}</span>`);

	const metaSvg = metaItems
		.map((item, idx) => {
			const xPos = 80 + idx * 170;
			return `<text x="${xPos}" y="490" font-family="monospace" font-size="16" fill="#8fa398" letter-spacing="1">${escapeXml(item.replace(/<[^>]+>/g, ''))}</text>`;
		})
		.join('');

	const svg = `
	<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
		<defs>
			<radialGradient id="bgGlow" cx="50%" cy="0%" r="90%">
				<stop offset="0%" stop-color="#05d9e8" stop-opacity="0.16" />
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
			<text x="${badge.length * 9.5 + 50}" y="19" font-family="monospace" font-size="14" fill="#05d9e8" letter-spacing="1">&gt; sebasinmas.site</text>
		</g>

		<!-- Divider line -->
		<line x1="80" y1="130" x2="1120" y2="130" stroke="url(#cyanLine)" stroke-width="2"/>

		<!-- Article / Page Title -->
		<text x="80" y="210" font-family="monospace, sans-serif" font-size="52" font-weight="bold" fill="#f0fdf4" letter-spacing="0.5">
			${titleSvg}
		</text>

		<!-- Description -->
		${
			descLines.length > 0
				? `<text x="80" y="380" font-family="monospace, sans-serif" font-size="22" fill="#8fa398" letter-spacing="0.5">${descSvg}</text>`
				: ''
		}

		<!-- Tags Section -->
		${tags.length > 0 ? `<g transform="translate(0, 420)">${tagsSvg}</g>` : ''}

		<!-- Meta Section -->
		${metaSvg}

		<!-- Bottom Brand Watermark -->
		<g transform="translate(920, 530)">
			<rect x="-15" y="-20" width="200" height="42" fill="#090e15" stroke="#05d9e8" stroke-opacity="0.4" stroke-width="1.5"/>
			<text x="85" y="7" font-family="monospace" font-size="18" font-weight="bold" fill="#05d9e8" letter-spacing="2" text-anchor="middle">SebaSinMas</text>
		</g>
	</svg>`;

	return await sharp(Buffer.from(svg)).png().toBuffer();
}
