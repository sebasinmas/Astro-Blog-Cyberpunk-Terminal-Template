# Portfolio en Astro VHS/CRT

Template de portfolio personal hecho con Astro 6, Tailwind CSS 4 y una estética de terminal CRT/synthwave. La idea del repo es que puedas clonarlo, cambiar identidad, proyectos, artículos y datos de contacto, y publicar tu propio portfolio estático sin montar un backend.

## Qué trae

- Home con hero, proyectos destacados, últimos posts y contacto.
- Proyectos y blog modelados como colecciones de contenido de Astro.
- Páginas de detalle generadas estáticamente desde Markdown/MDX.
- Layout compartido para artículos y proyectos.
- Estilos globales tipo terminal retro: fuente monospace, glow, scanlines, caret parpadeante y componentes cuadrados.
- SEO básico con canonical, Open Graph, Twitter cards, sitemap y metadatos por página.
- Deploy opcional a VPS con GitHub Actions, `rsync` y reinicio de Docker Compose si lo necesitas.

## Stack y decisiones

Este proyecto prioriza simplicidad y portabilidad:

- `Astro 6` como generador estático. No hay backend, base de datos ni runtime de servidor para el portfolio.
- `Tailwind CSS 4` integrado con `@tailwindcss/vite` en `astro.config.mjs`. No se usa `tailwind.config.js`; los tokens viven en `src/styles/global.css`.
- Componentes `.astro` sin framework de UI obligatorio. Si no necesitas React/Vue/Svelte, no los instales.
- Contenido en Markdown/MDX mediante Content Collections para tener frontmatter validado y rutas generadas.
- Imágenes de proyectos resueltas desde `src/assets/imgs/projects/` o por URL remota.
- Despliegue estático: el build genera `dist/`, que puede subirse a Netlify, Vercel, Cloudflare Pages, un bucket o un VPS.

## Requisitos

- Node.js `>=22.12.0`
- npm

## Primeros pasos

```sh
npm install
npm run dev
```

El sitio queda disponible en `http://localhost:4321`.

Para validar una build de producción:

```sh
npm run build
npm run preview
```

## Estructura del repositorio

```text
.
├── .github/workflows/deploy.yml      # Build y deploy a VPS por SSH/rsync
├── public/                           # Archivos públicos servidos desde /
├── src/
│   ├── assets/                       # Imágenes y fuentes procesadas por Astro
│   │   └── imgs/
│   │       ├── blog/                 # Imágenes para posts
│   │       └── projects/             # Imágenes locales de proyectos
│   ├── components/                   # Bloques de UI reutilizables
│   ├── content/                      # Markdown/MDX del blog y proyectos
│   ├── layouts/                      # Layout base y layout de artículos
│   ├── pages/                        # Rutas Astro
│   ├── styles/global.css             # Tailwind 4, tokens, tema CRT y estilos globales
│   ├── utils/                        # Helpers de contenido e imágenes
│   ├── consts.ts                     # Título y descripción global del sitio
│   └── content.config.ts             # Schemas de colecciones
├── astro.config.mjs                  # Configuración de Astro, Tailwind, sitemap e imágenes
├── package.json
└── tsconfig.json
```

## Cómo hacerlo tuyo

Empieza por estos archivos:

- `src/consts.ts`: cambia `SITE_TITLE` y `SITE_DESCRIPTION`.
- `astro.config.mjs`: cambia `site` por tu dominio real. Esto afecta canonical URLs y sitemap.
- `src/components/HomeHero.astro`: cambia nombre, titular, descripción, CTAs e imágenes personales.
- `src/components/AppHeader.astro`: cambia marca, enlaces principales y URL de GitHub.
- `src/components/HomeContact.astro`: cambia email, GitHub, LinkedIn y texto de contacto.
- `public/favicon.png`: reemplaza el favicon.
- `src/assets/imgs/projects/`: agrega capturas o imágenes de tus proyectos.

Si quieres cambiar el estilo visual, el centro de control es `src/styles/global.css`. Ahí están los tokens de color, fuentes, scanlines, glow y estilos globales. La decisión actual es mantener una estética de terminal CRT ochentera: fondo oscuro, neón magenta/cyan/green, tipografía monospace y bordes cuadrados. La guía de intención visual del repo está en `.cursorrules`.

## Proyectos

Los proyectos viven en `src/content/projects/`. Cada archivo `.md` genera una página en `/projects/[slug]/` y aparece en la sección de proyectos de la home.

Ejemplo:

```md
---
title: Mi Proyecto
description: "Resumen claro del problema, alcance y resultado."
tags:
  - Astro
  - Tailwind
image: mi-proyecto/home.png
pubDate: '2026-04-21'
order: 0
---

## Rol y alcance

Explica qué hiciste, qué decisiones tomaste y por qué importa.
```

Campos disponibles:

- `title`: nombre del proyecto.
- `description`: resumen usado en tarjetas y metadatos.
- `tags`: tecnologías o temas.
- `image`: URL remota o ruta relativa a `src/assets/imgs/projects/`.
- `pubDate`: fecha de publicación.
- `updatedDate`: fecha opcional de actualización.
- `heroImage`: banner opcional distinto al thumbnail.
- `order`: orden ascendente en la home.

Para imágenes locales, guarda el archivo en una carpeta del proyecto:

```text
src/assets/imgs/projects/mi-proyecto/home.png
```

Y referéncialo así:

```yaml
image: mi-proyecto/home.png
```

Si usas imágenes remotas, asegúrate de permitir el dominio en `astro.config.mjs` dentro de `image.remotePatterns`.

## Blog

Los posts se cargan desde `src/content/blog/` y aceptan Markdown o MDX. Si la carpeta no existe todavía, créala antes de agregar tu primer post.

Ejemplo:

```md
---
title: "Cómo armé mi portfolio"
description: "Notas técnicas y decisiones de implementación."
pubDate: '2026-05-14'
heroImage: /alguna-imagen.png
---

Contenido del post.
```

Campos del blog:

- `title`
- `description`
- `pubDate`
- `updatedDate` opcional
- `heroImage` opcional

Los últimos tres posts aparecen en la home dentro del bloque estilo terminal.

## Rutas principales

- `/`: home del portfolio.
- `/#projects`: sección de proyectos destacados.
- `/projects/[slug]/`: detalle de cada proyecto.
- `/blog/`: listado de posts.
- `/blog/[slug]/`: detalle de cada post.
- `/portfolio/`: ruta legada que redirige a `/#projects`.
- `/404`: página de error.

## Deploy a VPS

El workflow `.github/workflows/deploy.yml` hace:

1. Checkout del repo.
2. Instalación con `npm ci`.
3. Build con `npm run build`.
4. Copia de `dist/` al VPS con `rsync --delete`.
5. Ejecución opcional de Docker Compose en el servidor.

Secrets obligatorios en GitHub Actions:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_DEPLOY_PATH`

Secrets opcionales:

- `VPS_SSH_KNOWN_HOSTS`
- `VPS_COMPOSE_PATH`
- `VPS_COMPOSE_CMD`

Si no usas VPS, puedes ignorar ese workflow y desplegar `dist/` en cualquier hosting estático.

## Comandos útiles

| Comando | Acción |
| --- | --- |
| `npm install` | Instala dependencias |
| `npm run dev` | Levanta el entorno local |
| `npm run build` | Genera el sitio en `dist/` |
| `npm run preview` | Previsualiza la build local |
| `npm run astro -- --help` | Muestra ayuda de la CLI de Astro |

## Checklist para publicar tu versión

- Cambiar textos personales y enlaces.
- Reemplazar imágenes del hero, favicon y proyectos.
- Agregar tus proyectos en `src/content/projects/`.
- Crear posts en `src/content/blog/` si quieres blog.
- Cambiar `site` en `astro.config.mjs`.
- Revisar que `npm run build` pase sin errores.
- Configurar deploy o subir manualmente `dist/`.

## Crédito

El punto de partida fue el starter de blog de Astro, pero el repo fue convertido en un template de portfolio con estética terminal CRT y deploy a VPS. Si lo usas para armar el tuyo, deja una estrella o manda buena vibra.
