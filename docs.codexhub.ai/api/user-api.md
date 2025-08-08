# User API

The User API provides endpoints for retrieving and managing user information in the Digital Banking Platform.

## Get Current User

Retrieves information about the currently authenticated user.

- **URL**: `/api/user`
- **Method**: `GET`
- **Authentication**: Required

**Response**:

```json
{
  "user": {
    "id": "123"
  }
}
```

**Status Codes**:
- `200 OK`: Request successful
- `403 Forbidden`: User not authenticated

**Example Request**:

```javascript
async function getCurrentUser() {
  const response = await fetch('/api/user', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  
  return await response.json();
}
```

## Implementation Details

The User API is implemented using Next.js API routes. The `GET` handler for the `/api/user` endpoint checks for an authenticated session using NextAuth.js:

```typescript
export const GET = async () => {
  try {
    const session = await getServerSession(authOptions);
    if (session.user) {
      return NextResponse.json({
        user: session.user,
      });
    }
  } catch (e) {
    return NextResponse.json(
      {
        message: "You are not logged in",
      },
      {
        status: 403,
      }
    );
  }

  return NextResponse.json(
    {
      message: "You are not logged in",
    },
    {
      status: 403,
    }
  );
};
```

## Error Handling

Possible error responses:

- **Not authenticated**: When the request is made without a valid session
  ```json
  {
    "message": "You are not logged in"
  }
  ```

## Security Considerations

- All endpoints require authentication
- User information is only accessible to the authenticated user themselves
- Sensitive user data like passwords are never returned in responses