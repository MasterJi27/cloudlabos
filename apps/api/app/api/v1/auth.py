from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, RefreshRequest,
    MFASetupResponse, MFAVerifyRequest, PasswordResetRequest,
)
from app.schemas.user import UserResponse, APIKeyCreate, APIKeyCreated
from app.services.auth import AuthService
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    try:
        user = await svc.register(body.email, body.password, body.name)
        access, refresh, _ = await svc.login(body.email, body.password)
        return TokenResponse(access_token=access, refresh_token=refresh, user=_user_dict(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    try:
        access, refresh, user = await svc.login(body.email, body.password)
        return TokenResponse(access_token=access, refresh_token=refresh, user=_user_dict(user))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    try:
        access, refresh = await svc.refresh_token(body.refresh_token)
        return TokenResponse(access_token=access, refresh_token=refresh)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return user


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    secret, uri = await svc.setup_mfa(user.id)
    return MFASetupResponse(secret=secret, qr_code=uri)


@router.post("/mfa/verify")
async def verify_mfa(body: MFAVerifyRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    try:
        valid = await svc.verify_mfa(user.id, body.code)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid code")
    return {"status": "verified"}


@router.post("/mfa/disable")
async def disable_mfa(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    await svc.disable_mfa(user.id)
    return {"status": "disabled"}


@router.post("/password-reset")
async def request_password_reset(body: PasswordResetRequest):
    return {"status": "If the email exists, a reset link has been sent"}


@router.post("/api-keys", response_model=APIKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_api_key(body: APIKeyCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    raw_key, key_prefix, _ = await svc.generate_api_key(user.id, body.name)
    return APIKeyCreated(id=user.id, name=body.name, raw_key=raw_key, key_prefix=key_prefix)


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name,
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "is_active": u.is_active,
        "mfa_enabled": u.mfa_enabled or False,
        "avatar_url": u.avatar_url,
        "created_at": str(u.created_at),
    }
