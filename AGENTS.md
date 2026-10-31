# AGENTS.md

Guidance for any AI agent or developer working on this repository.

## Project

A showcase (not production) project: an AI analyst agent that analyzes an e-commerce database and answers questions like how many orders are completed, what the profit and loss are, total sales, and which product sells the most. It can also generate reports and save them.

## Confirmed stack

- **Language:** TypeScript (running on Node.js, JavaScript runtime)
- **Server:** Express
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth
- **ORM:** Drizzle
- **Agent framework:** LangChain, LangChain Core, LangGraph

Nothing else is decided yet. Do not add other libraries, frameworks, or services unless the project owner asks for them.

## Tools

**No agent tools are configured or decided.** They will be chosen at runtime / later by the project owner.

- Do not invent, pre-register, or hardcode any tools for the agent.
- Do not build a tool registry or plugin system "for later".
- When tools are decided, add them in the simplest way possible.

## Simplicity rules (most important)

This project must stay small and readable.

- **No extra abstraction.** No factories, base classes, service layers, repositories, dependency-injection containers, or "manager" classes.
- **No folder explosion.** Do not create a new file or folder for one or two lines of code. If something is small, keep it in the file where it is used.
- **Prefer plain functions** over classes.
- **Prefer flat structure** over nested structure.
- **Do not split code until a file becomes hard to read.** Duplication in two places is better than a premature abstraction.
- **No unused code, no speculative features.** Build only what is asked.
- If a simpler way exists, use the simpler way.

## Directory structure

Keep it close to this. Do not add more folders without a clear reason.

```
.
├── AGENTS.md
├── .env.example
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # Express app and routes
    ├── auth.ts         # Supabase auth middleware
    ├── agent.ts        # LangGraph agent
    └── db/
        ├── schema.ts   # Drizzle schema
        ├── index.ts    # Drizzle + Supabase connection
        └── seed.ts     # Fake data generator
```

## Database

E-commerce data model:

- `customers`, `categories`, `products`, `orders`, `order_items`, `returns`, `expenses`
- Agent side: `reports` (saved reports), `agent_runs` (history of runs)

Rules to remember:

- `order_items.unit_price` and `unit_cost` are snapshots at time of sale. Never recompute history from the current product price.
- `orders.status` is one of: `pending`, `completed`, `cancelled`, `returned`.
- `orders.total_amount` is what the customer paid (items minus discount). `orders.shipping_cost` is a cost paid by the store.
- Gross profit = sum of `quantity * (unit_price - unit_cost)` on completed orders, minus discounts and shipping.
- Net profit / loss = gross profit, minus refunds in `returns` on completed orders, minus `expenses` (rent, salaries, marketing, utilities, software, other) for the same period.
- Money columns are `numeric(12,2)`. Drizzle returns them as strings, so convert before doing math in JavaScript, or do the math in SQL.
- `reports.user_id` and `agent_runs.user_id` store the Supabase Auth user id (no foreign key, to keep it simple).
- Define the schema in `src/db/schema.ts` with Drizzle. Do not write raw migration files by hand.

## Agent behavior

- The agent should investigate, not only answer. For open questions it can run several queries and explain the findings.
- Show the work: keep the generated SQL and the steps visible so a demo viewer can see what happened.
- The agent must only **read** the business tables. It may write only to `reports` and `agent_runs`.
- Never let the agent run destructive SQL (`DROP`, `DELETE`, `UPDATE`, `TRUNCATE`, `ALTER`) on business data.

## Auth

- Use Supabase Auth. Verify the user's token in `src/auth.ts` and apply it to the routes that need it.
- Do not build a custom auth system.

## Code conventions

- TypeScript with `strict` enabled. Avoid `any`.
- ES modules.
- Use `async/await`.
- Keep functions short and named clearly.
- Comments only where the code is not obvious.
- Secrets live in `.env`, never in code. Keep `.env.example` up to date with variable names (no values).

## Do not

- Do not configure or add agent tools.
- Do not add libraries beyond the confirmed stack without asking.
- Do not add layers, patterns, or folders "for scalability". This is a showcase.
- Do not add tests, CI, Docker, or deployment config unless asked.
