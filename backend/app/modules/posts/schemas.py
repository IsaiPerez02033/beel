import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PostHostOut(BaseModel):
    id: uuid.UUID
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class PostMediaOut(BaseModel):
    id: uuid.UUID
    position: int = 0
    media_url: str
    media_type: str = "image"
    width: Optional[int] = None
    height: Optional[int] = None
    duration_s: Optional[int] = None

    model_config = {"from_attributes": True}


class PostOut(BaseModel):
    id: uuid.UUID
    host: PostHostOut
    property_id: Optional[uuid.UUID] = None
    caption: Optional[str] = None
    created_at: datetime
    media: list[PostMediaOut] = []
    like_count: int = 0
    liked: bool = False

    model_config = {"from_attributes": True}


class PostFeedOut(BaseModel):
    posts: list[PostOut]
    # Cursor keyset: created_at ISO del último post; null si no hay más.
    next_cursor: Optional[str] = None


class LikeOut(BaseModel):
    liked: bool
    like_count: int
