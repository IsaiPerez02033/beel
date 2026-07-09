"""Schemas del Concierge (planeador de viajes con IA)."""

from pydantic import BaseModel, Field


class ConciergeMessageIn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=4000)


class ConciergeChatIn(BaseModel):
    messages: list[ConciergeMessageIn] = Field(..., min_length=1, max_length=20)


class ConciergeChatOut(BaseModel):
    reply: str
    properties: list[dict] = []
    experiences: list[dict] = []
