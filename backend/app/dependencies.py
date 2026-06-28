import logging
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.exceptions import InvalidTokenException
from app.models.user import User

logger = logging.getLogger(__name__)

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
    ) -> User:
    


    try:
        payload = decode_access_token(credentials.credentials)

        user_id_str = payload.get("sub")

        if not user_id_str:
            raise InvalidTokenException("Token missing subject claim")

    except JWTError:
        raise InvalidTokenException()

    try:
        user_id = UUID(user_id_str)
    except (ValueError, TypeError):
        raise InvalidTokenException("Invalid user ID in token")

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()


    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
