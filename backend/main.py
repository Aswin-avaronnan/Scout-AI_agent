from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import scout
import uvicorn

app = FastAPI(title="Catalyst Scout v2 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scout.router, tags=["Scout"])

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
