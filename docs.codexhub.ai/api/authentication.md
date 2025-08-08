# Authentication API

The Digital Banking Platform uses NextAuth.js for authentication. This document provides details on the authentication endpoints and flows.

## Authentication Endpoints

### Sign In

Authenticates a user and creates a session.

- **URL**: `/api/auth/signin`
- **Method**: `POST`
- **Content-Type**: `application/json`

**Request Body**:

```json
{
  "number": "1234567890",
  "password": "yourpassword"
}
```

**Response**:

```json
{
  "user": {
    "id": "123"
  }
}
```

**Status Codes**:
- `200 OK`: Authentication successful
- `401 Unauthorized`: Invalid credentials

### Sign Up

Creates a new user account.

- **URL**: `/api/auth/signin` (with different payload)
- **Method**: `POST`
- **Content-Type**: `application/json`

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "name": "John Doe",
  "phone": "1234567890"
}
```

**Response**:

```json
{
  "user": {
    "id": "123"
  }
}
```

**Status Codes**:
- `200 OK`: Account created successfully
- `400 Bad Request`: Invalid input data
- `409 Conflict`: User already exists

### Sign Out

Ends the current user session.

- **URL**: `/api/auth/signout`
- **Method**: `POST`

**Response**:

```json
{
  "message": "Logged out successfully"
}
```

**Status Codes**:
- `200 OK`: Logged out successfully

### Session

Gets the current session information.

- **URL**: `/api/auth/session`
- **Method**: `GET`

**Response**:

```json
{
  "user": {
    "id": "123"
  }
}
```

or `null` if not authenticated.

**Status Codes**:
- `200 OK`: Request successful

## Authentication Flow

### Standard Authentication Flow

1. User submits credentials through the sign-in form
2. Credentials are validated against the database
3. If valid, a session is created and stored
4. Session information is returned to the client

### Session Management

Sessions are managed via HTTP cookies. The session contains:
- User ID
- Session expiration time

## Implementation Details

The authentication system uses NextAuth.js with a custom CredentialsProvider:

```typescript
CredentialsProvider({
  name: "Credentials",
  credentials: {
    email: {
      label: "Email",
      type: "text",
      placeholder: "jsmit@next.com",
    },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials: any) {
    // Authentication logic here
  }
})
```

## Password Security

Passwords are securely hashed using bcrypt before storage:

```typescript
const hashedPass = await hash(password, 10);
```

Password verification is done using bcrypt's compare function:

```typescript
const isValid = await compare(password, user.password);
```

## Security Considerations

- Session cookies are HTTP-only to prevent JavaScript access
- Passwords are never stored in plain text
- Authentication has rate limiting to prevent brute force attacks
- User input is validated using Zod schema validation

## Error Handling

Common authentication errors:

- **Invalid credentials**: When username/password combination is incorrect
- **User not found**: When attempting to sign in with a non-existent account
- **Validation error**: When input data doesn't meet the required format
- **Rate limiting**: When too many authentication attempts are made in a short period