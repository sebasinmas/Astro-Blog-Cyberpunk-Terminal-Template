import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const mm = gsap.matchMedia();

// Revelado escalonado al entrar en viewport para las vistas interiores (bitácora, artículos, 404).
mm.add('(prefers-reduced-motion: no-preference)', () => {
	const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]');
	gsap.set(targets, { opacity: 0, y: 24 });
	root.classList.remove('m-js');

	const reveals = ScrollTrigger.batch(targets, {
		start: 'top 92%',
		once: true,
		onEnter: (batch) =>
			gsap.to(batch, {
				opacity: 1,
				y: 0,
				duration: 0.8,
				ease: 'power3.out',
				stagger: 0.08,
				clearProps: 'transform',
			}),
	});

	// Solo los triggers de revelado: otros scripts de la página (p. ej. la barra de lectura) tienen los suyos.
	return () => reveals.forEach((t) => t.kill());
});

mm.add('(prefers-reduced-motion: reduce)', () => {
	root.classList.remove('m-js');
});
