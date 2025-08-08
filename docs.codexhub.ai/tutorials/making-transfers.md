# Making Your First Transfer

This tutorial will guide you through the process of sending money to another user on the Digital Banking Platform.

## Prerequisites

- An active account on the Digital Banking Platform
- Sufficient balance in your account
- The recipient's phone number

## Step 1: Access the P2P Transfer Page

1. Sign in to your account
2. Navigate to the P2P Transfer page using one of these methods:
   - Click on "P2P" in the sidebar menu
   - Click on the "Send Money" card on the dashboard

## Step 2: Enter Transfer Details

On the P2P Transfer page, you'll see a form to enter the transfer details:

1. **Recipient**: Enter the recipient's phone number
2. **Amount**: Enter the amount you wish to send

```jsx
// The transfer form component looks like this:
<form onSubmit={handleSubmit}>
  <TextInput
    label="To (Phone Number)"
    placeholder="1234567890"
    value={recipientPhone}
    onChange={(e) => setRecipientPhone(e.target.value)}
  />
  
  <TextInput
    label="Amount"
    type="number"
    placeholder="100"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
  />
  
  <button type="submit">Send Money</button>
</form>
```

## Step 3: Review and Confirm

1. Double-check the recipient's phone number to ensure it's correct
2. Verify the amount you're sending
3. Click the "Send Money" button to initiate the transfer

## Step 4: Transfer Processing

Once you submit the transfer, the following happens behind the scenes:

1. The system validates your session and identifies you as the sender
2. It looks up the recipient by phone number
3. It verifies you have sufficient funds
4. It executes the transfer in a database transaction to ensure consistency
5. It updates both your balance and the recipient's balance
6. It creates a transfer record in the database

```typescript
// Server-side transfer processing:
await prisma.$transaction(async (tx) => {
  // Lock sender's balance record
  await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${senderId} FOR UPDATE`;
  
  // Check sender's balance
  const senderBalance = await tx.balance.findUnique({
    where: { userId: senderId },
  });
  if (!senderBalance || senderBalance.amount < amount) {
    throw new Error('Insufficient funds');
  }
  
  // Update balances
  await tx.balance.update({
    where: { userId: senderId },
    data: { amount: { decrement: amount } },
  });
  await tx.balance.update({
    where: { userId: recipientId },
    data: { amount: { increment: amount } },
  });
  
  // Create transfer record
  await tx.p2pTransfer.create({
    data: {
      fromUserId: senderId,
      toUserId: recipientId,
      amount,
      timestamp: new Date()
    }
  });
});
```

## Step 5: Confirmation and Receipt

After the transfer is processed, you'll see a confirmation message indicating the transfer was successful.

The transfer will immediately appear in:
- Your transaction history
- The recipient's transaction history
- Your updated balance

## Handling Transfer Errors

You may encounter these common errors:

| Error | Description | Solution |
|-------|-------------|----------|
| "User not found" | The recipient phone number doesn't match any user | Verify the phone number is correct |
| "Insufficient funds" | Your balance is too low for this transfer | Add funds to your account or reduce the transfer amount |
| "Can't send money to yourself" | The recipient number matches your own | Use a different recipient number |

## Transfer Limits and Fees

- **Standard Limits**: Transfers are subject to daily and per-transaction limits based on your account type
- **Fees**: Currently, peer-to-peer transfers within the platform are free of charge

## Tracking Your Transfer

To view your transfer history:
1. Navigate to the "Transactions" page from the sidebar
2. Look for your recent transfer in the list
3. Click on any transfer to view more details

## Next Steps

Now that you've completed your first transfer, you might want to:

1. [Add more funds to your account](./adding-funds.md)
2. View your transaction history
3. Set up recurring transfers (if available)

## Security Tips

- Always double-check the recipient's phone number before confirming
- Never share your login credentials with others
- Report any suspicious activity immediately
- Set up notifications for transfers (if available)

For more security recommendations, see our [Security Best Practices](../guides/security-best-practices.md) guide.