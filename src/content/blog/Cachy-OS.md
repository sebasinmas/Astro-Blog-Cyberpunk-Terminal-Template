---
title: Me cambio a CachyOS
description: "Me aburrí de los errores y conflictos que me daba Windows y me cambié a CachyOS, una distribución de Linux basada en Arch."
tags:
- Linux
- Arch
- Opensource
- CachyOS
image: cachyos/cachyos.webp
pubDate: '2026-08-23'
order: 0
---
  
## ¿Por qué CachyOS?
Cuando empecé a estudiar Ingeniería Informática (en épocas donde la IA aún no era ni el 1% de lo que es hoy), ya había coqueteado un poco con Ubuntu. Me encantaba la idea de tener un **dual boot** y conviví con el menú de GRUB durante un montón de tiempo.

Pero mi notebook venía con BitLocker, lo que se tradujo en una insufrible cantidad de bloqueos del disco duro. Y ahí estaba yo, en los peores momentos posibles (entregas, pruebas, despliegues y reuniones), tecleando unas interminables claves de recuperación que, combinadas con mi miopía, hacían estragos en mi productividad. A eso había que sumarle los típicos conflictos de *hardware clock* que hacían que Windows y Linux se pelearan desajustando la hora del sistema a cada rato. Puedes leer más sobre esa pesadilla en este [post de reddit](https://www.reddit.com/r/linuxquestions/comments/rgkw0j/i_dual_boot_ubuntu_and_windows_11_everytime_i/).

Por esas razones, opté por abandonar Ubuntu. Como a gran parte de los que nos dedicamos a esto, me gusta jugar, y hay títulos en Steam que simplemente funcionaban como la mi**** en Linux. Mi lógica en ese momento fue: *"¿Para qué pelear con dos sistemas operativos si Windows con WSL2 me permite no tener que instalar una partición de Linux nunca más?"*.

Qué ingenuo era 🥲.

Durante mucho tiempo adapté mi máquina a mis necesidades de desarrollo dentro de ese entorno. Todo esto hasta que fui profundizando en lo que, hasta el día de hoy, es de las cosas que más disfruto: administrar entornos Linux nativos y levantar arquitecturas más complejas.

Para poder exprimir el hardware sin dejar de lado la pasión de jugar, elegí **CachyOS**.

![CachyOS](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ8FbFBpXmyZSEzoi70LU7YZNgRmUZlQ5_15224UnOh5w&s=10)

## ¿Fue fácil?
**NO...** y sí.
La instalación en sí es bastante amigable y te permite elegir tu propio entorno de escritorio desde el principio. El verdadero problema llegó cuando mi primera elección gráfica demostró requerir un nivel de microgestión manual altísimo.

### Hyprland
![hyprland desktop](https://hypr.land/ricing_competitions/1/amadeus.webp)
Al ser un gestor de ventanas basado en el protocolo Wayland, es sin lugar a dudas el mejor lienzo para generar diseños osados, fluidos y hermosos. Todo es perfecto hasta que recuerdas que tienes una gráfica **Nvidia**.

Ahí es cuando empiezas a sufrir problemas de compatibilidad con los drivers privativos: glitches con juegos de Steam que requieren el overlay, bugs al manejar el foco entre múltiples ventanas, y dolores de cabeza al levantar cargas pesadas de procesamiento con CUDA.

Es entonces cuando te das cuenta de que tu mejor opción, sacrificando la estética *anime* hiper minimalista a cambio de estabilidad, es...

### KDE Plasma
![KDE plasma desktop](https://kde.org/content/plasma-desktop/theme.png)
En el tiempo que llevo usando Linux a full, CachyOS junto con KDE Plasma han sido mis mejores aliados. Es un entorno robusto que no me da problemas de drivers, permitiéndome programar tranquilo, gestionar mis proyectos y seguir jugando sin tener que pelear con la interfaz de mi propio sistema.
No es que no sepa usar la terminal ni vim. De hecho lo hago en todo momento, es sólo que la experiencia de tener que toquetear tanto para poder echarme unas partidas al Project Zomboid puso a prueba mi paciencia y el Zomboid me ganó.

## En conclusión
Para quienes busquen una distribución optimizada, donde se pueda programar y jugar con gran sencillez sin tener que configurar cada ventana desde un archivo de texto, la combinación ganadora absoluta es **CachyOS + KDE Plasma**.