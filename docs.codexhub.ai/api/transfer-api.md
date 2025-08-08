# Transfer API

The Transfer API provides endpoints for peer-to-peer money transfers between users in the Digital Banking Platform.

## Peer-to-Peer Transfer

Transfers money from the current user's account to another user's account.

- **URL**: `/api/transfers` (handled by server actions)
- **Method**: Server Action
- **Authentication**: Required

**Parameters**:

| Name   | Type   | Description                          |
|--------|--------|--------------------------------------|
| to     | string | Recipient's phone number             |
| amount | number | Amount to transfer (in base units)   |

**Response**:

Success:
```json
{
  "message": "Transfer successful"
}
```

Error:
```json
{
  "message": "Error message details"
}
```

**Status Codes**:
- `200 OK`: Transfer processed (may be successful or have a handled error)
- `401 Unauthorized`: User not authenticated

**Example Usage**:

```javascript
import { p2pTransfer } from "../lib/actions/p2pTransfer";

async function sendMoney() {
  try {
    const result = await p2pTransfer("1234567890", 100);
    if (result.message === "Error while sending") {
      // Handle error
    } else {
      // Success
    }
  } catch (error) {
    console.error("Transfer failed", error);
  }
}
```

## Implementation Details

The transfer API is implemented using Next.js Server Actions. The main implementation is in the `p2pTransfer` function:

```typescript
export async function p2pTransfer(to: string, amount: number) {
    const session = await getServerSession(authOptions);
    const from = session?.user?.id;
    
    if (!from) {
        return {
            message: "Error while sending"
        }
    }
    
    const toUser = await prisma.user.findFirst({
        where: {
            number: to
        }
    });
    
    if (!toUser) {
        return {
            message: "User not found"
        }
    }

    if(Number(from) == toUser.id) {
        return {
            message: "Cant send money to yourself."
        }
    }

    await prisma.$transaction(async (tx) => {
        // Transaction logic here
    });
}
```

## Transfer Process

The transfer process uses a database transaction to ensure atomicity:

1. Lock the sender's balance record to prevent race conditions
2. Check if the sender has sufficient funds
3. Decrease the sender's balance
4. Increase the recipient's balance
5. Create a transfer record with timestamp and details
6. Commit the transaction if all steps succeed

## Error Handling

Possible error responses:

- **Error while sending**: General error, usually due to authentication issues
  ```json
  {
    "message": "Error while sending"
  }
  ```

- **User not found**: When the recipient phone number doesn't match any user
  ```json
  {
    "message": "User not found"
  }
  ```

- **Cannot send to self**: When attempting to transfer to your own account
  ```json
  {
    "message": "Cant send money to yourself."
  }
  ```

- **Insufficient funds**: When the sender doesn't have enough balance
  ```json
  {
    "message": "Insufficient funds"
  }
  ```

## Security Considerations

- All transfer endpoints require authentication
- Transfers use database transactions to ensure consistency
- Balance checks prevent overdrafts
- Self-transfers are blocked to prevent manipulation