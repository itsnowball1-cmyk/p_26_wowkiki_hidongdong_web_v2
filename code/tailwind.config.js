/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#005744',
          green: '#7CBE26',
          yellow: '#FDD100',
          danger: '#F64C4C'
        },
        ink: {
          900: '#252525',
          850: '#343A40',
          800: '#2F2E2E',
          700: '#484848',
          600: '#585858',
          500: '#777777',
          400: '#919191',
          300: '#B5B5B5',
          200: '#A1A1A1'
        },
        line: {
          DEFAULT: '#DEDEDE',
          soft: '#EAEAEA',
          input: '#ADB5BD',
          dark: '#575757',
          dash: '#CECECE',
          card: '#C3C3C3',
          cell: '#C8C8C8'
        },
        delta: {
          up: '#5D8EE9',
          down: '#FD5F5F'
        },
        surface: {
          DEFAULT: '#FAFAFA',
          card: '#FFFFFF',
          active: '#F1F1F1',
          chip: '#EAEAEA'
        },
        chart: {
          red: '#FF6767',
          green: '#5EBC93',
          orange: '#FF9873'
        },
        accent: {
          highlight: '#FD8D65'
        },
        tag: {
          yellow: '#FFF0BD',
          green: '#D8EFB9',
          blue: '#C7E2F5',
          pink: '#FDD1D1'
        },
        child: {
          1: '#FFE672',
          2: '#00E8FD',
          3: '#FF9E9E',
          4: '#A3B0FE',
          5: '#B2DB7B'
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
        logo: ['"Tmoney RoundWind"', 'Pretendard', 'sans-serif']
      },
      boxShadow: {
        sidebar: '0 0 5px 0 rgba(0,0,0,0.25)',
        chip: '0 4px 16px 0 rgba(0,0,0,0.1)'
      }
    }
  },
  plugins: []
}
