"""Per-launch authentication for the desktop's private loopback engine."""

import hmac

from starlette.responses import JSONResponse


class EngineTokenMiddleware:
    def __init__(self, app, token: str):
        self.app = app
        self.token = token.encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        supplied = headers.get(b"authorization", b"").removeprefix(b"Bearer ")
        path = scope.get("path", "")
        media = path.startswith("/songs/") and path.endswith(("/audio", "/artwork"))
        events = path.startswith("/analysis/jobs/") and path.endswith("/events")
        if not supplied and scope["method"] == "GET" and (media or events):
            from urllib.parse import parse_qs

            supplied = (
                parse_qs(scope.get("query_string", b"").decode())
                .get("token", [""])[0]
                .encode()
            )
        if not hmac.compare_digest(supplied, self.token):
            return await JSONResponse(
                {"detail": "Engine session authorization required."}, status_code=401
            )(scope, receive, send)
        await self.app(scope, receive, send)
