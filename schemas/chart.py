from datetime import date
from pydantic import BaseModel
from typing import Any


class OHLCVItem(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class OHLCVResponse(BaseModel):
    ticker: str
    interval: str
    items: list[OHLCVItem]


class MAItem(BaseModel):
    time: str
    value: float


class MAResponse(BaseModel):
    ticker: str
    window: int
    items: list[MAItem]


class VolumeProfileItem(BaseModel):
    price: float
    volume: int


class VolumeProfileResponse(BaseModel):
    ticker: str
    items: list[VolumeProfileItem]
