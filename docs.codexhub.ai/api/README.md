# API References

Welcome to the API References section of the Digital Banking Platform. This documentation provides detailed information about the available API endpoints, authentication methods, and data models.

## Contents

- [Authentication](./authentication.md): Information about user authentication and session management
- [User API](./user-api.md): Endpoints for user data and management
- [Transaction API](./transaction-api.md): Endpoints for managing transactions
- [Transfer API](./transfer-api.md): Endpoints for peer-to-peer transfers
- [Data Models](./data-models.md): Database schema and data structures

## API Overview

The Digital Banking Platform API is built on Next.js API routes and follows RESTful principles. The API uses JSON for request and response payloads.

### Base URL

For local development:
```
http://localhost:3001/api
```

For production:
```
https://yourdomain.com/api
```

### API Versioning

Currently, the API does not use explicit versioning in the URL path. Future API versions will be announced with appropriate migration paths.

### Response Format

Successful API responses typically follow this structure:

```json
{
  "data": {
    // Response data here
  },
  "message": "Operation successful"
}
```

Error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message details"
  }
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Authenticated but not authorized
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

## Getting Started

To get started with the API, first review the [Authentication](./authentication.md) documentation to understand how to authenticate your requests.