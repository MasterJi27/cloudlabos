import secrets
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.auth import hash_password, verify_password, create_access_token, create_refresh_token
from app.core.security import Role


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, email: str, password: str, name: str) -> User:
        existing = await self.db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")
        user = User(email=email, name=name, password_hash=hash_password(password), role=Role.MEMBER)
        self.db.add(user)
        await self.db.flush()
        # Every user needs a workspace or the dashboard is unusable (all resources
        # are scoped by workspace_id). Provision a personal workspace at signup so
        # the account works the moment the user lands on the dashboard.
        from app.models.workspace import Workspace, WorkspaceMember
        ws = Workspace(name=f"{name}'s Workspace", description="Personal workspace")
        self.db.add(ws)
        await self.db.flush()
        self.db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=Role.ADMIN))
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, email: str, password: str) -> tuple[str, str, User]:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")
        if not user.is_active:
            raise ValueError("Account is disabled")
        access = create_access_token(user.id)
        refresh = create_refresh_token(user.id)
        return access, refresh, user

    async def refresh_token(self, refresh_token: str) -> tuple[str, str]:
        from app.core.auth import decode_token
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        user_id = payload["sub"]
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise ValueError("User not found or inactive")
        return create_access_token(user_id), create_refresh_token(user_id)

    async def setup_mfa(self, user_id: str) -> tuple[str, str]:
        import pyotp
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")
        secret = pyotp.random_base32()
        user.mfa_secret = secret
        await self.db.commit()
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(user.email, issuer_name="CloudLabOS")
        return secret, provisioning_uri

    async def verify_mfa(self, user_id: str, code: str) -> bool:
        import pyotp
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.mfa_secret:
            raise ValueError("MFA not set up")
        totp = pyotp.TOTP(user.mfa_secret)
        valid = totp.verify(code, valid_window=1)
        if valid:
            user.mfa_enabled = True
            await self.db.commit()
        return valid

    async def disable_mfa(self, user_id: str):
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            user.mfa_secret = None
            user.mfa_enabled = False
            await self.db.commit()

    async def generate_api_key(self, user_id: str, name: str) -> tuple[str, str, str]:
        raw_key = f"clb_{secrets.token_urlsafe(32)}"
        key_prefix = raw_key[:12]
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")
        user.api_key_hash = raw_key  # In production, hash this
        await self.db.commit()
        return raw_key, key_prefix, user.id
