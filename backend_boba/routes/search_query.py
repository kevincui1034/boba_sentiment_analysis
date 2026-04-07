from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query
from database import supabase

router = APIRouter()


@router.get("/filter-options")
def filter_options(limit: int = Query(5000, ge=100, le=20000)):
    response = (
        supabase.table("boba_reviews")
        .select("city,state")
        .limit(limit)
        .execute()
    )
    rows = response.data or []

    cities = sorted(
        {
            str(row.get("city")).strip()
            for row in rows
            if row.get("city") and str(row.get("city")).strip()
        }
    )
    states = sorted(
        {
            str(row.get("state")).strip()
            for row in rows
            if row.get("state") and str(row.get("state")).strip()
        }
    )

    return {"cities": cities, "states": states}


@router.get("/search")
def search_phrase(
    q: str = Query(..., min_length=1, max_length=200),
    min_reviews: int = Query(3, ge=1, le=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
    city: str | None = Query(None, max_length=100),
    county: str | None = Query(None, max_length=100),
):
    phrase = q.strip()
    if not phrase:
        raise HTTPException(status_code=400, detail="Query must not be empty")
    
    query = (
        supabase.table("boba_reviews")
        .select("business_id,name,city,state,sentiment_polarity")
        .ilike("text", f"%{phrase}%")
    )
    if city and city.strip():
        query = query.ilike("city", f"%{city.strip()}%")
    if county and county.strip():
        query = query.ilike("state", f"%{county.strip()}%")

    response = query.limit(5000).execute()
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

    total_results = len(results)
    total_pages = max(1, (total_results + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    start_idx = (current_page - 1) * page_size
    end_idx = start_idx + page_size

    return {
        "query": phrase,
        "min_reviews": min_reviews,
        "page": current_page,
        "page_size": page_size,
        "total_results": total_results,
        "total_pages": total_pages,
        "city": city.strip() if city else None,
        "county": county.strip() if county else None,
        "results": results[start_idx:end_idx],
    }


@router.get("/restaurants/{business_id}/reviews")
def restaurant_reviews(
    business_id: str,
    q: str = Query(..., min_length=1, max_length=200),
    city: str | None = Query(None, max_length=100),
    county: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
):
    phrase = q.strip()
    if not phrase:
        raise HTTPException(status_code=400, detail="Query must not be empty")

    query = (
        supabase.table("boba_reviews")
        .select("business_id,name,city,state,text,sentiment_polarity,review_date")
        .eq("business_id", business_id)
        .ilike("text", f"%{phrase}%")
    )
    if city and city.strip():
        query = query.ilike("city", f"%{city.strip()}%")
    if county and county.strip():
        query = query.ilike("state", f"%{county.strip()}%")

    response = query.limit(2000).execute()
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="No matching reviews found")

    rows.sort(
        key=lambda row: float(row.get("sentiment_polarity") or 0),
        reverse=True,
    )

    total_results = len(rows)
    total_pages = max(1, (total_results + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    start_idx = (current_page - 1) * page_size
    end_idx = start_idx + page_size
    paged_rows = rows[start_idx:end_idx]

    first = rows[0]
    sentiments = [
        float(row.get("sentiment_polarity"))
        for row in rows
        if row.get("sentiment_polarity") is not None
    ]
    avg_sentiment = round(sum(sentiments) / len(sentiments), 4) if sentiments else 0.0

    return {
        "business_id": business_id,
        "name": first.get("name"),
        "city": first.get("city"),
        "state": first.get("state"),
        "query": phrase,
        "avg_sentiment_polarity": avg_sentiment,
        "matching_review_count": total_results,
        "page": current_page,
        "page_size": page_size,
        "total_results": total_results,
        "total_pages": total_pages,
        "reviews": [
            {
                "text": row.get("text"),
                "sentiment_polarity": row.get("sentiment_polarity"),
                "review_date": row.get("review_date"),
            }
            for row in paged_rows
        ],
    }