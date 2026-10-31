import { sql } from "drizzle-orm";
import { logger } from "../logger.ts";
import { getDb } from "./index.ts";
import {
  categories,
  customers,
  expenses,
  orderItems,
  orders,
  products,
  returns,
} from "./schema.ts";

// The seeder is a CLI, so the connection opens immediately and a bad
// DATABASE_URL fails right away instead of on the first insert.
const db = getDb();

const CATALOG: Record<string, [name: string, price: number][]> = {
  Electronics: [
    ["Wireless Earbuds", 89],
    ["Bluetooth Speaker", 129],
    ["Mechanical Keyboard", 149],
    ["USB-C Hub", 59],
    ["Smart Watch", 249],
    ["Noise-Cancelling Headphones", 299],
    ["Portable Charger", 45],
    ["Webcam 1080p", 79],
  ],
  "Home & Kitchen": [
    ["Espresso Machine", 279],
    ["Cast Iron Skillet", 49],
    ["Air Fryer", 119],
    ["Blender", 89],
    ["Knife Set", 159],
    ["Vacuum Cleaner", 229],
    ["Coffee Grinder", 69],
  ],
  "Sports & Outdoors": [
    ["Yoga Mat", 39],
    ["Dumbbell Set", 189],
    ["Running Shoes", 119],
    ["Camping Tent", 249],
    ["Water Bottle", 25],
    ["Cycling Helmet", 89],
  ],
  Books: [
    ["Clean Code", 42],
    ["The Pragmatic Programmer", 39],
    ["Designing Data-Intensive Applications", 55],
    ["Atomic Habits", 21],
    ["Deep Work", 19],
    ["Refactoring", 48],
  ],
  Clothing: [
    ["Denim Jacket", 99],
    ["Cotton T-Shirt", 25],
    ["Running Shorts", 35],
    ["Wool Sweater", 89],
    ["Rain Jacket", 129],
    ["Leather Belt", 45],
  ],
  Beauty: [
    ["Moisturiser", 29],
    ["Vitamin C Serum", 39],
    ["Shampoo", 15],
    ["Sunscreen SPF50", 22],
    ["Hair Dryer", 69],
  ],
  "Toys & Games": [
    ["Building Blocks Set", 59],
    ["Board Game", 45],
    ["Remote Control Car", 79],
    ["Puzzle 1000 Pieces", 25],
    ["Plush Bear", 29],
  ],
  Office: [
    ["Standing Desk", 449],
    ["Ergonomic Chair", 329],
    ["Desk Lamp", 49],
    ["Notebook Pack", 19],
    ["Wireless Mouse", 35],
    ["Monitor Stand", 65],
  ],
  Automotive: [
    ["Car Phone Mount", 25],
    ["Dash Cam", 129],
    ["Tyre Inflator", 59],
    ["Car Vacuum", 45],
    ["Jump Starter", 89],
    ["LED Headlight Kit", 69],
  ],
  "Garden & Outdoor": [
    ["Garden Hose", 39],
    ["Pruning Shears", 29],
    ["Patio Chair", 149],
    ["BBQ Grill", 279],
    ["Bird Feeder", 25],
    ["Lawn Sprinkler", 35],
  ],
  "Pet Supplies": [
    ["Dog Bed", 69],
    ["Cat Tree", 119],
    ["Pet Food Bowl", 19],
    ["Dog Leash", 25],
    ["Cat Litter Box", 45],
    ["Pet Grooming Kit", 39],
  ],
  Music: [
    ["Acoustic Guitar", 249],
    ["MIDI Keyboard", 139],
    ["Studio Headphones", 149],
    ["Microphone", 99],
    ["Guitar Strings", 12],
    ["Audio Interface", 179],
  ],
  Gaming: [
    ["Game Controller", 69],
    ["Gaming Headset", 99],
    ["Gaming Mouse", 59],
    ["Console Stand", 35],
    ["Gaming Chair", 299],
    ["Capture Card", 159],
  ],
  Health: [
    ["Digital Thermometer", 19],
    ["Blood Pressure Monitor", 59],
    ["Fitness Tracker", 89],
    ["Massage Gun", 129],
    ["Vitamin D3", 15],
    ["First Aid Kit", 35],
  ],
  Grocery: [
    ["Olive Oil 1L", 14],
    ["Coffee Beans 1kg", 29],
    ["Green Tea 100 Bags", 12],
    ["Protein Powder", 45],
    ["Dark Chocolate Box", 18],
    ["Honey 500g", 13],
    ["Pasta 5kg", 19],
  ],
  Baby: [
    ["Baby Stroller", 329],
    ["Diaper Bag", 49],
    ["Baby Monitor", 129],
    ["High Chair", 159],
    ["Baby Carrier", 79],
    ["Nursing Pillow", 45],
  ],
};

const FIRST_NAMES = [
  "Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Robin", "Avery",
  "Chris", "Dana", "Elliot", "Frankie", "Harper", "Indie", "Kai", "Logan", "Noor", "Quinn",
];

const LAST_NAMES = [
  "Miller", "Schmidt", "Garcia", "Nguyen", "Kowalski", "Rossi", "Silva", "Dubois", "Novak", "Haddad",
  "Okafor", "Tanaka", "Larsen", "Costa", "Weber", "Moreau", "Ivanov", "Bakker", "Fischer", "Reyes",
];

const LOCATIONS: [city: string, country: string][] = [
  ["Berlin", "Germany"],
  ["Munich", "Germany"],
  ["Amsterdam", "Netherlands"],
  ["Paris", "France"],
  ["Madrid", "Spain"],
  ["Milan", "Italy"],
  ["Lisbon", "Portugal"],
  ["Vienna", "Austria"],
  ["Zurich", "Switzerland"],
  ["Stockholm", "Sweden"],
  ["Warsaw", "Poland"],
  ["Dublin", "Ireland"],
];

const PAYMENT_METHODS = ["card", "paypal", "bank_transfer", "cash"];

const CUSTOMER_COUNT = 300;
const ORDER_COUNT = 2400;
const MONTHS_OF_HISTORY = 24;
// Roughly 6% of completed orders have one line partially or fully returned.
const RETURN_RATE = 0.06;

type Status = "pending" | "completed" | "cancelled" | "returned";

type OrderLine = {
  productId: number;
  quantity: number;
  unitPrice: string;
  unitCost: string;
};

type OrderDraft = {
  customerId: number;
  orderDate: Date;
  status: Status;
  paymentMethod: string;
  discountAmount: string;
  shippingCost: string;
  totalAmount: string;
  lines: OrderLine[];
};

// Deterministic PRNG (mulberry32) so re-seeding always produces the same demo data.
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return required(items[Math.floor(rand() * items.length)], "pick from an empty list");
}

function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function randomDate(rand: () => number, from: Date, to: Date): Date {
  return new Date(from.getTime() + rand() * (to.getTime() - from.getTime()));
}

// numeric(12,2) columns take strings in Drizzle.
function money(value: number): string {
  return value.toFixed(2);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pickStatus(rand: () => number): Status {
  const roll = rand();
  if (roll < 0.8) return "completed";
  if (roll < 0.88) return "pending";
  if (roll < 0.94) return "cancelled";
  return "returned";
}

async function reset(): Promise<void> {
  await db.execute(sql`
    truncate table ${orderItems}, ${returns}, ${orders}, ${products}, ${categories}, ${customers}, ${expenses}
    restart identity cascade
  `);
}

async function seedProducts(rand: () => number) {
  const categoryRows = await db
    .insert(categories)
    .values(Object.keys(CATALOG).map((name) => ({ name })))
    .returning();

  const categoryId = new Map(categoryRows.map((row) => [row.name, row.id]));

  const values = Object.entries(CATALOG).flatMap(([category, items]) =>
    items.map(([name, price]) => ({
      name,
      categoryId: required(categoryId.get(category), `category "${category}" was not inserted`),
      sellPrice: money(price),
      costPrice: money(price * (0.45 + rand() * 0.25)),
      stockQty: randomInt(rand, 0, 250),
    })),
  );

  return db.insert(products).values(values).returning();
}

async function seedCustomers(rand: () => number): Promise<number[]> {
  const values = Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const first = pick(FIRST_NAMES, rand);
    const last = pick(LAST_NAMES, rand);
    const [city, country] = pick(LOCATIONS, rand);
    return {
      name: `${first} ${last}`,
      email: `${first}.${last}.${index}@example.com`.toLowerCase(),
      city,
      country,
    };
  });

  const rows = await db.insert(customers).values(values).returning({ id: customers.id });
  return rows.map((row) => row.id);
}

function buildOrders(
  rand: () => number,
  customerIds: number[],
  productRows: { id: number; sellPrice: string; costPrice: string }[],
): OrderDraft[] {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - MONTHS_OF_HISTORY);

  return Array.from({ length: ORDER_COUNT }, () => {
    const lines: OrderLine[] = [];
    const chosen = new Set<number>();
    let subtotal = 0;

    const lineCount = randomInt(rand, 1, 4);
    for (let line = 0; line < lineCount; line++) {
      const product = pick(productRows, rand);
      if (chosen.has(product.id)) continue;
      chosen.add(product.id);

      const quantity = randomInt(rand, 1, 3);
      subtotal += Number(product.sellPrice) * quantity;

      lines.push({
        productId: product.id,
        quantity,
        unitPrice: product.sellPrice,
        unitCost: product.costPrice,
      });
    }

    const discountAmount = rand() < 0.3 ? subtotal * (0.05 + rand() * 0.1) : 0;

    return {
      customerId: pick(customerIds, rand),
      orderDate: randomDate(rand, from, now),
      status: pickStatus(rand),
      paymentMethod: pick(PAYMENT_METHODS, rand),
      discountAmount: money(discountAmount),
      shippingCost: money(rand() < 0.7 ? 4.9 + rand() * 10 : 0),
      totalAmount: money(subtotal - discountAmount),
      lines,
    };
  });
}

async function seedOrdersAndLines(
  rand: () => number,
  customerIds: number[],
  productRows: { id: number; sellPrice: string; costPrice: string }[],
): Promise<{ orderCount: number; lineCount: number; returnCount: number }> {
  const drafts = buildOrders(rand, customerIds, productRows);

  const orderRows = await db
    .insert(orders)
    .values(
      drafts.map((draft) => ({
        customerId: draft.customerId,
        orderDate: draft.orderDate,
        status: draft.status,
        paymentMethod: draft.paymentMethod,
        discountAmount: draft.discountAmount,
        shippingCost: draft.shippingCost,
        totalAmount: draft.totalAmount,
      })),
    )
    .returning({ id: orders.id });

  // RETURNING keeps the order of the values list, so ids line up with drafts by index.
  const lines = drafts.flatMap((draft, index) =>
    draft.lines.map((line) => ({ ...line, orderId: required(orderRows[index], "missing order id").id })),
  );

  await db.insert(orderItems).values(lines);

  const returned: {
    orderId: number;
    productId: number;
    quantity: number;
    refundAmount: string;
    reason: string;
    returnedAt: Date;
  }[] = [];

  drafts.forEach((draft, index) => {
    if (draft.status !== "completed" || rand() >= RETURN_RATE) return;

    const line = pick(draft.lines, rand);
    const quantity = randomInt(rand, 1, line.quantity);
    const returnedAt = new Date(draft.orderDate.getTime() + randomInt(rand, 3, 30) * 86_400_000);

    returned.push({
      orderId: required(orderRows[index], "missing order id").id,
      productId: line.productId,
      quantity,
      refundAmount: money(Number(line.unitPrice) * quantity),
      reason: pick(["damaged", "wrong item", "no longer needed", "arrived late"], rand),
      returnedAt,
    });
  });

  if (returned.length > 0) await db.insert(returns).values(returned);

  return { orderCount: drafts.length, lineCount: lines.length, returnCount: returned.length };
}

async function seedExpenses(rand: () => number): Promise<number> {
  const now = new Date();
  const values: {
    category: "rent" | "salaries" | "marketing" | "utilities" | "software" | "other";
    description: string;
    amount: string;
    expenseDate: string;
  }[] = [];

  for (let monthsAgo = MONTHS_OF_HISTORY - 1; monthsAgo >= 0; monthsAgo--) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const expenseDate = isoDate(month);

    values.push(
      { category: "rent", description: "Warehouse rent", amount: money(1800), expenseDate },
      { category: "salaries", description: "Team salaries", amount: money(6500), expenseDate },
      { category: "marketing", description: "Paid ads", amount: money(400 + rand() * 1800), expenseDate },
      { category: "utilities", description: "Electricity & internet", amount: money(180 + rand() * 320), expenseDate },
      { category: "software", description: "Subscriptions", amount: money(90 + rand() * 260), expenseDate },
    );

    if (rand() < 0.5) {
      values.push({ category: "other", description: "Misc", amount: money(50 + rand() * 500), expenseDate });
    }
  }

  await db.insert(expenses).values(values);
  return values.length;
}

async function seed(): Promise<void> {
  const rand = makeRandom(20260101);

  await reset();

  const productRows = await seedProducts(rand);
  const customerIds = await seedCustomers(rand);
  const { orderCount, lineCount, returnCount } = await seedOrdersAndLines(rand, customerIds, productRows);
  const expenseCount = await seedExpenses(rand);

  logger.info(
    {
      categories: Object.keys(CATALOG).length,
      products: productRows.length,
      customers: customerIds.length,
      orders: orderCount,
      orderItems: lineCount,
      returns: returnCount,
      expenses: expenseCount,
    },
    "Seed complete",
  );
}

await seed();
await db.$client.end();
