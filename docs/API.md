# API Reference

This document describes all API endpoints available in the Real Estate Agent application.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.vercel.app/api`

## Authentication

Most endpoints support optional authentication via Supabase JWT tokens.

```http
Authorization: Bearer <supabase_access_token>
```

For admin endpoints, use the API key:

```http
Authorization: Bearer <ADMIN_API_KEY>
```

---

## Chat Endpoint

### POST /api/chat

Process a natural language query and return matching listings.

**Request Body:**

```json
{
  "message": "Tražim dvosobni stan za najam u Zagrebu do 800€",
  "conversationId": "optional-uuid",
  "previousFilters": {}
}
```

**Response:**

```json
{
  "message": "Pronašao sam 15 stanova koji odgovaraju vašim kriterijima...",
  "listings": [
    {
      "id": "uuid",
      "title": "Dvosobni stan, Zagreb - Trešnjevka",
      "price": 750,
      "price_currency": "EUR",
      "listing_type": "rent",
      "location_city": "Zagreb",
      "rooms": 2,
      "surface_area": 55,
      "relevance_score": 0.95
    }
  ],
  "extractedFilters": {
    "listing_type": "rent",
    "location": "Zagreb",
    "max_price": 800,
    "rooms": 2
  },
  "suggestions": [
    "Želite li suziti pretragu na određenu četvrt?",
    "Trebate li parking?"
  ],
  "conversationId": "uuid"
}
```

**Rate Limit:** 30 requests/minute

---

## Listings Endpoints

### GET /api/listings

Get a paginated list of listings with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `listing_type` | string | Filter by 'rent' or 'sale' |
| `location_city` | string | Filter by city |
| `min_price` | number | Minimum price |
| `max_price` | number | Maximum price |
| `min_rooms` | number | Minimum rooms |
| `max_rooms` | number | Maximum rooms |
| `has_parking` | boolean | Has parking |
| `has_balcony` | boolean | Has balcony |
| `is_furnished` | boolean | Is furnished |
| `source` | string | Filter by source (njuskalo, index-oglasi) |

**Response:**

```json
{
  "listings": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Rate Limit:** 120 requests/minute

---

### GET /api/listings/:id

Get a single listing by ID.

**Response:**

```json
{
  "listing": {
    "id": "uuid",
    "title": "...",
    "description": "...",
    "price": 750,
    "price_currency": "EUR",
    "listing_type": "rent",
    "property_type": "apartment",
    "location_city": "Zagreb",
    "location_address": "...",
    "rooms": 2,
    "bedrooms": 1,
    "bathrooms": 1,
    "surface_area": 55,
    "has_parking": true,
    "has_balcony": true,
    "is_furnished": true,
    "amenities": [...],
    "images": [...],
    "url": "https://...",
    "source": "njuskalo",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### GET /api/listings/:id/similar

Get similar listings based on semantic similarity.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of similar listings (default: 5) |

**Response:**

```json
{
  "listings": [
    {
      "id": "uuid",
      "title": "...",
      "similarity_score": 0.89
    }
  ]
}
```

---

### POST /api/listings/:id/save

Save a listing to user favorites. **Requires authentication.**

**Response:**

```json
{
  "success": true,
  "message": "Listing saved"
}
```

---

### DELETE /api/listings/:id/save

Remove a listing from favorites. **Requires authentication.**

**Response:**

```json
{
  "success": true,
  "message": "Listing removed from saved"
}
```

---

### GET /api/listings/saved

Get user's saved listings. **Requires authentication.**

**Response:**

```json
{
  "listings": [
    {
      "listing": {...},
      "saved_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Search History Endpoints

### GET /api/searches

Get user's search history. **Requires authentication.**

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of searches (default: 20) |

**Response:**

```json
{
  "searches": [
    {
      "id": "uuid",
      "query_text": "...",
      "extracted_filters": {...},
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "stats": {
    "total_searches": 50,
    "most_common_city": "Zagreb",
    "most_common_type": "rent"
  }
}
```

---

### GET /api/searches/:id

Get a specific search with cached results. **Requires authentication.**

---

### POST /api/searches/:id/rerun

Re-run a previous search with fresh data. **Requires authentication.**

---

### DELETE /api/searches/:id

Delete a search from history. **Requires authentication.**

---

## Authentication Endpoints

### POST /api/auth/signup

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

---

### POST /api/auth/login

Login with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "user": {...},
  "session": {...}
}
```

---

### POST /api/auth/logout

Logout the current user.

---

### POST /api/auth/reset-password

Request a password reset email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

---

### POST /api/auth/refresh

Refresh the authentication token.

---

## Admin Endpoints

All admin endpoints require the `ADMIN_API_KEY` bearer token.

### POST /api/admin/scraping/trigger

Manually trigger a scraping job.

**Request Body:**

```json
{
  "type": "full" | "single" | "listing_type",
  "source": "njuskalo" | "index-oglasi",
  "listingType": "rent" | "sale",
  "propertyType": "apartment" | "house",
  "maxPages": 5
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "job-123",
  "message": "Full scrape job queued"
}
```

---

### GET /api/admin/scraping/status

Get the current queue status.

**Response:**

```json
{
  "waiting": 2,
  "active": 1,
  "completed": 150,
  "failed": 3
}
```

---

### GET /api/admin/scraping/jobs/:jobId

Get details of a specific job.

**Response:**

```json
{
  "id": "job-123",
  "name": "full-scrape",
  "data": {...},
  "progress": {...},
  "status": "completed",
  "result": {...}
}
```

---

### GET /api/admin/analytics

Get system analytics for the admin dashboard.

**Response:**

```json
{
  "database": {
    "totalListings": 1500,
    "listingsBySource": {...},
    "listingsByType": {...}
  },
  "scraping": {
    "queueStatus": {...}
  },
  "searches": {
    "totalSearches": 500
  },
  "system": {
    "redisConnected": true,
    "redisType": "upstash"
  }
}
```

---

## Cron Endpoint

### GET /api/cron/scrape

Called by Vercel Cron to trigger scheduled scrapes.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | 'full', 'rent', or 'sale' |

**Authentication:** Requires `CRON_SECRET` bearer token.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable - External service down |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/chat` | 30/minute |
| `/api/listings` | 120/minute |
| `/api/searches` | 60/minute |
| Default | 100/minute |

When rate limited, responses include:

```http
Retry-After: 60
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067200
```
