import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    title: Optional[str]
    body: Optional[str]
    data: Optional[dict]
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListOut(BaseModel):
    notifications: list[NotificationOut]
    total: int
    unread_count: int
