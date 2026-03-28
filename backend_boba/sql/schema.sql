CREATE TABLE IF NOT EXISTS boba_reviews (
    id BIGSERIAL PRIMARY KEY,
    review_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    user_id TEXT,
    name TEXT,
    city TEXT,
    state TEXT,
    stars DOUBLE PRECISION,
    review_count INTEGER,
    is_open INTEGER,
    categories TEXT,
    review_stars DOUBLE PRECISION,
    review_date TIMESTAMP WITHOUT TIME ZONE,
    text TEXT,
    sentiment_label TEXT,
    sentiment_max_score DOUBLE PRECISION,
    prob_negative DOUBLE PRECISION,
    prob_neutral DOUBLE PRECISION,
    prob_positive DOUBLE PRECISION,
    sentiment_polarity DOUBLE PRECISION
);

-- search + ranking queries
CREATE INDEX IF NOT EXISTS idx_boba_reviews_business_id ON boba_reviews (business_id);
CREATE INDEX IF NOT EXISTS idx_boba_reviews_name ON boba_reviews (name);
CREATE INDEX IF NOT EXISTS idx_boba_reviews_review_date ON boba_reviews (review_date);
CREATE INDEX IF NOT EXISTS idx_boba_reviews_sentiment_polarity ON boba_reviews (sentiment_polarity);