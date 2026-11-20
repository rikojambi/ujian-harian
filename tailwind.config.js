/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef3fa',
          100: '#dae4f2',
          200: '#b8cbe5',
          300: '#8aa9d1',
          400: '#5b82b8',
          500: '#3b659d',
          600: '#2b4d7f',
          700: '#223d66',
          800: '#1a2f50',
          900: '#0f2547',
          950: '#091732'
        },
        accent: {
          400: '#4d9dff',
          500: '#2563eb',
          600: '#1d4ed8'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,37,71,.06), 0 8px 24px rgba(15,37,71,.05)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
