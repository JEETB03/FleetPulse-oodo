import os
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from backend.database import get_session
from backend.models import User, Role

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "fleetpulse-super-secret-key-change-in-prod-12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480 # 8 hours for demo/hackathon ease

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

# Module permissions mapping (Allowed write roles)
WRITE_PERMISSIONS = {
    "vehicles": {Role.ADMIN, Role.FLEET_MANAGER},
    "drivers": {Role.ADMIN, Role.FLEET_MANAGER, Role.SAFETY_OFFICER},
    "dispatch": {Role.ADMIN, Role.DISPATCHER, Role.FLEET_MANAGER},
    "maintenance": {Role.ADMIN, Role.FLEET_MANAGER},
    "fuel_expense": {Role.ADMIN, Role.FINANCE_ANALYST, Role.FLEET_MANAGER},
    "settings": {Role.ADMIN},
}

# Module read permissions restriction (Special override for reports and settings)
READ_RESTRICTIONS = {
    "reports": {Role.ADMIN, Role.FLEET_MANAGER, Role.FINANCE_ANALYST, Role.SAFETY_OFFICER},
    "settings": {Role.ADMIN},
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + expires_delta
    else:
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise credentials_exception
    return user

class PermissionChecker:
    def __init__(self, module: str, requires_write: bool = True):
        self.module = module
        self.requires_write = requires_write

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        role = current_user.role
        
        # Check read restrictions first
        if not self.requires_write:
            if self.module in READ_RESTRICTIONS:
                if role not in READ_RESTRICTIONS[self.module]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Role '{role.value}' does not have read permission for module '{self.module}'."
                    )
            return current_user

        # Check write permissions
        allowed_roles = WRITE_PERMISSIONS.get(self.module)
        if not allowed_roles or role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role.value}' does not have write permission for module '{self.module}'."
            )
        return current_user