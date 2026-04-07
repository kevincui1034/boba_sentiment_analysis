import Link from "next/link"
import { Button } from "@/components/ui/button"

type PageProps = {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ q?: string; city?: string; county?: string; page?: string }>
}

type ReviewRow = {
  text: string | null
  sentiment_polarity: number | null
  review_date: string | null
}

type RestaurantResponse = {
  business_id: string
  name: string | null
  city: string | null
  state: string | null
  query: string
  avg_sentiment_polarity: number
  matching_review_count: number
  page: number
  page_size: number
  total_results: number
  total_pages: number
  reviews: ReviewRow[]
}

function highlightPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "gi")
  const chunks = text.split(regex)
  return chunks.map((chunk, index) => {
    const isMatch = chunk.toLowerCase() === phrase.toLowerCase()
    if (!isMatch) return <span key={index}>{chunk}</span>
    return (
      <mark key={index} className="rounded bg-yellow-200 px-0.5 text-black">
        {chunk}
      </mark>
    )
  })
}

export default async function RestaurantPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sp = await searchParams
  const queryPhrase = (sp.q ?? "").trim()
  const page = Number(sp.page ?? "1")

  if (!queryPhrase) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm underline">
          ← Back
        </Link>
        <p className="mt-4 text-red-600">Missing search phrase.</p>
      </main>
    )
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
  const requestParams = new URLSearchParams({
    q: queryPhrase,
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
    page_size: "10",
  })
  if ((sp.city ?? "").trim()) requestParams.set("city", (sp.city ?? "").trim())
  if ((sp.county ?? "").trim()) requestParams.set("county", (sp.county ?? "").trim())

  const response = await fetch(
    `${apiBase}/api/restaurants/${businessId}/reviews?${requestParams.toString()}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm underline">
          ← Back
        </Link>
        <p className="mt-4 text-red-600">No matching reviews found for this restaurant.</p>
      </main>
    )
  }

  const data = (await response.json()) as RestaurantResponse
  const placeQuery = [data.name, data.city, data.state].filter(Boolean).join(" ")
  const yelpUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(placeQuery)}`
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-6 py-10">
      <Link
        href={{
          pathname: "/",
          query: {
            q: sp.q ?? "",
            city: sp.city ?? "",
            county: sp.county ?? "",
            page: sp.page ?? "1",
          },
        }}
        className="inline-flex"
      >
        <Button variant="outline" size="sm">← Back to search</Button>
      </Link>
      <h1 className="text-3xl font-semibold">{data.name ?? "Unknown shop"}</h1>
      <p className="text-sm text-muted-foreground">
        {data.city ?? "Unknown city"}, {data.state ?? "Unknown state"}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Phrase: <span className="font-medium">{data.query}</span> · Avg sentiment:{" "}
          <span className="font-medium">{data.avg_sentiment_polarity.toFixed(3)}</span> · Matching reviews:{" "}
          <span className="font-medium">{data.matching_review_count}</span>
        </p>
        <div className="flex flex-wrap justify-end gap-3 text-sm">
          <Button asChild variant="secondary" size="sm">
            <a href={yelpUrl} target="_blank" rel="noopener noreferrer">
              View on Yelp
            </a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Open in Google Maps
            </a>
          </Button>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {data.reviews.map((review, idx) => (
          <article key={`${data.page}-${idx}`} className="rounded border p-3">
            <p className="text-sm">
              {review.text ? highlightPhrase(review.text, queryPhrase) : "No review text"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sentiment:{" "}
              {review.sentiment_polarity !== null
                ? review.sentiment_polarity.toFixed(4)
                : "N/A"}
              {review.review_date
                ? ` · ${review.review_date.replace("T", " ")}`
                : ""}
            </p>
          </article>
        ))}
      </div>

      {data.total_pages > 1 ? (
        <div className="flex items-center gap-3 pt-2 text-sm">
          {data.page > 1 ? (
            <Link
              className="underline"
              href={{
                pathname: `/restaurant/${businessId}`,
                query: { ...sp, page: String(data.page - 1) },
              }}
            >
              Previous
            </Link>
          ) : (
            <span className="text-muted-foreground">Previous</span>
          )}
          <span>
            Page {data.page} / {data.total_pages}
          </span>
          {data.page < data.total_pages ? (
            <Link
              className="underline"
              href={{
                pathname: `/restaurant/${businessId}`,
                query: { ...sp, page: String(data.page + 1) },
              }}
            >
              Next
            </Link>
          ) : (
            <span className="text-muted-foreground">Next</span>
          )}
        </div>
      ) : null}

      <p className="pt-6 text-xs text-muted-foreground">
        Disclaimer: Rankings and review snippets shown here are derived from the Yelp academic dataset.
      </p>
    </main>
  )
}
