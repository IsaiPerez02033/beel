import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StoryHostOut(BaseModel):
    id: uuid.UUID
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class StoryOut(BaseModel):
    id: uuid.UUID
    host_id: uuid.UUID
    property_id: Optional[uuid.UUID] = None
    media_url: str
    media_type: str = "image"
    caption: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    seen: bool = False
    # Solo se llena en /stories/mine
    view_count: Optional[int] = None

    model_config = {"from_attributes": True}


class StoryGroupOut(BaseModel):
    """Historias activas de un anfitrión, para el carrusel."""
    host: StoryHostOut
    stories: list[StoryOut]
    all_seen: bool = False


class StoryFeedOut(BaseModel):
    groups: list[StoryGroupOut]


class MyStoriesOut(BaseModel):
    stories: list[StoryOut]
