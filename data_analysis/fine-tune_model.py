import argparse
import os
import sys
from collections import defaultdict

import pandas as pd
import torch
from transformers import pipeline

JOINED_CSV = "yelp_joined_dataset.csv"
ENRICHED_CSV = "yelp_reviews_with_sentiment.csv"

MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"

ROWS_PER_CHUNK_BUILD = 10_000
ROWS_PER_CHUNK_QUERY = 50_000

META_COLUMNS = [
    "review_id",
    "business_id",
    "user_id",
    "name",
    "city",
    "state",
    "stars",
    "review_count",
    "is_open",
    "categories",
    "review_stars",
    "date",
    "text",
]


def parse_one_pipeline_result(single_review_result):
    """
    The pipeline returns one list per review. Each item looks like:
        {"label": "positive", "score": 0.93}
    We turn that into a small dictionary of probabilities and the winning label.
    """
    probs = {}
    for entry in single_review_result:
        label_name = entry["label"]
        label_name_lower = label_name.lower()
        score = float(entry["score"])
        probs[label_name_lower] = score

    best_label = None
    best_score = -1.0
    for label_name_lower, score in probs.items():
        if score > best_score:
            best_score = score
            best_label = label_name_lower

    prob_negative = probs.get("negative", 0.0)
    prob_neutral = probs.get("neutral", 0.0)
    prob_positive = probs.get("positive", 0.0)

    polarity = prob_positive - prob_negative

    return {
        "sentiment_label": best_label,
        "sentiment_max_score": best_score,
        "prob_negative": prob_negative,
        "prob_neutral": prob_neutral,
        "prob_positive": prob_positive,
        "sentiment_polarity": polarity,
    }


def parse_pipeline_batch(pipeline_results):
    """
    pipeline_results is a list: one element per review.
    Each element is a list of label/score dicts (all classes).
    Returns a pandas DataFrame with one row per review.
    """
    list_of_rows = []
    for single_review in pipeline_results:
        row_dict = parse_one_pipeline_result(single_review)
        list_of_rows.append(row_dict)
    return pd.DataFrame(list_of_rows)



def build_enriched_csv():
    # Read JOINED_CSV in chunks, run sentiment on each review, append to ENRICHED_CSV.
    sentiment_pipe = pipeline(
        "sentiment-analysis",
        model=MODEL_NAME,
        truncation=True,
        max_length=512,
        device=0,
    )

    is_first_chunk = True
    total_rows_written = 0

    for chunk in pd.read_csv(JOINED_CSV, chunksize=ROWS_PER_CHUNK_BUILD):
        chunk = chunk.dropna(subset=["text"]).copy()
        chunk["text"] = chunk["text"].astype(str)

        text_list = chunk["text"].tolist()
        raw_outputs = sentiment_pipe(text_list, batch_size=32, top_k=None)

        scores_table = parse_pipeline_batch(raw_outputs)

        chunk = chunk.reset_index(drop=True)
        combined = pd.concat([chunk, scores_table], axis=1)

        for column_name in META_COLUMNS:
            if column_name not in combined.columns:
                combined[column_name] = pd.NA

        output_column_order = []
        for column_name in META_COLUMNS:
            output_column_order.append(column_name)
        for column_name in scores_table.columns:
            output_column_order.append(column_name)

        table_to_save = combined[output_column_order]

        if is_first_chunk:
            write_mode = "w"
            write_header = True
        else:
            write_mode = "a"
            write_header = False

        table_to_save.to_csv(
            ENRICHED_CSV,
            mode=write_mode,
            header=write_header,
            index=False,
        )

        is_first_chunk = False
        rows_this_chunk = len(table_to_save)
        total_rows_written = total_rows_written + rows_this_chunk
        print("Wrote", rows_this_chunk, "rows (running total:", total_rows_written, ") ->", ENRICHED_CSV)

    print("Finished build. Output file:", ENRICHED_CSV)


def query_rankings(user_phrase, minimum_reviews, how_many_to_show):
    # Scan ENRICHED_CSV for reviews that text contains user_phrase

    user_phrase = user_phrase.strip()
    if user_phrase == "":
        print("Error: empty phrase.", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(ENRICHED_CSV):
        print(
            "Error: file not found:",
            ENRICHED_CSV,
            file=sys.stderr,
        )
        print("Run first: python ai_test_2.py build", file=sys.stderr)
        sys.exit(1)

    # For each restaurant name: total sum of polarity, and how many reviews matched.
    sum_polarity_by_restaurant = defaultdict(float)
    count_reviews_by_restaurant = defaultdict(int)

    for chunk in pd.read_csv(ENRICHED_CSV, chunksize=ROWS_PER_CHUNK_QUERY):
        if "text" not in chunk.columns:
            print("Error: enriched file has no 'text' column.", file=sys.stderr)
            sys.exit(1)
        if "sentiment_polarity" not in chunk.columns:
            print("Error: enriched file has no 'sentiment_polarity' column.", file=sys.stderr)
            sys.exit(1)

        mask = chunk["text"].str.contains(
            user_phrase,
            case=False,
            na=False,
            regex=False,
        )
        matching_rows = chunk.loc[mask]

        if matching_rows.empty:
            continue

        grouped = matching_rows.groupby("name", sort=False)["sentiment_polarity"]
        summary = grouped.agg(["sum", "count"])

        for restaurant_name, row in summary.iterrows():
            sum_polarity_by_restaurant[restaurant_name] = (
                sum_polarity_by_restaurant[restaurant_name] + float(row["sum"])
            )
            count_reviews_by_restaurant[restaurant_name] = (
                count_reviews_by_restaurant[restaurant_name] + int(row["count"])
            )

    # Average polarity per restaurant, but only if enough reviews mention the phrase.
    average_polarity_by_restaurant = {}
    for restaurant_name in sum_polarity_by_restaurant:
        review_count = count_reviews_by_restaurant[restaurant_name]
        if review_count >= minimum_reviews:
            total = sum_polarity_by_restaurant[restaurant_name]
            average = total / review_count
            average_polarity_by_restaurant[restaurant_name] = average

    if len(average_polarity_by_restaurant) == 0:
        print(
            "No restaurants had at least",
            minimum_reviews,
            "reviews mentioning:",
            repr(user_phrase),
        )
        return

    ranking_series = pd.Series(average_polarity_by_restaurant)
    ranking_series = ranking_series.sort_values(ascending=False)
    ranking_series = ranking_series.head(how_many_to_show)

    print()
    print("Top", len(ranking_series), "for", repr(user_phrase))
    print("(minimum", minimum_reviews, "matching reviews per restaurant)")
    print()

    rank = 1
    for restaurant_name in ranking_series.index:
        score = ranking_series[restaurant_name]
        n = count_reviews_by_restaurant[restaurant_name]
        line = (
            "  "
            + str(rank).rjust(2)
            + ". "
            + format(score, "+.4f")
            + "  ("
            + str(n)
            + " reviews)  — "
            + str(restaurant_name)
        )
        print(line)
        rank = rank + 1


def main():
    parser = argparse.ArgumentParser(
        description="Build enriched sentiment CSV once, or query it by keyword.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser(
        "build",
        help="Run the model on " + JOINED_CSV + " and write " + ENRICHED_CSV,
    )

    query_parser = subparsers.add_parser(
        "query",
        help="Rank restaurants using saved scores (no model run)",
    )
    query_parser.add_argument(
        "phrase",
        help='Word or phrase to find in review text, e.g. matcha or "thai tea"',
    )
    query_parser.add_argument(
        "--min-reviews",
        type=int,
        default=3,
        help="Ignore restaurants with fewer matching reviews than this (default: 3)",
    )
    query_parser.add_argument(
        "--top",
        type=int,
        default=15,
        dest="top_n",
        help="How many restaurants to print (default: 15)",
    )

    arguments = parser.parse_args()

    if arguments.command == "build":
        build_enriched_csv()
    elif arguments.command == "query":
        query_rankings(
            user_phrase=arguments.phrase,
            minimum_reviews=arguments.min_reviews,
            how_many_to_show=arguments.top_n,
        )
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
