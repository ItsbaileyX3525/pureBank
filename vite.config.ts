import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
    plugins: [tailwindcss()],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                shop: resolve(__dirname, 'shop.html'),
                orders: resolve(__dirname, 'orders.html'),
                account: resolve(__dirname, 'account.html'),
                signup: resolve(__dirname, 'signup.html'),
                login: resolve(__dirname, 'login.html'),
                admin: resolve(__dirname, 'admin.html'),
            },
        },
    },
})