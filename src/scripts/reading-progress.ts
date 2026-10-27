import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Barra de progreso de lectura de los artículos (bitácora y proyectos).
 *
 * El progreso se mide sobre el contenido (`[data-reading-content]`) y no sobre toda la página:
 * 0 % cuando el primer párrafo entra en la zona de lectura y 100 % cuando el último termina de
 * verse. Se usa el mismo punto de referencia (85 % de la altura del viewport) en ambos extremos,
 * así la barra llega al 100 % con un margen sobre el viewport, antes de que el pie de página
 * (acciones del artículo y footer del sitio) entre en pantalla.
 */
const READING_LINE = '85%';

const bar = document.querySelector<HTMLElement>('[data-reading-progress]');
const content = document.querySelector<HTMLElement>('[data-reading-content]');

if (bar && content) {
	const mm = gsap.matchMedia();

	mm.add(
		{
			smooth: '(prefers-reduced-motion: no-preference)',
			reduced: '(prefers-reduced-motion: reduce)',
		},
		(context) => {
			const { reduced } = context.conditions ?? {};

			gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' });

			gsap.to(bar, {
				scaleX: 1,
				ease: 'none',
				scrollTrigger: {
					trigger: content,
					start: `top ${READING_LINE}`,
					end: `bottom ${READING_LINE}`,
					// Con reduced-motion la barra sigue al scroll sin suavizado; es información, no adorno.
					scrub: reduced ? true : 0.25,
					invalidateOnRefresh: true,
				},
			});

			// Imágenes, fuentes o bloques que cambian la altura del contenido desplazan el final.
			let pending: gsap.core.Tween | undefined;
			const observer = new ResizeObserver(() => {
				pending?.kill();
				pending = gsap.delayedCall(0.15, () => ScrollTrigger.refresh());
			});
			observer.observe(content);

			return () => {
				pending?.kill();
				observer.disconnect();
			};
		},
	);
}
