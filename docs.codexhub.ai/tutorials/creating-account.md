# Creating Your First Account

This tutorial will guide you through the process of creating a user account on the Digital Banking Platform.

## Prerequisites

- The Digital Banking Platform is running (locally or on a server)
- A web browser
- A valid email address and phone number

## Step 1: Navigate to the Sign Up Page

1. Open the Digital Banking Platform in your web browser
2. Click on the "Sign Up" button in the top-right corner of the landing page

![Sign Up Navigation](../images/signup-nav.png)

## Step 2: Fill Out the Registration Form

Complete the sign-up form with your information:

1. **Name**: Enter your full name
2. **Email**: Enter a valid email address (this will be used for communications)
3. **Phone Number**: Enter your phone number (this will be your login identifier)
4. **Password**: Create a strong password (minimum 8 characters)

```jsx
// The sign-up form component looks like this:
<form onSubmit={handleSubmit}>
  <TextInput
    label="Name"
    placeholder="John Doe"
    value={name}
    onChange={(e) => setName(e.target.value)}
  />
  
  <TextInput
    label="Email"
    placeholder="john@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  
  <TextInput
    label="Phone"
    placeholder="1234567890"
    value={phone}
    onChange={(e) => setPhone(e.target.value)}
  />
  
  <TextInput
    label="Password"
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
  />
  
  <button type="submit">Sign Up</button>
</form>
```

## Step 3: Submit the Form

Click the "Sign Up" button to submit your information.

Behind the scenes, the following happens:
1. Your password is securely hashed using bcrypt
2. Your user record is created in the database
3. A balance record is created with an initial amount
4. You are automatically logged in

```typescript
// Server-side account creation logic:
const user = await prisma.user.create({
  data: {
    name,
    email,
    number: phone,
    password: hashedPassword,
  },
});

// Initial balance is created
await prisma.balance.create({
  data: {
    amount: Math.random() * 1000000, // Demo initial amount
    locked: 0,
    userId: user.id
  }
});
```

## Step 4: Verify Your Account

After signing up, you'll be automatically redirected to the dashboard. Your account is now created and ready to use.

The dashboard will display:
- Your current balance
- Transaction history (empty for new accounts)
- Options to send money or add funds

## Step 5: Explore Your Account Settings

Take some time to explore your account settings:

1. Click on your profile icon in the top-right corner
2. Browse through available options such as:
   - Profile information
   - Security settings
   - Notification preferences (if available)

## Common Issues and Solutions

**Issue**: "Email already exists" error  
**Solution**: Use a different email address or try signing in if you already have an account

**Issue**: "Phone number already registered" error  
**Solution**: Use a different phone number or recover access to your existing account

**Issue**: Password requirements not met  
**Solution**: Ensure your password is at least 8 characters long

## Next Steps

Now that you've created your account, you can:

1. [Add funds to your account](./adding-funds.md)
2. [Make your first transfer](./making-transfers.md)
3. Explore the dashboard and other features

## Security Best Practices

- Use a strong, unique password
- Don't share your login credentials
- Sign out when using shared or public devices
- Regularly check your transaction history

For more security recommendations, see our [Security Best Practices](../guides/security-best-practices.md) guide.