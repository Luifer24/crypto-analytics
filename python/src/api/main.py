"""
FastAPI Application

Main entry point for the backtest API.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routes
from src.api.routes import backtest

# Create FastAPI app
app = FastAPI(
    title="Crypto Analytics Engine",
    description="Statistical arbitrage backtest engine",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration for Next.js
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(backtest.router, prefix="/api/v1/backtest", tags=["backtest"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "crypto-analytics-engine",
        "version": "0.1.0",
    }


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "components": {
            "api": "operational",
            "backtest_engine": "operational",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("API_PORT", 8000))
    reload = os.getenv("API_RELOAD", "true").lower() == "true"

    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload,
    )
