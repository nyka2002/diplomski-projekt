/**
 * Test script for AI Integration Layer (Phase 4)
 *
 * Usage: npx tsx scripts/test-ai-services.ts
 */

// Load .env.local first
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAIServices } from '../src/services/ai';
import { createSearchServices } from '../src/services/search';

async function main() {
  console.log('='.repeat(60));
  console.log('Testing AI Services (Phase 4)');
  console.log('='.repeat(60));
  console.log('');

  // Check environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY must be set in .env.local');
    process.exit(1);
  }

  // Initialize services
  console.log('Initializing services...');
  const ai = createAIServices();
  const search = createSearchServices(ai.embedding);
  console.log('Services initialized successfully!\n');

  // Test 1: Query Extraction
  console.log('=== Test 1: Query Extraction ===');
  const testQueries = [
    'Tražim dvosobni stan za najam u Zagrebu do 700€ s parkingom',
    'Kuća na prodaju u Splitu, minimalno 4 sobe',
    'Garsonijera za najam, namještena, do 400 eura',
  ];

  for (const query of testQueries) {
    console.log(`\nQuery: "${query}"`);
    try {
      const extraction = await ai.queryExtractor.extractFilters(query);
      console.log('Extracted filters:', JSON.stringify(extraction.filters, null, 2));
      console.log('Confidence:', (extraction.confidence.overall * 100).toFixed(0) + '%');
      console.log('Token usage:', extraction.tokenUsage.totalTokens, 'tokens');
    } catch (error) {
      console.error('Error:', (error as Error).message);
    }
  }
  console.log('');

  // Test 2: Embedding Generation
  console.log('=== Test 2: Embedding Generation ===');
  const embeddingQuery = 'stan za najam u centru Zagreba';
  console.log(`Query: "${embeddingQuery}"`);
  try {
    const embedding = await ai.embedding.generateQueryEmbedding(embeddingQuery);
    console.log('Embedding dimensions:', embedding.embedding.length);
    console.log('Token count:', embedding.tokenCount);
    console.log('From cache:', embedding.cached);
    console.log('First 5 values:', embedding.embedding.slice(0, 5).map(v => v.toFixed(4)));
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
  console.log('');

  // Test 3: Chatbot Conversation
  console.log('=== Test 3: Chatbot Conversation ===');
  const context = ai.chatbot.createContext();

  const messages = [
    'Bok! Trebam stan.',
    'Za najam u Zagrebu, do 600 eura',
    'Treba mi parking i balkon',
  ];

  for (const message of messages) {
    console.log(`\nUser: "${message}"`);
    try {
      const response = await ai.chatbot.processMessage(message, context);
      console.log('Bot:', response.message);
      console.log('Should search:', response.shouldSearch);
      console.log('Clarification needed:', response.clarificationNeeded);
      if (response.extractedFilters) {
        console.log('Current filters:', JSON.stringify(response.extractedFilters, null, 2));
      }
      if (response.suggestedQuestions.length > 0) {
        console.log('Suggested questions:', response.suggestedQuestions);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
    }
  }
  console.log('');

  // Test 4: Semantic Search (requires embeddings in DB)
  console.log('=== Test 4: Semantic Search ===');
  const searchQuery = 'Tražim dvosobni stan za najam u Zagrebu do 700€';
  console.log(`Query: "${searchQuery}"`);
  try {
    const extraction = await ai.queryExtractor.extractFilters(searchQuery);
    const results = await search.semantic.search(searchQuery, extraction.filters);

    console.log('Total matches:', results.totalMatches);
    console.log('Search time:', results.searchTimeMs, 'ms');

    if (results.listings.length > 0) {
      console.log('\nTop 3 results:');
      results.listings.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.listing.title}`);
        console.log(`     Price: ${result.listing.price}€, Location: ${result.listing.location_city}`);
        console.log(`     Score: ${(result.scores.combinedScore * 100).toFixed(1)}%`);
      });
    } else {
      console.log('No results found. Make sure to run generate-embeddings.ts first!');
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('All tests completed!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});
