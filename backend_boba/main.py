from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routes.search_query import router as search_query_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Origin header has no trailing slash; must match exactly.
    allow_origins=[
        "http://localhost:3000",
        "https://bobasentimentanalysis.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(search_query_router, prefix="/api")