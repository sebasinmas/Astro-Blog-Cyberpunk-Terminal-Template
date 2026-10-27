import { gsap } from 'gsap';

/**
 * Easter egg: código Konami (↑ ↑ ↓ ↓ ← → ← → B A).
 *
 * - Al acertar la primera tecla aparece un overlay con las teclas pulsadas, abajo al centro.
 * - Si se falla, el progreso se reinicia y una mini ✕ roja salta y cae con gravedad.
 * - Si se completa, viñeteado verde animado con un tick verde en el centro; el overlay se
 *   desvanece y el tick cae.
 *
 * Con `prefers-reduced-motion` no hay saltos ni caídas: solo desvanecimientos.
 */

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const;
const GLYPHS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', b: 'B', a: 'A' };
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'OS']);

/** Tiempo sin pulsar nada tras el cual se abandona el intento. */
const IDLE_MS = 3000;
/** Aceleración de caída de las partículas, en px/s². */
const GRAVITY = 2600;
/** Segundos que tarda en desvanecerse una partícula que ya empezó a caer. */
const FADE_S = 0.6;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Overlay {
	root: HTMLElement;
	vignette: HTMLElement;
	tray: HTMLElement;
}

interface Particle {
	node: HTMLElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	rot: number;
	vrot: number;
	/** Si es `true`, se desvanece desde que empieza a caer; si no, solo desaparece al salir de pantalla. */
	fade: boolean;
	age: number;
}

let progress = 0;
let locked = false;
let overlay: Overlay | undefined;
let fxLayer: HTMLElement | undefined;
let idleTimer: number | undefined;
const particles = new Set<Particle>();

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const sign = () => (Math.random() < 0.5 ? -1 : 1);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	if (text) node.textContent = text;
	return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
	const node = document.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
	return node;
}

/* ───────────────────────── Partículas con gravedad ───────────────────────── */

function getFxLayer(): HTMLElement {
	if (!fxLayer || !fxLayer.isConnected) {
		fxLayer = el('div', 'konami-fx');
		fxLayer.setAttribute('aria-hidden', 'true');
		document.body.append(fxLayer);
	}
	return fxLayer;
}

function place(p: Particle) {
	p.node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) rotate(${p.rot}deg)`;
}

function step(_time: number, deltaMs: number) {
	const dt = Math.min(deltaMs, 50) / 1000;
	for (const p of particles) {
		p.vy += GRAVITY * dt;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.rot += p.vrot * dt;

		if (p.fade && p.vy > 0) {
			p.age += dt;
			p.node.style.opacity = String(Math.max(0, 1 - p.age / FADE_S));
		}
		place(p);

		if (p.y > window.innerHeight + 80 || (p.fade && p.age >= FADE_S)) {
			p.node.remove();
			particles.delete(p);
		}
	}
	if (particles.size === 0) gsap.ticker.remove(step);
}

function launch(p: Particle) {
	if (!p.node.isConnected) getFxLayer().append(p.node);
	place(p);
	particles.add(p);
	gsap.ticker.add(step);
}

function particle(node: HTMLElement, x: number, y: number, motion: Partial<Particle> = {}): Particle {
	return { node, x, y, vx: 0, vy: 0, rot: 0, vrot: 0, fade: false, age: 0, ...motion };
}

/* ──────────────────────────────── Overlay ──────────────────────────────── */

function ensureOverlay(): Overlay {
	if (overlay?.root.isConnected) {
		gsap.killTweensOf(overlay.root);
		gsap.set(overlay.root, { opacity: 1 });
		return overlay;
	}
	const root = el('div', 'konami');
	root.setAttribute('aria-hidden', 'true');
	const vignette = el('div', 'konami__vignette');
	const tray = el('div', 'konami__tray');
	root.append(vignette, tray);
	document.body.append(root);
	overlay = { root, vignette, tray };
	return overlay;
}

function hideOverlay(delay = 0) {
	const o = overlay;
	if (!o) return;
	gsap.to(o.root, {
		opacity: 0,
		duration: 0.3,
		delay,
		ease: 'power1.out',
		onComplete: () => o.root.remove(),
	});
}

function addKey(key: string) {
	const o = ensureOverlay();
	const chip = el('span', 'konami__key', GLYPHS[key] ?? key.toUpperCase());
	o.tray.append(chip);
	if (prefersReducedMotion()) return;
	gsap.fromTo(chip, { y: 26, scale: 0.55, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.38, ease: 'back.out(2.2)' });
}

function armIdle() {
	window.clearTimeout(idleTimer);
	idleTimer = window.setTimeout(cancel, IDLE_MS);
}

function cancel() {
	window.clearTimeout(idleTimer);
	progress = 0;
	if (overlay) {
		const ghost = overlay.tray.cloneNode(true) as HTMLElement;
		overlay.root.append(ghost);
		overlay.tray.replaceChildren();
	}
	hideOverlay();
}

/* ───────────────────────────────── Error ───────────────────────────────── */

function createCross(size: number): HTMLElement {
	const node = el('div', 'konami-fx__item');
	const icon = svg('svg', { viewBox: '0 0 24 24', width: String(size), height: String(size) });
	icon.classList.add('konami-fx__cross');
	icon.append(svg('path', { d: 'M5 5 L19 19 M19 5 L5 19', fill: 'none', 'stroke-width': '3.6', 'stroke-linecap': 'round' }));
	node.append(icon);
	return node;
}

function fail(key: string) {
	const o = ensureOverlay();
	const reduced = prefersReducedMotion();

	// Punto de salida de la ✕: justo a continuación de la última tecla pulsada.
	const last = o.tray.lastElementChild;
	const rect = (last ?? o.tray).getBoundingClientRect();
	const x = last ? rect.right + 22 : rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;

	// Las teclas acumuladas se despiden desde una copia, para que la bandeja real quede libre.
	const ghost = o.tray.cloneNode(true) as HTMLElement;
	o.root.append(ghost);
	o.tray.replaceChildren();
	gsap.to(ghost.children, {
		opacity: 0,
		y: reduced ? 0 : 18,
		duration: 0.3,
		stagger: reduced ? 0 : 0.02,
		ease: 'power1.in',
		onComplete: () => ghost.remove(),
	});

	if (reduced) {
		const cross = createCross(26);
		cross.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
		getFxLayer().append(cross);
		gsap.to(cross, { opacity: 0, duration: 0.4, delay: 0.5, onComplete: () => cross.remove() });
	} else {
		// ✕ que salta hacia arriba y cae con gravedad, acompañada de unas chispas.
		launch(particle(createCross(26), x, y, { vx: rand(-110, 110), vy: -rand(560, 700), vrot: sign() * rand(260, 520), fade: true }));
		for (let i = 0; i < 6; i++) {
			const spark = el('div', 'konami-fx__item konami-fx__spark');
			launch(particle(spark, x, y, { vx: rand(-260, 260), vy: -rand(220, 520), fade: true }));
		}
	}

	// Un fallo reinicia el progreso; si la tecla fallida es el inicio de la secuencia, cuenta como primera.
	progress = 0;
	if (key === SEQUENCE[0]) {
		addKey(key);
		progress = 1;
		armIdle();
	} else {
		window.clearTimeout(idleTimer);
		hideOverlay(0.6);
	}
}

/* ───────────────────────────────── Éxito ───────────────────────────────── */

function createTick() {
	const node = el('div', 'konami-fx__item');
	const icon = svg('svg', { viewBox: '0 0 96 96', width: '112', height: '112' });
	icon.classList.add('konami-fx__tick');
	const ring = svg('circle', { cx: '48', cy: '48', r: '42', fill: 'none', 'stroke-width': '5' });
	const check = svg('path', {
		d: 'M28 50 L43 65 L69 34',
		fill: 'none',
		'stroke-width': '7',
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
	});
	// Longitudes de trazo: 2π·42 ≈ 264 y 21,2 + 40,5 ≈ 62.
	ring.style.strokeDasharray = '264';
	check.style.strokeDasharray = '62';
	icon.append(ring, check);
	node.append(icon);
	return { node, icon, ring, check };
}

function succeed() {
	locked = true;
	window.clearTimeout(idleTimer);

	const o = ensureOverlay();
	const reduced = prefersReducedMotion();
	const tick = createTick();
	const center = particle(tick.node, window.innerWidth / 2, window.innerHeight / 2);
	place(center);
	getFxLayer().append(tick.node);

	o.tray.classList.add('is-ok');

	const finish = () => {
		o.root.remove();
		progress = 0;
		locked = false;
	};

	if (reduced) {
		gsap
			.timeline({ onComplete: finish })
			.set(o.vignette, { '--vig': '45%' })
			.fromTo([o.vignette, tick.icon], { opacity: 0 }, { opacity: 1, duration: 0.25 })
			.set([tick.ring, tick.check], { strokeDashoffset: 0 })
			.to([o.root, tick.node], { opacity: 0, duration: 0.4, onComplete: () => tick.node.remove() }, '+=1.1');
		return;
	}

	// El viñeteado "respira" hacia dentro mientras se dibuja el tick.
	const vignette = { stop: 82 };
	const paintVignette = () => o.vignette.style.setProperty('--vig', `${vignette.stop}%`);
	paintVignette();

	gsap.set(tick.ring, { strokeDashoffset: 264 });
	gsap.set(tick.check, { strokeDashoffset: 62 });

	gsap
		.timeline({ onComplete: finish })
		.to(o.vignette, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0)
		.to(vignette, { stop: 40, duration: 0.8, ease: 'power2.out', onUpdate: paintVignette }, 0)
		.fromTo(tick.icon, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, 0.1)
		.to(tick.ring, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, 0.1)
		.to(tick.check, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, 0.4)
		.to({}, { duration: 0.6 })
		// El overlay desaparece y el tick, ya suelto, cae.
		.add(() => {
			Object.assign(center, { vx: rand(-40, 40), vy: -300, vrot: sign() * rand(40, 90) });
			launch(center);
		})
		.to(o.root, { opacity: 0, duration: 0.5, ease: 'power1.in' }, '<');
}

/* ───────────────────────────────── Teclado ───────────────────────────────── */

function isEditable(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function onKeyDown(event: KeyboardEvent) {
	if (event.repeat || locked || event.ctrlKey || event.metaKey || event.altKey || MODIFIERS.has(event.key)) return;
	if (isEditable(event.target)) return;

	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

	if (key === SEQUENCE[progress]) {
		addKey(key);
		progress++;
		if (progress === SEQUENCE.length) succeed();
		else armIdle();
		return;
	}

	// Sin intento en curso, una tecla cualquiera no hace nada.
	if (progress === 0) return;
	if (key === 'Escape') cancel();
	else fail(key);
}

window.addEventListener('keydown', onKeyDown);
