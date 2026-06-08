import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

export function IconDashboard(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M7.85714 1H2.14286C1.51167 1 1 1.44772 1 2V9C1 9.55229 1.51167 10 2.14286 10H7.85714C8.48833 10 9 9.55229 9 9V2C9 1.44772 8.48833 1 7.85714 1Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M18 1H13C12.4477 1 12 1.53726 12 2.2V5.8C12 6.46274 12.4477 7 13 7H18C18.5523 7 19 6.46274 19 5.8V2.2C19 1.53726 18.5523 1 18 1Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M18 10H13C12.4477 10 12 10.4477 12 11V18C12 18.5523 12.4477 19 13 19H18C18.5523 19 19 18.5523 19 18V11C19 10.4477 18.5523 10 18 10Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M7.75 13.375H2.125C1.50368 13.375 1 13.8787 1 14.5V17.875C1 18.4963 1.50368 19 2.125 19H7.75C8.37132 19 8.875 18.4963 8.875 17.875V14.5C8.875 13.8787 8.37132 13.375 7.75 13.375Z" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// 회원 관리 group header (person + gear)
export function IconMembers(p: P) {
  return (
    <svg viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M7.75563 8.31864C9.7671 8.31864 11.3977 6.68802 11.3977 4.67654C11.3977 2.66507 9.7671 1.03444 7.75563 1.03444C5.74415 1.03444 4.11353 2.66507 4.11353 4.67654C4.11353 6.68802 5.74415 8.31864 7.75563 8.31864Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M1.03444 16.443C1.03444 12.7295 4.04484 9.71912 7.75832 9.71912C9.99962 9.71912 11.9888 10.8117 13.2215 12.4927" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16.4406 10.2794L17.3932 10.5596L18.2897 10.1674L19.3543 11.232L18.9621 12.1285L19.2423 13.0811L20.2228 13.5013V14.9021L19.2423 15.3223L18.9621 16.2749L19.3543 17.1714L18.2897 18.236L17.3932 17.8438L16.4406 18.124L16.0204 19.1045H14.6196L14.1993 18.124L13.2468 17.8438L12.3503 18.236L11.2857 17.1714L11.6779 16.2749L11.3977 15.3223L10.4172 14.9021V13.5013L11.3977 13.0811L11.6779 12.1285L11.2857 11.232L12.3503 10.1674L13.2468 10.5596L14.1993 10.2794L14.6196 9.29887H16.0204L16.4406 10.2794Z" fill="white" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.32 16.1628C16.4031 16.1628 17.2811 15.2848 17.2811 14.2017C17.2811 13.1186 16.4031 12.2406 15.32 12.2406C14.2369 12.2406 13.3589 13.1186 13.3589 14.2017C13.3589 15.2848 14.2369 16.1628 15.32 16.1628Z" fill="white" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconChild(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M6.81901 10.3333C9.39633 10.3333 11.4857 8.24399 11.4857 5.66666C11.4857 3.08934 9.39633 1 6.81901 1C4.24168 1 2.15234 3.08934 2.15234 5.66666C2.15234 8.24399 4.24168 10.3333 6.81901 10.3333Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 14.5278C9.04464 13.5777 7.78304 13 6.4 13C3.41767 13 1 15.6863 1 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14.2266 13.1772C13.9897 12.5842 13.161 11.5599 11.5617 12.2068C10.134 12.7842 9.77834 14.6668 10.8512 16.0888C11.4329 16.8598 13.2787 18.353 14.226 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14.2266 13.1772C14.4634 12.5842 15.2921 11.5599 16.8915 12.2068C18.3192 12.7842 18.6748 14.6668 17.6019 16.0888C17.0203 16.8598 15.1744 18.353 14.2271 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconInfo(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <circle cx="10" cy="6" r="2" fill="currentColor"/>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 10V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconDownload(p: P) {
  return (
    <svg viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M2 9L7.29289 14.2929C7.68342 14.6834 8.31658 14.6834 8.70711 14.2929L14 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 1L8 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M1 19H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconTrash(p: P) {
  return (
    <svg viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M3 6C3 5.44772 3.44772 5 4 5H14C14.5523 5 15 5.44772 15 6V17C15 18.1046 14.1046 19 13 19H5C3.89543 19 3 18.1046 3 17V6Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M1 5H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M5 4.42857V2C5 1.44771 5.44772 1 6 1H12C12.5523 1 13 1.44772 13 2V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 9.5V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 9.5V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 9.5V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconPlus(p: P) {
  return (
    <svg viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M9.5 2.5V16.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
      <path d="M16.5 9.5L2.5 9.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconCalendar(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M17.3125 3H2.6875C1.75552 3 1 3.74105 1 4.65517V17.3448C1 18.259 1.75552 19 2.6875 19H17.3125C18.2445 19 19 18.259 19 17.3448V4.65517C19 3.74105 18.2445 3 17.3125 3Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M1 7H19.4286" stroke="currentColor" strokeWidth="2"/>
      <path d="M5.60547 1V4.45536" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M14.8203 1V4.45536" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="5" y="10" width="2" height="2" rx="0.575893" fill="currentColor"/>
      <rect x="5" y="14" width="2" height="2" rx="0.575893" fill="currentColor"/>
      <rect x="9" y="10" width="2" height="2" rx="0.575893" fill="currentColor"/>
      <rect x="9" y="14" width="2" height="2" rx="0.575893" fill="currentColor"/>
      <rect x="13" y="10" width="2" height="2" rx="0.575893" fill="currentColor"/>
      <rect x="13" y="14" width="2" height="2" rx="0.575893" fill="currentColor"/>
    </svg>
  )
}

export function IconMyPage(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 9C11.1046 9 12 8.10457 12 7C12 5.89543 11.1046 5 10 5C8.89543 5 8 5.89543 8 7C8 8.10457 8.89543 9 10 9Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 15C6.25946 13.3029 7.94595 12 10 12C12.0541 12 13.7405 13.3029 14 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// 고객센터 group header (speech bubble with 3 dots)
export function IconInquiry(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M10.2602 1C16.2002 1 19 4.9483 19 9.52641C19 14.1046 14.8446 17.8158 9.71875 17.8158C8.50937 17.8158 7.35625 17.6086 6.30156 17.2355L2.40625 19L3.5875 15.3882C2.0125 13.8191 1 11.806 1 9.52641C1 4.94833 3.78016 1 10.2602 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="6" cy="9" r="1" fill="currentColor"/>
      <circle cx="10" cy="9" r="1" fill="currentColor"/>
      <circle cx="14" cy="9" r="1" fill="currentColor"/>
    </svg>
  )
}

// 공지사항 (megaphone)
export function IconNotice(p: P) {
  return (
    <svg viewBox="0 0 17 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M1 4.5L13 1V13L1 9.5V4.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M13 4C14.7143 4.375 16 5.5 16 7C16 8.5 14.7143 9.625 13 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 11V16.8993C3 18.0595 3.67159 19 4.5 19C5.32841 19 6 18.0595 6 16.8993V11.8759" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 4V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconFAQ(p: P) {
  return (
    <svg viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M17.6208 1.00561H3.37921C2.06831 1.00561 1.00561 2.16334 1.00561 3.59147V12.211C1.00561 13.6391 2.06831 14.7969 3.37921 14.7969H4.96161V17.971C4.96161 18.4074 5.47932 18.6366 5.80239 18.3433L9.7088 14.7969H17.6208C18.9317 14.7969 19.9944 13.6391 19.9944 12.211V3.59147C19.9944 2.16334 18.9317 1.00561 17.6208 1.00561Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M5.94646 8.44447V10.2277C5.94646 10.3421 5.90561 10.4279 5.82391 10.4851C5.74629 10.5423 5.65641 10.5729 5.55428 10.577C5.43989 10.5811 5.33776 10.5525 5.24788 10.4912C5.16209 10.434 5.11919 10.3462 5.11919 10.2277V6.3916C5.11919 6.15874 5.17843 5.99329 5.2969 5.89524C5.41946 5.79719 5.59309 5.74817 5.81778 5.74817H7.84C7.95847 5.74817 8.04835 5.78902 8.10963 5.87073C8.17091 5.95244 8.20155 6.04027 8.20155 6.13423C8.20155 6.22411 8.17091 6.30581 8.10963 6.37935C8.04835 6.45288 7.95847 6.48965 7.84 6.48965H6.14869C6.07924 6.48965 6.02817 6.50395 5.99549 6.53255C5.96281 6.56114 5.94646 6.61425 5.94646 6.69187V7.7275H7.68067C7.78281 7.7275 7.86043 7.76426 7.91354 7.8378C7.97073 7.90725 7.99933 7.98896 7.99933 8.08292C8.00341 8.17279 7.97686 8.25654 7.91966 8.33416C7.86655 8.4077 7.78689 8.44447 7.68067 8.44447H5.94646ZM9.6487 6.03006C9.69364 5.91975 9.76105 5.836 9.85092 5.77881C9.94489 5.72162 10.0429 5.69302 10.1451 5.69302C10.2472 5.69302 10.3432 5.72366 10.4331 5.78494C10.527 5.84213 10.5965 5.92997 10.6414 6.04844L12.2041 10.0745C12.2367 10.1521 12.2408 10.2216 12.2163 10.2829C12.1959 10.3482 12.1571 10.4013 12.0999 10.4422C12.0468 10.4871 11.9814 10.5198 11.9038 10.5402C11.8303 10.5607 11.7567 10.5668 11.6832 10.5586C11.6096 10.5504 11.5402 10.5259 11.4748 10.4851C11.4136 10.4442 11.3686 10.3829 11.34 10.3012L10.9968 9.31464H9.24426L8.90109 10.3012C8.85615 10.4279 8.78058 10.5096 8.67436 10.5464C8.56814 10.5872 8.46397 10.5913 8.36183 10.5586C8.2597 10.53 8.17799 10.4708 8.11672 10.3809C8.05544 10.2951 8.04727 10.1909 8.0922 10.0684L9.6487 6.03006ZM9.4955 8.58541H10.7456L10.1144 6.79605L9.4955 8.58541ZM14.5659 10.5647C14.2841 10.5647 14.0144 10.5157 13.7571 10.4177C13.5038 10.3237 13.2811 10.1766 13.0891 9.97645C12.8971 9.77627 12.7439 9.52299 12.6295 9.21659C12.5192 8.90611 12.4641 8.53639 12.4641 8.10743C12.4641 7.69481 12.5192 7.33735 12.6295 7.03504C12.7439 6.72864 12.8971 6.4774 13.0891 6.2813C13.2811 6.08112 13.5038 5.93201 13.7571 5.83396C14.0103 5.73591 14.28 5.68689 14.5659 5.68689C14.8519 5.68689 15.1215 5.73183 15.3748 5.82171C15.6322 5.91158 15.8569 6.05457 16.0489 6.25066C16.245 6.44676 16.4002 6.698 16.5146 7.0044C16.629 7.3108 16.6862 7.67847 16.6862 8.10743C16.6862 8.63035 16.6004 9.06339 16.4288 9.40655C16.2573 9.74972 16.0285 10.0112 15.7425 10.1909L16.5146 10.5709C16.629 10.6281 16.6923 10.7118 16.7046 10.8221C16.7209 10.9324 16.7005 11.0345 16.6433 11.1285C16.5902 11.2225 16.5105 11.2899 16.4043 11.3307C16.2981 11.3757 16.1817 11.3593 16.055 11.2817L14.8233 10.5341C14.7866 10.5464 14.7457 10.5545 14.7008 10.5586C14.6558 10.5627 14.6109 10.5647 14.5659 10.5647ZM14.5598 9.82325C14.7396 9.82325 14.905 9.79262 15.0562 9.73134C15.2114 9.66597 15.3442 9.56588 15.4545 9.43107C15.5648 9.29217 15.6506 9.11446 15.7119 8.89793C15.7772 8.67733 15.8099 8.41383 15.8099 8.10743C15.8099 7.8092 15.7772 7.55591 15.7119 7.34756C15.6506 7.13513 15.5628 6.9615 15.4484 6.82669C15.3381 6.69187 15.2073 6.59383 15.0562 6.53255C14.905 6.47127 14.7416 6.44063 14.5659 6.44063C14.3862 6.44063 14.2207 6.47127 14.0696 6.53255C13.9184 6.59383 13.7877 6.69187 13.6774 6.82669C13.5671 6.9615 13.4793 7.13513 13.4139 7.34756C13.3526 7.55591 13.322 7.8092 13.322 8.10743C13.322 8.41791 13.3526 8.68141 13.4139 8.89793C13.4752 9.11446 13.561 9.29217 13.6713 9.43107C13.7816 9.56588 13.9123 9.66597 14.0635 9.73134C14.2146 9.79262 14.3801 9.82325 14.5598 9.82325Z" fill="currentColor"/>
    </svg>
  )
}

// 1:1 문의사항 (two overlapping chat bubbles)
export function IconChat(p: P) {
  return (
    <svg viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M8.64758 1H19.2362C20.2108 1 21.0009 1.79011 21.0009 2.76476V8.64731C21.0009 9.62196 20.2108 10.4121 19.2362 10.4121H18.0597V13.3533L14.5301 10.4121H8.64758C7.67293 10.4121 6.88281 9.62196 6.88281 8.64731V2.76476C6.88281 1.79011 7.67293 1 8.64758 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M2.76476 7.4707H9.82382C10.7985 7.4707 11.5886 8.26082 11.5886 9.23547V13.9415C11.5886 14.9162 10.7985 15.7063 9.82382 15.7063H7.4708L4.52953 18.6475V15.7063H2.76476C1.79011 15.7063 1 14.9162 1 13.9415V9.23547C1 8.26082 1.79011 7.4707 2.76476 7.4707Z" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  )
}

// 통계/로그 (L-axis bar chart with trend line)
export function IconStats(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M1.0345 1.0345V18.9655H18.9655" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.86351 18.3254L5.86351 14.483" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M10.6683 18.325L10.6683 12.5615" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M15.469 18.3256L15.469 9.68025" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4.90175 8.276L8.88458 6.39509L12.2984 7.80577L16.2813 3.1035" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// 보안 (shield with padlock)
export function IconSecurity(p: P) {
  return (
    <svg viewBox="0 0 18 21" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M8.99918 1L16.9984 3.79383V9.94026C16.9984 14.9692 13.3064 18.3217 8.99918 19.998C4.69193 18.3217 1 14.9692 1 9.94026V3.79383L8.99918 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M7 7.49902V6.21331C7 5.26653 7.89542 4.49902 9 4.49902C10.1046 4.49902 11 5.26653 11 6.21331V7.49902" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M11.9091 7.87695H6.09091C5.48842 7.87695 5 8.32467 5 8.87695V12.877C5 13.4292 5.48842 13.877 6.09091 13.877H11.9091C12.5116 13.877 13 13.4292 13 12.877V8.87695C13 8.32467 12.5116 7.87695 11.9091 7.87695Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M8.99624 11.3704C9.5184 11.3704 9.94169 10.9471 9.94169 10.4249C9.94169 9.90279 9.5184 9.47949 8.99624 9.47949C8.47408 9.47949 8.05078 9.90279 8.05078 10.4249C8.05078 10.9471 8.47408 11.3704 8.99624 11.3704Z" fill="currentColor"/>
    </svg>
  )
}

// 콘텐츠 (landscape/image icon)
export function IconContent(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M17.3125 1H2.6875C1.75552 1 1 1.86345 1 2.92857V17.0714C1 18.1365 1.75552 19 2.6875 19H17.3125C18.2445 19 19 18.1365 19 17.0714V2.92857C19 1.86345 18.2445 1 17.3125 1Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 15L6.79167 11.1765L9.41667 13.8235L12.625 10L17 14.4118" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.5 7C15.3284 7 16 6.32843 16 5.5C16 4.67157 15.3284 4 14.5 4C13.6716 4 13 4.67157 13 5.5C13 6.32843 13.6716 7 14.5 7Z" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// 버전관리 (git branch/tree)
export function IconVersion(p: P) {
  return (
    <svg viewBox="0 0 17 21" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M3.04805 5.06602V15.9357" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M3.04805 10.5005C3.04805 12.985 5.53253 13.6061 9.25926 13.6061C11.7437 13.6061 13.6071 12.985 13.6071 10.5005" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M3.04671 5.06535C4.16158 5.06535 5.06535 4.16158 5.06535 3.04671C5.06535 1.93184 4.16158 1.02806 3.04671 1.02806C1.93184 1.02806 1.02806 1.93184 1.02806 3.04671C1.02806 4.16158 1.93184 5.06535 3.04671 5.06535Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M3.04671 19.9723C4.16158 19.9723 5.06535 19.0685 5.06535 17.9536C5.06535 16.8388 4.16158 15.935 3.04671 15.935C1.93184 15.935 1.02806 16.8388 1.02806 17.9536C1.02806 19.0685 1.93184 19.9723 3.04671 19.9723Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M13.6085 5.06535C14.7233 5.06535 15.6271 4.16158 15.6271 3.04671C15.6271 1.93184 14.7233 1.02806 13.6085 1.02806C12.4936 1.02806 11.5898 1.93184 11.5898 3.04671C11.5898 4.16158 12.4936 5.06535 13.6085 5.06535Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M13.6058 5.06602V8.48219" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// 기관
export function IconBuilding(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M2 19V8L10 2L18 8V19" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M7 19V13H13V19" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <rect x="6" y="7" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="7" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

// 기관 관리자 / 일반 사용자 (generic person outline)
export function IconPerson(p: P) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M10 9C12.2091 9 14 7.20914 14 5C14 2.79086 12.2091 1 10 1C7.79086 1 6 2.79086 6 5C6 7.20914 7.79086 9 10 9Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M2 19C2 15.134 5.58172 12 10 12C14.4183 12 18 15.134 18 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// 앱 푸시 (bell)
export function IconPush(p: P) {
  return (
    <svg viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M9 3.10449C12.3333 3.10449 15 5.39021 15 8.24735V12.2473L17 15.1045H1L3 12.2473V8.24735C3 5.39021 5.66667 3.10449 9 3.10449Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 2.66667V1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 16.1045C6 17.2091 7.34315 18.1045 9 18.1045C10.6568 18.1045 12 17.2091 12 16.1045" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// 기관관리자 (person with checkmark badge)
export function IconIAdmin(p: P) {
  return (
    <svg viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M8.99938 8.5222C11.0766 8.5222 12.7605 6.8383 12.7605 4.7611C12.7605 2.6839 11.0766 1 8.99938 1C6.92218 1 5.23828 2.6839 5.23828 4.7611C5.23828 6.8383 6.92218 8.5222 8.99938 8.5222Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 19V14.9476C1 12.2147 4.54717 10 8.92453 10H9.07547C13.4528 10 17 12.2147 17 14.9476V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="14.5" cy="15.5" r="4.5" fill="white" stroke="currentColor" strokeWidth="2"/>
      <path d="M13 15.5L13.9811 16.8081C14.2119 17.1158 14.6892 17.0586 14.8407 16.7051L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

// 의사 (person with stethoscope)
export function IconDoctor(p: P) {
  return (
    <svg viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M8.99938 8.5222C11.0766 8.5222 12.7605 6.8383 12.7605 4.7611C12.7605 2.6839 11.0766 1 8.99938 1C6.92218 1 5.23828 2.6839 5.23828 4.7611C5.23828 6.8383 6.92218 8.5222 8.99938 8.5222Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 19V14.9476C1 12.2147 4.54717 10 8.92453 10H9.07547C13.4528 10 17 12.2147 17 14.9476V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 14L9 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.69531 10C5.69531 11.7089 7.18678 13.1126 9.00249 13.1126C10.8182 13.1126 12.3097 11.7089 12.3097 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.00195 16C10.1271 16 11.0398 16.912 11.04 18.0371C11.04 19.1624 10.1273 20.0752 9.00195 20.0752C7.87685 20.075 6.96484 19.1623 6.96484 18.0371C6.96508 16.9121 7.87699 16.0002 9.00195 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// 치료사 (person with therapist marker)
export function IconTherapist(p: P) {
  return (
    <svg viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M8.99938 8.5222C11.0766 8.5222 12.7605 6.8383 12.7605 4.7611C12.7605 2.6839 11.0766 1 8.99938 1C6.92218 1 5.23828 2.6839 5.23828 4.7611C5.23828 6.8383 6.92218 8.5222 8.99938 8.5222Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 19V14.9476C1 12.2147 4.54717 10 8.92453 10H9.07547C13.4528 10 17 12.2147 17 14.9476V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 11C6.16667 12.3333 7.8 15 9 15C10.2 15 11.8333 12.3333 12.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M9 15V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// 아동별 커스텀 (star)
export function IconCustom(p: P) {
  return (
    <svg viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...p}>
      <path d="M14.4161 1.07926C14.7884 0.881878 15.2254 1.19706 15.1556 1.61261L14.6996 4.32842C14.6719 4.49343 14.7271 4.66152 14.8473 4.77789L16.826 6.6932C17.1288 6.98627 16.9641 7.49928 16.5473 7.56133L13.8235 7.96684C13.658 7.99148 13.5152 8.09598 13.4417 8.24629L12.2316 10.72C12.0464 11.0985 11.5076 11.1004 11.3198 10.7232L10.0924 8.25798C10.0178 8.1082 9.87434 8.0047 9.70867 7.98121L6.98209 7.59474C6.5649 7.5356 6.3966 7.02375 6.69731 6.72858L8.66257 4.79949C8.78198 4.68228 8.83607 4.51381 8.80721 4.349L8.33221 1.63644C8.25953 1.22138 8.69433 0.903159 9.06798 1.09793L11.5099 2.37089C11.6583 2.44823 11.8353 2.44762 11.9831 2.36924L14.4161 1.07926Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M7.97087 10.5794C5.07708 13.8584 3.90913 15.2711 1.01534 18.5501" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
