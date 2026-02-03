/**
 * Chat API Endpoint
 *
 * POST /api/chat
 *
 * Process user natural language queries for property search.
 * Integrates chatbot, NLP extraction, semantic search, and ranking.
 *
 * Request body:
 * {
 *   query: string;              // User message
 *   conversation_history?: ChatMessage[];
 *   session_id?: string;        // For context persistence
 * }
 *
 * Response:
 * {
 *   success: true;
 *   data: {
 *     message: string;          // Chatbot response
 *     listings: Listing[];      // Search results
 *     extracted_filters: ExtractedFilters;
 *     follow_up_questions: string[];
 *     total_matches: number;
 *     session_id: string;
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  optionalAuth,
  applyRateLimit,
  handleApiError,
  createSuccessResponse,
  createErrorResponse,
  logRequest,
  logResponse,
  ApiError,
  addResponseHeaders,
} from '@/lib/api';
import {
  getCachedSearchResults,
  cacheSearchResults,
  getCachedChatContext,
  cacheChatContext,
} from '@/lib/api/cache';
import { createAIServices } from '@/services/ai';
import { createSearchServices } from '@/services/search';
import { saveUserSearch } from '@/lib/db-helpers';
import { ChatMessage } from '@/types/api';
import { ExtractedFilters } from '@/types/search';
import { Listing } from '@/types/listing';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

interface ChatRequestBody {
  query: string;
  conversation_history?: ChatMessage[];
  session_id?: string;
}

interface ChatResponseData {
  message: string;
  listings: Listing[];
  extracted_filters: ExtractedFilters;
  follow_up_questions: string[];
  total_matches: number;
  session_id: string;
  cached: boolean;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  // Optional authentication - allows anonymous users
  const authResult = await optionalAuth(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { context } = authResult;
  logRequest(request, context);

  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(request, context, 'chat');
  if (rateLimitResponse) {
    logResponse(context, 429);
    return rateLimitResponse;
  }

  try {
    // Parse request body
    const body: ChatRequestBody = await request.json();

    // Validate request
    if (!body.query || typeof body.query !== 'string') {
      throw new ApiError('Query is required', 400, 'INVALID_REQUEST');
    }

    if (body.query.trim().length === 0) {
      throw new ApiError('Query cannot be empty', 400, 'INVALID_REQUEST');
    }

    if (body.query.length > 1000) {
      throw new ApiError('Query too long (max 1000 characters)', 400, 'INVALID_REQUEST');
    }

    // Process the chat request
    const result = await processChatRequest(body, context.user?.id);

    // Save search history if user is authenticated
    if (context.user?.id && result.extracted_filters) {
      try {
        await saveUserSearch(
          context.user.id,
          body.query,
          result.extracted_filters
        );
      } catch (error) {
        // Don't fail the request if saving history fails
        console.error('Failed to save user search:', error);
      }
    }

    const response = NextResponse.json(
      createSuccessResponse<ChatResponseData>(result),
      { status: 200 }
    );

    logResponse(context, 200);
    return addResponseHeaders(response, context);
  } catch (error) {
    const response = handleApiError(error, context.requestId);
    logResponse(context, response.status, error instanceof Error ? error.message : 'Unknown error');
    return response;
  }
}

// ============================================================================
// CHAT PROCESSING
// ============================================================================

async function processChatRequest(
  body: ChatRequestBody,
  userId?: string
): Promise<ChatResponseData> {
  const sessionId = body.session_id || uuidv4();

  // Initialize AI and Search services
  const aiServices = createAIServices();
  const searchServices = createSearchServices(aiServices.embedding);

  // Try to restore chat context from cache
  let chatContext = await getCachedChatContext(sessionId);

  // If no cached context, create new one
  if (!chatContext) {
    chatContext = {
      conversationHistory: body.conversation_history?.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date(),
      })) || [],
      currentFilters: undefined,
      lastSearchResults: undefined,
      sessionStartTime: new Date(),
      turnCount: 0,
    };
  }

  // Process the message through the chatbot
  const chatbotResponse = await aiServices.chatbot.processMessage(
    body.query,
    chatContext
  );

  let listings: Listing[] = [];
  let totalMatches = 0;
  let cached = false;
  const extractedFilters = chatbotResponse.extractedFilters || {};

  // Perform search if chatbot indicates we should
  if (chatbotResponse.shouldSearch && !chatbotResponse.clarificationNeeded) {
    // Check cache first
    const cachedResults = await getCachedSearchResults(
      body.query,
      extractedFilters,
      userId
    );

    if (cachedResults) {
      listings = cachedResults.listings as Listing[];
      totalMatches = cachedResults.totalMatches;
      cached = true;
    } else {
      // Perform semantic search
      try {
        const searchResult = await searchServices.semantic.search(
          body.query,
          extractedFilters,
          { maxResults: 20 }
        );

        listings = searchResult.listings.map(r => r.listing);
        totalMatches = searchResult.totalMatches;

        // Cache the results
        await cacheSearchResults(
          body.query,
          extractedFilters,
          listings,
          totalMatches,
          userId
        );
      } catch (error) {
        console.error('Search failed:', error);
        // Continue with empty results rather than failing
      }
    }

    // If we got results, update the chatbot response with them
    if (listings.length > 0) {
      const updatedResponse = await aiServices.chatbot.processMessageWithResults(
        body.query,
        chatContext,
        {
          listings: listings.map(l => ({
            title: l.title,
            price: l.price,
            location_city: l.location_city,
            rooms: l.rooms,
            surface_area: l.surface_area,
            has_parking: l.has_parking,
            has_balcony: l.has_balcony,
            is_furnished: l.is_furnished,
          })),
          totalCount: totalMatches,
        }
      );

      // Update context with search results (store listing IDs)
      chatContext.lastSearchResults = listings.map(l => l.id);

      // Cache the updated context
      await cacheChatContext(sessionId, chatContext);

      return {
        message: updatedResponse.message,
        listings,
        extracted_filters: extractedFilters,
        follow_up_questions: updatedResponse.suggestedQuestions || [],
        total_matches: totalMatches,
        session_id: sessionId,
        cached,
      };
    }
  }

  // Cache the context for follow-up messages
  await cacheChatContext(sessionId, chatContext);

  return {
    message: chatbotResponse.message,
    listings,
    extracted_filters: extractedFilters,
    follow_up_questions: chatbotResponse.suggestedQuestions || [],
    total_matches: totalMatches,
    session_id: sessionId,
    cached,
  };
}

// ============================================================================
// GET - Usage Information
// ============================================================================

export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/chat',
    description: 'Process natural language property search queries',
    authentication: 'Optional (Bearer token for personalized results)',
    rateLimit: '30 requests per minute',
    body: {
      query: {
        type: 'string',
        required: true,
        maxLength: 1000,
        description: 'Natural language search query',
        example: 'Tražim dvosobni stan za najam u Zagrebu do 800€',
      },
      conversation_history: {
        type: 'ChatMessage[]',
        required: false,
        description: 'Previous messages in the conversation',
      },
      session_id: {
        type: 'string',
        required: false,
        description: 'Session ID for context persistence across requests',
      },
    },
    response: {
      success: true,
      data: {
        message: 'Chatbot response message',
        listings: 'Array of matching property listings',
        extracted_filters: 'Filters extracted from the query',
        follow_up_questions: 'Suggested follow-up questions',
        total_matches: 'Total number of matching listings',
        session_id: 'Session ID for follow-up requests',
        cached: 'Whether results came from cache',
      },
    },
    examples: [
      {
        description: 'Basic search',
        body: {
          query: 'Tražim stan za najam u Zagrebu',
        },
      },
      {
        description: 'Detailed search',
        body: {
          query: 'Potpuno opremljen dvosobni stan s parkingom i balkonom do 1000€ mjesečno',
        },
      },
      {
        description: 'Follow-up query',
        body: {
          query: 'Može i bez parkinga',
          session_id: 'previous-session-id',
        },
      },
    ],
  });
}
