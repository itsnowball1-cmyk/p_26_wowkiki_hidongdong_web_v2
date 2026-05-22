/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#005744',
          danger: '#F64C4C'
        },
        ink: {
          900: '#252525',
          850: '#343A40',
          700: '#484848',
          600: '#585858',
          500: '#777777',
          400: '#919191',
          300: '#B5B5B5'
        },
        line: {
          DEFAULT: '#DEDEDE',
          soft: '#EAEAEA'
        },
        surface: {
          DEFAULT: '#FAFAFA',
          chip: '#EAEAEA',
          active: '#F1F1F1'
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
