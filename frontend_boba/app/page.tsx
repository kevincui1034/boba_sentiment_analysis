"use client"

import * as React from "react"

import { FallingBobaBackground } from "@/components/falling-boba-background"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

type SearchResult = {
  business_id: string
  name: string | null
  city: string | null
  state: string | null
  avg_sentiment_polarity: number
  matching_review_count: number
}

export default function Home() {
  const [phrase, setPhrase] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** Query we last finished a search for; avoids "no results" while only typing. */
  const [lastSearchedPhrase, setLastSearchedPhrase] = React.useState<
    string | null
  >(null)

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPhrase = phrase.trim()
    if (!trimmedPhrase) return

    setLoading(true)
    setError(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
      const response = await fetch(
        `${apiBase}/api/search?q=${encodeURIComponent(trimmedPhrase)}&min_reviews=3&top=15`,
        { method: "GET" }
      )
      if (!response.ok) {
        throw new Error("Search request failed")
      }
      const payload = await response.json()
      setResults(payload.results ?? [])
      setLastSearchedPhrase(trimmedPhrase)
    } catch (err) {
      console.error(err)
      setError("Unable to search right now. Check backend connection.")
      setResults([])
      setLastSearchedPhrase(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="home"
      className="relative min-h-screen grid place-items-center overflow-hidden"
    >
      <FallingBobaBackground />
      <div className="relative z-10 w-full max-w-2xl space-y-4 text-center px-4">
        <h1 className="text-5xl font-semibold pb-10">Find Your Next Boba Stop!</h1>
        <form onSubmit={handleSearch}>
          <InputGroup>
            <InputGroupInput
              placeholder="Enter a type of drink..."
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="secondary">
                {loading ? "Searching..." : "Search"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>

        {error ? <p className="text-red-600">{error}</p> : null}

        <div className="text-left space-y-3 pt-4">
          {results.map((item, index) => (
            <div key={item.business_id} className="rounded border p-3">
              <p className="font-semibold">
                #{index + 1} {item.name ?? "Unknown shop"}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.city ?? "Unknown city"}, {item.state ?? "Unknown state"}
              </p>
              <p className="text-sm">
                Avg sentiment: {item.avg_sentiment_polarity} · Matching reviews:{" "}
                {item.matching_review_count}
              </p>
            </div>
          ))}
          {!loading &&
          results.length === 0 &&
          !error &&
          lastSearchedPhrase !== null &&
          lastSearchedPhrase === phrase.trim() ? (
            <p className="text-sm text-muted-foreground">
              No matching results found.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}