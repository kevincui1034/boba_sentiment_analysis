import pandas as pd

df = pd.read_csv("yelp_reviews_with_sentiment.csv", nrows=1000)

print(df.head())

print(df.columns)

print(df.info())

print(df.describe())

print(df.shape)

print(df.sample(10))