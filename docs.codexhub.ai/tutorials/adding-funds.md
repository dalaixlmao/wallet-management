# Adding Funds to Your Account

This tutorial will guide you through the process of adding money to your Digital Banking Platform account using the on-ramp feature.

## Prerequisites

- An active account on the Digital Banking Platform
- Access to a supported payment method (bank account, debit card, etc.)

## Step 1: Access the Add Money Feature

1. Sign in to your account
2. Navigate to the dashboard
3. Locate the "Add Money" card and click on it

Alternatively, you can access this feature through the sidebar menu if available.

## Step 2: Select a Payment Provider

The platform supports various payment providers for adding funds to your account:

1. From the add money page, you'll see a list of available payment providers
2. Select your preferred provider (e.g., Bank XYZ, Payment Processor ABC)

```jsx
// The provider selection component looks like this:
<div className="provider-selection">
  <h2>Select a Payment Provider</h2>
  <div className="provider-list">
    {providers.map(provider => (
      <button 
        key={provider.id} 
        className="provider-button"
        onClick={() => selectProvider(provider.id)}
      >
        {provider.name}
      </button>
    ))}
  </div>
</div>
```

## Step 3: Enter the Amount

After selecting a payment provider:

1. Enter the amount you wish to add to your account
2. Review any applicable fees (if any)
3. Click "Continue" or "Next" to proceed

```jsx
// The amount input component:
<form onSubmit={handleSubmit}>
  <TextInput
    label="Amount"
    type="number"
    placeholder="Enter amount"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
  />
  
  <button type="submit">Continue</button>
</form>
```

## Step 4: Provider-Specific Process

At this point, the process varies depending on the selected payment provider:

1. You may be redirected to the provider's website or payment page
2. Follow the provider's instructions to complete the payment
3. After completing the payment, you'll be redirected back to the Digital Banking Platform

Behind the scenes, an on-ramp transaction is created:

```typescript
// Server-side on-ramp transaction creation:
await prisma.onRampTransaction.create({
  data: {
    provider: providerName,
    status: "Processing",
    startTime: new Date(),
    token: generatedToken,
    userId: userId,
    amount: amount * 100 // Convert to smallest currency unit
  }
});
```

## Step 5: Transaction Processing

Once the payment is initiated:

1. The transaction is created with a status of "Processing"
2. You'll see a confirmation page showing that your transaction is being processed
3. Depending on the provider, this process may take a few seconds to several minutes

## Step 6: Confirmation and Receipt

Once the transaction is processed:

1. The transaction status changes to "Success" (or "Failure" if something went wrong)
2. Your account balance is updated with the added funds
3. You'll receive a confirmation message
4. The transaction appears in your transaction history

## Tracking Your Transaction

To check the status of your transaction:

1. Navigate to the "Transactions" page from the sidebar
2. Look for your recent transaction in the list
3. The status will show as "Processing", "Success", or "Failure"

```jsx
// Example of how transactions are displayed:
<div className="transaction-item">
  <div className="transaction-provider">{transaction.provider}</div>
  <div className="transaction-amount">${transaction.amount / 100}</div>
  <div className="transaction-status">{transaction.status}</div>
  <div className="transaction-date">
    {new Date(transaction.startTime).toLocaleString()}
  </div>
</div>
```

## Handling Common Issues

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| Transaction stuck in "Processing" | Delay in receiving confirmation from provider | Wait a few minutes, then check again |
| "Failed" transaction | Payment declined by provider or insufficient funds | Try another payment method or contact your bank |
| Amount not showing in balance | Transaction may still be processing | Wait for the transaction to complete |
| Error during payment process | Connection issue or provider downtime | Try again later or use a different provider |

## Transaction Limits and Fees

- **Minimum Amount**: Typically $5 or equivalent
- **Maximum Amount**: Varies by provider and account status
- **Fees**: May vary by provider, always displayed before confirming

## Next Steps

Now that you've added funds to your account, you can:

1. [Make a transfer to another user](./making-transfers.md)
2. Use other platform features that require funds
3. Check your updated balance and transaction history

## Support

If you encounter issues with adding funds that aren't resolved by this guide, please contact support with your transaction details:

- Transaction token (if available)
- Provider name
- Amount
- Date and time of the transaction