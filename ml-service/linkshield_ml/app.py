"""FastAPI prediction service. Internal: only the Express backend should call it.

The service never opens, resolves or fetches a submitted URL; it only parses the string.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import MODEL_PATH
from .features import InvalidURLError
from .predictor import ModelNotLoadedError, Predictor


class PredictRequest(BaseModel):
    url: str


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def create_app(model_path=None) -> FastAPI:
    predictor = Predictor(model_path or os.getenv("LINKSHIELD_MODEL_PATH", MODEL_PATH))

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        predictor.load()
        yield

    app = FastAPI(title="LinkShield ML Service", version="1.0.0", lifespan=lifespan)
    app.state.predictor = predictor

    @app.exception_handler(StarletteHTTPException)
    async def http_exc(_: Request, exc: StarletteHTTPException):
        return _error(exc.status_code, "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR", str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_exc(_: Request, __: RequestValidationError):
        return _error(400, "VALIDATION_ERROR", "Request body must be JSON like {\"url\": \"...\"}")

    @app.get("/health")
    def health():
        if not predictor.loaded:
            predictor.load()  # pick up a model trained after the service started
        return {"status": "ok", "model_loaded": predictor.loaded, "model_version": predictor.version}

    @app.get("/model-info")
    def model_info():
        if not predictor.loaded and not predictor.load():
            return _error(503, "MODEL_NOT_LOADED", "No trained model found. Run the training pipeline.")
        return predictor.info()

    @app.post("/predict")
    def predict(body: PredictRequest):
        if not predictor.loaded and not predictor.load():
            return _error(503, "MODEL_NOT_LOADED", "No trained model found. Run the training pipeline.")
        try:
            return predictor.predict(body.url)
        except InvalidURLError as exc:
            return _error(400, "INVALID_URL", str(exc))
        except ModelNotLoadedError as exc:
            return _error(503, "MODEL_NOT_LOADED", str(exc))

    return app


app = create_app()
