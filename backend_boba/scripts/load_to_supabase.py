from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
import psycopg


INSERT_SQL = """
INSERT INTO boba_reviews (
    review_id, business_id, user_id, name, city, state, stars, review_count,
    is_open, categories, review_stars, review_date, text, sentiment_label,
    sentiment_max_score, prob_negative, prob_neutral, prob_positive, sentiment_polarity
) VALUES (
    %(review_id)s, %(business_id)s, %(user_id)s, %(name)s, %(city)s, %(state)s,
    %(stars)s, %(review_count)s, %(is_open)s, %(categories)s, %(review_stars)s,
    %(review_date)s, %(text)s, %(sentiment_label)s, %(sentiment_max_score)s,
    %(prob_negative)s, %(prob_neutral)s, %(prob_positive)s, %(sentiment_polarity)s
)
"""


def is_boba_row(categories: str | float) -> bool:
    if categories is None or (isinstance(categories, float) and pd.isna(categories)):
        return False
    c = str(categories).lower()
    return ("bubble tea" in c) or ("boba" in c) or ("milk tea" in c)


def to_float_or_none(value):
    if pd.isna(value):
        return None
    return float(value)


def to_int_or_none(value):
    if pd.isna(value):
        return None
    return int(value)


def to_str_or_none(value):
    if pd.isna(value):
        return None
    return str(value)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load sentiment CSV into Supabase Postgres")
    parser.add_argument("--csv", type=Path, required=True, help="Path to yelp_reviews_with_sentiment.csv")
    parser.add_argument("--chunksize", type=int, default=50_000)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--truncate-first", action="store_true", help="DELETE all rows first")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Set DATABASE_URL first. Example (PowerShell):", file=sys.stderr)
        print('$env:DATABASE_URL="postgresql://..."', file=sys.stderr)
        sys.exit(1)

    if not args.csv.is_file():
        print(f"CSV not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    total_seen = 0
    total_kept = 0

    with psycopg.connect(database_url) as conn:
        if args.truncate_first and not args.dry_run:
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE boba_reviews;")
            conn.commit()
            print("Truncated boba_reviews")

        for chunk in pd.read_csv(args.csv, chunksize=args.chunksize, low_memory=False):
            total_seen += len(chunk)

            # Keep rows with text + boba-related categories
            chunk = chunk.dropna(subset=["text"]).copy()
            filtered = chunk[chunk["categories"].apply(is_boba_row)]

            if filtered.empty:
                print(f"Scanned {total_seen:,} rows, kept {total_kept:,}")
                continue

            records = []
            for _, row in filtered.iterrows():
                raw_date = row.get("date")
                if pd.isna(raw_date):
                    review_date = None
                else:
                    dt = pd.to_datetime(raw_date, errors="coerce")
                    review_date = None if pd.isna(dt) else dt.to_pydatetime()

                records.append(
                    {
                        "review_id": to_str_or_none(row.get("review_id")),
                        "business_id": to_str_or_none(row.get("business_id")),
                        "user_id": to_str_or_none(row.get("user_id")),
                        "name": to_str_or_none(row.get("name")),
                        "city": to_str_or_none(row.get("city")),
                        "state": to_str_or_none(row.get("state")),
                        "stars": to_float_or_none(row.get("stars")),
                        "review_count": to_int_or_none(row.get("review_count")),
                        "is_open": to_int_or_none(row.get("is_open")),
                        "categories": to_str_or_none(row.get("categories")),
                        "review_stars": to_float_or_none(row.get("review_stars")),
                        "review_date": review_date,
                        "text": to_str_or_none(row.get("text")),
                        "sentiment_label": to_str_or_none(row.get("sentiment_label")),
                        "sentiment_max_score": to_float_or_none(row.get("sentiment_max_score")),
                        "prob_negative": to_float_or_none(row.get("prob_negative")),
                        "prob_neutral": to_float_or_none(row.get("prob_neutral")),
                        "prob_positive": to_float_or_none(row.get("prob_positive")),
                        "sentiment_polarity": to_float_or_none(row.get("sentiment_polarity")),
                    }
                )

            if not args.dry_run:
                with conn.cursor() as cur:
                    cur.executemany(INSERT_SQL, records)
                conn.commit()

            total_kept += len(records)
            print(f"Scanned {total_seen:,} rows, inserted {total_kept:,} boba rows")

    print("Done.")
    if args.dry_run:
        print(f"[Dry run] Total matched rows: {total_kept:,}")


if __name__ == "__main__":
    main()