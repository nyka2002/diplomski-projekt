import { http, HttpResponse } from 'msw';
import { mockListings } from '../fixtures/listings';

/**
 * MSW request handlers for API mocking
 */
export const handlers = [
  // Chat API
  http.post('/api/chat', async ({ request }) => {
    const body = (await request.json()) as { query: string; session_id?: string };

    if (!body.query || body.query.trim().length === 0) {
      return HttpResponse.json(
        { success: false, error: { code: 'INVALID_QUERY', message: 'Query is required' } },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        message: 'Pronašao sam 5 stanova koji odgovaraju vašim kriterijima.',
        listings: mockListings.slice(0, 5),
        extracted_filters: {
          listing_type: 'rent',
          location: 'Zagreb',
          price_max: 800,
          rooms_min: 2,
        },
        confidence: {
          overall: 0.85,
          listing_type: 0.95,
          location: 0.9,
          price: 0.85,
          rooms: 0.8,
          amenities: 0.7,
          ambiguousFields: [],
        },
        follow_up_questions: [
          'Želite li suziti pretragu po kvartu?',
          'Je li vam važan parking?',
          'Tražite namješten stan?',
        ],
        total_matches: 15,
        session_id: body.session_id || 'test-session-123',
        cached: false,
      },
    });
  }),

  // Listings API
  http.get('/api/listings', () => {
    return HttpResponse.json({
      success: true,
      data: {
        listings: mockListings,
        total: mockListings.length,
        page: 1,
        limit: 20,
      },
    });
  }),

  // Single Listing API
  http.get('/api/listings/:id', ({ params }) => {
    const listing = mockListings.find((l) => l.id === params.id);

    if (!listing) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Listing not found' } },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        listing,
        is_saved: false,
        similar_listings: mockListings.filter((l) => l.id !== params.id).slice(0, 3),
      },
    });
  }),

  // Save Listing API
  http.post('/api/listings/:id/save', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { listing_id: params.id, saved: true },
    });
  }),

  http.delete('/api/listings/:id/save', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { listing_id: params.id, saved: false },
    });
  }),

  // Saved Listings API
  http.get('/api/listings/saved', () => {
    return HttpResponse.json({
      success: true,
      data: {
        listings: mockListings.slice(0, 2),
        total: 2,
      },
    });
  }),

  // Search History API
  http.get('/api/searches', () => {
    return HttpResponse.json({
      success: true,
      data: {
        searches: [
          {
            id: 'search-1',
            query_text: 'Dvosobni stan u Zagrebu',
            extracted_filters: { listing_type: 'rent', location: 'Zagreb', rooms_min: 2 },
            created_at: new Date().toISOString(),
          },
          {
            id: 'search-2',
            query_text: 'Kuća na prodaju u Splitu',
            extracted_filters: { listing_type: 'sale', location: 'Split', property_type: 'house' },
            created_at: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
        stats: {
          total_searches: 10,
          most_common_city: 'Zagreb',
          avg_price_max: 750,
          most_searched_listing_type: 'rent',
        },
      },
    });
  }),

  // Auth API
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
          session: { access_token: 'test-token', refresh_token: 'test-refresh' },
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 }
    );
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; name: string };

    return HttpResponse.json({
      success: true,
      data: {
        user: {
          id: 'new-user-123',
          email: body.email,
          user_metadata: { name: body.name },
        },
        message: 'Check your email to confirm your account',
      },
    });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),

  // User Profile API
  http.get('/api/user/profile', () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date().toISOString(),
      },
    });
  }),
];
