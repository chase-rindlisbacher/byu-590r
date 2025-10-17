<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class HelloWorldController extends Controller
{
    /**
     * Simple hello world endpoint
     */
    public function hello(): JsonResponse
    {
        return response()->json([
            'message' => 'Hello World from BYU 590R Monorepo!',
            'status' => 'success',
            'timestamp' => now()->toISOString()
        ]);
    }

    /**
     * Health check endpoint
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'service' => 'byu-590r-monorepo-backend',
            'version' => '1.0.0',
            'timestamp' => now()->toISOString()
        ]);
    }
}
