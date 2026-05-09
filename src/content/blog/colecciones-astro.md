---
title: 'Content Collections en Astro: un solo origen de verdad'
description: 'Esquema con Zod, Markdown y rutas estáticas sin perder flexibilidad.'
pubDate: '2026-05-08'
heroImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1600&q=80'
---

Las **Content Collections** permiten tipar el frontmatter y generar rutas de blog de forma predecible.

### Ventajas prácticas

1. Autocompletado y validación al editar posts.
2. Misma API para listados y detalle (`getCollection`, `render`).
3. Build estático sin sorpresas en producción.

```ts
// El loader apunta a ./src/content/blog
const posts = await getCollection('blog');
```

En este proyecto el esquema incluye título, descripción, fecha y una imagen opcional como URL.
