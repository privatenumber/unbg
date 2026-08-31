import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
	plugins: [
		vue(),
		Icons({ compiler: 'vue3' }),
	],
	test: {
		environment: 'jsdom',
	},
});
