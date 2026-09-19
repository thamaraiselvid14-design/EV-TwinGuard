import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from app.schemas.battery import (
    RealtimeNextResponse,
    RealtimeStartRequest,
    RealtimeStatusResponse,
)
from app.services.realtime_service import RealtimeDatasetService, get_realtime_service

logger = logging.getLogger("ev_twinguard.api.realtime")

router = APIRouter(prefix="/realtime", tags=["Real-Time Dataset Stream"])


@router.get(
    "/status",
    response_model=RealtimeStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Real-Time Dataset Stream Status",
    description="Returns current state of the continuous dataset telemetry stream (running, interval, current index, total records).",
)
async def get_stream_status(
    realtime_service: RealtimeDatasetService = Depends(get_realtime_service),
) -> RealtimeStatusResponse:
    return realtime_service.get_status()


@router.post(
    "/start",
    response_model=RealtimeStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Start Real-Time Dataset Stream",
    description="Starts or resumes real-time dataset simulation with configurable interval in seconds.",
)
async def start_stream(
    req: Optional[RealtimeStartRequest] = None,
    realtime_service: RealtimeDatasetService = Depends(get_realtime_service),
) -> RealtimeStatusResponse:
    interval = req.interval_seconds if req else 3
    return realtime_service.start_stream(interval_seconds=interval)


@router.post(
    "/pause",
    response_model=RealtimeStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Pause Real-Time Dataset Stream",
    description="Pauses the simulated real-time telemetry stream.",
)
async def pause_stream(
    realtime_service: RealtimeDatasetService = Depends(get_realtime_service),
) -> RealtimeStatusResponse:
    return realtime_service.pause_stream()


@router.post(
    "/reset",
    response_model=RealtimeStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset Real-Time Dataset Stream",
    description="Resets the streaming index to the beginning of the dataset.",
)
async def reset_stream(
    realtime_service: RealtimeDatasetService = Depends(get_realtime_service),
) -> RealtimeStatusResponse:
    return realtime_service.reset_stream()


@router.get(
    "/next",
    response_model=RealtimeNextResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch Next Real-Time Dataset Record & Analysis",
    description="Steps the dataset stream forward by one record, performs validation, ML temperature prediction, multi-factor risk assessment, alert dispatching, and SQLite event persistence.",
)
async def get_next_record(
    realtime_service: RealtimeDatasetService = Depends(get_realtime_service),
) -> RealtimeNextResponse:
    return realtime_service.get_next_record()
