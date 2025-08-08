```mermaid
flowchart TD
    User[User/Browser] --> NextJS[Next.js Frontend]
    NextJS --> Auth[NextAuth.js]
    NextJS --> ServerActions[Server Actions]
    NextJS --> APIRoutes[Next.js API Routes]
    Auth --> Prisma[Prisma ORM]
    ServerActions --> Prisma
    APIRoutes --> Prisma
    Prisma --> PostgreSQL[(PostgreSQL)]
    
    subgraph Components
        BalanceCard[Balance Card]
        TransactionHistory[Transaction History]
        SendMoneyForm[Send Money Form]
        AddMoneyForm[Add Money Form]
        BalanceChart[Balance Chart]
    end
    
    NextJS --> Components
```