# VillaMusic

Reproductor de música web hecho en San Juan de Pasto. La idea de fondo es simple: cada playlist es una **lista doblemente enlazada** escrita desde cero, y toda la interfaz está construida alrededor de eso. Se puede ver la cadena de nodos en pantalla mientras suena la música.

- App publicada: https://villa-music-iota.vercel.app
- Código: https://github.com/ManuelVillarreal-l/VillaMusic
- Autor: Manuel Villarreal

Funciona en computador y en celular, y se puede instalar como app.

## Qué se puede hacer

- Crear, renombrar, borrar y ordenar playlists.
- Buscar cualquier canción y reproducirla completa (YouTube), o música independiente (Audius), o vista previa de 30 s de éxitos comerciales (iTunes).
- Subir archivos de audio propios.
- Armar una playlist con IA a partir de una frase ("música para estudiar con lluvia").
- Compartir una playlist con un enlace.
- Ver la letra sincronizada de la canción que suena.
- Dejar una canción "para después" sin tocar el orden del resto.
- Instalarla en el computador o el celular.

## Cómo está organizada la pantalla

En computador hay tres columnas y una barra abajo.

**Columna izquierda (menú)**
- Logo y lista de playlists. Al hacer clic se abre esa playlist. El ícono de barras animadas marca la que está sonando.
- `+` crea una playlist nueva.
- **DJ con IA** abre el diálogo donde se escribe qué se quiere escuchar.
- **Subir mi música** abre el selector de archivos de audio.
- **Instalar app** aparece solo si el navegador permite instalarla.
- Los tres círculos de colores cambian el tema (Galeras, La Cocha, Carnaval).

**Columna central (la playlist)**
- Arriba: portada, nombre y duración total. Al hacer clic en el nombre se puede editar.
- **Reproducir / Pausar / Continuar**: controla la playlist completa.
- Aleatorio, **compartir** (copia un enlace) y **Ordenar** (por título, artista o duración, o invertir la lista).
- El bote de basura borra la playlist.
- **La cadena de tu playlist**: el diagrama de la lista enlazada. Cada caja es un nodo, con sus punteros `prev` y `next`, y las etiquetas `head` y `tail`. Un clic en un nodo reproduce esa canción. La flecha que sale del nodo actual se va llenando con el avance de la canción. Se puede plegar con la flecha de arriba a la derecha.
- Debajo, la tabla de canciones. Con el mouse encima de una fila aparecen dos botones: el de cola (**sonará después**) y el de quitar. Doble clic reproduce.

**Columna derecha (Descubrir)**
- Tres pestañas: **Catálogo** (16 canciones de ejemplo generadas en el navegador), **Todo el mundo** (búsqueda) y **Mi música** (lo que subiste).
- En "Todo el mundo" hay tres fuentes: YouTube completas, Independientes y Éxitos con vista previa de 30 s.
- Cada resultado tiene tres botones: reproducir, "sonará después" y `+` (agrega al final de la playlist abierta).
- Cuando suena una canción de YouTube, el video aparece en un panel propio arriba de esta columna.

**Barra inferior (reproductor)**
- Portada y título de lo que suena; el nombre de la playlist de origen es un enlace para volver a ella.
- El ícono de letras abre la letra sincronizada. Tocar una línea salta a esa parte de la canción.
- Controles: aleatorio, anterior, retroceder 10 s, play/pausa, adelantar 10 s, siguiente, repetir (apagado, toda la playlist, una canción).
- Barra de progreso, volumen y visualizador.

## Cómo agregar canciones y ordenarlas

Hay dos formas. Con el botón `+` de cada resultado, que la agrega al final. O arrastrando: se toma una canción de Descubrir y se suelta sobre cualquier fila. Si se suelta en la mitad de arriba queda antes, en la de abajo queda después, y una línea de color muestra dónde va a caer. No pregunta posición.

También se pueden reordenar las canciones arrastrando filas dentro de la playlist, y soltar una canción sobre otra playlist del menú para copiarla ahí. Soltar archivos de audio del computador sobre una fila los sube y los deja justo en esa posición; sobre la columna derecha, los sube a "Mi música".

En pantalla táctil el arrastre no funciona; ahí se usa el botón `+`.

## Atajos de teclado

| Tecla | Acción |
|---|---|
| Espacio | Play / pausa |
| ← / → | Retroceder / adelantar 10 s |
| Shift + ← / → | Canción anterior / siguiente |
| M | Silenciar |
| S | Aleatorio |
| R | Cambiar modo de repetición |
| Esc | Cierra letras o diálogos |

## En el celular

El menú de la izquierda pasa a ser una franja arriba, con los botones **DJ**, **Buscar** e **Instalar** y las playlists. **Buscar** abre Descubrir como un panel desde abajo. El botón "volver" del teléfono cierra el panel que esté abierto (Buscar, letras o DJ) en lugar de salir de la app. Si hay un video sonando, toda la página se desplaza y el reproductor queda fijo abajo.

Para instalarla: en Android, menú del navegador > Instalar aplicación. En iPhone, Compartir > Añadir a pantalla de inicio.

## La lista doblemente enlazada

Está en `src/lib/DoublyLinkedList.ts` y no usa arrays para la playlist. Cada nodo guarda su valor y referencias al anterior y al siguiente.

| Operación | Costo |
|---|---|
| Insertar antes o después de un nodo | O(1) |
| Quitar un nodo | O(1) |
| Mover un nodo a otra posición | O(1) |
| Siguiente / anterior al reproducir | O(1) |
| Invertir | O(n) |
| Ordenar | O(n log n) |

La cola "sonará después" es una de esas operaciones: sacar el nodo y volver a insertarlo justo después del que suena. También hay un método `checkIntegrity()` que recorre la lista en ambos sentidos y verifica que los punteros sean consistentes; las pruebas lo usan.

## Cómo está hecho

- React 19, TypeScript y Vite. Sin librerías de UI ni de estado: el estado vive en un contexto (`src/store.tsx`).
- Las 16 canciones del catálogo no son archivos: se sintetizan en el navegador con Web Audio (`src/lib/synth.ts`).
- `src/lib/engine.ts` envuelve el `<audio>` y el reproductor de YouTube detrás de una misma interfaz, para que el resto de la app no tenga que saber de cuál viene el sonido.
- Los datos (playlists, tema, volumen) se guardan en `localStorage`; los audios subidos, en IndexedDB. Todo queda en el navegador de cada persona, no hay base de datos ni cuentas.
- Las playlists compartidas viajan dentro del enlace: el contenido va comprimido y codificado en el `#share=...` de la URL. Los archivos subidos no se comparten.
- Las letras vienen de LRCLIB. Audius e iTunes se consultan directo desde el navegador; YouTube pasa por una función propia para no exponer la clave.
- Es una PWA: tiene `manifest.webmanifest` y un service worker (`public/sw.js`) que guarda la interfaz para abrir más rápido.

Estructura:

```
api/                  funciones del servidor (Vercel)
  youtube-search.js     proxy de búsqueda de YouTube
  dj.js                 DJ con IA
public/               logo, manifest y service worker
src/
  components/           pantallas y paneles
  lib/                  lista enlazada, reproductor, buscadores, letras, compartir
  store.tsx             estado global
  styles.css            estilos
```

## Correrlo en local

Requiere Node 22.6 o superior (las pruebas ejecutan TypeScript directo con `--experimental-strip-types`).

```
npm install
npm run dev
```

Se abre en `http://localhost:5173`. Con `npm run dev` no existen las funciones de `api/`, así que:

- El **DJ con IA** no está disponible (avisa en pantalla).
- La búsqueda de YouTube pide pegar una clave propia de YouTube Data API v3. El formulario aparece en el mismo panel.

Para probar todo junto, incluidas las funciones del servidor, se puede usar `npx vercel dev`.

Otros comandos:

```
npm run typecheck     revisa tipos
npm run build         genera la versión de producción en dist/
npm test              pruebas
```

Las pruebas cubren la lista enlazada (inserción, borrado, movimiento, inversión, orden, integridad), el sintetizador, el codificador de enlaces para compartir y el lector de letras.

## Publicación

Está desplegado en Vercel, conectado al repositorio: cada `git push` a `main` publica una versión nueva. Variables de entorno que usa el servidor (Settings > Environment Variables):

| Variable | Para qué |
|---|---|
| `YOUTUBE_API_KEY` | Búsqueda de YouTube (YouTube Data API v3) |
| `GEMINI_API_KEY` | DJ con IA (Google AI Studio, tiene plan gratis) |
| `GEMINI_MODEL` | Opcional. Fuerza un modelo de Gemini concreto |
| `ANTHROPIC_API_KEY` | Opcional. Si existe, el DJ usa Claude en lugar de Gemini |

Después de cambiar una variable hay que hacer Redeploy para que se aplique.

## Límites que conviene saber

- **Canciones completas:** vienen de YouTube, no de archivos propios, así que dependen de que el video exista y permita reproducirse embebido. Los éxitos comerciales por iTunes solo ofrecen 30 s por derechos de autor.
- **Cuota de YouTube:** la búsqueda gasta cuota diaria de la clave (unas 100 búsquedas al día). Las repetidas se guardan 24 horas. Si se acaba, la app ofrece usar una clave propia.
- **El video no se puede ocultar:** YouTube exige que el reproductor sea visible, por eso va en su propio panel.
- **DJ con IA:** cada persona puede pedir hasta 12 playlists por hora. Las canciones se resuelven en YouTube la primera vez que suenan, no al crear la playlist.
- **Datos por navegador:** las playlists no se sincronizan entre dispositivos. Para pasar una a otro aparato se usa el botón de compartir.
- **Arrastrar y soltar** no funciona con el dedo.
