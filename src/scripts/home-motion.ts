import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {
	// Intro del hero: entrada escalonada de eyebrow, titular, bio, acciones y retrato.
	const hero = gsap.utils.toArray<HTMLElement>('[data-hero]');
	gsap.set(hero, { opacity: 0, y: 28 });
	root.classList.remove('m-js');
	gsap.to(hero, {
		opacity: 1,
		y: 0,
		duration: 0.9,
		ease: 'power3.out',
		stagger: 0.1,
		delay: 0.1,
		clearProps: 'transform',
	});

	// Revelado al hacer scroll para el resto de bloques.
	gsap.utils
		.toArray<HTMLElement>('[data-reveal]:not([data-hero])')
		.forEach((el) => {
			gsap.fromTo(
				el,
				{ opacity: 0, y: 32 },
				{
					opacity: 1,
					y: 0,
					duration: 0.8,
					ease: 'power3.out',
					clearProps: 'transform',
					scrollTrigger: { trigger: el, start: 'top 88%', once: true },
				},
			);
		});

	// Los divisores se dibujan de izquierda a derecha.
	gsap.utils.toArray<HTMLElement>('[data-rule]').forEach((el) => {
		gsap.fromTo(
			el,
			{ scaleX: 0 },
			{
				scaleX: 1,
				duration: 1.1,
				ease: 'power2.inOut',
				scrollTrigger: { trigger: el, start: 'top 95%', once: true },
			},
		);
	});

	return () => ScrollTrigger.getAll().forEach((t) => t.kill());
});

// Con reduced-motion no se anima nada: se muestra todo de inmediato.
mm.add('(prefers-reduced-motion: reduce)', () => {
	root.classList.remove('m-js');
});
