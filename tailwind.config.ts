import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Drawn from Konjo Foods' real product line — Datta Red, Datta
        // Green, and the ginger/amber of Hot & Sweet Ketchup — set against
        // a deep roasted-charcoal base so the glassmorphism cards have
        // something rich to float on. Swap these for exact brand hex codes
        // if/when Konjo shares a formal style guide (see README).
        konjo: {
          charcoal: '#201512',
          'charcoal-2': '#2A1B15',
          cream: '#F7ECDD',
          red: '#E4402A',
          'red-deep': '#A82A1B',
          green: '#5B8C3E',
          amber: '#EDA83B',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
};

export default config;
