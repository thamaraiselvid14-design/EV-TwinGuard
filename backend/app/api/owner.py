import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.services.alert_service import AlertService, get_alert_service
from app.services.auth_service import require_owner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/owner", tags=["Owner Portal"])


@router.get(
    "/dashboard",
    status_code=status.HTTP_200_OK,
    summary="Owner Dashboard Aggregate Metrics",
    description="Returns real aggregate metrics for customers, total analyses, risk breakdowns, and alerts.",
)
async def get_owner_dashboard_metrics(
    current_user: dict = Depends(require_owner),
    alert_service: AlertService = Depends(get_alert_service),
) -> Dict[str, Any]:
    return alert_service.get_owner_metrics()


@router.get(
    "/customers",
    status_code=status.HTTP_200_OK,
    summary="List Registered Customers",
    description="Returns all registered customers with vehicle details, total analyses count, and latest risk status.",
)
async def get_owner_customers_list(
    q: Optional[str] = Query(default=None, description="Search term for name, email, vehicle, or battery ID"),
    current_user: dict = Depends(require_owner),
    alert_service: AlertService = Depends(get_alert_service),
) -> List[Dict[str, Any]]:
    return alert_service.get_owner_customers(search=q)


@router.get(
    "/customers/{customer_id}",
    status_code=status.HTTP_200_OK,
    summary="Get Specific Customer Details (Owner View)",
    description="Returns full profile, vehicle/battery data, latest AI prediction, analyses history, and alerts history for the selected customer. Owner remains authenticated as OWNER.",
)
async def get_owner_customer_view(
    customer_id: str,
    current_user: dict = Depends(require_owner),
    alert_service: AlertService = Depends(get_alert_service),
) -> Dict[str, Any]:
    customer_data = alert_service.get_owner_customer_detail(customer_id)
    if not customer_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return customer_data


@router.get(
    "/alerts",
    status_code=status.HTTP_200_OK,
    summary="Get All Fleet Alerts",
    description="Returns all safety alerts logged across all customer battery packs.",
)
async def get_owner_all_alerts(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict = Depends(require_owner),
    alert_service: AlertService = Depends(get_alert_service),
) -> List[Dict[str, Any]]:
    return alert_service.get_owner_all_alerts(limit=limit)


@router.get(
    "/analyses",
    status_code=status.HTTP_200_OK,
    summary="Get All Fleet Analyses",
    description="Returns all battery analyses logged across all customers.",
)
async def get_owner_all_analyses(
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict = Depends(require_owner),
    alert_service: AlertService = Depends(get_alert_service),
) -> List[Dict[str, Any]]:
    return alert_service.get_owner_all_analyses(limit=limit)
