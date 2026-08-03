import { PantryCategory, PantryItem } from '../models/pantry-item.model';

const CATEGORY_PALETTE: Record<
  PantryCategory,
  { readonly start: string; readonly end: string; readonly accent: string; readonly text: string }
> = {
  produce: { start: '#dff7e4', end: '#b7efc5', accent: '#2f9e44', text: '#1b4332' },
  dairy: { start: '#f7efe2', end: '#f2d8b3', accent: '#d97706', text: '#7c2d12' },
  meat: { start: '#fde2e4', end: '#f8c4c8', accent: '#dc2626', text: '#7f1d1d' },
  frozen: { start: '#dbeafe', end: '#bfdbfe', accent: '#2563eb', text: '#1e3a8a' },
  spices: { start: '#fff1dc', end: '#ffd7a8', accent: '#ea580c', text: '#7c2d12' },
  grains: { start: '#fef3c7', end: '#fde68a', accent: '#b45309', text: '#78350f' },
  masala: { start: '#fff1dc', end: '#ffd7a8', accent: '#ea580c', text: '#7c2d12' },
  nuts: { start: '#f5e9dc', end: '#e7c6a5', accent: '#92400e', text: '#78350f' },
  pulses: { start: '#fef3c7', end: '#fde68a', accent: '#ca8a04', text: '#713f12' },
  snacks: { start: '#fce7f3', end: '#f9c6df', accent: '#db2777', text: '#831843' },
  bakery: { start: '#fff7d6', end: '#ffe7a3', accent: '#b45309', text: '#78350f' },
  biscuits: { start: '#fff7d6', end: '#ffe7a3', accent: '#d97706', text: '#7c2d12' },
  sauces: { start: '#ffe4e6', end: '#fecdd3', accent: '#e11d48', text: '#881337' },
  beverages: { start: '#e0f2fe', end: '#bae6fd', accent: '#0284c7', text: '#0c4a6e' },
  vegetables: { start: '#dcfce7', end: '#bbf7d0', accent: '#16a34a', text: '#14532d' },
  fruits: { start: '#fee2e2', end: '#fecaca', accent: '#e11d48', text: '#881337' },
  other: { start: '#e2e8f0', end: '#cbd5e1', accent: '#475569', text: '#1e293b' }
};

const DEFAULT_CATEGORY = 'other';
const PHOTO_BY_KEYWORD: ReadonlyArray<{ readonly keywords: readonly string[]; readonly url: string }> = [
  {
    keywords: ['milk'],
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['egg', 'eggs'],
    url: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['rice'],
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['apple', 'apples'],
    url: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['banana', 'bananas'],
    url: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['tomato', 'tomatoes'],
    url: 'https://images.unsplash.com/photo-1546470427-e5ac89cd0b20?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['potato', 'potatoes'],
    url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['onion', 'onions'],
    url: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['carrot', 'carrots'],
    url: 'https://images.unsplash.com/photo-1447175008436-170170753d52?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['bread'],
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['cheese', 'paneer'],
    url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['yogurt', 'curd', 'dahi'],
    url: 'https://images.unsplash.com/photo-1571212515416-fca88a9d5f20?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['tea', 'chai'],
    url: 'https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['coffee'],
    url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=80'
  },
  {
    keywords: ['chicken'],
    url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=640&q=80'
  }
];

const PHOTO_BY_CATEGORY: Readonly<Record<PantryCategory, string>> = {
  produce: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=640&q=80',
  dairy: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=640&q=80',
  meat: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=640&q=80',
  frozen: 'https://images.unsplash.com/photo-1615486363978-371f19f1d4e5?auto=format&fit=crop&w=640&q=80',
  spices: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=640&q=80',
  grains: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=640&q=80',
  masala: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=640&q=80',
  nuts: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=640&q=80',
  pulses: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=640&q=80',
  snacks: 'https://images.unsplash.com/photo-1585238341986-6741998b5cfa?auto=format&fit=crop&w=640&q=80',
  bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=80',
  biscuits: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=640&q=80',
  sauces: 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?auto=format&fit=crop&w=640&q=80',
  beverages: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=640&q=80',
  vegetables: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&q=80',
  fruits: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=640&q=80',
  other: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&q=80'
};

type PantryImageItem = Pick<PantryItem, 'name' | 'imageUrl'> & { category?: PantryCategory | null };

const EMOJI_BY_KEYWORD: ReadonlyArray<{ readonly emoji: string; readonly keywords: readonly string[] }> = [
  { emoji: '🍕', keywords: ['pizza'] },
  { emoji: '🍿', keywords: ['mixture', 'namkeen'] },
  { emoji: '🍬', keywords: ['sugarfree mints', 'sugar free mints', 'mint candy'] },
  { emoji: '🌿', keywords: ['mint leaves', 'mint leaf', 'pudina'] },
  { emoji: '🍃', keywords: ['stevia'] },
  { emoji: '🌱', keywords: ['chia seed', 'chia seeds'] },
  { emoji: '🍚', keywords: ['puffed rice', 'muri', 'murmura'] },
  { emoji: '🥛', keywords: ['yogurt', 'yoghurt', 'curd'] },
  { emoji: '🫑', keywords: ['capsicum', 'bell pepper'] },
  {
    emoji: '🫑',
    keywords: [
      'green chilli',
      'green chili',
      'green chillies',
      'green chilies',
      'green chilly',
      'green chillies vegetable',
      'vegetable green chilly',
      'vegetable green chilli'
    ]
  },
  { emoji: '🫙', keywords: ['ginger garlic paste', 'ginger-garlic paste'] },
  { emoji: '🫙', keywords: ['vinegar', 'vinegar sauce'] },
  { emoji: '🧴', keywords: ['dishwasher soap', 'dish wash soap', 'dishwashing liquid', 'liquid wash'] },
  { emoji: '🫚', keywords: ['ginger', 'adrak'] },
  { emoji: '🧀', keywords: ['paneer'] },
  { emoji: '🌯', keywords: ['tortilla wrap', 'tortilla', 'wraps', 'wrap'] },
  { emoji: '🛢️', keywords: ['oil'] },
  { emoji: '🧈', keywords: ['ghee'] },
  { emoji: '🫛', keywords: ['green peas', 'peas'] },
  {
    emoji: '🧻',
    keywords: ['bathroom tissue', 'bathroom tissues', 'tissue paper', 'tissue papers', 'tissues']
  },
  { emoji: '🍎', keywords: ['apple', 'apples'] },
  { emoji: '🍌', keywords: ['banana', 'bananas'] },
  { emoji: '🍊', keywords: ['orange', 'oranges', 'mandarin'] },
  { emoji: '🍋', keywords: ['lemon', 'lemons', 'lime', 'limes'] },
  { emoji: '🍇', keywords: ['grape', 'grapes'] },
  { emoji: '🍓', keywords: ['strawberry', 'strawberries'] },
  { emoji: '🍍', keywords: ['pineapple'] },
  { emoji: '🥭', keywords: ['mango', 'mangoes'] },
  { emoji: '🥑', keywords: ['avocado', 'avocados'] },
  { emoji: '🍅', keywords: ['tomato', 'tomatoes'] },
  { emoji: '🥔', keywords: ['potato', 'potatoes'] },
  { emoji: '🧅', keywords: ['onion', 'onions'] },
  { emoji: '🥕', keywords: ['carrot', 'carrots'] },
  { emoji: '🥦', keywords: ['broccoli'] },
  { emoji: '🌶️', keywords: ['chilli', 'chili', 'pepper', 'capsicum'] },
  { emoji: '🥬', keywords: ['spinach', 'lettuce', 'cabbage'] },
  { emoji: '🥒', keywords: ['cucumber'] },
  { emoji: '🍄', keywords: ['mushroom', 'mushrooms'] },
  { emoji: '🧄', keywords: ['garlic'] },
  { emoji: '🥚', keywords: ['egg', 'eggs'] },
  { emoji: '🥛', keywords: ['milk'] },
  { emoji: '🧀', keywords: ['cheese'] },
  { emoji: '🧈', keywords: ['butter'] },
  { emoji: '🍞', keywords: ['bread'] },
  { emoji: '🍚', keywords: ['rice'] },
  { emoji: '🌾', keywords: ['wheat', 'flour', 'atta'] },
  { emoji: '🥖', keywords: ['baguette'] },
  { emoji: '🥜', keywords: ['peanut', 'peanuts', 'almond', 'almonds', 'cashew', 'cashews', 'nuts'] },
  { emoji: '🫘', keywords: ['bean', 'beans', 'lentil', 'lentils', 'dal', 'chana', 'rajma'] },
  { emoji: '🍪', keywords: ['biscuit', 'biscuits', 'cookie', 'cookies'] },
  { emoji: '🫙', keywords: ['sauce', 'sauces', 'ketchup', 'chutney', 'dip'] },
  { emoji: '🍫', keywords: ['chocolate'] },
  { emoji: '🍿', keywords: ['chips'] },
  { emoji: '🧂', keywords: ['salt'] },
  { emoji: '🍯', keywords: ['honey'] },
  { emoji: '🫒', keywords: ['olive'] },
  { emoji: '🧃', keywords: ['juice'] },
  { emoji: '🥤', keywords: ['soda', 'cola', 'drink', 'drinks'] },
  { emoji: '☕', keywords: ['coffee'] },
  { emoji: '🍵', keywords: ['tea'] },
  { emoji: '🧊', keywords: ['ice'] },
  { emoji: '🍗', keywords: ['chicken'] },
  { emoji: '🥩', keywords: ['beef', 'mutton', 'pork', 'meat'] },
  { emoji: '🐟', keywords: ['fish', 'salmon', 'tuna'] },
  { emoji: '🧊', keywords: ['frozen'] }
];

const EMOJI_BY_CATEGORY: Readonly<Record<PantryCategory, string>> = {
  produce: '🥕',
  dairy: '🥛',
  meat: '🥩',
  frozen: '🧊',
  spices: '🧂',
  grains: '🌾',
  masala: '🧂',
  nuts: '🥜',
  pulses: '🫘',
  snacks: '🍿',
  bakery: '🍞',
  biscuits: '🍪',
  sauces: '🫙',
  beverages: '🥤',
  vegetables: '🥦',
  fruits: '🍎',
  other: '🛒'
};

export function resolvePantryImageUrl(item: PantryImageItem | null | undefined): string {
  const customUrl = item?.imageUrl?.trim();
  if (customUrl) {
    return customUrl;
  }

  return createPantryRealisticImageUrl(item) ?? createPantryFallbackImage(item);
}

function createPantryRealisticImageUrl(item: PantryImageItem | null | undefined): string | null {
  const name = item?.name?.trim().toLowerCase() ?? '';
  const category = item?.category ?? DEFAULT_CATEGORY;

  const keywordMatch = PHOTO_BY_KEYWORD.find((entry) => entry.keywords.some((keyword) => name.includes(keyword)));
  if (keywordMatch) {
    return keywordMatch.url;
  }

  return PHOTO_BY_CATEGORY[category] ?? PHOTO_BY_CATEGORY.other;
}

export function createPantryFallbackImage(item: PantryImageItem | null | undefined): string {
  const category = item?.category ?? DEFAULT_CATEGORY;
  const palette = CATEGORY_PALETTE[category];
  const name = item?.name?.trim() || 'Pantry item';
  const fallbackEmoji = resolveEmoji(name, category);
  const isSpiceVisual = isSpiceItem(name, category);
  const isNamkeenVisual = isNamkeenItem(name);
  const isYogurtVisual = isYogurtItem(name);
  const isTeaVisual = isTeaItem(name);
  const title = escapeSvgText(name);
  const emoji = escapeSvgText(fallbackEmoji);
  const label = escapeSvgText(toCategoryLabel(category));
  const iconMarkup = isSpiceVisual
    ? createSpiceIconMarkup(palette)
    : isNamkeenVisual
      ? createNamkeenPacketIconMarkup()
    : isYogurtVisual
      ? createYogurtIconMarkup()
    : isTeaVisual
      ? createTeaIconMarkup()
      : `
      <text x="52%" y="49%" dominant-baseline="middle" text-anchor="middle" font-family="'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" font-size="124">
        ${emoji}
      </text>
    `.trim();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.start}" />
          <stop offset="100%" stop-color="${palette.end}" />
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="40" fill="url(#bg)" />
      <circle cx="252" cy="68" r="42" fill="${palette.accent}" opacity="0.14" />
      <circle cx="64" cy="258" r="56" fill="#ffffff" opacity="0.28" />
      <rect x="34" y="34" width="252" height="252" rx="32" fill="#ffffff" opacity="0.18" />
      ${iconMarkup}
      <text x="50" y="236" font-family="'Trebuchet MS', 'Segoe UI', sans-serif" font-size="22" font-weight="700" fill="${palette.text}" opacity="0.74">
        ${label}
      </text>
      <text x="50" y="266" font-family="'Trebuchet MS', 'Segoe UI', sans-serif" font-size="24" font-weight="600" fill="${palette.text}">
        ${title}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function toCategoryLabel(category: PantryCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function resolveEmoji(name: string, category: PantryCategory): string {
  const normalizedName = name.toLowerCase();
  const keywordMatch = EMOJI_BY_KEYWORD.find((entry) =>
    entry.keywords.some((keyword) => normalizedName.includes(keyword))
  );
  if (keywordMatch) {
    return keywordMatch.emoji;
  }

  return EMOJI_BY_CATEGORY[category] ?? EMOJI_BY_CATEGORY.other;
}

function isSpiceItem(name: string, category: PantryCategory): boolean {
  if (category === 'masala' || category === 'spices') {
    return true;
  }

  const normalizedName = name.toLowerCase();
  const isGreenChilli = ['green chilli', 'green chili', 'green chillies', 'green chilies', 'green chilly'].some(
    (keyword) => normalizedName.includes(keyword)
  );
  if (isGreenChilli) {
    return false;
  }

  return ['masala', 'spice', 'turmeric', 'haldi', 'cumin', 'coriander', 'pepper', 'chilli', 'chili'].some((keyword) =>
    normalizedName.includes(keyword)
  );
}

function isTeaItem(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return ['tea', 'chai'].some((keyword) => normalizedName.includes(keyword));
}

function isNamkeenItem(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return ['mixture', 'namkeen', 'chips'].some((keyword) => normalizedName.includes(keyword));
}

function isYogurtItem(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return ['yogurt', 'yoghurt', 'curd', 'dahi'].some((keyword) => normalizedName.includes(keyword));
}

function createSpiceIconMarkup(palette: { readonly text: string }): string {
  return `
    <g aria-hidden="true">
      <ellipse cx="160" cy="214" rx="96" ry="22" fill="#000000" opacity="0.14" />

      <rect x="86" y="86" width="48" height="94" rx="11" fill="#fffaf0" opacity="0.94" />
      <rect x="86" y="77" width="48" height="15" rx="6" fill="#8b5e3c" opacity="0.95" />
      <rect x="92" y="118" width="36" height="55" rx="8" fill="#f59e0b" opacity="0.9" />

      <rect x="136" y="78" width="48" height="102" rx="11" fill="#fffdf7" opacity="0.95" />
      <rect x="136" y="69" width="48" height="15" rx="6" fill="#6b7280" opacity="0.95" />
      <rect x="142" y="112" width="36" height="62" rx="8" fill="#dc2626" opacity="0.84" />

      <rect x="186" y="90" width="48" height="90" rx="11" fill="#fffaf0" opacity="0.94" />
      <rect x="186" y="81" width="48" height="15" rx="6" fill="#7c2d12" opacity="0.95" />
      <rect x="192" y="126" width="36" height="48" rx="8" fill="#d97706" opacity="0.88" />

      <ellipse cx="160" cy="206" rx="58" ry="18" fill="#f3e7d0" opacity="0.9" />
      <ellipse cx="160" cy="202" rx="52" ry="14" fill="#f8efe0" opacity="0.95" />

      <ellipse cx="138" cy="201" rx="17" ry="7" fill="#f59e0b" opacity="0.95" />
      <ellipse cx="160" cy="204" rx="17" ry="7" fill="#b91c1c" opacity="0.9" />
      <ellipse cx="182" cy="201" rx="17" ry="7" fill="#b45309" opacity="0.93" />

      <circle cx="129" cy="199" r="1.8" fill="#92400e" opacity="0.82" />
      <circle cx="149" cy="206" r="1.6" fill="#7f1d1d" opacity="0.82" />
      <circle cx="173" cy="198" r="1.6" fill="#78350f" opacity="0.84" />
      <circle cx="189" cy="203" r="1.7" fill="#92400e" opacity="0.84" />

      <path d="M214 112c16-9 31-1 34 14-13 6-27 1-34-14z" fill="${palette.text}" opacity="0.42" />
      <path d="M224 106c9-11 22-13 31-6-6 12-20 16-31 6z" fill="#2f855a" opacity="0.55" />
      <path d="M74 122c8-9 18-11 26-5-5 10-16 14-26 5z" fill="#2f855a" opacity="0.42" />
    </g>
  `.trim();
}

function createTeaIconMarkup(): string {
  return `
    <g aria-hidden="true">
      <ellipse cx="160" cy="222" rx="92" ry="20" fill="#000000" opacity="0.14" />

      <rect x="88" y="84" width="144" height="124" rx="14" fill="#fff3f1" stroke="#a11212" stroke-width="3" />
      <rect x="88" y="84" width="144" height="34" rx="14" fill="#c01616" />
      <rect x="88" y="110" width="144" height="8" fill="#7a0f0f" opacity="0.92" />

      <text x="160" y="104" text-anchor="middle" font-family="'Trebuchet MS', 'Segoe UI', sans-serif" font-size="13" font-weight="700" fill="#fff5f5">
        RED LABEL TEA
      </text>

      <circle cx="132" cy="152" r="20" fill="#ffffff" opacity="0.9" />
      <path d="M120 152c0-7 5-12 12-12s12 5 12 12-5 12-12 12-12-5-12-12z" fill="#8b4513" opacity="0.88" />
      <path d="M149 146c6 0 10 4 10 8s-4 8-10 8" fill="none" stroke="#8b4513" stroke-width="4" stroke-linecap="round" />

      <path d="M124 130c-3-6 1-10 5-13" stroke="#b88a44" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.75" />
      <path d="M134 128c-3-6 1-10 5-13" stroke="#b88a44" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.75" />

      <rect x="162" y="134" width="54" height="32" rx="6" fill="#c01616" />
      <text x="189" y="154" text-anchor="middle" font-family="'Trebuchet MS', 'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="#fff5f5">
        LABEL
      </text>
    </g>
  `.trim();
}

function createYogurtIconMarkup(): string {
  return `
    <g aria-hidden="true">
      <ellipse cx="160" cy="220" rx="88" ry="18" fill="#000000" opacity="0.12" />
      <path d="M108 118h104l-10 82c-2 14-14 24-28 24h-28c-14 0-26-10-28-24z" fill="#f8fbff" stroke="#94a3b8" stroke-width="3" />
      <ellipse cx="160" cy="118" rx="52" ry="14" fill="#e2e8f0" />
      <ellipse cx="160" cy="116" rx="46" ry="11" fill="#ffffff" />
      <path d="M126 112c8-7 20-8 26-1 8-8 21-8 30 0 3 3 5 7 5 11h-62c0-4 1-7 1-10z" fill="#fff7ed" opacity="0.95" />
      <circle cx="150" cy="109" r="2.2" fill="#f59e0b" opacity="0.9" />
      <circle cx="167" cy="107" r="1.9" fill="#f97316" opacity="0.86" />
      <circle cx="178" cy="111" r="1.8" fill="#f59e0b" opacity="0.86" />
      <rect x="126" y="136" width="68" height="44" rx="8" fill="#60a5fa" opacity="0.92" />
      <text x="160" y="163" text-anchor="middle" font-family="'Trebuchet MS', 'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="#eff6ff">
        YOGURT
      </text>
    </g>
  `.trim();
}

function createNamkeenPacketIconMarkup(): string {
  return `
    <g aria-hidden="true">
      <ellipse cx="160" cy="220" rx="90" ry="18" fill="#000000" opacity="0.14" />
      <path d="M104 96h112l-14 116H118z" fill="#ffd166" stroke="#c2410c" stroke-width="3" />
      <rect x="104" y="96" width="112" height="26" fill="#dc2626" />
      <rect x="104" y="122" width="112" height="8" fill="#f59e0b" opacity="0.9" />
      <text x="160" y="114" text-anchor="middle" font-family="'Trebuchet MS', 'Segoe UI', sans-serif" font-size="12" font-weight="700" fill="#fff7ed">
        NAMKEEN
      </text>
      <ellipse cx="160" cy="164" rx="35" ry="22" fill="#fff7ed" opacity="0.9" />
      <circle cx="146" cy="162" r="8" fill="#f59e0b" />
      <circle cx="160" cy="168" r="8" fill="#fb923c" />
      <circle cx="173" cy="160" r="8" fill="#f97316" />
      <circle cx="154" cy="176" r="6" fill="#eab308" />
      <circle cx="168" cy="176" r="6" fill="#f59e0b" />
      <text x="160" y="198" text-anchor="middle" font-family="'Trebuchet MS', 'Segoe UI', sans-serif" font-size="11" font-weight="700" fill="#7c2d12">
        CHIPS MIX
      </text>
    </g>
  `.trim();
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
