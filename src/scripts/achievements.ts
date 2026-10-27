import { gsap } from 'gsap';
import konamiSprite from '../assets/claude_sinmas-export.png?url';
import cjSprite from '../assets/cj-sinmas.png?url';

/**
 * Easter eggs: logros que se desbloquean tecleando un código (Konami, HESOYAM…).
 *
 * - Al acertar la primera tecla aparece un overlay con las teclas pulsadas, abajo al centro.
 * - Si se falla, el progreso se reinicia y una mini ✕ roja salta y cae con gravedad.
 * - Si se completa, viñeteado verde animado y el pixel art del logro aparece en el centro y salta;
 *   luego el overlay se desvanece y el sprite vuela hasta quedar como un trofeo abajo a la derecha.
 *   Que se logró se guarda en localStorage y el trofeo reaparece en cada visita.
 *
 * Cada logro tiene su propia casilla de trofeo (apilados hacia arriba) y, mientras no se consiga, una
 * pista en baja opacidad: una lengüeta en el borde derecho (Konami) o un texto que sube desde detrás de
 * un elemento de la página al pasar el mouse (HESOYAM).
 * Con `prefers-reduced-motion` no hay saltos ni vuelos: solo desvanecimientos.
 *
 * El intento en curso es una máquina de estados pequeña (ver "Máquina de estados" más abajo). Todo cambio
 * pasa por `dispatch`, que solo acepta los eventos listados para el estado actual y descarta el resto; así
 * un temporizador o una animación rezagada no pueden mover la máquina a un estado al que no toca ir.
 *
 *   estado      evento                       → siguiente
 *   ─────────   ──────────────────────────   ─────────────────────────────────────────────
 *   idle        START (1.ª tecla de un código)  typing
 *   typing      ADVANCE (tecla correcta)        typing
 *               COMPLETE (última tecla)         unlocking
 *               MISS (tecla errónea)            fading   (✕ y apagado diferido)
 *               RESTART (errónea, pero inicia   typing   (✕ y vuelve a empezar)
 *                        otro código)
 *               ABORT (Escape o inactividad)    fading
 *   fading      START                           typing   (recupera el overlay)
 *               FADED (overlay apagado)         idle
 *   unlocking   DONE (fin de la animación)      idle
 *
 * - idle: sin intento ni overlay.   - typing: hay teclas acertadas; si no se pulsa nada en IDLE_MS, ABORT.
 * - fading: el overlay se apaga; pulsar la primera tecla de un código lo recupera (START).
 * - unlocking: animación del logro; ignora el teclado por completo y solo sale con DONE.
 */

interface Achievement {
	id: string;
	/** Teclas en orden; las letras van en minúscula. */
	sequence: readonly string[];
	/** Clave de localStorage; el valor guardado es el booleano `'true'`. */
	storageKey: string;
	/** Pixel art como rejilla de `cols`×`rows` píxeles, exportado ×10. */
	sprite: { url: string; cols: number; rows: number };
	desc: string;
	ariaLabel: string;
	hint: {
		lead: string;
		text: string;
		/** Selector del elemento detrás del cual sube el texto; sin él, es una lengüeta en el borde derecho. */
		anchor?: string;
	};
}

const ACHIEVEMENTS: readonly Achievement[] = [
	{
		id: 'konami',
		sequence: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
		storageKey: 'sinmas:konami-unlocked',
		sprite: { url: konamiSprite, cols: 49, rows: 28 },
		desc: 'Código Konami · +30 vidas',
		ariaLabel: 'Logro desbloqueado: Código Konami. +30 vidas.',
		hint: { lead: 'Sssh…', text: '¿recuerdas el código Konami?' },
	},
	{
		id: 'hesoyam',
		sequence: ['h', 'e', 's', 'o', 'y', 'a', 'm'],
		storageKey: 'sinmas:hesoyam-unlocked',
		sprite: { url: cjSprite, cols: 50, rows: 50 },
		desc: 'HESOYAM · dinero, vida y auto',
		ariaLabel: 'Logro desbloqueado: HESOYAM. Dinero, vida y auto reparado.',
		hint: {
			lead: 'Sssh…',
			text: '¿Recuerdas la clave de GTA San Andreas que te daba dinero, vida y reparaba tu auto?',
			anchor: '[data-achievement-anchor="hesoyam"]',
		},
	},
];

const GLYPHS: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', b: 'B', a: 'A' };
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'OS']);

/** Tiempo sin pulsar nada tras el cual se abandona el intento. */
const IDLE_MS = 3000;
/** Aceleración de caída de las partículas, en px/s². */
const GRAVITY = 2600;
/** Segundos que tarda en desvanecerse una partícula que ya empezó a caer. */
const FADE_S = 0.6;
/** El sprite se muestra ×4 en el centro y ×1 en el trofeo (el original es un ×10 de la rejilla). */
const SPRITE_SCALE = 4;
/** Opacidad del trofeo en reposo (coincide con la del CSS). */
const TROPHY_REST_OPACITY = 0.4;
/** Espera antes de mostrar la pista del borde, para que aparezca como un descubrimiento y no con la carga. */
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

/** Elementos de la página que pertenecen a cada logro. */
interface Widgets {
	trophy?: HTMLElement;
	hint?: HTMLElement;
}

type State = 'idle' | 'typing' | 'fading' | 'unlocking';
/**
 * START: primera tecla de un código · ADVANCE: tecla correcta · COMPLETE: última tecla de un código
 * MISS: tecla errónea · RESTART: tecla errónea que a la vez inicia otro código · ABORT: Escape o inactividad
 * FADED: terminó de apagarse el overlay · DONE: terminó la animación del logro
 */
type Event = 'START' | 'ADVANCE' | 'COMPLETE' | 'MISS' | 'RESTART' | 'ABORT' | 'FADED' | 'DONE';

interface Transition {
	to: State;
	/** Efectos de la transición; el estado ya es `to` cuando se ejecuta. */
	run: (key: string, achievement?: Achievement) => void;
}

let state: State = 'idle';
/** Teclas acertadas del intento en curso; solo tiene contenido en `typing` y `unlocking`. */
let buffer: string[] = [];
let overlay: Overlay | undefined;
let fxLayer: HTMLElement | undefined;
let idleTimer: number | undefined;
let fadeTween: gsap.core.Tween | undefined;
const particles = new Set<Particle>();
const widgets = new Map<Achievement, Widgets>(ACHIEVEMENTS.map((a) => [a, {}]));

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

function isUnlocked(a: Achievement): boolean {
	try {
		return localStorage.getItem(a.storageKey) === 'true';
	} catch {
		// Modo privado o almacenamiento bloqueado: el logro vale solo para esta visita.
		return false;
	}
}

function markUnlocked(a: Achievement) {
	try {
		localStorage.setItem(a.storageKey, 'true');
	} catch {
		/* sin almacenamiento: el trofeo no persistirá, pero la animación funciona igual */
	}
}

/* ───────────────────────── Partículas con gravedad ───────────────────────── */

function getFxLayer(): HTMLElement {
	if (!fxLayer || !fxLayer.isConnected) {
		fxLayer = el('div', 'ach-fx');
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
	const root = el('div', 'ach');
	root.setAttribute('aria-hidden', 'true');
	const vignette = el('div', 'ach__vignette');
	const tray = el('div', 'ach__tray');
	root.append(vignette, tray);
	document.body.append(root);
	overlay = { root, vignette, tray };
	return overlay;
}

/** Apaga el overlay (tras `delay` segundos); al terminar avisa a la máquina. */
function fadeOut(delay: number) {
	if (!overlay?.root.isConnected) return;
	fadeTween = gsap.to(overlay.root, {
		opacity: 0,
		duration: 0.3,
		delay,
		ease: 'power1.out',
		onComplete: () => dispatch('FADED'),
	});
}

function addKey(key: string) {
	const o = ensureOverlay();
	const chip = el('span', 'ach__key', GLYPHS[key] ?? key.toUpperCase());
	o.tray.append(chip);
	if (prefersReducedMotion()) return;
	gsap.fromTo(chip, { y: 26, scale: 0.55, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.38, ease: 'back.out(2.2)' });
}

function armIdle() {
	window.clearTimeout(idleTimer);
	idleTimer = window.setTimeout(() => dispatch('ABORT'), IDLE_MS);
}

/**
 * Las teclas acumuladas se despiden desde una copia, para que la bandeja real quede libre y un nuevo
 * intento pueda empezar encima sin mezclarse con las teclas que se van. La copia se elimina sola.
 */
function releaseTray(o: Overlay, reduced: boolean) {
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
}

/* ───────────────────────────────── Error ───────────────────────────────── */

function createCross(size: number): HTMLElement {
	const node = el('div', 'ach-fx__item');
	const icon = svg('svg', { viewBox: '0 0 24 24', width: String(size), height: String(size) });
	icon.classList.add('ach-fx__cross');
	icon.append(svg('path', { d: 'M5 5 L19 19 M19 5 L5 19', fill: 'none', 'stroke-width': '3.6', 'stroke-linecap': 'round' }));
	node.append(icon);
	return node;
}

/** Efecto de una tecla errónea: las teclas se despiden y una ✕ salta desde la última. */
function reject() {
	const o = ensureOverlay();
	const reduced = prefersReducedMotion();

	// Punto de salida de la ✕: justo a continuación de la última tecla pulsada.
	const last = o.tray.lastElementChild;
	const rect = (last ?? o.tray).getBoundingClientRect();
	const x = last ? rect.right + 22 : rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;

	releaseTray(o, reduced);

	if (reduced) {
		const cross = createCross(26);
		cross.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
		getFxLayer().append(cross);
		gsap.to(cross, { opacity: 0, duration: 0.4, delay: 0.5, onComplete: () => cross.remove() });
	} else {
		// ✕ que salta hacia arriba y cae con gravedad, acompañada de unas chispas.
		launch(particle(createCross(26), x, y, { vx: rand(-110, 110), vy: -rand(560, 700), vrot: sign() * rand(260, 520), fade: true }));
		for (let i = 0; i < 6; i++) {
			const spark = el('div', 'ach-fx__item ach-fx__spark');
			launch(particle(spark, x, y, { vx: rand(-260, 260), vy: -rand(220, 520), fade: true }));
		}
	}

	buffer = [];
}

/* ─────────────────────────── Pistas (antes del logro) ─────────────────────────── */

/**
 * Lengüeta tenue pegada al borde derecho, a la altura donde luego aterriza el trofeo. En reposo solo
 * asoma el asa (dentro del margen lateral, sin tapar contenido); al pasar el mouse se despliega.
 */
function createEdgeHint(a: Achievement): HTMLElement {
	const node = el('div', 'ach-hint');
	const text = el('span', 'ach-hint__text');
	text.append(el('span', 'ach-hint__lead', a.hint.lead), el('span', '', a.hint.text));
	node.append(el('span', 'ach-hint__handle', '?'), text);
	window.setTimeout(() => node.classList.add('is-visible'), HINT_DELAY_MS);
	return node;
}

/**
 * Texto que sube desde detrás del borde superior de un elemento al pasar el mouse sobre él. El contenedor
 * recorta la lengüeta, de modo que parece salir de atrás del elemento.
 */
function createPeekHint(a: Achievement, anchor: HTMLElement): HTMLElement {
	const node = el('div', 'ach-peek');
	const tab = el('p', 'ach-peek__tab');
	tab.append(el('span', 'ach-peek__lead', a.hint.lead), a.hint.text);
	node.append(tab);
	anchor.classList.add('ach-anchor');
	anchor.append(node);
	return node;
}

/** Las pistas son decorativas: los lectores de pantalla las ignoran. */
function ensureHint(a: Achievement) {
	const w = widgets.get(a)!;
	if (w.hint?.isConnected) return;
	const anchor = a.hint.anchor ? document.querySelector<HTMLElement>(a.hint.anchor) : undefined;
	if (a.hint.anchor && !anchor) return;

	const node = anchor ? createPeekHint(a, anchor) : createEdgeHint(a);
	node.setAttribute('aria-hidden', 'true');
	if (!anchor) document.body.append(node);
	w.hint = node;
}

/** Mientras se teclea un código las pistas se apartan para no estorbar. */
function muteHints(muted: boolean) {
	for (const { hint } of widgets.values()) hint?.classList.toggle('is-muted', muted);
}

/** Al conseguir el logro su pista desaparece para siempre: ya no hay nada que recordar. */
function dismissHint(a: Achievement) {
	const w = widgets.get(a)!;
	const node = w.hint;
	if (!node) return;
	w.hint = undefined;
	node.classList.add('is-gone');
	window.setTimeout(() => node.remove(), 900);
}

/* ───────────────────────────── Trofeo (reposo) ───────────────────────────── */

/** Crea el trofeo (una sola vez por página); en reposo es un cuadrado con el sprite y baja opacidad. */
function ensureTrophy(a: Achievement): HTMLElement {
	const w = widgets.get(a)!;
	if (w.trophy?.isConnected) return w.trophy;

	const root = el('div', 'ach-trophy');
	root.style.setProperty('--slot', String(ACHIEVEMENTS.indexOf(a)));
	root.tabIndex = 0;
	root.setAttribute('role', 'note');
	root.setAttribute('aria-label', a.ariaLabel);

	const icon = el('span', 'ach-trophy__icon');
	const img = el('img', '');
	img.src = a.sprite.url;
	img.alt = '';
	img.width = a.sprite.cols;
	img.height = a.sprite.rows;
	icon.append(img);

	const text = el('span', 'ach-trophy__text');
	text.setAttribute('aria-hidden', 'true');
	text.append(el('span', 'ach-trophy__title', '¡Logro desbloqueado!'), el('span', 'ach-trophy__desc', a.desc));

	root.append(icon, text);
	document.body.append(root);
	w.trophy = root;
	return root;
}

/** Remate de la animación: el trofeo queda visible; la primera vez se anuncia expandido. */
function arriveAtTrophy(a: Achievement, first: boolean) {
	const t = ensureTrophy(a);
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

function createSprite(a: Achievement): Sprite {
	const node = el('div', 'ach-fx__item');
	const img = el('img', 'ach-fx__sprite');
	img.src = a.sprite.url;
	img.alt = '';
	img.width = a.sprite.cols * SPRITE_SCALE;
	img.height = a.sprite.rows * SPRITE_SCALE;
	node.append(img);
	return { node, img };
}

/** El sprite vuela del centro a su sitio en el trofeo mientras el overlay se desvanece. */
function flyToTrophy(a: Achievement, sprite: Sprite, first: boolean, o: Overlay, done: () => void) {
	const target = ensureTrophy(a).querySelector('img')!.getBoundingClientRect();
	const k = target.width / (a.sprite.cols * SPRITE_SCALE);

	gsap
		.timeline({
			onComplete: () => {
				sprite.node.remove();
				arriveAtTrophy(a, first);
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

function unlock(a: Achievement) {
	const o = ensureOverlay();
	const reduced = prefersReducedMotion();

	// El logro se guarda al completarlo; la primera vez el trofeo nace oculto hasta que llega el sprite.
	const first = !isUnlocked(a);
	markUnlocked(a);
	dismissHint(a);
	const t = ensureTrophy(a);
	if (first) t.classList.add('is-pending');

	const sprite = createSprite(a);
	const cx = window.innerWidth / 2;
	const cy = window.innerHeight / 2;
	getFxLayer().append(sprite.node);
	gsap.set(sprite.node, { x: cx, y: cy, xPercent: -50, yPercent: -50, opacity: 0 });

	o.tray.classList.add('is-ok');

	const settle = () => dispatch('DONE');

	if (reduced) {
		gsap
			.timeline({
				onComplete: () => {
					sprite.node.remove();
					arriveAtTrophy(a, first);
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

	const tl = gsap.timeline({ onComplete: () => flyToTrophy(a, sprite, first, o, settle) });
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

/* ─────────────────────────────── Máquina de estados ─────────────────────────────── */

/** Empieza (o reinicia) un intento con su primera tecla. */
function beginAttempt(key: string) {
	buffer = [key];
	addKey(key);
	armIdle();
}

function pushKey(key: string) {
	buffer.push(key);
	addKey(key);
}

/**
 * Qué puede pasar en cada estado. Lo que no está aquí es imposible por construcción: por ejemplo, desde
 * `unlocking` solo se sale con DONE (ninguna tecla ni temporizador lo interrumpe), y `idle` solo se
 * alcanza desde `fading` o `unlocking`, cuando el overlay ya desapareció.
 */
const TRANSITIONS: Record<State, Partial<Record<Event, Transition>>> = {
	idle: {
		START: {
			to: 'typing',
			run: (key) => {
				// Los sprites se precargan al empezar el intento para que no aparezcan tarde al completarlo.
				for (const a of ACHIEVEMENTS) new Image().src = a.sprite.url;
				muteHints(true);
				beginAttempt(key);
			},
		},
	},
	typing: {
		ADVANCE: {
			to: 'typing',
			run: (key) => {
				pushKey(key);
				armIdle();
			},
		},
		COMPLETE: {
			to: 'unlocking',
			run: (key, a) => {
				pushKey(key);
				unlock(a!);
			},
		},
		MISS: {
			to: 'fading',
			run: () => {
				reject();
				fadeOut(0.6);
			},
		},
		RESTART: {
			to: 'typing',
			run: (key) => {
				reject();
				beginAttempt(key);
			},
		},
		ABORT: {
			to: 'fading',
			run: () => {
				buffer = [];
				if (overlay) releaseTray(overlay, prefersReducedMotion());
				fadeOut(0);
			},
		},
	},
	fading: {
		// Se retoma el overlay que se estaba apagando (el efecto de salida de `fading` ya detuvo el fundido).
		START: { to: 'typing', run: (key) => beginAttempt(key) },
		FADED: {
			to: 'idle',
			run: () => {
				overlay?.root.remove();
				muteHints(false);
			},
		},
	},
	unlocking: {
		DONE: {
			to: 'idle',
			run: () => {
				overlay?.root.remove();
				buffer = [];
				muteHints(false);
			},
		},
	},
};

/** Efectos al abandonar un estado, sea cual sea el destino (también si es el mismo). */
const ON_EXIT: Partial<Record<State, () => void>> = {
	typing: () => window.clearTimeout(idleTimer),
	fading: () => fadeTween?.kill(),
};

/** Único punto por el que cambia `state`. Devuelve `false` si el evento no es válido en el estado actual. */
function dispatch(event: Event, key = '', achievement?: Achievement): boolean {
	const transition = TRANSITIONS[state][event];
	if (!transition) return false;
	ON_EXIT[state]?.();
	state = transition.to;
	transition.run(key, achievement);
	return true;
}

/* ───────────────────────────────── Teclado ───────────────────────────────── */

function startsWith(sequence: readonly string[], prefix: readonly string[]): boolean {
	return prefix.length <= sequence.length && prefix.every((key, i) => key === sequence[i]);
}

function startsAnySequence(prefix: readonly string[]): boolean {
	return ACHIEVEMENTS.some((a) => startsWith(a.sequence, prefix));
}

function isEditable(target: EventTarget | null): boolean {
	return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function onKeyDown(event: KeyboardEvent) {
	if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || MODIFIERS.has(event.key)) return;
	if (isEditable(event.target)) return;

	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
	const next = [...buffer, key];

	// Aquí solo se traduce la tecla a un evento; si el estado actual no lo admite, `dispatch` lo ignora
	// (p. ej. una tecla cualquiera sin intento en curso, o cualquier tecla durante la animación del logro).
	if (startsAnySequence(next)) {
		const done = ACHIEVEMENTS.find((a) => a.sequence.length === next.length && startsWith(a.sequence, next));
		if (done) dispatch('COMPLETE', key, done);
		else dispatch(buffer.length === 0 ? 'START' : 'ADVANCE', key);
	} else if (key === 'Escape') {
		dispatch('ABORT');
	} else {
		dispatch(startsAnySequence([key]) ? 'RESTART' : 'MISS', key);
	}
}

window.addEventListener('keydown', onKeyDown);

// Quien ya consiguió un logro ve su trofeo en cada visita; por cada uno que falte, una pista discreta.
for (const a of ACHIEVEMENTS) {
	if (isUnlocked(a)) ensureTrophy(a);
	else ensureHint(a);
}
