from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from typing import Any, Dict
import logging
import traceback

logger = logging.getLogger(__name__)

class ErrorHandler:
    @staticmethod
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning(f"Validation error: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": exc.errors(),
                "body": exc.body,
                "code": "VALIDATION_ERROR"
            }
        )

    @staticmethod
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.error(f"Database error: {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Database error occurred",
                "code": "DATABASE_ERROR"
            }
        )

    @staticmethod
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(f"Unhandled exception: {str(exc)}\n{traceback.format_exc()}")
        
        if isinstance(exc, KeyError):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "detail": "Missing required field",
                    "code": "MISSING_FIELD"
                }
            )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error",
                "code": "INTERNAL_ERROR"
            }
        )

    @staticmethod
    def create_error_response(
        status_code: int,
        message: str,
        code: str,
        details: Dict[str, Any] = None
    ) -> JSONResponse:
        content = {
            "status": "error",
            "message": message,
            "code": code
        }
        
        if details:
            content["details"] = details
            
        return JSONResponse(
            status_code=status_code,
            content=content
        )