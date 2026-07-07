
import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
        headline: ['var(--font-space-grotesk)', 'Space Grotesk', 'sans-serif'],
        code: ['var(--font-source-code-pro)', 'Source Code Pro', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        sidebar: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--foreground))',
          primary: 'hsl(var(--primary))',
          'primary-foreground': 'hsl(var(--primary-foreground))',
          accent: 'hsl(var(--accent))',
          'accent-foreground': 'hsl(var(--accent-foreground))',
          border: 'hsl(var(--border))',
          ring: 'hsl(var(--ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'glow': '0 0 22px -3px hsl(var(--primary) / 0.55)',
        'glow-lg': '0 0 48px -6px hsl(var(--primary) / 0.6)',
        'glow-secondary': '0 0 22px -3px hsl(var(--secondary) / 0.55)',
        'inner-top': 'inset 0 1px 0 0 rgba(255,255,255,0.07)',
        'card-3d': '0 18px 40px -20px rgba(0,0,0,0.8), 0 0 0 1px hsl(var(--border) / 0.6)',
      },
      backgroundImage: {
        'grid-fade': 'linear-gradient(to right, hsl(var(--primary) / 0.10) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--primary) / 0.10) 1px, transparent 1px)',
        'radial-fade': 'radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.18), transparent 60%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-fast': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'grid-pan': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 48px' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.85' },
        },
        'rotate-3d': {
          '0%': { transform: 'rotateX(-22deg) rotateY(0deg)' },
          '100%': { transform: 'rotateX(-22deg) rotateY(360deg)' },
        },
        'drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(4%, -6%, 0) scale(1.08)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.5)' },
          '70%': { boxShadow: '0 0 0 10px hsl(var(--primary) / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
        },
        'border-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-fast': 'pulse-fast 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 7s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'shimmer': 'shimmer 2.2s infinite',
        'grid-pan': 'grid-pan 3s linear infinite',
        'spin-slow': 'spin-slow 22s linear infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        'rotate-3d': 'rotate-3d 18s linear infinite',
        'drift': 'drift 16s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'border-flow': 'border-flow 6s ease infinite',
        'scanline': 'scanline 3.5s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
