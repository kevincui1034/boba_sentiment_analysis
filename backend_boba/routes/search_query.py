from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query
from database import supabase

router = APIRouter()


@router.get("/search")
def search_phrase(
    q: str = Query(..., min_length=1, max_length=200),
    min_reviews: int = Query(3, ge=1, le=100),
    top: int = Query(15, ge=1, le=50),
):
    phrase = q.strip()
    if not phrase:
        raise HTTPException(status_code=400, detail="Query must not be empty")
    
    response = (
        supabase.table("boba_reviews")
        .select("business_id,name,city,state,sentiment_polarity")
        .ilike("text", f"%{phrase}%")
        .limit(5000)
        .execute()
    )
    rows = response.data or []

    totals = defaultdict(float)
    counts = defaultdict(int)
    meta = {}

    for row in rows:
        business_id = row.get("business_id")
        polarity = row.get("sentiment_polarity")
        if not business_id or polarity is None:
            continue
        totals[business_id] += float(polarity)
        counts[business_id] += 1
        if business_id not in meta:
            meta[business_id] = {
                "name": row.get("name"),
                "city": row.get("city"),
                "state": row.get("state"),
            }

    results = []
    for business_id, total in totals.items():
        count = counts[business_id]
        if count < min_reviews:
            continue
        details = meta[business_id]
        results.append(
            {
                "business_id": business_id,
                "name": details.get("name"),
                "city": details.get("city"),
                "state": details.get("state"),
                "avg_sentiment_polarity": round(total / count, 4),
                "matching_review_count": count,
            }
        )

    results.sort(
        key=lambda item: (
            item["avg_sentiment_polarity"],
            item["matching_review_count"],
        ),
        reverse=True,
    )

    return {
        "query": phrase,
        "min_reviews": min_reviews,
        "results": results[:top],
    }