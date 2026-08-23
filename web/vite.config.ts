import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
	plugins: [
		vue(),
		tailwindcss(),
		// Import icons on demand as Vue components, e.g. `~icons/lucide/check`.
		Icons({ compiler: 'vue3' }),
	],
});
