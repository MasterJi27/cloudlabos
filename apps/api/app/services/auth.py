import secrets
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.security import ApiKey, UserSession
from app.core.auth import hash_password, verify_password, hash_api_key, create_access_token, create_refresh_token
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

    async def _create_session(self, user_id: str, jti: str, ip_address: Optional[str], user_agent: Optional[str]):
        session = UserSession(user_id=user_id, refresh_jti=jti, ip_address=ip_address, user_agent=user_agent)
        self.db.add(session)
        await self.db.commit()

    async def login(self, email: str, password: str,
                     ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> tuple[str, str, User]:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")
        if not user.is_active:
            raise ValueError("Account is disabled")
        access = create_access_token(user.id)
        refresh, jti = create_refresh_token(user.id)
        await self._create_session(user.id, jti, ip_address, user_agent)
        return access, refresh, user

    async def refresh_token(self, refresh_token: str) -> tuple[str, str]:
        from app.core.auth import decode_token
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        user_id = payload["sub"]
        jti = payload.get("jti")

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise ValueError("User not found or inactive")

        session = None
        if jti:
            sess_result = await self.db.execute(select(UserSession).where(UserSession.refresh_jti == jti))
            session = sess_result.scalar_one_or_none()
            if not session or session.revoked:
                raise ValueError("Session has been revoked")

        new_access = create_access_token(user_id)
        new_refresh, new_jti = create_refresh_token(user_id)
        if session:
            # Rotate the jti so the old refresh token can't be replayed.
            session.refresh_jti = new_jti
            session.last_active_at = datetime.now(timezone.utc)
            await self.db.commit()
        return new_access, new_refresh

    async def list_sessions(self, user_id: str) -> list[UserSession]:
        result = await self.db.execute(
            select(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked == False)
            .order_by(UserSession.last_active_at.desc())
        )
        return result.scalars().all()

    async def revoke_session(self, user_id: str, session_id: str) -> bool:
        result = await self.db.execute(
            select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return False
        session.revoked = True
        await self.db.commit()
        return True

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
        key = ApiKey(user_id=user_id, name=name, key_hash=hash_api_key(raw_key), key_prefix=key_prefix)
        self.db.add(key)
        await self.db.commit()
        await self.db.refresh(key)
        return raw_key, key_prefix, key.id

    async def list_api_keys(self, user_id: str) -> list[ApiKey]:
        result = await self.db.execute(
            select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
        )
        return result.scalars().all()

    async def revoke_api_key(self, user_id: str, key_id: str) -> bool:
        result = await self.db.execute(
            select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
        )
        key = result.scalar_one_or_none()
        if not key:
            return False
        await self.db.delete(key)
        await self.db.commit()
        return True
