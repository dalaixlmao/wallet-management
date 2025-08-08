# Transaction API

The Transaction API provides endpoints for creating and managing on-ramp transactions in the Digital Banking Platform.

## Create On-Ramp Transaction

Creates a new on-ramp transaction to add money to a user's account.

- **URL**: `/api/transactions` (handled by server actions)
- **Method**: Server Action
- **Authentication**: Required

**Parameters**:

| Name     | Type   | Description                   |
|----------|--------|-------------------------------|
| provider | string | Payment provider name         |
| amount   | number | Amount to add (in base units) |

**Response**:

```json
{
  "message": "Done"
}
```

**Status Codes**:
- `200 OK`: Transaction created successfully
- `401 Unauthorized`: User not authenticated

**Example Usage**:

```javascript
import { createOnRampTransaction } from "../lib/actions/createOnrampTransaction";

async function addMoney() {
  try {
    const result = await createOnRampTransaction("Bank_XYZ", 100);
    console.log(result.message); // "Done"
  } catch (error) {
    console.error("Failed to create transaction", error);
  }
}
```

## Implementation Details

The transaction API is implemented using Next.js Server Actions. The main implementation is in the `createOnRampTransaction` function:

```typescript
export async function createOnRampTransaction(provider: string, amount: number) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !session.user?.id) {
        return {
            message: "Unauthenticated request"
        }
    }
    const token = (Math.random() * 1000).toString();
    await prisma.onRampTransaction.create({
        data: {
            provider,
            status: "Processing",
            startTime: new Date(),
            token: token,
            userId: Number(session?.user?.id),
            amount: amount * 100
        }
    });

    return {
        message: "Done"
    }
}
```

## Transaction Status

Transactions can have the following status values:

| Status     | Description                           |
|------------|---------------------------------------|
| Processing | Transaction is currently in progress  |
| Success    | Transaction completed successfully    |
| Failure    | Transaction failed                    |

## Error Handling

Possible error responses:

- **Unauthenticated request**: When the user is not logged in
  ```json
  {
    "message": "Unauthenticated request"
  }
  ```

- **Database errors**: When there's an issue with the database operation
  ```json
  {
    "error": "Failed to create transaction"
  }
  ```

## Security Considerations

- All transaction endpoints require authentication
- Transactions are always associated with the authenticated user
- Amount values are validated before processing
- Transaction tokens are randomly generated for each transaction