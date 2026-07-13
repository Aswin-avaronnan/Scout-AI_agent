import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import scout, simulate, upload
import uvicorn

app = FastAPI(title="Catalyst Scout v2 API")

# ALLOWED_ORIGINS: comma-separated list, e.g. "https://catalyst-scout.vercel.app,http://localhost:3000"
# Falls back to "*" only if unset, so local dev still works out of the box.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
allowed_origins = ["*"] if _raw_origins == "*" else [o.strip() for o in _raw_origins.split(",") if o.strip()]
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Wildcard origins + credentials is an invalid combination per the CORS spec (browsers reject it).
    # Only allow credentials when origins are explicitly restricted.
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scout.router, tags=["Scout"])
app.include_router(simulate.router, tags=["Simulate"])
app.include_router(upload.router, tags=["Upload"])

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
