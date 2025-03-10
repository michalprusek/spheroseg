from fastapi import Request, status
from fastapi.responses import JSONResponse
from ..exceptions import (
    AuthenticationError,
    AuthorizationError,
    ResourceNotFoundError,
    ValidationError,
    ProcessingError
)

async def error_handler_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except AuthenticationError as e:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": "Authentication failed", "detail": str(e)}
        )
    except AuthorizationError as e:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Permission denied", "detail": str(e)}
        )
    except ResourceNotFoundError as e:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Resource not found", "detail": str(e)}
        )
    except ValidationError as e:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "Validation error", "detail": str(e)}
        )
    except ProcessingError as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Processing error", "detail": str(e)}
        )