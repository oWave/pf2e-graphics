/* eslint-env node */
import fs from 'node:fs'
import { type Connect, defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { sveltePreprocess } from 'svelte-preprocess'
import checker from 'vite-plugin-checker'
import tsconfigPaths from 'vite-tsconfig-paths'
import resolve from '@rollup/plugin-node-resolve' // This resolves NPM modules from node_modules.
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import nesting from 'tailwindcss/nesting'
// @ts-expect-error - not typed, but the entire thing is tiny
import minify from 'postcss-minify'
import moduleJSON from './module.json' with { type: 'json' }

const packagePath = `modules/${moduleJSON.id}`
// const { esmodules, styles } = moduleJSON

const skippedFiles = [
	`${moduleJSON.id}.css`,
].map(f => `dist/${f}`).join('|')

export default defineConfig(({ command: _buildOrServe }) => ({
	root: 'src',
	base: `/${packagePath}/dist`,
	cacheDir: '../.vite-cache',
	publicDir: '../assets',

	clearScreen: true,

	esbuild: {
		target: ['es2022'],
	},

	css: {
		postcss: {
			inject: false,
			sourceMap: true,
			plugins: [nesting, tailwindcss, autoprefixer, minify],
		},
	},

	resolve: { conditions: ['import', 'browser'] },

	server: {
		open: '/join',
		port: 30001,
		proxy: {
			// Serves static files from main Foundry server.
			[`^(/${packagePath}/(assets|lang|packs|${skippedFiles}))`]: 'http://localhost:30000',

			// All other paths besides package ID path are served from main Foundry server.
			[`^(?!/${packagePath}/)`]: 'http://localhost:30000',

			// Enable socket.io from main Foundry server.
			'/socket.io': { target: 'ws://localhost:30000', ws: true },
		},
	},

	build: {
		copyPublicDir: false,
		outDir: '../dist',
		emptyOutDir: true,
		sourcemap: true,
		minify: 'terser' as const,
		terserOptions: {
			mangle: {
				toplevel: true,
				keep_classnames: true,
				keep_fnames: true,
			},
			module: true,
		},
		lib: {
			entry: 'index.js',
			formats: ['es'],
			fileName: moduleJSON.id,
		},
		rollupOptions: {
			output: {
				assetFileNames: assetInfo => (assetInfo.name === 'style.css') ? `${moduleJSON.id}.css` : (assetInfo.name as string),
			},
		},
	},

	optimizeDeps: {
		esbuildOptions: {
			target: 'es2022',
		},
	},

	plugins: [
		checker({ typescript: true }),
		tsconfigPaths(),
		svelte({
			compilerOptions: {
				cssHash: ({ hash, css }) => `svelte-pf2e-g-${hash(css)}`,
			},
			preprocess: sveltePreprocess(),
		}),
		resolve({
			browser: true,
			dedupe: ['svelte'],
		}),
		{
			name: 'change-names',
			configureServer(server) {
				server.middlewares.use((req: Connect.IncomingMessage & { url?: string }, res, next) => {
					if (req.originalUrl === `/${packagePath}/dist/${moduleJSON.id}.js`) {
						req.url = `/${packagePath}/dist/index.js`
					}
					next()
				})
			},
		},
		{
			name: 'update-animations-json',
			handleHotUpdate({ file, server, read: _read }) {
				if (file.endsWith('animations.json')) {
					server.ws.send({
						event: 'updateAnims',
						type: 'custom',
						data: fs.readFileSync(file, 'utf-8'),
					})
					return []
				}
			},
		},
	],
}
),
)
