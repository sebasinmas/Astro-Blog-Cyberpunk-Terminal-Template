import { gsap } from 'gsap';
import spriteUrl from '../assets/claude_sinmas-export.png?url';

/**
 * Easter egg: código Konami (↑ ↑ ↓ ↓ ← → ← → B A).
 *
 * - Al acertar la primera tecla aparece un overlay con las teclas pulsadas, abajo al centro.
 * - Si se falla, el progreso se reinicia y una mini ✕ roja salta y cae con gravedad.
 * - Si se completa, viñeteado verde animado y el pixel art (el cangrejo) aparece en el centro y
 *   salta; luego el overlay se desvanece y el sprite vuela hasta quedar como un trofeo abajo a la
 *   derecha. Que se logró se guarda en localStorage y el trofeo reaparece en cada visita.
 *
 * Mientras el logro no se haya conseguido, una pista en baja opacidad ocupa el lugar del trofeo.
 * Con `prefers-reduced-motion` no hay saltos ni vuelos: solo desvanecimientos.
 */

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const;
const GLYPHS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', b: 'B', a: 'A' };
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'OS']);

/** Clave de localStorage; el valor guardado es el booleano `'true'`. */
const STORAGE_KEY = 'sinmas:konami-unlocked';

/** Tiempo sin pulsar nada tras el cual se abandona el intento. */
const IDLE_MS = 3000;
/** Aceleración de caída de las partículas, en px/s². */
const GRAVITY = 2600;
/** Segundos que tarda en desvanecerse una partícula que ya empezó a caer. */
const FADE_S = 0.6;
/** El sprite original es una rejilla de 49×28 px (exportada ×10): 196×112 es un ×4 exacto. */
const SPRITE_W = 196;
const SPRITE_H = 112;
/** Opacidad del trofeo en reposo (coincide con la del CSS). */
const TROPHY_REST_OPACITY = 0.4;
/** Pista en forma de lengüeta: asoma por el borde derecho y se despliega al pasar el mouse. */
const HINT_LEAD = 'Sssh…';
const HINT_TEXT = '¿recuerdas el código Konami?';
/** Espera antes de mostrar la pista, para que aparezca como un descubrimiento y no con la carga. */
const HINT_DELAY_MS = 1500;
/** Cuánto se queda expandido el aviso "logro desbloqueado" la primera vez. */
const ANNOUNCE_MS = 2800;
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

interface Sprite {
	/** Contenedor: posición, escala y vuelo (GSAP). */
	node: HTMLElement;
	/** Imagen: aplastamiento y estiramiento al caer de cada salto. */
	img: HTMLImageElement;
}

let progress = 0;
let locked = false;
let overlay: Overlay | undefined;
let fxLayer: HTMLElement | undefined;
let trophy: HTMLElement | undefined;
let hint: HTMLElement | undefined;
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

/* ───────────────────────────── Logro (localStorage) ───────────────────────────── */

function isUnlocked(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		// Modo privado o almacenamiento bloqueado: el logro vale solo para esta visita.
		return false;
	}
}

function markUnlocked() {
	try {
		localStorage.setItem(STORAGE_KEY, 'true');
	} catch {
		/* sin almacenamiento: el trofeo no persistirá, pero la animación funciona igual */
	}
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
	// El sprite se precarga al empezar el intento para que no aparezca tarde al completarlo.
	new Image().src = spriteUrl;
	muteHint(true);

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
		onComplete: () => {
			o.root.remove();
			muteHint(false);
		},
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

/* ─────────────────────────── Pista (antes del logro) ─────────────────────────── */

/**
 * Lengüeta tenue pegada al borde derecho, a la altura donde luego aterriza el trofeo. En reposo solo
 * asoma el asa (dentro del margen lateral, sin tapar contenido); al pasar el mouse se despliega.
 * Es decorativa: los lectores de pantalla la ignoran.
 */
function ensureHint() {
	if (hint?.isConnected) return;
	const node = el('div', 'konami-hint');
	node.setAttribute('aria-hidden', 'true');
	const text = el('span', 'konami-hint__text');
	text.append(el('span', 'konami-hint__lead', HINT_LEAD), el('span', '', HINT_TEXT));
	node.append(el('span', 'konami-hint__handle', '?'), text);
	document.body.append(node);
	hint = node;
	window.setTimeout(() => node.classList.add('is-visible'), HINT_DELAY_MS);
}

/** Mientras se teclea el código la pista se aparta para no estorbar. */
function muteHint(muted: boolean) {
	hint?.classList.toggle('is-muted', muted);
}

/** Al conseguir el logro la pista desaparece para siempre: ya no hay nada que recordar. */
function dismissHint() {
	const node = hint;
	if (!node) return;
	hint = undefined;
	node.classList.add('is-gone');
	window.setTimeout(() => node.remove(), 900);
}

/* ───────────────────────────── Trofeo (reposo) ───────────────────────────── */

/** Crea el trofeo (una sola vez por página); en reposo es un cuadrado con el sprite y baja opacidad. */
function ensureTrophy(): HTMLElement {
	if (trophy?.isConnected) return trophy;

	const root = el('div', 'konami-trophy');
	root.tabIndex = 0;
	root.setAttribute('role', 'note');
	root.setAttribute('aria-label', 'Logro desbloqueado: Código Konami. +30 vidas.');

	const icon = el('span', 'konami-trophy__icon');
	const img = el('img', '');
	img.src = spriteUrl;
	img.alt = '';
	img.width = 49;
	img.height = 28;
	icon.append(img);

	const text = el('span', 'konami-trophy__text');
	text.setAttribute('aria-hidden', 'true');
	text.append(el('span', 'konami-trophy__title', '¡Logro desbloqueado!'), el('span', 'konami-trophy__desc', 'Código Konami · +30 vidas'));

	root.append(icon, text);
	document.body.append(root);
	trophy = root;
	return root;
}

/** Remate de la animación: el trofeo queda visible; la primera vez se anuncia expandido. */
function arriveAtTrophy(first: boolean) {
	const t = ensureTrophy();
	if (first) {
		// Sin transición para que el relevo con el sprite que acaba de llegar sea imperceptible.
		t.style.transition = 'none';
		t.classList.remove('is-pending');
		void t.offsetWidth;
		t.style.transition = '';
		t.classList.add('is-announcing');
		window.setTimeout(() => t.classList.remove('is-announcing'), ANNOUNCE_MS);
	} else if (!prefersReducedMotion()) {
		gsap.fromTo(t, { scale: 1 }, { scale: 1.18, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.out', clearProps: 'transform' });
	}
}

/* ───────────────────────────────── Éxito ───────────────────────────────── */

function createSprite(): Sprite {
	const node = el('div', 'konami-fx__item');
	const img = el('img', 'konami-fx__sprite');
	img.src = spriteUrl;
	img.alt = '';
	img.width = SPRITE_W;
	img.height = SPRITE_H;
	node.append(img);
	return { node, img };
}

/** El sprite vuela del centro a su sitio en el trofeo mientras el overlay se desvanece. */
function flyToTrophy(sprite: Sprite, first: boolean, o: Overlay, done: () => void) {
	const target = ensureTrophy().querySelector('img')!.getBoundingClientRect();
	const k = target.width / SPRITE_W;

	gsap
		.timeline({
			onComplete: () => {
				sprite.node.remove();
				arriveAtTrophy(first);
				done();
			},
		})
		.to(o.root, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 0)
		.to(
			sprite.node,
			{ x: target.left + target.width / 2, y: target.top + target.height / 2, scale: k, duration: 0.95, ease: 'power3.inOut' },
			0,
		)
		// Llega con la misma opacidad que el trofeo en reposo, para que el relevo sea continuo.
		.to(sprite.node, { opacity: TROPHY_REST_OPACITY, duration: 0.3, ease: 'none' }, 0.65);
}

function succeed() {
	locked = true;
	window.clearTimeout(idleTimer);

	const o = ensureOverlay();
	const reduced = prefersReducedMotion();

	// El logro se guarda al completarlo; la primera vez el trofeo nace oculto hasta que llega el sprite.
	const first = !isUnlocked();
	markUnlocked();
	dismissHint();
	const t = ensureTrophy();
	if (first) t.classList.add('is-pending');

	const sprite = createSprite();
	const cx = window.innerWidth / 2;
	const cy = window.innerHeight / 2;
	getFxLayer().append(sprite.node);
	gsap.set(sprite.node, { x: cx, y: cy, xPercent: -50, yPercent: -50, opacity: 0 });

	o.tray.classList.add('is-ok');

	const settle = () => {
		o.root.remove();
		progress = 0;
		locked = false;
	};

	if (reduced) {
		gsap
			.timeline({
				onComplete: () => {
					sprite.node.remove();
					arriveAtTrophy(first);
					settle();
				},
			})
			.set(o.vignette, { '--vig': '45%' })
			.fromTo(o.vignette, { opacity: 0 }, { opacity: 1, duration: 0.25 })
			.to(sprite.node, { opacity: 1, duration: 0.25 }, 0)
			.to([o.root, sprite.node], { opacity: 0, duration: 0.4 }, '+=1.1');
		return;
	}

	// El viñeteado "respira" hacia dentro mientras el sprite entra y salta.
	const vignette = { stop: 82 };
	const paintVignette = () => o.vignette.style.setProperty('--vig', `${vignette.stop}%`);
	paintVignette();

	const tl = gsap.timeline({ onComplete: () => flyToTrophy(sprite, first, o, settle) });
	tl.to(o.vignette, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0)
		.to(vignette, { stop: 40, duration: 0.8, ease: 'power2.out', onUpdate: paintVignette }, 0)
		.fromTo(sprite.node, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' }, 0.1);

	// Tres saltos cada vez más bajos; al caer, el sprite se aplasta y rebota (squash & stretch).
	const hop = (height: number, air: number, squash: number, at: string | number) => {
		tl.to(sprite.node, { y: cy - height, duration: air, ease: 'power2.out' }, at)
			.to(sprite.node, { y: cy, duration: air, ease: 'power2.in' })
			.to(sprite.img, { scaleY: 1 - squash, scaleX: 1 + squash * 0.7, duration: 0.07, ease: 'power1.out' })
			.to(sprite.img, { scaleY: 1, scaleX: 1, duration: 0.22, ease: 'elastic.out(1, 0.45)' });
	};
	hop(130, 0.3, 0.18, 0.55);
	hop(70, 0.22, 0.12, '-=0.14');
	hop(28, 0.14, 0.07, '-=0.14');
	tl.to({}, { duration: 0.3 });
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

// Quien ya consiguió el logro ve su trofeo en cada visita; el resto, una pista discreta.
if (isUnlocked()) ensureTrophy();
else ensureHint();
