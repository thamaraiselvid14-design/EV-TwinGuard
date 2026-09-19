import logging
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.auth import (
    CustomerRegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import AuthService, get_auth_service, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/customer/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Customer Registration",
    description="Registers a new customer. Role is automatically set to CUSTOMER.",
)
async def register_customer(
    req: CustomerRegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    user = auth_service.create_customer(
        full_name=req.full_name,
        email=req.email,
        mobile_number=req.mobile_number,
        password=req.password,
        vehicle_model=req.vehicle_model,
        battery_id=req.battery_id,
    )
    logger.info(f"Registered new customer account: {user['email']} (ID: {user['id']})")
    return UserResponse(**user)


@router.post(
    "/customer/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Customer Login",
    description="Authenticates a customer and returns a JWT access token.",
)
async def login_customer(
    req: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    auth_result = auth_service.authenticate_user(
        email=req.email,
        password=req.password,
        expected_role="CUSTOMER",
    )
    logger.info(f"Customer logged in: {req.email}")
    return TokenResponse(
        access_token=auth_result["access_token"],
        token_type=auth_result["token_type"],
        user=UserResponse(**auth_result["user"]),
    )


@router.post(
    "/owner/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Owner Login",
    description="Authenticates the fleet owner and returns a JWT access token.",
)
async def login_owner(
    req: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    auth_result = auth_service.authenticate_user(
        email=req.email,
        password=req.password,
        expected_role="OWNER",
    )
    logger.info(f"Owner logged in: {req.email}")
    return TokenResponse(
        access_token=auth_result["access_token"],
        token_type=auth_result["token_type"],
        user=UserResponse(**auth_result["user"]),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Returns the profile of the currently authenticated user based on Bearer token.",
)
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
) -> UserResponse:
    return UserResponse(**current_user)
