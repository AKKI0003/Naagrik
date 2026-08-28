/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glowCyan: '0 0 18px rgba(77, 217, 232, 0.35)',
        glowGold: '0 0 18px rgba(217, 175, 82, 0.35)',
        panel: '0 8px 30px rgba(0, 0, 0, 0.45)',
      },
      colors: {
        bg: '#0A1420',
        panel: '#0D1B2A',
        panelAlt: '#0B1926',
        cyan: '#4DD9E8',
        cyanDark: '#2E93A6',
        gold: '#D9AF52',
        muted: '#8B96AC',
        mutedDark: '#5C6884',
        danger: '#E85D5D',
        catRoad: '#E8A23D',
        catWaste: '#6FCF97',
        catUtility: '#F2C94C',
        catWater: '#56CCF2',
        catOther: '#BB6BD9',
      },
    },
  },
  plugins: [],
};
