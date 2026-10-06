/* eslint-disable no-console */
import { AdminRole, BannerPosition, CouponType, InventoryReason, PrismaClient, ProductStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';
import { bannerSvg, productSvg, type Shape } from './artwork';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const API_URL = process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000';
const SEED_DIR = join(__dirname, '..', 'assets', 'seed');

// ───────────── Demo artwork (generated, committed under assets/ so it survives redeploys) ─────────────

function writeAsset(name: string, svg: string) {
  writeFileSync(join(SEED_DIR, name), svg);
  return `${API_URL}/assets/seed/${name}`;
}

// ───────────── Catalog definition ─────────────

interface CatDef {
  name: string;
  slug: string;
  children?: CatDef[];
  returnWindowDays?: number;
  isReturnable?: boolean;
}

const CATEGORY_TREE: CatDef[] = [
  {
    name: 'Men',
    slug: 'men',
    children: [
      { name: 'T-Shirts', slug: 'men-t-shirts' },
      { name: 'Shirts', slug: 'men-shirts' },
      { name: 'Jeans', slug: 'men-jeans' },
    ],
  },
  {
    name: 'Women',
    slug: 'women',
    children: [
      { name: 'Dresses', slug: 'women-dresses' },
      { name: 'Tops', slug: 'women-tops' },
      { name: 'Kurtas', slug: 'women-kurtas' },
      { name: 'Jeans', slug: 'women-jeans' },
    ],
  },
  {
    name: 'Kids',
    slug: 'kids',
    children: [
      { name: 'Boys', slug: 'kids-boys' },
      { name: 'Girls', slug: 'kids-girls' },
    ],
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    children: [
      { name: 'Shoes', slug: 'footwear-shoes' },
      { name: 'Sandals', slug: 'footwear-sandals' },
    ],
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    returnWindowDays: 15,
    children: [
      { name: 'Bags', slug: 'accessories-bags' },
      { name: 'Watches', slug: 'accessories-watches', isReturnable: false },
    ],
  },
];

const COLORS: Record<string, string> = {
  Black: '#1f2937',
  White: '#f9fafb',
  Navy: '#1e3a8a',
  Olive: '#4d7c0f',
  Maroon: '#881337',
  Grey: '#6b7280',
  Blue: '#2563eb',
  'Light Blue': '#93c5fd',
  Pink: '#f472b6',
  Mustard: '#ca8a04',
  Green: '#15803d',
  Red: '#dc2626',
  Beige: '#d6c7a1',
  Brown: '#78350f',
  Yellow: '#facc15',
};

interface ProductDef {
  name: string;
  brand: string;
  category: string;
  shape: Shape;
  price: number; // rupees
  mrp: number; // rupees
  colors: string[];
  sizes: string[];
  material: string;
  description: string;
  specs: Record<string, string>;
  featured?: boolean;
  tags: string[];
  sold?: number;
}

const APPAREL_SIZES = ['S', 'M', 'L', 'XL'];

const PRODUCTS: ProductDef[] = [
  { name: 'Classic Crew Neck Cotton T-Shirt', brand: 'Urban Basics', category: 'men-t-shirts', shape: 'tshirt', price: 499, mrp: 999, colors: ['Black', 'White', 'Navy'], sizes: APPAREL_SIZES, material: '100% Cotton', description: 'A wardrobe essential cut from soft, breathable combed cotton. Regular fit with a ribbed crew neck that keeps its shape wash after wash.', specs: { Fit: 'Regular', Sleeve: 'Half sleeve', Neck: 'Crew neck', 'Wash care': 'Machine wash cold' }, featured: true, tags: ['tshirt', 'cotton', 'casual'], sold: 120 },
  { name: 'Oversized Graphic Print T-Shirt', brand: 'StreetLab', category: 'men-t-shirts', shape: 'tshirt', price: 699, mrp: 1299, colors: ['Olive', 'Black'], sizes: APPAREL_SIZES, material: 'Cotton blend', description: 'Relaxed oversized silhouette with a bold back print and dropped shoulders. Made for everyday streetwear.', specs: { Fit: 'Oversized', Sleeve: 'Half sleeve', Print: 'Graphic' }, featured: true, tags: ['tshirt', 'oversized', 'streetwear'], sold: 85 },
  { name: 'Polo T-Shirt with Contrast Tipping', brand: 'Urban Basics', category: 'men-t-shirts', shape: 'tshirt', price: 799, mrp: 1499, colors: ['Maroon', 'Navy', 'White'], sizes: APPAREL_SIZES, material: 'Pique cotton', description: 'Smart-casual polo in textured pique cotton with contrast tipping on collar and cuffs.', specs: { Fit: 'Slim', Collar: 'Polo', Sleeve: 'Half sleeve' }, tags: ['polo', 'tshirt'], sold: 40 },
  { name: 'Slim Fit Oxford Shirt', brand: 'Crestline', category: 'men-shirts', shape: 'shirt', price: 1199, mrp: 2199, colors: ['Light Blue', 'White'], sizes: ['38', '40', '42', '44'], material: 'Oxford cotton', description: 'A crisp oxford shirt with a button-down collar. Dress it up for work or roll the sleeves for the weekend.', specs: { Fit: 'Slim', Sleeve: 'Full sleeve', Collar: 'Button-down' }, featured: true, tags: ['shirt', 'formal', 'office'], sold: 60 },
  { name: 'Linen Blend Casual Shirt', brand: 'Crestline', category: 'men-shirts', shape: 'shirt', price: 1399, mrp: 2499, colors: ['Beige', 'Olive'], sizes: ['38', '40', '42', '44'], material: 'Linen blend', description: 'Lightweight linen-blend shirt that stays cool through Indian summers.', specs: { Fit: 'Regular', Sleeve: 'Full sleeve', Occasion: 'Casual' }, tags: ['shirt', 'linen', 'summer'], sold: 25 },
  { name: 'Slim Tapered Stretch Jeans', brand: 'DenimCo', category: 'men-jeans', shape: 'jeans', price: 1499, mrp: 2999, colors: ['Blue', 'Black'], sizes: ['30', '32', '34', '36'], material: '98% Cotton, 2% Elastane', description: 'Mid-rise slim tapered jeans with just enough stretch for all-day comfort.', specs: { Fit: 'Slim tapered', Rise: 'Mid rise', Closure: 'Zip fly' }, featured: true, tags: ['jeans', 'denim'], sold: 95 },
  { name: 'Floral Print Midi Dress', brand: 'Bloom', category: 'women-dresses', shape: 'dress', price: 1299, mrp: 2599, colors: ['Pink', 'Yellow'], sizes: ['XS', 'S', 'M', 'L'], material: 'Viscose rayon', description: 'Flowy midi dress in an all-over floral print with a flattering tie waist.', specs: { Length: 'Midi', Sleeve: 'Short sleeve', Neck: 'V-neck' }, featured: true, tags: ['dress', 'floral', 'party'], sold: 70 },
  { name: 'Bodycon Ribbed Dress', brand: 'Bloom', category: 'women-dresses', shape: 'dress', price: 999, mrp: 1999, colors: ['Black', 'Maroon'], sizes: ['XS', 'S', 'M', 'L'], material: 'Ribbed knit', description: 'Figure-hugging ribbed knit dress for evenings out.', specs: { Length: 'Knee length', Fit: 'Bodycon' }, tags: ['dress', 'bodycon'], sold: 30 },
  { name: 'Relaxed Fit Linen Top', brand: 'Aura', category: 'women-tops', shape: 'top', price: 799, mrp: 1499, colors: ['White', 'Beige', 'Green'], sizes: ['XS', 'S', 'M', 'L', 'XL'], material: 'Linen blend', description: 'Easy relaxed top with a boat neck and soft linen-blend feel.', specs: { Fit: 'Relaxed', Neck: 'Boat neck' }, tags: ['top', 'linen'], sold: 55 },
  { name: 'Embroidered Straight Kurta', brand: 'Rangrez', category: 'women-kurtas', shape: 'kurta', price: 1199, mrp: 2399, colors: ['Mustard', 'Navy', 'Maroon'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], material: 'Cotton', description: 'Straight-cut cotton kurta with delicate thread embroidery on the yoke. Perfect for festive and daily wear.', specs: { Length: 'Calf length', Sleeve: '3/4 sleeve', Occasion: 'Festive' }, featured: true, tags: ['kurta', 'ethnic', 'festive'], sold: 110 },
  { name: 'High Rise Mom Jeans', brand: 'DenimCo', category: 'women-jeans', shape: 'jeans', price: 1599, mrp: 2999, colors: ['Light Blue', 'Blue'], sizes: ['26', '28', '30', '32'], material: '100% Cotton denim', description: 'Vintage-inspired high-rise mom jeans with a relaxed leg.', specs: { Fit: 'Mom fit', Rise: 'High rise' }, tags: ['jeans', 'denim'], sold: 45 },
  { name: 'Boys Dino Print T-Shirt', brand: 'Little Steps', category: 'kids-boys', shape: 'tshirt', price: 349, mrp: 699, colors: ['Green', 'Blue'], sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], material: '100% Cotton', description: 'Soft cotton tee with a playful dinosaur print.', specs: { Fit: 'Regular', Sleeve: 'Half sleeve' }, tags: ['kids', 'tshirt'], sold: 35 },
  { name: 'Girls Party Frock', brand: 'Little Steps', category: 'kids-girls', shape: 'dress', price: 899, mrp: 1799, colors: ['Pink', 'Red'], sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], material: 'Net with cotton lining', description: 'Twirl-worthy party frock with layered net skirt and comfortable cotton lining.', specs: { Length: 'Knee length', Occasion: 'Party' }, tags: ['kids', 'dress', 'party'], sold: 20 },
  { name: 'Everyday Running Shoes', brand: 'Stride', category: 'footwear-shoes', shape: 'shoe', price: 1999, mrp: 3999, colors: ['Black', 'Grey', 'Blue'], sizes: ['UK6', 'UK7', 'UK8', 'UK9', 'UK10'], material: 'Mesh upper, EVA sole', description: 'Lightweight running shoes with breathable mesh and cushioned EVA midsole.', specs: { Type: 'Running', Sole: 'EVA', Closure: 'Lace-up' }, featured: true, tags: ['shoes', 'sports', 'running'], sold: 80 },
  { name: 'Leather Comfort Sandals', brand: 'Stride', category: 'footwear-sandals', shape: 'sandal', price: 1299, mrp: 1999, colors: ['Brown', 'Black'], sizes: ['UK6', 'UK7', 'UK8', 'UK9', 'UK10'], material: 'Genuine leather', description: 'Hand-finished leather sandals with a cushioned footbed.', specs: { Type: 'Sandals', Material: 'Leather' }, tags: ['sandals', 'leather'], sold: 22 },
  { name: 'Canvas Everyday Tote Bag', brand: 'Carry', category: 'accessories-bags', shape: 'bag', price: 699, mrp: 1199, colors: ['Beige', 'Black'], sizes: ['Free Size'], material: 'Heavy canvas', description: 'Roomy canvas tote with an inner zip pocket — fits a laptop up to 14".', specs: { Capacity: '18 L', Closure: 'Open top' }, tags: ['bag', 'tote'], sold: 18 },
  { name: 'Minimal Analog Watch', brand: 'Tempo', category: 'accessories-watches', shape: 'watch', price: 2499, mrp: 4999, colors: ['Black', 'Brown'], sizes: ['Free Size'], material: 'Stainless steel, leather strap', description: 'Clean minimal dial with Japanese quartz movement and a genuine leather strap.', specs: { Movement: 'Quartz', 'Water resistance': '30 m', Warranty: '1 year' }, featured: true, tags: ['watch'], sold: 15 },
];

const SIZE_CHART = [
  { size: 'S', chest: '38', length: '27' },
  { size: 'M', chest: '40', length: '28' },
  { size: 'L', chest: '42', length: '29' },
  { size: 'XL', chest: '44', length: '30' },
];

async function main() {
  mkdirSync(SEED_DIR, { recursive: true });

  // Categories
  const catIds = new Map<string, string>();
  const createCats = async (defs: CatDef[], parentId: string | null) => {
    for (const [i, def] of defs.entries()) {
      const cat = await prisma.category.upsert({
        where: { slug: def.slug },
        create: {
          name: def.name,
          slug: def.slug,
          parentId,
          sortOrder: i,
          returnWindowDays: def.returnWindowDays,
          isReturnable: def.isReturnable,
        },
        update: { name: def.name, parentId, sortOrder: i },
      });
      catIds.set(def.slug, cat.id);
      if (def.children) await createCats(def.children, cat.id);
    }
  };
  await createCats(CATEGORY_TREE, null);
  console.log(`✓ ${catIds.size} categories`);

  // Category images
  for (const root of CATEGORY_TREE) {
    const shape = { men: 'tshirt', women: 'dress', kids: 'tshirt', footwear: 'shoe', accessories: 'bag' }[root.slug] ?? 'tshirt';
    const url = writeAsset(`cat-${root.slug}.svg`, productSvg(shape as Shape, '#2563eb'));
    await prisma.category.update({ where: { slug: root.slug }, data: { imageUrl: url } });
  }

  // Products
  let count = 0;
  for (const def of PRODUCTS) {
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const images = def.colors.flatMap((color) => [
      { url: writeAsset(`${slug}-${color.toLowerCase().replace(/\s+/g, '-')}-1.svg`, productSvg(def.shape, COLORS[color])), alt: `${def.name} ${color}`, color },
      { url: writeAsset(`${slug}-${color.toLowerCase().replace(/\s+/g, '-')}-2.svg`, productSvg(def.shape, COLORS[color], 1)), alt: `${def.name} ${color} detail`, color },
    ]);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) continue;
    const prefix = def.brand.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() + String(count + 1).padStart(3, '0');
    const parent = await prisma.category.findUnique({ where: { id: catIds.get(def.category)! } });
    const product = await prisma.product.create({
      data: {
        name: def.name,
        slug,
        brand: def.brand,
        description: def.description,
        material: def.material,
        specifications: def.specs,
        sizeChart: APPAREL_SIZES.join() === def.sizes.join() ? SIZE_CHART : undefined,
        tags: def.tags,
        status: ProductStatus.ACTIVE,
        isFeatured: def.featured ?? false,
        soldCount: def.sold ?? 0,
        minPrice: def.price * 100,
        maxMrp: def.mrp * 100,
        discountPct: Math.round(((def.mrp - def.price) / def.mrp) * 100),
        categories: {
          create: [
            { categoryId: catIds.get(def.category)!, isPrimary: true },
            ...(parent?.parentId ? [{ categoryId: parent.parentId }] : []),
          ],
        },
        images: { create: images.map((img, i) => ({ ...img, sortOrder: i })) },
      },
    });
    for (const color of def.colors) {
      for (const size of def.sizes) {
        const stock = (count + size.length * 7 + color.length * 3) % 4 === 0 ? 0 : 5 + ((count * 7 + size.length * 5) % 30);
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: `${prefix}-${color.replace(/\s+/g, '').slice(0, 3).toUpperCase()}-${size.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`,
            color,
            colorHex: COLORS[color],
            size,
            price: def.price * 100,
            mrp: def.mrp * 100,
            stock,
          },
        });
        if (stock) {
          await prisma.inventoryMovement.create({
            data: { variantId: variant.id, change: stock, reason: InventoryReason.RESTOCK, note: 'Seed stock' },
          });
        }
      }
    }
    count++;
  }
  console.log(`✓ ${count} products created`);

  // Admin
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  await prisma.admin.upsert({
    where: { email },
    create: { email, name: 'Super Admin', role: AdminRole.SUPER_ADMIN, passwordHash: await bcrypt.hash(password, 12) },
    update: {},
  });
  console.log(`✓ super admin ${email}`);

  // Demo customer
  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    create: {
      name: 'Demo Customer',
      email: 'customer@example.com',
      phone: '9876543210',
      passwordHash: await bcrypt.hash('Customer@123', 12),
      addresses: {
        create: {
          name: 'Demo Customer',
          phone: '9876543210',
          line1: '221B, MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          isDefault: true,
        },
      },
    },
    update: {},
  });
  console.log('✓ demo customer customer@example.com / Customer@123');

  // Coupons
  const coupons = [
    { code: 'WELCOME10', description: '10% off on your first order (up to ₹300)', type: CouponType.PERCENT, value: 10, maxDiscount: 30000, minOrderValue: 49900, firstOrderOnly: true },
    { code: 'FLAT200', description: '₹200 off on orders above ₹1,499', type: CouponType.FLAT, value: 20000, minOrderValue: 149900, perUserLimit: 3 },
    { code: 'FOOTWEAR15', description: '15% off on footwear', type: CouponType.PERCENT, value: 15, maxDiscount: 75000, minOrderValue: 0, applicableCategoryIds: [catIds.get('footwear')!] },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({ where: { code: c.code }, create: c, update: {} });
  }
  console.log(`✓ ${coupons.length} coupons`);

  // Banners
  const bannerImages = [
    writeAsset('banner-1.svg', bannerSvg('NEW SEASON', '#0a1c36', '#2563eb', ['tshirt', 'dress', 'shoe'])),
    writeAsset('banner-2.svg', bannerSvg('FESTIVE EDIT', '#7c2d12', '#db2777', ['kurta', 'dress', 'sandal'])),
    writeAsset('banner-3.svg', bannerSvg('FLAT200', '#064e3b', '#0d9488', ['bag', 'shirt', 'watch'])),
  ];
  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.createMany({
      data: [
        { title: 'New Season Collection', subtitle: 'Fresh styles for every day — up to 50% off', imageUrl: bannerImages[0], linkUrl: '/c/men', ctaText: 'Shop Now', position: BannerPosition.HERO, sortOrder: 0 },
        { title: 'Festive Ethnic Edit', subtitle: 'Kurtas & more for every celebration', imageUrl: bannerImages[1], linkUrl: '/c/women-kurtas', ctaText: 'Explore', position: BannerPosition.HERO, sortOrder: 1 },
        { title: 'Flat ₹200 off', subtitle: 'On orders above ₹1,499. Use code FLAT200', imageUrl: bannerImages[2], linkUrl: '/search?sort=discount', ctaText: 'Grab the deal', position: BannerPosition.OFFER, sortOrder: 0 },
      ],
    });
  }
  console.log('✓ banners');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
