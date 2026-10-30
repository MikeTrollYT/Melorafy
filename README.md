<p align="center">
  <img src="./public/img/logo.svg" alt="Melorafy" width="150">
</p>

<h1 align="center">Melorafy</h1>

<p align="center">
  Un reproductor minimalista para mostrar qué estás escuchando ahora mismo.
</p>

**Demo:** [melorafy.vercel.app](https://melorafy.vercel.app)

## Qué hace

- Muestra la canción que suena en este momento (título, artista y carátula).
- Se actualiza solo, sin recargar la página.
- Funciona con tus scrobbles de Last.fm, así que Spotify solo tiene que estar conectado a tu cuenta de Last.fm.

## Tecnologías

- [Next.js](https://nextjs.org/)
- [Last.fm API](https://www.last.fm/api)
- [Vercel](https://vercel.com/) para el despliegue

## Requisitos

- Node.js 18 o superior
- Una cuenta de Last.fm con Spotify conectado (Ajustes > Aplicaciones)
- Una API key de Last.fm: [crear una aquí](https://www.last.fm/api/account/create)

## Instalación en local

1. Clona el repositorio:

   ```bash
   git clone https://github.com/miketrollyt/melorafy.git
   cd melorafy
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Copia el archivo de ejemplo de variables de entorno y rellénalo:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   LASTFM_API_KEY=tu_api_key
   LASTFM_USER=tu_usuario_de_lastfm
   ```

4. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000).

## Scripts disponibles

| Comando         | Qué hace                                  |
| --------------- | ----------------------------------------- |
| `npm run dev`   | Servidor de desarrollo en localhost:3000  |
| `npm run build` | Genera la versión de producción           |
| `npm run start` | Arranca la versión de producción          |
| `npm run lint`  | Revisa el código con ESLint               |

## Variables de entorno

| Variable         | Descripción                        |
| ---------------- | ---------------------------------- |
| `LASTFM_API_KEY` | Tu API key de Last.fm              |
| `LASTFM_USER`    | Tu nombre de usuario en Last.fm    |

## Despliegue en Vercel

1. Sube el proyecto a GitHub.
2. Impórtalo en [vercel.com/new](https://vercel.com/new).
3. En **Settings > Environment Variables** añade `LASTFM_API_KEY` y `LASTFM_USER`.
4. Despliega. Cada `git push` a la rama principal se desplegará automáticamente.

## Licencia

MIT