/**
 * Individual Job Status API
 *
 * GET /api/admin/scraping/jobs/[jobId]
 * Get status of a specific job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob, cancelJob } from '@/services/queue';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { jobId } = await params;
    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const state = await job.getState();
    const progress = job.progress as Record<string, unknown> | undefined;

    return NextResponse.json({
      id: job.id,
      name: job.name,
      state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to cancel a job
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  // Check authorization
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { jobId } = await params;
    const cancelled = await cancelJob(jobId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job not found or cannot be cancelled (may be active)' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} cancelled`,
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
