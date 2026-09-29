/**
 * Sample seed data for Mirella Skin & Hair Care
 * Used when Firebase is unavailable / localStorage is empty
 */

const SEED_PRODUCTS = [
  {
    id: "prod_001",
    name: "Rose Gold Glow Serum",
    category: "skincare",
    price: 1499,
    stock: 48,
    description: "Lightweight vitamin-C infused serum with rose extract for luminous, even-toned skin. Suitable for all skin types.",
    tags: ["all-skin", "brightening", "vitamin-c"],
    featured: true,
    icon: "✨",
    image: null
  },
  {
    id: "prod_002",
    name: "Hydra Blush Moisturizer",
    category: "skincare",
    price: 1299,
    stock: 62,
    description: "24-hour hydration cream with hyaluronic acid and blush-pink botanical extracts. Plump, soft finish.",
    tags: ["dry-skin", "hydrating", "daily"],
    featured: true,
    icon: "🌸",
    image: null
  },
  {
    id: "prod_003",
    name: "Gentle Cleanse Foam",
    category: "skincare",
    price: 899,
    stock: 75,
    description: "pH-balanced foaming cleanser that removes impurities without stripping the skin barrier.",
    tags: ["all-skin", "sensitive", "cleanser"],
    featured: false,
    icon: "🫧",
    image: null
  },
  {
    id: "prod_004",
    name: "Night Repair Cream",
    category: "skincare",
    price: 1699,
    stock: 35,
    description: "Overnight recovery cream with ceramides and peptides. Wake up to smoother, restored skin.",
    tags: ["mature", "repair", "night"],
    featured: true,
    icon: "🌙",
    image: null
  },
  {
    id: "prod_005",
    name: "Silk Strength Shampoo",
    category: "haircare",
    price: 999,
    stock: 55,
    description: "Sulfate-free shampoo enriched with silk proteins for stronger, shinier strands.",
    tags: ["all-hair", "strengthening", "sulfate-free"],
    featured: true,
    icon: "💇",
    image: null
  },
  {
    id: "prod_006",
    name: "Argan Gold Conditioner",
    category: "haircare",
    price: 1099,
    stock: 50,
    description: "Deep conditioning treatment with pure argan oil. Tames frizz and adds mirror-like shine.",
    tags: ["dry-hair", "frizz", "argan"],
    featured: true,
    icon: "✨",
    image: null
  },
  {
    id: "prod_007",
    name: "Scalp Therapy Oil",
    category: "haircare",
    price: 1199,
    stock: 40,
    description: "Nourishing blend of rosemary, tea tree and jojoba oils for a healthy, balanced scalp.",
    tags: ["scalp-care", "growth", "oil"],
    featured: false,
    icon: "🌿",
    image: null
  },
  {
    id: "prod_008",
    name: "Rose Gold Brush Set",
    category: "tools",
    price: 2499,
    stock: 28,
    description: "Professional 8-piece makeup brush set with ultra-soft synthetic bristles and rose-gold handles.",
    tags: ["makeup", "brushes", "professional"],
    featured: true,
    icon: "🖌️",
    image: null
  },
  {
    id: "prod_009",
    name: "Facial Rose Quartz Roller",
    category: "tools",
    price: 799,
    stock: 45,
    description: "Genuine rose quartz facial roller to depuff, improve circulation and enhance product absorption.",
    tags: ["skincare-tool", "depuff", "rose-quartz"],
    featured: false,
    icon: "💎",
    image: null
  },
  {
    id: "prod_010",
    name: "Velvet Lip & Cheek Tint",
    category: "skincare",
    price: 699,
    stock: 80,
    description: "Multi-use cream tint in a soft rose-gold shade. Buildable color for lips and cheeks.",
    tags: ["makeup", "tint", "multi-use"],
    featured: false,
    icon: "💄",
    image: null
  },
  {
    id: "prod_011",
    name: "Hair Growth Serum",
    category: "haircare",
    price: 1599,
    stock: 32,
    description: "Clinically-inspired leave-in serum with biotin, caffeine and botanical extracts for denser-looking hair.",
    tags: ["growth", "thinning", "serum"],
    featured: true,
    icon: "🌱",
    image: null
  },
  {
    id: "prod_012",
    name: "Jade Gua Sha Stone",
    category: "tools",
    price: 649,
    stock: 38,
    description: "Hand-carved jade gua sha tool for facial sculpting, lymphatic drainage and tension relief.",
    tags: ["skincare-tool", "sculpt", "jade"],
    featured: false,
    icon: "💚",
    image: null
  }
];

const SEED_REVIEWS = [
  {
    id: "rev_001",
    name: "Ayesha K.",
    rating: 5,
    text: "The Rose Gold Glow Serum transformed my dull skin in two weeks. Sana's recommendations are pure gold!",
    product: "Rose Gold Glow Serum",
    approved: true,
    date: "2025-08-12"
  },
  {
    id: "rev_002",
    name: "Priya M.",
    rating: 5,
    text: "Silk Strength Shampoo + Argan Conditioner combo is heavenly. My hair has never felt this soft and strong.",
    product: "Silk Strength Shampoo",
    approved: true,
    date: "2025-08-20"
  },
  {
    id: "rev_003",
    name: "Fatima R.",
    rating: 5,
    text: "Ordered the full bridal kit. Packaging was luxurious and every product performed beautifully on the big day.",
    product: "Bridal Kit",
    approved: true,
    date: "2025-09-01"
  },
  {
    id: "rev_004",
    name: "Neha S.",
    rating: 4,
    text: "Hydra Blush Moisturizer is perfect for my dry skin. Light scent, no greasiness. Will repurchase!",
    product: "Hydra Blush Moisturizer",
    approved: true,
    date: "2025-09-05"
  },
  {
    id: "rev_005",
    name: "Zara A.",
    rating: 5,
    text: "The brush set is professional quality at a fraction of the price. Soft bristles, gorgeous rose-gold finish.",
    product: "Rose Gold Brush Set",
    approved: true,
    date: "2025-09-10"
  },
  {
    id: "rev_006",
    name: "Meera T.",
    rating: 5,
    text: "Sana is not only a talented artist but also so educational. Her products reflect that care and expertise.",
    product: "General",
    approved: true,
    date: "2025-09-15"
  }
];

// Expose globally
window.SEED_PRODUCTS = SEED_PRODUCTS;
window.SEED_REVIEWS = SEED_REVIEWS;
