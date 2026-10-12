export default function WordArt() {
  return (
    <svg
      className="home-art"
      xmlns="http://www.w3.org/2000/svg"
      width="440"
      height="430"
      viewBox="0 0 440 430"
      role="img"
      aria-label="Ocean, coral, and water word cards"
    >
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#78634b" floodOpacity=".09" />
        </filter>
        <pattern id="paper" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r=".4" fill="#b5a991" opacity=".16" />
        </pattern>
      </defs>
      <circle cx="233" cy="218" r="167" fill="#f0eadb" />
      <g transform="translate(62 31) rotate(-9 138 152)" filter="url(#shadow)">
        <rect width="244" height="286" rx="16" fill="#fffdf6" stroke="#e1d6c4" />
        <rect width="244" height="286" rx="16" fill="url(#paper)" />
        <rect x="15" y="15" width="214" height="203" rx="9" fill="#d7e6e6" />
        <circle cx="181" cy="57" r="20" fill="#fff9e7" />
        <path d="M15 116Q42 96 68 117T122 117T175 116T229 117V218H15Z" fill="#9cc6c4" />
        <path d="M15 145Q42 125 68 146T122 146T175 145T229 146V218H15Z" fill="#72abaa" />
        <path d="M15 178Q42 158 68 179T122 179T175 178T229 179V218H15Z" fill="#4d898b" />
        <path
          d="M46 153q10-7 19 0q-9 7-19 0l-6 4v-8zM150 183q10-7 19 0q-9 7-19 0l-6 4v-8z"
          fill="#fcf4dc"
          opacity=".85"
        />
        <text x="122" y="255" fontFamily="inherit" fontSize="27" fill="#365d61" textAnchor="middle">
          ocean
        </text>
      </g>
      <g transform="translate(237 187) rotate(10 87 100)" filter="url(#shadow)">
        <rect width="163" height="207" rx="13" fill="#fffdf6" stroke="#e1d6c4" />
        <rect x="12" y="12" width="139" height="141" rx="8" fill="#f0d7c8" />
        <g
          fill="none"
          stroke="#b66647"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M79 129V61M79 104L49 83V48M79 92L111 68V41M79 76L60 59V35M49 68L31 56V43M111 58L131 48V33M79 62L98 44V27" />
        </g>
        <text x="81" y="182" fontFamily="inherit" fontSize="23" fill="#9c5539" textAnchor="middle">
          coral
        </text>
      </g>
      <g transform="translate(20 307) rotate(-5 72 45)" filter="url(#shadow)">
        <rect width="154" height="80" rx="12" fill="#e1e7d7" stroke="#c9d3bc" />
        <path
          d="M31 24q-11 14-11 20a11 11 0 0 0 22 0q0-6-11-20Z"
          fill="none"
          stroke="#768864"
          strokeWidth="2.5"
        />
        <text x="94" y="49" fontFamily="inherit" fontSize="23" fill="#5a704e" textAnchor="middle">
          water
        </text>
      </g>
    </svg>
  );
}
