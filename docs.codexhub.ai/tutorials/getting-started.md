# Getting Started with the Digital Banking Platform

This tutorial will guide you through setting up and running the Digital Banking Platform locally for development or testing purposes.

## Prerequisites

Before you begin, make sure you have the following installed on your system:

- **Node.js**: version 16.x or higher
- **npm**: version 8.x or higher (comes with Node.js)
- **PostgreSQL**: version 13 or higher
- **Git**: for cloning the repository

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd digital-banking-platform
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install all the required dependencies including:
- Next.js
- Prisma ORM
- NextAuth.js
- Chart.js
- Other development dependencies

## Step 3: Set Up the Database

1. Create a new PostgreSQL database:

```bash
createdb digital_banking_db
```

2. Create a `.env` file in the root directory with the following content:

```
DATABASE_URL="postgresql://username:password@localhost:5432/digital_banking_db?schema=public"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key-here"
```

Replace `username` and `password` with your PostgreSQL credentials.

## Step 4: Run Database Migrations

Initialize your database schema:

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

## Step 5: Start the Development Server

```bash
npm run dev
```

This will start the development server at [http://localhost:3001](http://localhost:3001).

## Step 6: Access the Application

Open your browser and navigate to [http://localhost:3001](http://localhost:3001).

You should see the landing page of the Digital Banking Platform.

## Step 7: Create a Test Account

1. Click on "Sign Up" in the navigation
2. Fill in the registration form:
   - Name: Your name
   - Email: Your email (can be a test email)
   - Phone: A phone number (will be used for sign-in)
   - Password: A secure password (minimum 8 characters)
3. Submit the form to create your account

## Step 8: Explore the Platform

After signing up, you'll be automatically logged in and redirected to the dashboard. From here, you can:

- View your account balance
- Navigate to the transfers page to send money
- Add funds to your account using the on-ramp feature
- View your transaction history

## Troubleshooting

**Problem**: Database connection error  
**Solution**: Verify your DATABASE_URL in the `.env` file and ensure your PostgreSQL server is running.

**Problem**: "Error: listen EADDRINUSE: address already in use :::3001"  
**Solution**: Another application is using port 3001. You can change the port in the `package.json` file by modifying the `dev` script:
```json
"dev": "next dev --port 3002"
```

**Problem**: Authentication not working  
**Solution**: Ensure your `NEXTAUTH_SECRET` is set in the `.env` file and your database migrations have been applied correctly.

## Next Steps

Now that you have the Digital Banking Platform running locally, you might want to:

1. [Create your first account](./creating-account.md) (if you haven't already)
2. [Make your first transfer](./making-transfers.md)
3. [Add funds to your account](./adding-funds.md)
4. Explore the API endpoints using the [API Reference](../api/README.md)

## Additional Resources

- [User Guide](../guides/user-guide.md) for a complete overview of platform features
- [Deployment Guide](../guides/deployment-guide.md) for putting the platform into production
- [API References](../api/README.md) for integrating with the platform