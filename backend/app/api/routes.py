from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Health Check", tags=["System"])
async def health_check():
    """
    Health check endpoint to verify backend service availability.
    Returns HTTP 200 with status ok when healthy.
    """
    return {"status": "ok"}
