import { defineRelations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  date,
  uuid,
  index,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const orderStatus = pgEnum("order_status", [
  "pending",
  "completed",
  "cancelled",
  "returned",
]);
export const expenseCategory = pgEnum("expense_category", [
  "rent",
  "salaries",
  "marketing",
  "utilities",
  "software",
  "other",
]);

// ---------- Business tables ----------
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  city: text("city"),
  country: text("country"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
    stockQty: integer("stock_qty").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_products_category").on(t.categoryId)],
);

// totalAmount  = what the customer paid (items - discount)
// shippingCost = what the store paid to ship (a business cost)
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    orderDate: timestamp("order_date").notNull(),
    status: orderStatus("status").notNull(),
    paymentMethod: text("payment_method").notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [
    index("idx_orders_date").on(t.orderDate),
    index("idx_orders_status").on(t.status),
    index("idx_orders_customer").on(t.customerId),
  ],
);

// unitPrice / unitCost are snapshots at time of sale. History never changes when prices change.
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index("idx_items_order").on(t.orderId), index("idx_items_product").on(t.productId)],
);

export const returns = pgTable(
  "returns",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason"),
    returnedAt: timestamp("returned_at").notNull(),
  },
  (t) => [index("idx_returns_order").on(t.orderId)],
);

// Business running costs (not tied to a single order). Used for net profit / loss.
export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    category: expenseCategory("category").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    expenseDate: date("expense_date").notNull(),
  },
  (t) => [index("idx_expenses_date").on(t.expenseDate)],
);

// ---------- Agent tables ----------
// userId = Supabase Auth user id (auth.users.id). No foreign key, to keep things simple.
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id"),
  // The run this report was made from, so the PDF can include its data.
  runId: integer("run_id"),
  title: text("title").notNull(),
  question: text("question"),
  generatedSql: text("generated_sql"),
  resultSummary: text("result_summary"),
  // pending -> ready, or failed with an error attached by the worker.
  pdfStatus: text("pdf_status").notNull().default("pending"),
  pdfPath: text("pdf_path"),
  pdfError: text("pdf_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id"),
  // Runs sharing this id belong to one context window.
  conversationId: text("conversation_id"),
  userPrompt: text("user_prompt").notNull(),
  stepsLog: text("steps_log"),
  status: text("status").notNull().default("running"),
  // What the history view reports back to the user.
  durationMs: integer("duration_ms"),
  totalTokens: integer("total_tokens"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Relations (for db.query.*.findMany({ with: ... })) ----------
export const relations = defineRelations(
  { customers, categories, products, orders, orderItems, returns, expenses, reports, agentRuns },
  (r) => ({
    customers: {
      orders: r.many.orders({ from: r.customers.id, to: r.orders.customerId }),
    },
    categories: {
      products: r.many.products({ from: r.categories.id, to: r.products.categoryId }),
    },
    products: {
      category: r.one.categories({ from: r.products.categoryId, to: r.categories.id }),
      orderItems: r.many.orderItems({ from: r.products.id, to: r.orderItems.productId }),
      returns: r.many.returns({ from: r.products.id, to: r.returns.productId }),
    },
    orders: {
      customer: r.one.customers({ from: r.orders.customerId, to: r.customers.id }),
      items: r.many.orderItems({ from: r.orders.id, to: r.orderItems.orderId }),
      returns: r.many.returns({ from: r.orders.id, to: r.returns.orderId }),
    },
    orderItems: {
      order: r.one.orders({ from: r.orderItems.orderId, to: r.orders.id }),
      product: r.one.products({ from: r.orderItems.productId, to: r.products.id }),
    },
    returns: {
      order: r.one.orders({ from: r.returns.orderId, to: r.orders.id }),
      product: r.one.products({ from: r.returns.productId, to: r.products.id }),
    },
  }),
);
